import type { OutboundMessage } from "../bus/events.js";
import { MessageBus } from "../bus/queue.js";
import type { ChannelsConfig, Config } from "../config/schema.js";
import { BaseChannel, type ChannelLifecycleConfig } from "./base.js";

// 通道工厂函数：
// 给 ChannelManager 一个统一的“如何创建某类通道”的入口，
// 这样管理器不需要硬编码 new TelegramChannel / new DiscordChannel。
export type ChannelFactory<
  TConfig extends ChannelLifecycleConfig = ChannelLifecycleConfig,
> = (config: TConfig, bus: MessageBus) => BaseChannel<TConfig>;

// 当前项目支持的通道工厂表。
// key 是平台名，例如 telegram / discord，value 是创建该平台通道的函数。
export type ChannelFactories = Partial<
  Record<keyof ChannelsConfig, ChannelFactory<any>>
>;

// 通道管理器负责“组装和路由”，而不是平台细节本身。
// 它的主要职责：
// 1. 根据配置创建已启用通道
// 2. 统一启动/停止所有通道
// 3. 订阅 outbound 总线并把消息路由到正确通道
export class ChannelManager {
  // name -> channel 实例映射，便于后续按平台名路由。
  private readonly channels = new Map<string, BaseChannel<ChannelLifecycleConfig>>();
  // 防止 startAll() 被多次调用时重复订阅 outbound，导致一条消息发多次。
  private outboundSubscribed = false;

  constructor(
    private readonly config: Config,
    private readonly bus: MessageBus,
    private readonly factories: ChannelFactories = {},
  ) {
    this.initializeChannels();
  }

  async startAll(): Promise<void> {
    // 先建立 outbound 监听，再启动通道。
    // 这样一旦后续业务开始 publishOutbound，路由已经就位。
    this.ensureOutboundSubscription();
    await Promise.all(
      [...this.channels.values()].map(async (channel) => channel.start()),
    );
  }

  async stopAll(): Promise<void> {
    // 统一停掉所有已创建通道。
    await Promise.all(
      [...this.channels.values()].map(async (channel) => channel.stop()),
    );
  }

  getChannel(name: string): BaseChannel<ChannelLifecycleConfig> | undefined {
    return this.channels.get(name);
  }

  get enabledChannels(): string[] {
    return [...this.channels.keys()];
  }

  // 返回一个适合状态页、日志或调试输出的最小状态视图。
  getStatus(): Record<string, { enabled: true; running: boolean }> {
    return Object.fromEntries(
      [...this.channels.entries()].map(([name, channel]) => [
        name,
        {
          enabled: true as const,
          running: channel.isRunning,
        },
      ]),
    );
  }

  // 根据 OutboundMessage.channel 决定应该交给哪个具体通道发送。
  // 找不到目标通道时返回 false，让调用方知道路由失败了。
  async routeOutboundMessage(message: OutboundMessage): Promise<boolean> {
    const channel = this.channels.get(message.channel);
    if (channel === undefined) {
      return false;
    }

    await channel.send(message);
    return true;
  }

  private initializeChannels(): void {
    // 遍历“可创建的通道工厂”，再结合配置判断哪些平台真正启用。
    for (const [name, factory] of Object.entries(this.factories) as Array<
      [keyof ChannelsConfig, ChannelFactory<any> | undefined]
    >) {
      if (factory === undefined) {
        continue;
      }

      // 这里的 name 就是配置里的平台名，例如 telegram。
      const channelConfig = this.config.channels[name];
      if (channelConfig.enabled) {
        // 配置是静态数据，factory 创建出来的才是运行中的通道对象。
        const channel = factory(channelConfig, this.bus);
        this.channels.set(String(name), channel);
      }
    }
  }

  private ensureOutboundSubscription(): void {
    if (this.outboundSubscribed) {
      return;
    }

    this.outboundSubscribed = true;
    // 这里不是“某个具体通道订阅总线”，而是管理器统一订阅 outbound，
    // 然后再按 channel 字段分发给对应通道。
    this.bus.onOutbound(async (message) => {
      await this.routeOutboundMessage(message);
    });
  }
}
