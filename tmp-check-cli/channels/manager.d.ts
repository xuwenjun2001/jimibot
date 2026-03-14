import type { OutboundMessage } from "../bus/events.js";
import { MessageBus } from "../bus/queue.js";
import type { ChannelsConfig, Config } from "../config/schema.js";
import { BaseChannel, type ChannelLifecycleConfig } from "./base.js";
export type ChannelFactory<TConfig extends ChannelLifecycleConfig = ChannelLifecycleConfig> = (config: TConfig, bus: MessageBus) => BaseChannel<TConfig>;
export type ChannelFactories = Partial<Record<keyof ChannelsConfig, ChannelFactory<any>>>;
export declare class ChannelManager {
    private readonly config;
    private readonly bus;
    private readonly factories;
    private readonly channels;
    private outboundSubscribed;
    constructor(config: Config, bus: MessageBus, factories?: ChannelFactories);
    startAll(): Promise<void>;
    stopAll(): Promise<void>;
    getChannel(name: string): BaseChannel<ChannelLifecycleConfig> | undefined;
    get enabledChannels(): string[];
    getStatus(): Record<string, {
        enabled: true;
        running: boolean;
    }>;
    routeOutboundMessage(message: OutboundMessage): Promise<boolean>;
    private initializeChannels;
    private ensureOutboundSubscription;
}
//# sourceMappingURL=manager.d.ts.map