import {
  appendSessionMessage,
  readSessionState,
  readSessionMessages,
  writeSessionState,
} from "./jsonl.js";
import {
  createSession,
  createSessionMessage,
  type Session,
  type SessionInput,
  type SessionMessage,
  type SessionMessageInput,
} from "./types.js";

function cloneMessage(message: SessionMessage): SessionMessage {
  const cloned: SessionMessage = {
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
  private readonly cache = new Map<string, Session>();

  constructor(private readonly workspacePath: string) {}

  async getSession(sessionKey: string): Promise<Session> {
    const cached = this.cache.get(sessionKey);
    if (cached !== undefined) {
      return cached;
    }

    const loaded = await this.loadSession(sessionKey);
    this.cache.set(sessionKey, loaded);
    return loaded;
  }

  async getHistory(
    sessionKey: string,
    maxMessages = 500,
  ): Promise<SessionMessage[]> {
    const session = await this.getSession(sessionKey);
    if (maxMessages <= 0) {
      return [];
    }

    return session.messages
      .slice(-Math.trunc(maxMessages))
      .map((message) => cloneMessage(message));
  }

  async append(
    sessionKey: string,
    messageInput: SessionMessageInput,
  ): Promise<SessionMessage> {
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

  async saveSession(session: Session): Promise<void> {
    await writeSessionState(this.workspacePath, session);
    this.cache.set(session.sessionKey, session);
  }

  invalidate(sessionKey: string): void {
    this.cache.delete(sessionKey);
  }

  private async loadSession(sessionKey: string): Promise<Session> {
    const [messages, state] = await Promise.all([
      readSessionMessages(this.workspacePath, sessionKey),
      readSessionState(this.workspacePath, sessionKey),
    ]);

    if (messages.length === 0) {
      const emptySessionInput: SessionInput = { sessionKey };

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
    const sessionInput: SessionInput = {
      sessionKey,
      messages,
    };

    if (state?.createdAt !== undefined) {
      sessionInput.createdAt = state.createdAt;
    } else if (firstMessage !== undefined) {
      sessionInput.createdAt = firstMessage.timestamp;
    }
    if (state?.updatedAt !== undefined) {
      sessionInput.updatedAt = state.updatedAt;
    } else if (lastMessage !== undefined) {
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
