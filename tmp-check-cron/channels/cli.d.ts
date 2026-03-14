import { type Writable } from "node:stream";
import type { OutboundMessage } from "../bus/events.js";
import { MessageBus } from "../bus/queue.js";
import { BaseChannel, type ChannelLifecycleConfig } from "./base.js";
export interface CliChannelConfig extends ChannelLifecycleConfig {
    senderId: string;
    chatId: string;
    prompt: string;
    assistantPrefix: string;
    exitCommands: string[];
}
export interface CliChannelRuntimeOptions {
    input?: NodeJS.ReadableStream;
    output?: Writable;
    terminal?: boolean;
}
export declare class CliChannel extends BaseChannel<CliChannelConfig> {
    private readonly input;
    private readonly output;
    private readonly terminal;
    private rl;
    constructor(config: CliChannelConfig, bus: MessageBus, options?: CliChannelRuntimeOptions);
    get name(): string;
    start(): Promise<void>;
    stop(): Promise<void>;
    send(message: OutboundMessage): Promise<void>;
    receiveLine(line: string): void;
    private isExitCommand;
    private prompt;
}
export declare function createCliChannelConfig(input?: Partial<CliChannelConfig>): CliChannelConfig;
//# sourceMappingURL=cli.d.ts.map