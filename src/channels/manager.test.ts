import assert from "node:assert/strict";

import { createOutboundMessage } from "../bus/events.js";
import { MessageBus } from "../bus/queue.js";
import { parseConfig } from "../config/loader.js";
import { MockChannel } from "./mock.js";
import { ChannelManager } from "./manager.js";

const config = parseConfig({
  channels: {
    telegram: {
      enabled: true,
      allow_from: ["*"],
    },
  },
});

const bus = new MessageBus();
const manager = new ChannelManager(config, bus, {
  telegram: (channelConfig, channelBus) =>
    new MockChannel("telegram", channelConfig, channelBus),
});

assert.deepEqual(manager.enabledChannels, ["telegram"]);

const channel = manager.getChannel("telegram");
assert.equal(channel instanceof MockChannel, true);

await manager.startAll();
assert.equal(channel?.isRunning, true);
assert.deepEqual(manager.getStatus(), {
  telegram: {
    enabled: true,
    running: true,
  },
});

const outbound = createOutboundMessage({
  channel: "telegram",
  chatId: "chat-1",
  content: "hello outbound",
});

const routed = await manager.routeOutboundMessage(outbound);
assert.equal(routed, true);
assert.equal((channel as MockChannel).sentMessages.length, 1);
assert.equal((channel as MockChannel).sentMessages[0]?.content, "hello outbound");

bus.publishOutbound(
  createOutboundMessage({
    channel: "telegram",
    chatId: "chat-2",
    content: "hello through bus",
  }),
);
await Promise.resolve();
assert.equal((channel as MockChannel).sentMessages.length, 2);

const unknownRouted = await manager.routeOutboundMessage(
  createOutboundMessage({
    channel: "unknown",
    chatId: "chat-3",
    content: "missing channel",
  }),
);
assert.equal(unknownRouted, false);

await (channel as MockChannel).simulateInboundMessage({
  senderId: "u1",
  chatId: "chat-1",
  content: "hello inbound",
});

await manager.stopAll();
assert.equal(channel?.isRunning, false);

console.log("Mission 7 channel manager checks passed.");
