import { Tool } from "./base.js";
export class SpawnTool extends Tool {
    manager;
    originChannel = "cli";
    originChatId = "direct";
    sessionKey = "cli:direct";
    constructor(manager) {
        super();
        this.manager = manager;
    }
    get name() {
        return "spawn";
    }
    get description() {
        return "Spawn a background subagent for longer tasks and report back when it finishes.";
    }
    get parameters() {
        return {
            type: "object",
            properties: {
                task: {
                    type: "string",
                    minLength: 1,
                    description: "The task for the background subagent to complete.",
                },
                label: {
                    type: "string",
                    minLength: 1,
                    description: "Optional short label for the task.",
                },
            },
            required: ["task"],
        };
    }
    setContext(channel, chatId, sessionKey) {
        this.originChannel = channel;
        this.originChatId = chatId;
        this.sessionKey = sessionKey;
    }
    async execute(params) {
        const castedParams = this.castParams(params);
        const errors = this.validateParams(castedParams);
        if (errors.length > 0) {
            throw new Error(errors.join("\n"));
        }
        const task = castedParams.task;
        const label = castedParams.label;
        if (typeof task !== "string") {
            throw new Error("task should be a string");
        }
        if (label !== undefined && typeof label !== "string") {
            throw new Error("label should be a string");
        }
        const options = {
            origin: {
                channel: this.originChannel,
                chatId: this.originChatId,
                sessionKey: this.sessionKey,
            },
        };
        if (label !== undefined) {
            options.label = label;
        }
        return this.manager.spawn(task, options);
    }
}
//# sourceMappingURL=spawn.js.map