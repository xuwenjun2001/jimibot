import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import type { InboundMessage } from "../bus/events.js";
import { MessageBus } from "../bus/queue.js";
import { CronService, computeNextRun } from "./service.js";

const storePath = path.join(process.cwd(), "tmp", "cron-service", "jobs.json");
await rm(path.dirname(storePath), { recursive: true, force: true });

let nowMs = Date.UTC(2026, 2, 14, 10, 0, 0);
const bus = new MessageBus();
const service = new CronService({
  bus,
  storePath,
  now: () => nowMs,
  idGenerator: () => "job-every",
});

const everyJob = await service.addJob({
  name: "Take a break",
  schedule: {
    kind: "every",
    everyMs: 60_000,
  },
  payload: {
    kind: "agent_turn",
    message: "Time to stretch.",
    deliver: true,
    channel: "cli",
    chatId: "direct",
  },
});

assert.equal(everyJob.state.nextRunAtMs, nowMs + 60_000);
assert.equal(service.listJobs().length, 1);

const cronNextRun = computeNextRun(
  {
    kind: "cron",
    expr: "5 10 * * *",
    tz: "UTC",
  },
  Date.UTC(2026, 2, 14, 10, 3, 20),
);
assert.equal(cronNextRun, Date.UTC(2026, 2, 14, 10, 5, 0));

const dueMessage = new Promise<InboundMessage>((resolve) => {
  bus.onInbound(async (message) => {
    if (message.senderId === "cron") {
      resolve(message);
    }
  });
});

nowMs += 60_000;
await service.runDueJobs();

const inbound = await dueMessage;
assert.equal(inbound.channel, "cli");
assert.equal(inbound.chatId, "direct");
assert.equal(inbound.content, "Time to stretch.");
assert.equal(inbound.sessionKeyOverride, "cron:job-every");
assert.equal(inbound.metadata.cronJobId, "job-every");

const savedStore = JSON.parse(await readFile(storePath, "utf-8")) as {
  jobs: Array<{ id: string }>;
};
assert.equal(savedStore.jobs[0]?.id, "job-every");

const oneShotService = new CronService({
  bus: new MessageBus(),
  storePath: path.join(process.cwd(), "tmp", "cron-service-once", "jobs.json"),
  now: () => nowMs,
  idGenerator: () => "job-once",
});
await rm(path.join(process.cwd(), "tmp", "cron-service-once"), {
  recursive: true,
  force: true,
});

await oneShotService.addJob({
  name: "One-shot reminder",
  schedule: {
    kind: "at",
    atMs: nowMs + 1_000,
  },
  payload: {
    kind: "agent_turn",
    message: "This runs once.",
    deliver: true,
    channel: "cli",
    chatId: "direct",
  },
  deleteAfterRun: true,
});

nowMs += 1_000;
await oneShotService.runDueJobs();
assert.equal(oneShotService.listJobs(true).length, 0);

console.log("Mission 14 cron service checks passed.");
