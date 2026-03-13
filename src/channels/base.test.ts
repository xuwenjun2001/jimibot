import assert from "node:assert/strict";

import { MessageBus } from "../bus/queue.js";
import { BaseChannel, type ChannelInboundInput, type ChannelLifecycleConfig } from "./base.js";

class DummyChannel extends BaseChannel<ChannelLifecycleConfig> {
  constructor(config: ChannelLifecycleConfig, bus: MessageBus) {
    super(config, bus);
  }

  get name(): string {
    return "dummy";
  }

  async start(): Promise<void> {
    this.setRunning(true);
  }

  async stop(): Promise<void> {
    this.setRunning(false);
  }

  async send(): Promise<void> {}

  emitInbound(input: ChannelInboundInput): void {
    this.handleMessage(input);
  }
}

const bus = new MessageBus();
const allowAllChannel = new DummyChannel(
  {
    enabled: true,
    allowFrom: ["*"],
  },
  bus,
);
const denyAllChannel = new DummyChannel(
  {
    enabled: true,
    allowFrom: [],
  },
  bus,
);
const specificChannel = new DummyChannel(
  {
    enabled: true,
    allowFrom: ["alice", "bob"],
  },
  bus,
);

assert.equal(allowAllChannel.isAllowed("anyone"), true);
assert.equal(denyAllChannel.isAllowed("anyone"), false);
assert.equal(specificChannel.isAllowed("alice"), true);
assert.equal(specificChannel.isAllowed("charlie"), false);

const inboundReceived = new Promise<{
  channel: string;
  senderId: string;
  chatId: string;
  content: string;
  metadata: Record<string, unknown>;
  sessionKeyOverride?: string;
}>((resolve) => {
  bus.onInbound(async (message) => {
    resolve(message);
  });
});

specificChannel.emitInbound({
  senderId: "alice",
  chatId: "room-1",
  content: "hello from dummy",
  metadata: { source: "test" },
  sessionKeyOverride: "dummy:thread-1",
});

const inboundMessage = await inboundReceived;
assert.equal(inboundMessage.channel, "dummy");
assert.equal(inboundMessage.senderId, "alice");
assert.equal(inboundMessage.chatId, "room-1");
assert.equal(inboundMessage.content, "hello from dummy");
assert.deepEqual(inboundMessage.metadata, { source: "test" });
assert.equal(inboundMessage.sessionKeyOverride, "dummy:thread-1");

await specificChannel.start();
assert.equal(specificChannel.isRunning, true);
await specificChannel.stop();
assert.equal(specificChannel.isRunning, false);

let deniedTriggered = false;
bus.onInbound(async (message) => {
  if (message.senderId === "eve") {
    deniedTriggered = true;
  }
});

denyAllChannel.emitInbound({
  senderId: "eve",
  chatId: "room-2",
  content: "should be denied",
});

await Promise.resolve();
assert.equal(deniedTriggered, false);

console.log("Mission 7 base channel checks passed.");
