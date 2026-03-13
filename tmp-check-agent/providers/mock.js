import { LLMProvider, LLMResponse, } from "./base.js";
const DEFAULT_MODEL = "mock-model";
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;
// 教学/测试用 Provider。
// 它不访问网络，只做两件事：
// 1. 记录请求
// 2. 按顺序返回预设响应
export class MockProvider extends LLMProvider {
    // 对外暴露请求记录，方便测试直接检查 Provider 层输入是否正确。
    requests = [];
    defaultModel;
    // 响应队列：每次 chat 消费一条预设响应，模拟多轮对话或工具调用链。
    responseQueue;
    // 当响应队列耗尽时的兜底结果，避免测试因为“没有预设响应”直接崩掉。
    fallbackResponse;
    constructor(options = {}) {
        super(options.apiKey, options.apiBase);
        this.defaultModel = options.defaultModel ?? DEFAULT_MODEL;
        this.responseQueue = (options.responses ?? []).map(normalizeResponse);
        this.fallbackResponse = normalizeResponse(options.fallbackResponse ?? { content: "Mock response" });
    }
    // 允许测试在运行过程中继续往队列里塞响应，
    // 这样可以更自然地模拟“下一轮模型会返回什么”。
    enqueueResponse(response) {
        this.responseQueue.push(normalizeResponse(response));
    }
    async chat(options) {
        // 即便是 MockProvider，也复用和真实 Provider 一样的清洗逻辑，
        // 这样测试出来的请求形态才更贴近生产行为。
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
        // 优先消费预设响应；如果没有，则回退到默认响应。
        return this.responseQueue.shift() ?? this.fallbackResponse;
    }
    getDefaultModel() {
        return this.defaultModel;
    }
}
// 兼容两种传参方式：
// 1. 已经构造好的 LLMResponse
// 2. 便于手写的普通对象
function normalizeResponse(response) {
    return response instanceof LLMResponse ? response : new LLMResponse(response);
}
//# sourceMappingURL=mock.js.map