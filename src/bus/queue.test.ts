import assert from "node:assert/strict";

import {
  createInboundMessage,
  createOutboundMessage,
  type InboundMessage,
  type OutboundMessage,
} from "./events.js";
import { MessageBus } from "./queue.js";

const bus = new MessageBus();

const inboundMessage = createInboundMessage({
  channel: "telegram",
  senderId: "114514",
  chatId: "1919",
  content: "hello from inbound",
});

const outboundMessage = createOutboundMessage({
  channel: "telegram",
  chatId: "1919",
  content: "hello from outbound",
});

const inboundReceived = new Promise<InboundMessage>((resolve) => {
  bus.onInbound(async (message) => {
    resolve(message);
  });
});

const outboundReceived = new Promise<OutboundMessage>((resolve) => {
  bus.onOutbound(async (message) => {
    resolve(message);
  });
});

bus.publishInbound(inboundMessage);
bus.publishOutbound(outboundMessage);

const receivedInbound = await inboundReceived;
const receivedOutbound = await outboundReceived;

assert.equal(receivedInbound.content, inboundMessage.content);
assert.equal(receivedInbound.senderId, inboundMessage.senderId);
assert.equal(receivedOutbound.content, outboundMessage.content);
assert.equal(receivedOutbound.chatId, outboundMessage.chatId);

// @ts-expect-error OutboundMessage cannot be published to the inbound channel.
bus.publishInbound(outboundMessage);

console.log("Mission 2 queue checks passed.");
