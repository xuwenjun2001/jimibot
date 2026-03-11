export interface InboundMessage {
  channel: string; //信息的发送渠道
  senderId: string; //发送者
  chatId: string; //标识会话
  content: string; //内容
  timestamp: Date; //时间戳
  media: string[]; //url
  metadata: Record<string, unknown>; //渠道特有的信息
  sessionKeyOverride?: string;
}

export interface InboundMessageInput {
  channel: string; //信息的发送渠道
  senderId: string; //发送者
  chatId: string; //标识会话
  content: string; //内容
  timestamp?: Date; //时间戳
  media?: string[]; //url
  metadata?: Record<string, unknown>; //渠道特有的信息
  sessionKeyOverride?: string;
}

export function createInboundMessage(
  input: InboundMessageInput,
): InboundMessage {
  const message: InboundMessage = {
    channel: input.channel,
    senderId: input.senderId,
    chatId: input.chatId,
    content: input.content,
    timestamp: input.timestamp ?? new Date(),
    media: input.media ?? [],
    metadata: input.metadata ?? {},
  };
  if (input.sessionKeyOverride !== undefined) {
    message.sessionKeyOverride = input.sessionKeyOverride;
  }

  return message;
}

export function getSessionKey(message: InboundMessage): string {
  return message.sessionKeyOverride ?? `${message.channel}:${message.chatId}`;
}

export interface OutboundMessage {
  channel: string; //信息的发送渠道
  chatId: string; //标识会话
  content: string; //内容
  replyTo?: string;
  media: string[]; //url
  metadata: Record<string, unknown>; //渠道特有的信息
}

export interface OutboundMessageInput {
  channel: string; //信息的发送渠道
  chatId: string; //标识会话
  content: string; //内容
  replyTo?: string;
  media?: string[]; //url
  metadata?: Record<string, unknown>; //渠道特有的信息
}

export function createOutboundMessage(
  input: OutboundMessageInput,
): OutboundMessage {
  const message: OutboundMessage = {
    channel: input.channel,
    chatId: input.chatId,
    content: input.content,
    media: input.media ?? [],
    metadata: input.metadata ?? {},
  };

  if (input.replyTo !== undefined) {
    message.replyTo = input.replyTo;
  }

  return message;
}
