import {
  createInboundMessage,
  createOutboundMessage,
  getSessionKey,
  type InboundMessage,
  type OutboundMessage,
} from "./events.js";

const inMessage: InboundMessage = createInboundMessage({
  channel: "telegram",
  senderId: "114514",
  chatId: "1919",
  content: "Hello!",
});

const outMessage: OutboundMessage = createOutboundMessage({
  channel: "telegram",
  chatId: "1919",
  content: "Hello!",
});

const sessionKey: string = getSessionKey(inMessage);

console.log({
  inMessage,
  outMessage,
  sessionKey,
  hasDate: inMessage.timestamp instanceof Date,
});
