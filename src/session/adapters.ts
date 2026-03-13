import type { InboundMessage } from "../bus/events.js";
import {
  createSessionMessage,
  type SessionMessage,
} from "./types.js";

export function createUserSessionMessageFromInbound(
  message: InboundMessage,
): SessionMessage {
  return createSessionMessage({
    role: "user",
    content: message.content,
    timestamp: message.timestamp.toISOString(),
  });
}

export function createAssistantSessionMessage(
  content: string,
  timestamp = new Date().toISOString(),
): SessionMessage {
  return createSessionMessage({
    role: "assistant",
    content,
    timestamp,
  });
}

export interface ToolSessionMessageInput {
  name: string;
  content: string;
  toolCallId?: string;
  timestamp?: string;
}

export function createToolSessionMessage(
  input: ToolSessionMessageInput,
): SessionMessage {
  const messageInput = {
    role: "tool",
    content: input.content,
  } as const;

  const normalizedInput: {
    role: "tool";
    content: string;
    timestamp?: string;
  } = {
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
