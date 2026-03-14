import type { ToolParametersSchema } from "../../types/schema.js";
import { Tool } from "./base.js";
import type { SubagentManager } from "../subagent.js";

export class SpawnTool extends Tool {
  private originChannel = "cli";
  private originChatId = "direct";
  private sessionKey = "cli:direct";

  constructor(private readonly manager: SubagentManager) {
    super();
  }

  get name(): string {
    return "spawn";
  }

  get description(): string {
    return "Spawn a background subagent for longer tasks and report back when it finishes.";
  }

  get parameters(): ToolParametersSchema {
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

  setContext(channel: string, chatId: string, sessionKey: string): void {
    this.originChannel = channel;
    this.originChatId = chatId;
    this.sessionKey = sessionKey;
  }

  async execute(params: Record<string, unknown>): Promise<string> {
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
    } as {
      origin: {
        channel: string;
        chatId: string;
        sessionKey: string;
      };
      label?: string;
    };

    if (label !== undefined) {
      options.label = label;
    }

    return this.manager.spawn(task, options);
  }
}
