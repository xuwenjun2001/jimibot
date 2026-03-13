import type { ToolSchemaDefinition } from "../agent/tools/base.js";
type JsonObject = Record<string, unknown>;
export interface ToolCallRequest {
    id: string;
    name: string;
    arguments: JsonObject;
}
export interface LLMUsage {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
}
export interface ChatContentBlock extends JsonObject {
    type?: string;
    text?: unknown;
}
export type ChatMessageContent = string | null | ChatContentBlock[] | JsonObject;
export interface ChatMessage extends JsonObject {
    role: string;
    content?: ChatMessageContent;
    tool_calls?: unknown;
    tool_call_id?: string;
    name?: string;
    reasoning_content?: string;
    thinking_blocks?: JsonObject[];
}
export interface ChatOptions {
    messages: ChatMessage[];
    tools?: ToolSchemaDefinition[];
    model?: string;
    maxTokens?: number;
    temperature?: number;
    reasoningEffort?: string | null;
}
export interface LLMResponseInit {
    content: string | null;
    toolCalls?: ToolCallRequest[];
    finishReason?: string;
    usage?: LLMUsage;
    reasoningContent?: string | null;
    thinkingBlocks?: JsonObject[] | null;
}
export declare class LLMResponse {
    readonly content: string | null;
    readonly toolCalls: ToolCallRequest[];
    readonly finishReason: string;
    readonly usage: LLMUsage;
    readonly reasoningContent: string | null;
    readonly thinkingBlocks: JsonObject[] | null;
    constructor(init: LLMResponseInit);
    get hasToolCalls(): boolean;
}
export declare function isToolCallRequest(value: unknown): value is ToolCallRequest;
export declare abstract class LLMProvider {
    protected readonly apiKey: string | undefined;
    protected readonly apiBase: string | undefined;
    constructor(apiKey?: string, apiBase?: string);
    static sanitizeEmptyContent(messages: readonly ChatMessage[]): ChatMessage[];
    static sanitizeRequestMessages(messages: readonly ChatMessage[], allowedKeys: ReadonlySet<string>): ChatMessage[];
    abstract chat(options: ChatOptions): Promise<LLMResponse>;
    abstract getDefaultModel(): string;
}
export {};
//# sourceMappingURL=base.d.ts.map