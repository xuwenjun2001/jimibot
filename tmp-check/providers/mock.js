import { LLMProvider, LLMResponse, } from "./base.js";
const DEFAULT_MODEL = "mock-model";
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;
export class MockProvider extends LLMProvider {
    requests = [];
    defaultModel;
    responseQueue;
    fallbackResponse;
    constructor(options = {}) {
        super(options.apiKey, options.apiBase);
        this.defaultModel = options.defaultModel ?? DEFAULT_MODEL;
        this.responseQueue = (options.responses ?? []).map(normalizeResponse);
        this.fallbackResponse = normalizeResponse(options.fallbackResponse ?? { content: "Mock response" });
    }
    enqueueResponse(response) {
        this.responseQueue.push(normalizeResponse(response));
    }
    async chat(options) {
        const request = {
            messages: LLMProvider.sanitizeEmptyContent(options.messages),
            model: options.model ?? this.defaultModel,
            maxTokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
            temperature: options.temperature ?? DEFAULT_TEMPERATURE,
            reasoningEffort: options.reasoningEffort ?? null,
        };
        if (options.tools !== undefined) {
            request.tools = options.tools;
        }
        this.requests.push(request);
        return this.responseQueue.shift() ?? this.fallbackResponse;
    }
    getDefaultModel() {
        return this.defaultModel;
    }
}
function normalizeResponse(response) {
    return response instanceof LLMResponse ? response : new LLMResponse(response);
}
//# sourceMappingURL=mock.js.map