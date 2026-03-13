import { appendSessionMessage, readSessionMessages, } from "./jsonl.js";
import { createSession, createSessionMessage, } from "./types.js";
function cloneMessage(message) {
    const cloned = {
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
    };
    if (message.tool_calls !== undefined) {
        cloned.tool_calls = message.tool_calls.map((toolCall) => ({ ...toolCall }));
    }
    if (message.tool_call_id !== undefined) {
        cloned.tool_call_id = message.tool_call_id;
    }
    if (message.name !== undefined) {
        cloned.name = message.name;
    }
    return cloned;
}
export class SessionManager {
    workspacePath;
    cache = new Map();
    constructor(workspacePath) {
        this.workspacePath = workspacePath;
    }
    async getSession(sessionKey) {
        const cached = this.cache.get(sessionKey);
        if (cached !== undefined) {
            return cached;
        }
        const loaded = await this.loadSession(sessionKey);
        this.cache.set(sessionKey, loaded);
        return loaded;
    }
    async getHistory(sessionKey, maxMessages = 500) {
        const session = await this.getSession(sessionKey);
        if (maxMessages <= 0) {
            return [];
        }
        return session.messages
            .slice(-Math.trunc(maxMessages))
            .map((message) => cloneMessage(message));
    }
    async append(sessionKey, messageInput) {
        const session = await this.getSession(sessionKey);
        const message = createSessionMessage(messageInput);
        session.messages.push(message);
        session.updatedAt = message.timestamp;
        await appendSessionMessage(this.workspacePath, sessionKey, message);
        return cloneMessage(message);
    }
    invalidate(sessionKey) {
        this.cache.delete(sessionKey);
    }
    async loadSession(sessionKey) {
        const messages = await readSessionMessages(this.workspacePath, sessionKey);
        if (messages.length === 0) {
            return createSession({ sessionKey });
        }
        const firstMessage = messages[0];
        const lastMessage = messages[messages.length - 1];
        const sessionInput = {
            sessionKey,
            messages,
        };
        if (firstMessage !== undefined) {
            sessionInput.createdAt = firstMessage.timestamp;
        }
        if (lastMessage !== undefined) {
            sessionInput.updatedAt = lastMessage.timestamp;
        }
        return createSession(sessionInput);
    }
}
//# sourceMappingURL=manager.js.map