import assert from "node:assert/strict";
import { PassThrough } from "node:stream";

import { createOutboundMessage } from "../bus/events.js";
import { MessageBus } from "../bus/queue.js";
import { CliChannel, createCliChannelConfig } from "./cli.js";

const bus = new MessageBus();
const input = new PassThrough();
const output = new PassThrough();
let written = "";

output.on("data", (chunk) => {
  written += chunk.toString("utf-8");
});

const channel = new CliChannel(
  createCliChannelConfig({
    prompt: "",
    assistantPrefix: "Bot: ",
  }),
  bus,
  {
    input,
    output,
    terminal: false,
  },
);

const inboundReceived = new Promise<{
  channel: string;
  senderId: string;
  chatId: string;
  content: string;
  metadata: Record<string, unknown>;
}>((resolve) => {
  bus.onInbound(async (message) => {
    resolve(message);
  });
});

await channel.start();
assert.equal(channel.isRunning, true);

channel.receiveLine("hello from cli");

const inbound = await inboundReceived;
assert.equal(inbound.channel, "cli");
assert.equal(inbound.senderId, "cli-user");
assert.equal(inbound.chatId, "direct");
assert.equal(inbound.content, "hello from cli");
assert.deepEqual(inbound.metadata, { source: "cli" });

await channel.send(
  createOutboundMessage({
    channel: "cli",
    chatId: "direct",
    content: "hello back",
  }),
);

assert.match(written, /Bot: hello back/);

channel.receiveLine("/exit");
await Promise.resolve();
assert.equal(channel.isRunning, false);

console.log("Mission 13 CLI channel checks passed.");
