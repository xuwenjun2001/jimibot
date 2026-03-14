import { LLMProvider, LLMResponse, type ChatOptions } from "./base.js";
export interface OpenAIProviderOptions {
    apiKey?: string;
    apiBase?: string;
    defaultModel?: string;
    fetchImpl?: typeof fetch;
}
export declare class OpenAIProvider extends LLMProvider {
    private readonly defaultModel;
    private readonly fetchImpl;
    constructor(options?: OpenAIProviderOptions);
    chat(options: ChatOptions): Promise<LLMResponse>;
    getDefaultModel(): string;
    private getChatCompletionsUrl;
    private buildHeaders;
    private buildRequestBody;
    private parseResponse;
}
//# sourceMappingURL=openai.d.ts.map