import { Tool } from "./base.js";
export class CronTool extends Tool {
    cron;
    channel = "";
    chatId = "";
    inCronContext = false;
    constructor(cron) {
        super();
        this.cron = cron;
    }
    get name() {
        return "cron";
    }
    get description() {
        return "Schedule reminders and recurring tasks. Actions: add, list, remove.";
    }
    get parameters() {
        return {
            type: "object",
            properties: {
                action: {
                    type: "string",
                    enum: ["add", "list", "remove"],
                    description: "The cron action to perform.",
                },
                message: {
                    type: "string",
                    description: "Reminder or task message for add.",
                },
                every_seconds: {
                    type: "integer",
                    minimum: 1,
                    description: "Run every N seconds.",
                },
                cron_expr: {
                    type: "string",
                    description: "Cron expression like '*/5 * * * *'.",
                },
                tz: {
                    type: "string",
                    description: "Optional IANA timezone for cron_expr.",
                },
                at: {
                    type: "string",
                    description: "ISO datetime for one-time execution.",
                },
                job_id: {
                    type: "string",
                    description: "Job ID for remove.",
                },
            },
            required: ["action"],
        };
    }
    setContext(channel, chatId) {
        this.channel = channel;
        this.chatId = chatId;
    }
    setCronContext(active) {
        const previous = this.inCronContext;
        this.inCronContext = active;
        return previous;
    }
    resetCronContext(previous) {
        this.inCronContext = previous;
    }
    async execute(params) {
        const castedParams = this.castParams(params);
        const errors = this.validateParams(castedParams);
        if (errors.length > 0) {
            throw new Error(errors.join("\n"));
        }
        const action = castedParams.action;
        if (typeof action !== "string") {
            throw new Error("action should be a string");
        }
        switch (action) {
            case "add":
                return this.addJob(castedParams);
            case "list":
                return this.listJobs();
            case "remove":
                return this.removeJob(castedParams.job_id);
            default:
                return `Unknown action: ${action}`;
        }
    }
    async addJob(params) {
        if (this.inCronContext) {
            return "Error: cannot schedule new jobs from within a cron job execution";
        }
        if (!this.channel || !this.chatId) {
            return "Error: no session context (channel/chatId)";
        }
        const message = typeof params.message === "string" ? params.message.trim() : "";
        const everySeconds = typeof params.every_seconds === "number" ? params.every_seconds : undefined;
        const cronExpr = typeof params.cron_expr === "string" ? params.cron_expr.trim() : undefined;
        const tz = typeof params.tz === "string" ? params.tz.trim() : undefined;
        const at = typeof params.at === "string" ? params.at.trim() : undefined;
        if (message.length === 0) {
            return "Error: message is required for add";
        }
        if (tz !== undefined && cronExpr === undefined) {
            return "Error: tz can only be used with cron_expr";
        }
        let schedule;
        let deleteAfterRun = false;
        if (everySeconds !== undefined) {
            schedule = {
                kind: "every",
                everyMs: everySeconds * 1000,
            };
        }
        else if (cronExpr !== undefined) {
            schedule = {
                kind: "cron",
                expr: cronExpr,
            };
            if (tz !== undefined && tz.length > 0) {
                schedule.tz = tz;
            }
        }
        else if (at !== undefined) {
            const timestamp = Date.parse(at);
            if (Number.isNaN(timestamp)) {
                return `Error: invalid ISO datetime format '${at}'`;
            }
            schedule = {
                kind: "at",
                atMs: timestamp,
            };
            deleteAfterRun = true;
        }
        else {
            return "Error: either every_seconds, cron_expr, or at is required";
        }
        try {
            const job = await this.cron.addJob({
                name: message.slice(0, 30),
                schedule,
                payload: {
                    kind: "agent_turn",
                    message,
                    deliver: true,
                    channel: this.channel,
                    chatId: this.chatId,
                },
                deleteAfterRun,
            });
            return `Created job '${job.name}' (id: ${job.id})`;
        }
        catch (error) {
            return `Error: ${this.getErrorMessage(error)}`;
        }
    }
    listJobs() {
        const jobs = this.cron.listJobs();
        if (jobs.length === 0) {
            return "No scheduled jobs.";
        }
        return `Scheduled jobs:\n${jobs
            .map((job) => `- ${job.name} (id: ${job.id}, ${job.schedule.kind})`)
            .join("\n")}`;
    }
    async removeJob(jobId) {
        if (typeof jobId !== "string" || jobId.trim().length === 0) {
            return "Error: job_id is required for remove";
        }
        const removed = await this.cron.removeJob(jobId.trim());
        return removed ? `Removed job ${jobId.trim()}` : `Job ${jobId.trim()} not found`;
    }
    getErrorMessage(error) {
        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    }
}
//# sourceMappingURL=cron.js.map