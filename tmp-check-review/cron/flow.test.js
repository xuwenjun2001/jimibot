import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { AgentLoop } from "../agent/loop.js";
import { MessageBus } from "../bus/queue.js";
import { createOutboundMessage } from "../bus/events.js";
import { parseConfig } from "../config/loader.js";
import { MockProvider } from "../providers/mock.js";
import { SessionManager } from "../session/manager.js";
import { MockChannel } from "../channels/mock.js";
import { ChannelManager } from "../channels/manager.js";
import { CronService } from "./service.js";
const workspacePath = path.join(process.cwd(), "tmp", "cron-flow");
await rm(workspacePath, { recursive: true, force: true });
await mkdir(workspacePath, { recursive: true });
let nowMs = Date.UTC(2026, 2, 14, 10, 0, 0);
const bus = new MessageBus();
const sessionManager = new SessionManager(workspacePath);
const provider = new MockProvider({
    responses: [{ content: "定时提醒：该休息了。" }],
});
const cronService = new CronService({
    bus,
    storePath: path.join(workspacePath, "cron", "jobs.json"),
    now: () => nowMs,
    idGenerator: () => "cron-flow-job",
});
const config = parseConfig({
    channels: {
        cli: {
            enabled: true,
            allow_from: ["*"],
        },
    },
});
const mockChannel = new MockChannel("cli", config.channels.cli, bus);
const manager = new ChannelManager(config, bus, {
    cli: () => mockChannel,
});
const loop = new AgentLoop({
    bus,
    provider,
    sessionManager,
    cronService,
});
loop.start();
await manager.startAll();
await cronService.addJob({
    name: "Break reminder",
    schedule: {
        kind: "every",
        everyMs: 60_000,
    },
    payload: {
        kind: "agent_turn",
        message: "请提醒我休息一下。",
        deliver: true,
        channel: "cli",
        chatId: "direct",
    },
});
nowMs += 60_000;
await cronService.runDueJobs();
for (let attempt = 0; attempt < 20; attempt += 1) {
    if (mockChannel.sentMessages.length > 0) {
        break;
    }
    await new Promise((resolve) => {
        setTimeout(resolve, 10);
    });
}
assert.equal(mockChannel.sentMessages.length, 1);
assert.deepEqual(mockChannel.sentMessages[0], createOutboundMessage({
    channel: "cli",
    chatId: "direct",
    content: "定时提醒：该休息了。",
    metadata: {
        cronJobId: "cron-flow-job",
        cron: true,
        cronDeliver: true,
    },
}));
const history = await sessionManager.getHistory("cron:cron-flow-job");
assert.deepEqual(history.map((message) => message.role), ["user", "assistant"]);
await manager.stopAll();
console.log("Mission 14 cron flow checks passed.");
//# sourceMappingURL=flow.test.js.map