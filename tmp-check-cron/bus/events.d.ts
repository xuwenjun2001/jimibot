export interface InboundMessage {
    channel: string;
    senderId: string;
    chatId: string;
    content: string;
    timestamp: Date;
    media: string[];
    metadata: Record<string, unknown>;
    sessionKeyOverride?: string;
}
export interface InboundMessageInput {
    channel: string;
    senderId: string;
    chatId: string;
    content: string;
    timestamp?: Date;
    media?: string[];
    metadata?: Record<string, unknown>;
    sessionKeyOverride?: string;
}
export declare function createInboundMessage(input: InboundMessageInput): InboundMessage;
export declare function getSessionKey(message: InboundMessage): string;
export interface OutboundMessage {
    channel: string;
    chatId: string;
    content: string;
    replyTo?: string;
    media: string[];
    metadata: Record<string, unknown>;
}
export interface OutboundMessageInput {
    channel: string;
    chatId: string;
    content: string;
    replyTo?: string;
    media?: string[];
    metadata?: Record<string, unknown>;
}
export declare function createOutboundMessage(input: OutboundMessageInput): OutboundMessage;
//# sourceMappingURL=events.d.ts.map