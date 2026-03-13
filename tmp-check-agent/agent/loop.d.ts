import { type InboundMessage, type OutboundMessage } from "../bus/events.js";
import { MessageBus } from "../bus/queue.js";
import { LLMProvider } from "../providers/base.js";
import { SessionManager } from "../session/index.js";
import { ToolRegistry } from "./tools/registry.js";
export interface AgentLoopOptions {
    bus: MessageBus;
    provider: LLMProvider;
    sessionManager: SessionManager;
    tools?: ToolRegistry;
    model?: string;
    maxIterations?: number;
    historyLimit?: number;
    maxTokens?: number;
    temperature?: number;
    reasoningEffort?: string | null;
}
export declare class AgentLoop {
    private readonly bus;
    private readonly provider;
    private readonly sessionManager;
    private readonly tools;
    private readonly model;
    private readonly maxIterations;
    private readonly historyLimit;
    private readonly maxTokens;
    private readonly temperature;
    private readonly reasoningEffort;
    private running;
    private inboundSubscribed;
    constructor(options: AgentLoopOptions);
    get isRunning(): boolean;
    start(): void;
    stop(): void;
    processInboundMessage(message: InboundMessage): Promise<OutboundMessage>;
    private ensureInboundSubscription;
    private buildContext;
    private buildChatOptions;
    private runToolCalls;
    private createAssistantToolCallMessage;
    private toChatMessage;
    private persistTurn;
    private getErrorMessage;
}
//# sourceMappingURL=loop.d.ts.map