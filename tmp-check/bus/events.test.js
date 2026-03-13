import { createInboundMessage, createOutboundMessage, getSessionKey, } from "./events.js";
const inMessage = createInboundMessage({
    channel: "telegram",
    senderId: "114514",
    chatId: "1919",
    content: "Hello!",
});
const outMessage = createOutboundMessage({
    channel: "telegram",
    chatId: "1919",
    content: "Hello!",
});
const sessionKey = getSessionKey(inMessage);
console.log({
    inMessage,
    outMessage,
    sessionKey,
    hasDate: inMessage.timestamp instanceof Date,
});
//# sourceMappingURL=events.test.js.map