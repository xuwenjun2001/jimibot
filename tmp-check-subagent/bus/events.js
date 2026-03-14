export function createInboundMessage(input) {
    const message = {
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
export function getSessionKey(message) {
    return message.sessionKeyOverride ?? `${message.channel}:${message.chatId}`;
}
export function createOutboundMessage(input) {
    const message = {
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
//# sourceMappingURL=events.js.map