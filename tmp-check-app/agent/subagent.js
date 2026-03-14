import { createInboundMessage } from "../bus/events.js";
import { MessageBus } from "../bus/queue.js";
import { LLMProvider, } from "../providers/base.js";
import { SkillsLoader } from "./skills.js";
import { ReadFileTool } from "./tools/FileTool.js";
import { ExecTool } from "./tools/cmd.js";
import { ToolRegistry } from "./tools/registry.js";
const DEFAULT_MAX_ITERATIONS = 15;
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;
export class SubagentManager {
    bus;
    provider;
    workspacePath;
    skillsLoader;
    model;
    maxIterations;
    maxTokens;
    temperature;
    reasoningEffort;
    runningTasks = new Map();
    sessionTasks = new Map();
    constructor(options) {
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
    async spawn(task, options) {
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
            sessionTaskIds = new Set();
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
    getRunningCount() {
        return this.runningTasks.size;
    }
    async waitForAll() {
        await Promise.all([...this.runningTasks.values()]);
    }
    async runSubagent(taskId, task, label, origin) {
        const tools = this.buildTools();
        const messages = [
            {
                role: "system",
                content: await this.buildPrompt(),
            },
            {
                role: "user",
                content: task,
            },
        ];
        let finalResult = null;
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
        }
        catch (error) {
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
    buildTools() {
        const tools = new ToolRegistry();
        tools.register(new ReadFileTool());
        tools.register(new ExecTool({ workingDir: this.workspacePath }));
        return tools;
    }
    async buildPrompt() {
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
                parts.push("", "## Skills", "Use read_file on a SKILL.md path if a listed skill is relevant.", summary);
            }
        }
        return parts.join("\n");
    }
    async runToolCalls(tools, toolCalls) {
        const results = [];
        for (const toolCall of toolCalls) {
            let content;
            try {
                content = await tools.execute(toolCall.name, toolCall.arguments);
            }
            catch (error) {
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
    createAssistantToolCallMessage(content, toolCalls) {
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
    async announceResult(input) {
        const statusText = input.status === "ok" ? "completed successfully" : "failed";
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
        this.bus.publishInbound(createInboundMessage({
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
        }));
    }
    truncateLabel(task) {
        const trimmed = task.replace(/\s+/g, " ").trim();
        if (trimmed.length <= 30) {
            return trimmed || "background task";
        }
        return `${trimmed.slice(0, 27)}...`;
    }
    createTaskId() {
        return Math.random().toString(36).slice(2, 10);
    }
    getErrorMessage(error) {
        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    }
}
//# sourceMappingURL=subagent.js.map