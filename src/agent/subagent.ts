import { createInboundMessage } from "../bus/events.js";
import { MessageBus } from "../bus/queue.js";
import {
  LLMProvider,
  type ChatMessage,
  type ToolCallRequest,
} from "../providers/base.js";
import { SkillsLoader } from "./skills.js";
import { ReadFileTool } from "./tools/FileTool.js";
import { ExecTool } from "./tools/cmd.js";
import { ToolRegistry } from "./tools/registry.js";

const DEFAULT_MAX_ITERATIONS = 15;
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;

export interface SubagentOrigin {
  channel: string;
  chatId: string;
  sessionKey: string;
}

export interface SpawnSubagentOptions {
  label?: string;
  origin: SubagentOrigin;
}

export interface SubagentManagerOptions {
  bus: MessageBus;
  provider: LLMProvider;
  workspacePath: string;
  skillsLoader?: SkillsLoader;
  model?: string;
  maxIterations?: number;
  maxTokens?: number;
  temperature?: number;
  reasoningEffort?: string | null;
}

export class SubagentManager {
  private readonly bus: MessageBus;
  private readonly provider: LLMProvider;
  private readonly workspacePath: string;
  private readonly skillsLoader: SkillsLoader | undefined;
  private readonly model: string;
  private readonly maxIterations: number;
  private readonly maxTokens: number;
  private readonly temperature: number;
  private readonly reasoningEffort: string | null | undefined;
  private readonly runningTasks = new Map<string, Promise<void>>();
  private readonly sessionTasks = new Map<string, Set<string>>();

  constructor(options: SubagentManagerOptions) {
    this.bus = options.bus;
    this.provider = options.provider;
    this.workspacePath = options.workspacePath;
    this.skillsLoader = options.skillsLoader;
    this.model = options.model ?? this.provider.getDefaultModel();
    this.maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.temperature = options.temperature ?? DEFAULT_TEMPERATURE;
    this.reasoningEffort = options.reasoningEffort;
  }

  async spawn(task: string, options: SpawnSubagentOptions): Promise<string> {
    const taskId = this.createTaskId();
    const label = options.label?.trim() || this.truncateLabel(task);
    const backgroundTask = (async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
      await this.runSubagent(taskId, task, label, options.origin);
    })();

    this.runningTasks.set(taskId, backgroundTask);
    let sessionTaskIds = this.sessionTasks.get(options.origin.sessionKey);
    if (sessionTaskIds === undefined) {
      sessionTaskIds = new Set<string>();
      this.sessionTasks.set(options.origin.sessionKey, sessionTaskIds);
    }
    sessionTaskIds.add(taskId);

    void backgroundTask.finally(() => {
      this.runningTasks.delete(taskId);
      const sessionIds = this.sessionTasks.get(options.origin.sessionKey);
      if (sessionIds === undefined) {
        return;
      }

      sessionIds.delete(taskId);
      if (sessionIds.size === 0) {
        this.sessionTasks.delete(options.origin.sessionKey);
      }
    });

    return `Background task [${label}] started. I'll report back when it's done.`;
  }

  getRunningCount(): number {
    return this.runningTasks.size;
  }

  async waitForAll(): Promise<void> {
    await Promise.all([...this.runningTasks.values()]);
  }

  private async runSubagent(
    taskId: string,
    task: string,
    label: string,
    origin: SubagentOrigin,
  ): Promise<void> {
    const tools = this.buildTools();
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: await this.buildPrompt(),
      },
      {
        role: "user",
        content: task,
      },
    ];

    let finalResult: string | null = null;
    let iteration = 0;

    try {
      while (iteration < this.maxIterations) {
        iteration += 1;

        const chatOptions = {
          messages,
          tools: tools.getDefinitions(),
          model: this.model,
          maxTokens: this.maxTokens,
          temperature: this.temperature,
        } as {
          messages: ChatMessage[];
          tools: ReturnType<ToolRegistry["getDefinitions"]>;
          model: string;
          maxTokens: number;
          temperature: number;
          reasoningEffort?: string | null;
        };

        if (this.reasoningEffort !== undefined) {
          chatOptions.reasoningEffort = this.reasoningEffort;
        }

        const response = await this.provider.chat(chatOptions);

        if (response.hasToolCalls) {
          messages.push(this.createAssistantToolCallMessage(response.content, response.toolCalls));
          const toolMessages = await this.runToolCalls(tools, response.toolCalls);
          messages.push(...toolMessages);
          continue;
        }

        finalResult =
          response.content ??
          "The task completed, but no final response was generated.";
        break;
      }

      if (finalResult === null) {
        finalResult =
          `The task hit the maximum number of tool call iterations (${this.maxIterations}).`;
      }

      await this.announceResult({
        taskId,
        label,
        task,
        result: finalResult,
        status: "ok",
        origin,
      });
    } catch (error) {
      await this.announceResult({
        taskId,
        label,
        task,
        result: `Error: ${this.getErrorMessage(error)}`,
        status: "error",
        origin,
      });
    }
  }

  private buildTools(): ToolRegistry {
    const tools = new ToolRegistry();
    tools.register(new ReadFileTool());
    tools.register(new ExecTool({ workingDir: this.workspacePath }));
    return tools;
  }

  private async buildPrompt(): Promise<string> {
    const parts = [
      "# Subagent",
      "",
      "You are a focused subagent spawned by the main agent.",
      "Complete the assigned task and return a concise result to the main agent.",
      "Stay on task, use tools when needed, and do not ask the user questions directly.",
      "",
      "## Constraints",
      "- You cannot message the user directly.",
      "- You cannot spawn another subagent.",
      `- Workspace: ${this.workspacePath}`,
    ];

    if (this.skillsLoader !== undefined) {
      const summary = await this.skillsLoader.buildSkillsSummary();
      if (summary.length > 0) {
        parts.push(
          "",
          "## Skills",
          "Use read_file on a SKILL.md path if a listed skill is relevant.",
          summary,
        );
      }
    }

    return parts.join("\n");
  }

  private async runToolCalls(
    tools: ToolRegistry,
    toolCalls: ToolCallRequest[],
  ): Promise<ChatMessage[]> {
    const results: ChatMessage[] = [];

    for (const toolCall of toolCalls) {
      let content: string;
      try {
        content = await tools.execute(toolCall.name, toolCall.arguments);
      } catch (error) {
        content = `Error: ${this.getErrorMessage(error)}`;
      }

      results.push({
        role: "tool",
        tool_call_id: toolCall.id,
        name: toolCall.name,
        content,
      });
    }

    return results;
  }

  private createAssistantToolCallMessage(
    content: string | null,
    toolCalls: ToolCallRequest[],
  ): ChatMessage {
    return {
      role: "assistant",
      content: content ?? "",
      tool_calls: toolCalls.map((toolCall) => ({
        id: toolCall.id,
        type: "function",
        function: {
          name: toolCall.name,
          arguments: JSON.stringify(toolCall.arguments),
        },
      })),
    };
  }

  private async announceResult(input: {
    taskId: string;
    label: string;
    task: string;
    result: string;
    status: "ok" | "error";
    origin: SubagentOrigin;
  }): Promise<void> {
    const statusText =
      input.status === "ok" ? "completed successfully" : "failed";
    const content = [
      `[Background task '${input.label}' ${statusText}]`,
      "",
      `Task: ${input.task}`,
      "",
      "Result:",
      input.result,
      "",
      "Summarize this naturally for the user in 1-2 sentences.",
      "Do not mention background workers, internal task IDs, or implementation details.",
    ].join("\n");

    this.bus.publishInbound(
      createInboundMessage({
        channel: "system",
        senderId: "subagent",
        chatId: input.origin.chatId,
        content,
        metadata: {
          originChannel: input.origin.channel,
          originChatId: input.origin.chatId,
          subagentTaskId: input.taskId,
          subagentLabel: input.label,
          subagentStatus: input.status,
        },
        sessionKeyOverride: input.origin.sessionKey,
      }),
    );
  }

  private truncateLabel(task: string): string {
    const trimmed = task.replace(/\s+/g, " ").trim();
    if (trimmed.length <= 30) {
      return trimmed || "background task";
    }

    return `${trimmed.slice(0, 27)}...`;
  }

  private createTaskId(): string {
    return Math.random().toString(36).slice(2, 10);
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
