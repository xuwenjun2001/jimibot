import type { OutboundMessage } from "../bus/events.js";
import { MessageBus } from "../bus/queue.js";
import { BaseChannel, type ChannelInboundInput, type ChannelLifecycleConfig } from "./base.js";
export interface MockChannelConfig extends ChannelLifecycleConfig {
}
export declare class MockChannel extends BaseChannel<MockChannelConfig> {
    private readonly channelName;
    readonly sentMessages: OutboundMessage[];
    readonly inboundEvents: ChannelInboundInput[];
    readonly startLogs: string[];
    readonly stopLogs: string[];
    constructor(channelName: string, config: MockChannelConfig, bus: MessageBus);
    get name(): string;
    start(): Promise<void>;
    stop(): Promise<void>;
    send(message: OutboundMessage): Promise<void>;
    simulateInboundMessage(input: ChannelInboundInput): Promise<void>;
}
//# sourceMappingURL=mock.d.ts.map