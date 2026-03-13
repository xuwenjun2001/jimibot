import {
  createInboundMessage,
  type InboundMessageInput,
  type OutboundMessage,
} from "../bus/events.js";
import { MessageBus } from "../bus/queue.js";

// 通道层最小权限配置。
// 当前 Mission 7 只关心 sender 白名单，后续真实平台接入时可以继续扩展更多字段。
export interface ChannelAccessConfig {
  allowFrom: string[];
}

// 具备生命周期控制的通道配置。
// ChannelManager 只会为 enabled=true 的平台创建通道实例。
export interface ChannelLifecycleConfig extends ChannelAccessConfig {
  enabled: boolean;
}

// 子类上报入站消息时不需要自己填写 channel，
// 因为具体通道实例已经天然知道“自己代表哪个平台”。
export interface ChannelInboundInput
  extends Omit<InboundMessageInput, "channel"> {}

// 所有聊天平台通道的抽象基类。
// 这层的职责是把“平台共性”收口：
// 1. 生命周期接口（start/stop）
// 2. 出站发送接口（send）
// 3. 权限检查
// 4. 入站消息模板流程（平台消息 -> 内部消息 -> MessageBus）
export abstract class BaseChannel<TConfig extends ChannelAccessConfig> {
  protected readonly config: TConfig;
  protected readonly bus: MessageBus;
  // 运行状态由基类统一持有，具体通道只负责在 start/stop 时更新它。
  private running = false;

  constructor(config: TConfig, bus: MessageBus) {
    this.config = config;
    this.bus = bus;
  }

  abstract get name(): string;

  abstract start(): Promise<void>;

  abstract stop(): Promise<void>;

  abstract send(message: OutboundMessage): Promise<void>;

  // 最小权限模型：
  // 空白名单 = 全拒绝
  // "*" = 全允许
  // 其他情况按 senderId 精确匹配
  // 这个判断发生在“平台消息进入系统之前”。
  isAllowed(senderId: string): boolean {
    if (this.config.allowFrom.length === 0) {
      return false;
    }

    if (this.config.allowFrom.includes("*")) {
      return true;
    }

    return this.config.allowFrom.includes(String(senderId));
  }

  get isRunning(): boolean {
    return this.running;
  }

  // 只允许子类修改运行状态，外部只能读，不能直接写。
  protected setRunning(running: boolean): void {
    this.running = running;
  }

  // 模板方法：具体平台通道只需要负责“提取平台字段”，
  // 剩下的权限检查、内部消息组装、发布到总线都在这里统一完成。
  protected handleMessage(input: ChannelInboundInput): void {
    if (!this.isAllowed(input.senderId)) {
      return;
    }

    // 先构造最小必填字段，再按需补可选字段。
    // 这样写是为了兼容 exactOptionalPropertyTypes：
    // 可选字段不能显式传 undefined，只能在值存在时再挂上去。
    const messageInput: InboundMessageInput = {
      channel: this.name,
      senderId: String(input.senderId),
      chatId: String(input.chatId),
      content: input.content,
    };

    if (input.timestamp !== undefined) {
      messageInput.timestamp = input.timestamp;
    }
    if (input.media !== undefined) {
      messageInput.media = input.media;
    }
    if (input.metadata !== undefined) {
      messageInput.metadata = input.metadata;
    }
    if (input.sessionKeyOverride !== undefined) {
      messageInput.sessionKeyOverride = input.sessionKeyOverride;
    }

    // 到这里为止，平台原始消息已经被翻译成系统内部统一消息。
    const message = createInboundMessage(messageInput);

    // 通道层不直接调用 AgentLoop，而是统一交给 MessageBus，
    // 由总线把通道层和后续业务层解耦开。
    this.bus.publishInbound(message);
  }
}
