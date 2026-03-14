import { appendSessionMessage, readSessionState, readSessionMessages, writeSessionState, } from "./jsonl.js";
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
        const wasEmpty = session.messages.length === 0;
        session.messages.push(message);
        if (wasEmpty) {
            session.createdAt = message.timestamp;
        }
        session.updatedAt = message.timestamp;
        await appendSessionMessage(this.workspacePath, sessionKey, message);
        await this.saveSession(session);
        return cloneMessage(message);
    }
    async saveSession(session) {
        await writeSessionState(this.workspacePath, session);
        this.cache.set(session.sessionKey, session);
    }
    invalidate(sessionKey) {
        this.cache.delete(sessionKey);
    }
    async loadSession(sessionKey) {
        const [messages, state] = await Promise.all([
            readSessionMessages(this.workspacePath, sessionKey),
            readSessionState(this.workspacePath, sessionKey),
        ]);
        if (messages.length === 0) {
            const emptySessionInput = { sessionKey };
            if (state?.createdAt !== undefined) {
                emptySessionInput.createdAt = state.createdAt;
            }
            if (state?.updatedAt !== undefined) {
                emptySessionInput.updatedAt = state.updatedAt;
            }
            if (state?.lastConsolidated !== undefined) {
                emptySessionInput.lastConsolidated = state.lastConsolidated;
            }
            if (state?.metadata !== undefined) {
                emptySessionInput.metadata = state.metadata;
            }
            return createSession(emptySessionInput);
        }
        const firstMessage = messages[0];
        const lastMessage = messages[messages.length - 1];
        const sessionInput = {
            sessionKey,
            messages,
        };
        if (state?.createdAt !== undefined) {
            sessionInput.createdAt = state.createdAt;
        }
        else if (firstMessage !== undefined) {
            sessionInput.createdAt = firstMessage.timestamp;
        }
        if (state?.updatedAt !== undefined) {
            sessionInput.updatedAt = state.updatedAt;
        }
        else if (lastMessage !== undefined) {
            sessionInput.updatedAt = lastMessage.timestamp;
        }
        if (state?.lastConsolidated !== undefined) {
            sessionInput.lastConsolidated = state.lastConsolidated;
        }
        if (state?.metadata !== undefined) {
            sessionInput.metadata = state.metadata;
        }
        return createSession(sessionInput);
    }
}
//# sourceMappingURL=manager.js.map