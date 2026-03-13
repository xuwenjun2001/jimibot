import type { ToolSchemaDefinition } from "../agent/tools/base.js";
import { LLMProvider, LLMResponse, type ChatMessage, type ChatOptions, type LLMResponseInit } from "./base.js";
export interface MockProviderOptions {
    apiKey?: string;
    apiBase?: string;
    defaultModel?: string;
    responses?: Array<LLMResponse | LLMResponseInit>;
    fallbackResponse?: LLMResponse | LLMResponseInit;
}
export interface MockChatRequest {
    messages: ChatMessage[];
    tools?: ToolSchemaDefinition[];
    model: string;
    maxTokens: number;
    temperature: number;
    reasoningEffort: string | null;
}
export declare class MockProvider extends LLMProvider {
    readonly requests: MockChatRequest[];
    private readonly defaultModel;
    private readonly responseQueue;
    private readonly fallbackResponse;
    constructor(options?: MockProviderOptions);
    enqueueResponse(response: LLMResponse | LLMResponseInit): void;
    chat(options: ChatOptions): Promise<LLMResponse>;
    getDefaultModel(): string;
}
//# sourceMappingURL=mock.d.ts.map