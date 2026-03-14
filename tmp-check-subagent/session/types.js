const SESSION_ROLES = ["user", "assistant", "tool"];
function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function isSessionRole(value) {
    return typeof value === "string" && SESSION_ROLES.includes(value);
}
export function isSessionMessage(value) {
    if (!isRecord(value)) {
        return false;
    }
    if (!isSessionRole(value.role)) {
        return false;
    }
    if (typeof value.content !== "string" || typeof value.timestamp !== "string") {
        return false;
    }
    if ("tool_calls" in value && value.tool_calls !== undefined) {
        if (!Array.isArray(value.tool_calls)) {
            return false;
        }
    }
    if ("tool_call_id" in value && value.tool_call_id !== undefined) {
        if (typeof value.tool_call_id !== "string") {
            return false;
        }
    }
    if ("name" in value && value.name !== undefined) {
        if (typeof value.name !== "string") {
            return false;
        }
    }
    return true;
}
export function createSessionMessage(input) {
    const message = {
        role: input.role,
        content: input.content,
        timestamp: input.timestamp ?? new Date().toISOString(),
    };
    if (input.tool_calls !== undefined) {
        message.tool_calls = input.tool_calls;
    }
    if (input.tool_call_id !== undefined) {
        message.tool_call_id = input.tool_call_id;
    }
    if (input.name !== undefined) {
        message.name = input.name;
    }
    return message;
}
export function createSession(input) {
    const createdAt = input.createdAt ?? new Date().toISOString();
    return {
        sessionKey: input.sessionKey,
        createdAt,
        updatedAt: input.updatedAt ?? createdAt,
        lastConsolidated: input.lastConsolidated ?? 0,
        metadata: input.metadata ?? {},
        messages: input.messages ?? [],
    };
}
//# sourceMappingURL=types.js.map