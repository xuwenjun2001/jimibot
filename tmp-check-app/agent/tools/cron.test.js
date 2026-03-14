import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { MessageBus } from "../../bus/queue.js";
import { CronService } from "../../cron/service.js";
import { CronTool } from "./cron.js";
const storePath = path.join(process.cwd(), "tmp", "cron-tool", "jobs.json");
await rm(path.dirname(storePath), { recursive: true, force: true });
const service = new CronService({
    bus: new MessageBus(),
    storePath,
    idGenerator: () => "cron-tool-job",
});
const tool = new CronTool(service);
tool.setContext("cli", "direct");
const created = await tool.execute({
    action: "add",
    message: "Time to take a break",
    every_seconds: 60,
});
assert.match(created, /Created job 'Time to take a break'/);
const listed = await tool.execute({
    action: "list",
});
assert.match(listed, /Scheduled jobs:/);
assert.match(listed, /cron-tool-job/);
const removed = await tool.execute({
    action: "remove",
    job_id: "cron-tool-job",
});
assert.equal(removed, "Removed job cron-tool-job");
const missing = await tool.execute({
    action: "remove",
    job_id: "missing-job",
});
assert.equal(missing, "Job missing-job not found");
const previous = tool.setCronContext(true);
const blocked = await tool.execute({
    action: "add",
    message: "Should fail",
    every_seconds: 60,
});
tool.resetCronContext(previous);
assert.equal(blocked, "Error: cannot schedule new jobs from within a cron job execution");
console.log("Mission 14 cron tool checks passed.");
//# sourceMappingURL=cron.test.js.map