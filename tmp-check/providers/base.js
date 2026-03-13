export class LLMResponse {
    content;
    toolCalls;
    finishReason;
    usage;
    reasoningContent;
    thinkingBlocks;
    constructor(init) {
        this.content = init.content;
        this.toolCalls = init.toolCalls ?? [];
        this.finishReason = init.finishReason ?? "stop";
        this.usage = init.usage ?? {};
        this.reasoningContent = init.reasoningContent ?? null;
        this.thinkingBlocks = init.thinkingBlocks ?? null;
    }
    get hasToolCalls() {
        return this.toolCalls.length > 0;
    }
}
export function isToolCallRequest(value) {
    if (!isRecord(value)) {
        return false;
    }
    return (typeof value.id === "string" &&
        typeof value.name === "string" &&
        isRecord(value.arguments));
}
export class LLMProvider {
    apiKey;
    apiBase;
    constructor(apiKey, apiBase) {
        this.apiKey = apiKey;
        this.apiBase = apiBase;
    }
    static sanitizeEmptyContent(messages) {
        return messages.map((message) => {
            const content = message.content;
            if (typeof content === "string" && content.length === 0) {
                return {
                    ...message,
                    content: shouldUseNullContent(message) ? null : "(empty)",
                };
            }
            if (Array.isArray(content)) {
                const filtered = content.filter((item) => !isEmptyTextBlock(item));
                if (filtered.length !== content.length) {
                    return {
                        ...message,
                        content: filtered.length > 0
                            ? filtered
                            : shouldUseNullContent(message)
                                ? null
                                : "(empty)",
                    };
                }
            }
            if (isRecord(content)) {
                return {
                    ...message,
                    content: [content],
                };
            }
            return { ...message };
        });
    }
    static sanitizeRequestMessages(messages, allowedKeys) {
        return messages.map((message) => {
            const clean = { role: message.role };
            for (const [key, value] of Object.entries(message)) {
                if (allowedKeys.has(key)) {
                    clean[key] = value;
                }
            }
            if (clean.role === "assistant" && !("content" in clean)) {
                clean.content = null;
            }
            return clean;
        });
    }
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isTextBlock(value) {
    if (!isRecord(value)) {
        return false;
    }
    return typeof value.type === "string";
}
function isEmptyTextBlock(value) {
    if (!isTextBlock(value)) {
        return false;
    }
    const { type, text } = value;
    if (typeof type !== "string") {
        return false;
    }
    return (isTextBlockType(type) &&
        (text === "" || text === null || text === undefined));
}
function isTextBlockType(type) {
    return (type === "text" ||
        type === "input_text" ||
        type === "output_text");
}
function shouldUseNullContent(message) {
    return (message.role === "assistant" &&
        Array.isArray(message.tool_calls) &&
        message.tool_calls.length > 0);
}
//# sourceMappingURL=base.js.map