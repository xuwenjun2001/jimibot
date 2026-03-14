import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { PassThrough } from "node:stream";

import { AgentLoop } from "../agent/loop.js";
import { MessageBus } from "../bus/queue.js";
import { parseConfig } from "../config/loader.js";
import { MockProvider } from "../providers/mock.js";
import { SessionManager } from "../session/manager.js";
import { CliChannel, createCliChannelConfig } from "./cli.js";
import { ChannelManager } from "./manager.js";

const workspacePath = path.join(process.cwd(), "tmp", "cli-channel-flow");
await rm(workspacePath, { recursive: true, force: true });
await mkdir(workspacePath, { recursive: true });

const bus = new MessageBus();
const sessionManager = new SessionManager(workspacePath);
const provider = new MockProvider({
  responses: [{ content: "这是 CLI 通道打通后的回复。" }],
});
const loop = new AgentLoop({
  bus,
  provider,
  sessionManager,
});

const input = new PassThrough();
const output = new PassThrough();
let written = "";
output.on("data", (chunk) => {
  written += chunk.toString("utf-8");
});

const cliChannel = new CliChannel(
  createCliChannelConfig({
    prompt: "",
    assistantPrefix: "AI: ",
  }),
  bus,
  {
    input,
    output,
    terminal: false,
  },
);

const config = parseConfig({
  channels: {
    cli: {
      enabled: true,
      allow_from: ["*"],
      prompt: "",
    },
  },
});

const manager = new ChannelManager(config, bus, {
  cli: () => cliChannel,
});

loop.start();
await manager.startAll();

cliChannel.receiveLine("请测试 CLI 完整链路");

for (let attempt = 0; attempt < 20; attempt += 1) {
  if (written.includes("这是 CLI 通道打通后的回复。")) {
    break;
  }
  await new Promise((resolve) => {
    setTimeout(resolve, 10);
  });
}

assert.match(written, /AI: 这是 CLI 通道打通后的回复。/);

const history = await sessionManager.getHistory("cli:direct");
assert.deepEqual(history.map((message) => message.role), ["user", "assistant"]);

await manager.stopAll();

console.log("Mission 13 CLI flow checks passed.");
