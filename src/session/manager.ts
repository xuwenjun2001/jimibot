import {
  appendSessionMessage,
  readSessionMessages,
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

    session.messages.push(message);
    session.updatedAt = message.timestamp;

    await appendSessionMessage(this.workspacePath, sessionKey, message);
    return cloneMessage(message);
  }

  invalidate(sessionKey: string): void {
    this.cache.delete(sessionKey);
  }

  private async loadSession(sessionKey: string): Promise<Session> {
    const messages = await readSessionMessages(this.workspacePath, sessionKey);
    if (messages.length === 0) {
      return createSession({ sessionKey });
    }

    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];
    const sessionInput: SessionInput = {
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
