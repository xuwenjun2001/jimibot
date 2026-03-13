import { type InboundMessageInput, type OutboundMessage } from "../bus/events.js";
import { MessageBus } from "../bus/queue.js";
export interface ChannelAccessConfig {
    allowFrom: string[];
}
export interface ChannelLifecycleConfig extends ChannelAccessConfig {
    enabled: boolean;
}
export interface ChannelInboundInput extends Omit<InboundMessageInput, "channel"> {
}
export declare abstract class BaseChannel<TConfig extends ChannelAccessConfig> {
    protected readonly config: TConfig;
    protected readonly bus: MessageBus;
    private running;
    constructor(config: TConfig, bus: MessageBus);
    abstract get name(): string;
    abstract start(): Promise<void>;
    abstract stop(): Promise<void>;
    abstract send(message: OutboundMessage): Promise<void>;
    isAllowed(senderId: string): boolean;
    get isRunning(): boolean;
    protected setRunning(running: boolean): void;
    protected handleMessage(input: ChannelInboundInput): void;
}
//# sourceMappingURL=base.d.ts.map