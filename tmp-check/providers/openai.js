import { LLMProvider, LLMResponse, } from "./base.js";
const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_API_BASE = "https://api.openai.com/v1";
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;
const OPENAI_ALLOWED_MSG_KEYS = new Set([
    "role",
    "content",
    "tool_calls",
    "tool_call_id",
    "name",
]);
export class OpenAIProvider extends LLMProvider {
    defaultModel;
    fetchImpl;
    constructor(options = {}) {
        super(options.apiKey, options.apiBase ?? DEFAULT_API_BASE);
        this.defaultModel = options.defaultModel ?? DEFAULT_MODEL;
        this.fetchImpl = options.fetchImpl ?? fetch;
    }
    async chat(options) {
        const model = options.model ?? this.defaultModel;
        const body = this.buildRequestBody(options, model);
        try {
            const response = await this.fetchImpl(this.getChatCompletionsUrl(), {
                method: "POST",
                headers: this.buildHeaders(),
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                const errorText = await response.text();
                return new LLMResponse({
                    content: `OpenAI API Error ${response.status}: ${errorText}`,
                    finishReason: "error",
                });
            }
            const payload = (await response.json());
            return this.parseResponse(payload);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return new LLMResponse({
                content: `Error calling OpenAI: ${message}`,
                finishReason: "error",
            });
        }
    }
    getDefaultModel() {
        return this.defaultModel;
    }
    getChatCompletionsUrl() {
        const base = this.apiBase ?? DEFAULT_API_BASE;
        const normalizedBase = base.endsWith("/") ? base : `${base}/`;
        return new URL("chat/completions", normalizedBase).toString();
    }
    buildHeaders() {
        const headers = {
            "Content-Type": "application/json",
        };
        if (this.apiKey !== undefined && this.apiKey.length > 0) {
            headers.Authorization = `Bearer ${this.apiKey}`;
        }
        return headers;
    }
    buildRequestBody(options, model) {
        const sanitizedMessages = LLMProvider.sanitizeRequestMessages(LLMProvider.sanitizeEmptyContent(options.messages), OPENAI_ALLOWED_MSG_KEYS);
        const body = {
            model,
            messages: sanitizedMessages,
            max_tokens: Math.max(1, options.maxTokens ?? DEFAULT_MAX_TOKENS),
        };
        if (options.temperature !== undefined) {
            body.temperature = options.temperature;
        }
        else {
            body.temperature = DEFAULT_TEMPERATURE;
        }
        if (options.reasoningEffort !== undefined && options.reasoningEffort !== null) {
            body.reasoning_effort = options.reasoningEffort;
        }
        if (options.tools !== undefined) {
            body.tools = options.tools;
            body.tool_choice = "auto";
        }
        return body;
    }
    parseResponse(payload) {
        if (!isRecord(payload)) {
            return new LLMResponse({
                content: "Error parsing OpenAI response: payload is not an object",
                finishReason: "error",
            });
        }
        const choices = Array.isArray(payload.choices) ? payload.choices : [];
        const firstChoice = choices[0];
        if (!isRecord(firstChoice)) {
            return new LLMResponse({
                content: "Error parsing OpenAI response: missing choices[0]",
                finishReason: "error",
            });
        }
        const message = isRecord(firstChoice.message) ? firstChoice.message : {};
        const toolCalls = extractToolCalls(message.tool_calls);
        const usage = extractUsage(payload.usage);
        const content = typeof message.content === "string" ? message.content : null;
        const reasoningContent = typeof message.reasoning_content === "string"
            ? message.reasoning_content
            : null;
        return new LLMResponse({
            content,
            toolCalls,
            finishReason: typeof firstChoice.finish_reason === "string"
                ? firstChoice.finish_reason
                : "stop",
            usage,
            reasoningContent,
        });
    }
}
function extractToolCalls(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    const toolCalls = [];
    for (const item of value) {
        if (!isRecord(item)) {
            continue;
        }
        const id = typeof item.id === "string" ? item.id : "";
        const fn = isRecord(item.function) ? item.function : null;
        const name = fn !== null && typeof fn.name === "string" ? fn.name : "";
        const args = fn !== null ? parseToolArguments(fn.arguments) : {};
        if (id && name) {
            toolCalls.push({
                id,
                name,
                arguments: args,
            });
        }
    }
    return toolCalls;
}
function parseToolArguments(value) {
    if (isRecord(value)) {
        return value;
    }
    if (typeof value !== "string") {
        return {};
    }
    try {
        const parsed = JSON.parse(value);
        if (isRecord(parsed)) {
            return parsed;
        }
        return { value: parsed };
    }
    catch {
        return { _raw: value };
    }
}
function extractUsage(value) {
    if (!isRecord(value)) {
        return {};
    }
    const usage = {};
    if (typeof value.prompt_tokens === "number") {
        usage.promptTokens = value.prompt_tokens;
    }
    if (typeof value.completion_tokens === "number") {
        usage.completionTokens = value.completion_tokens;
    }
    if (typeof value.total_tokens === "number") {
        usage.totalTokens = value.total_tokens;
    }
    return usage;
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=openai.js.map