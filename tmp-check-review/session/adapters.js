import { createSessionMessage, } from "./types.js";
export function createUserSessionMessageFromInbound(message) {
    return createSessionMessage({
        role: "user",
        content: message.content,
        timestamp: message.timestamp.toISOString(),
    });
}
export function createAssistantSessionMessage(content, timestamp = new Date().toISOString()) {
    return createSessionMessage({
        role: "assistant",
        content,
        timestamp,
    });
}
export function createToolSessionMessage(input) {
    const messageInput = {
        role: "tool",
        content: input.content,
    };
    const normalizedInput = {
        ...messageInput,
    };
    if (input.timestamp !== undefined) {
        normalizedInput.timestamp = input.timestamp;
    }
    const message = createSessionMessage(normalizedInput);
    message.name = input.name;
    if (input.toolCallId !== undefined) {
        message.tool_call_id = input.toolCallId;
    }
    return message;
}
//# sourceMappingURL=adapters.js.map