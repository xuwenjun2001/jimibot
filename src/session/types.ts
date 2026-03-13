const SESSION_ROLES = ["user", "assistant", "tool"] as const;

export type SessionRole = (typeof SESSION_ROLES)[number];

export interface SessionMessage {
  role: SessionRole;
  content: string;
  timestamp: string;
  tool_calls?: Record<string, unknown>[];
  tool_call_id?: string;
  name?: string;
}

export interface SessionMessageInput {
  role: SessionRole;
  content: string;
  timestamp?: string;
  tool_calls?: Record<string, unknown>[];
  tool_call_id?: string;
  name?: string;
}

export interface Session {
  sessionKey: string;
  createdAt: string;
  updatedAt: string;
  lastConsolidated: number;
  metadata: Record<string, unknown>;
  messages: SessionMessage[];
}

export interface SessionInput {
  sessionKey: string;
  createdAt?: string;
  updatedAt?: string;
  lastConsolidated?: number;
  metadata?: Record<string, unknown>;
  messages?: SessionMessage[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isSessionRole(value: unknown): value is SessionRole {
  return typeof value === "string" && SESSION_ROLES.includes(value as SessionRole);
}

export function isSessionMessage(value: unknown): value is SessionMessage {
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

export function createSessionMessage(
  input: SessionMessageInput,
): SessionMessage {
  const message: SessionMessage = {
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

export function createSession(input: SessionInput): Session {
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
