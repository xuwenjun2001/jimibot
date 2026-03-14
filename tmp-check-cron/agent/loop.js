import { createOutboundMessage, getSessionKey, } from "../bus/events.js";
import { MessageBus } from "../bus/queue.js";
import { LLMProvider, } from "../providers/base.js";
import { SessionManager, createAssistantSessionMessage, createToolSessionMessage, createUserSessionMessageFromInbound, } from "../session/index.js";
import { MemoryStore } from "./memory.js";
import { SkillsLoader } from "./skills.js";
import { SubagentManager } from "./subagent.js";
import { CronService } from "../cron/service.js";
import { CronTool } from "./tools/cron.js";
import { SpawnTool } from "./tools/spawn.js";
import { ToolRegistry } from "./tools/registry.js";
const DEFAULT_MAX_ITERATIONS = 8;
const DEFAULT_HISTORY_LIMIT = 100;
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;
export class AgentLoop {
    bus;
    provider;
    sessionManager;
    memoryStore;
    skillsLoader;
    subagentManager;
    cronService;
    tools;
    skillNames;
    model;
    maxIterations;
    historyLimit;
    memoryWindow;
    maxTokens;
    temperature;
    reasoningEffort;
    running = false;
    inboundSubscribed = false;
    backgroundTasks = new Set();
    consolidatingSessions = new Set();
    sessionProcessing = new Map();
    constructor(options) {
        this.bus = options.bus;
        this.provider = options.provider;
        this.sessionManager = options.sessionManager;
        this.memoryStore = options.memoryStore;
        this.skillsLoader = options.skillsLoader;
        this.subagentManager = options.subagentManager;
        this.cronService = options.cronService;
        this.tools = options.tools ?? new ToolRegistry();
        this.skillNames = options.skillNames ?? [];
        this.model = options.model ?? this.provider.getDefaultModel();
        this.maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
        this.historyLimit = options.historyLimit ?? DEFAULT_HISTORY_LIMIT;
        this.memoryWindow = options.memoryWindow ?? DEFAULT_HISTORY_LIMIT;
        this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
        this.temperature = options.temperature ?? DEFAULT_TEMPERATURE;
        this.reasoningEffort = options.reasoningEffort;
        if (this.subagentManager !== undefined &&
            this.tools.get("spawn") === undefined) {
            this.tools.register(new SpawnTool(this.subagentManager));
        }
        if (this.cronService !== undefined && this.tools.get("cron") === undefined) {
            this.tools.register(new CronTool(this.cronService));
        }
    }
    get isRunning() {
        return this.running;
    }
    start() {
        this.running = true;
        this.ensureInboundSubscription();
    }
    stop() {
        this.running = false;
    }
    async waitForBackgroundTasks() {
        await Promise.all([...this.backgroundTasks]);
    }
    async processInboundMessage(message) {
        const sessionKey = getSessionKey(message);
        const outboundTarget = this.resolveOutboundTarget(message);
        this.prepareToolContext(outboundTarget.channel, outboundTarget.chatId, sessionKey);
        const previousCronContext = this.setCronToolExecutionContext(message);
        try {
            const history = await this.sessionManager.getHistory(sessionKey, this.historyLimit);
            const currentUserMessage = createUserSessionMessageFromInbound(message);
            const memoryContext = await this.loadMemoryContext();
            const skillsContext = await this.loadSkillsContext();
            const skillsSummary = await this.loadSkillsSummary();
            const context = this.buildContext(history, currentUserMessage, memoryContext, skillsContext, skillsSummary);
            const turnMessages = [currentUserMessage];
            let finalContent = null;
            let iteration = 0;
            while (iteration < this.maxIterations) {
                iteration += 1;
                const response = await this.provider.chat(this.buildChatOptions(context));
                if (response.hasToolCalls) {
                    const assistantToolCallMessage = this.createAssistantToolCallMessage(response);
                    context.push(this.toChatMessage(assistantToolCallMessage));
                    turnMessages.push(assistantToolCallMessage);
                    const toolMessages = await this.runToolCalls(response.toolCalls);
                    for (const toolMessage of toolMessages) {
                        context.push(this.toChatMessage(toolMessage));
                        turnMessages.push(toolMessage);
                    }
                    continue;
                }
                finalContent =
                    response.content ?? "I've completed processing but have no response to give.";
                const assistantMessage = createAssistantSessionMessage(finalContent);
                turnMessages.push(assistantMessage);
                break;
            }
            if (finalContent === null) {
                finalContent =
                    `I reached the maximum number of tool call iterations (${this.maxIterations}) without completing the task.`;
                turnMessages.push(createAssistantSessionMessage(finalContent));
            }
            await this.persistTurn(sessionKey, turnMessages);
            this.scheduleConsolidation(sessionKey);
            return createOutboundMessage({
                channel: outboundTarget.channel,
                chatId: outboundTarget.chatId,
                content: finalContent,
                metadata: message.metadata,
            });
        }
        finally {
            this.resetCronToolExecutionContext(previousCronContext);
        }
    }
    ensureInboundSubscription() {
        if (this.inboundSubscribed) {
            return;
        }
        this.inboundSubscribed = true;
        this.bus.onInbound(async (message) => {
            const sessionKey = getSessionKey(message);
            const previousTask = this.sessionProcessing.get(sessionKey) ?? Promise.resolve();
            const currentTask = previousTask
                .catch(() => undefined)
                .then(async () => {
                if (!this.running) {
                    return;
                }
                try {
                    const outbound = await this.processInboundMessage(message);
                    this.bus.publishOutbound(outbound);
                }
                catch {
                    const outboundTarget = this.resolveOutboundTarget(message);
                    this.bus.publishOutbound(createOutboundMessage({
                        channel: outboundTarget.channel,
                        chatId: outboundTarget.chatId,
                        content: "Sorry, I encountered an error.",
                        metadata: message.metadata,
                    }));
                }
            })
                .finally(() => {
                if (this.sessionProcessing.get(sessionKey) === currentTask) {
                    this.sessionProcessing.delete(sessionKey);
                }
            });
            this.sessionProcessing.set(sessionKey, currentTask);
        });
    }
    buildContext(history, currentUserMessage, memoryContext, skillsContext, skillsSummary) {
        const context = [];
        if (memoryContext.length > 0) {
            context.push({
                role: "system",
                content: memoryContext,
            });
        }
        if (skillsContext.length > 0) {
            context.push({
                role: "system",
                content: `## Loaded Skills\n${skillsContext}`,
            });
        }
        if (skillsSummary.length > 0) {
            context.push({
                role: "system",
                content: `## Available Skills\n${skillsSummary}`,
            });
        }
        context.push(...history.map((message) => this.toChatMessage(message)));
        context.push(this.toChatMessage(currentUserMessage));
        return context;
    }
    buildChatOptions(messages) {
        const options = {
            messages,
            model: this.model,
            maxTokens: this.maxTokens,
            temperature: this.temperature,
        };
        if (this.reasoningEffort !== undefined) {
            options.reasoningEffort = this.reasoningEffort;
        }
        const toolDefinitions = this.tools.getDefinitions();
        if (toolDefinitions.length > 0) {
            options.tools = toolDefinitions;
        }
        return options;
    }
    async runToolCalls(toolCalls) {
        const results = [];
        for (const toolCall of toolCalls) {
            let content;
            try {
                content = await this.tools.execute(toolCall.name, toolCall.arguments);
            }
            catch (error) {
                content = `Error: ${this.getErrorMessage(error)}`;
            }
            results.push(createToolSessionMessage({
                name: toolCall.name,
                content,
                toolCallId: toolCall.id,
            }));
        }
        return results;
    }
    createAssistantToolCallMessage(response) {
        return {
            role: "assistant",
            content: response.content ?? "",
            timestamp: new Date().toISOString(),
            tool_calls: response.toolCalls.map((toolCall) => ({
                id: toolCall.id,
                type: "function",
                function: {
                    name: toolCall.name,
                    arguments: JSON.stringify(toolCall.arguments),
                },
            })),
        };
    }
    toChatMessage(message) {
        const chatMessage = {
            role: message.role,
            content: message.content,
        };
        if (message.tool_calls !== undefined) {
            chatMessage.tool_calls = message.tool_calls;
        }
        if (message.tool_call_id !== undefined) {
            chatMessage.tool_call_id = message.tool_call_id;
        }
        if (message.name !== undefined) {
            chatMessage.name = message.name;
        }
        return chatMessage;
    }
    async persistTurn(sessionKey, messages) {
        for (const message of messages) {
            await this.sessionManager.append(sessionKey, message);
        }
    }
    async loadMemoryContext() {
        if (this.memoryStore === undefined) {
            return "";
        }
        return this.memoryStore.getMemoryContext();
    }
    async loadSkillsContext() {
        if (this.skillsLoader === undefined) {
            return "";
        }
        const alwaysSkills = await this.skillsLoader.getAlwaysLoadSkills();
        const names = new Set([
            ...alwaysSkills.map((skill) => skill.name),
            ...this.skillNames,
        ]);
        return this.skillsLoader.loadSkillsForContext([...names]);
    }
    async loadSkillsSummary() {
        if (this.skillsLoader === undefined) {
            return "";
        }
        return this.skillsLoader.buildSkillsSummary();
    }
    prepareToolContext(channel, chatId, sessionKey) {
        const spawnTool = this.tools.get("spawn");
        const cronTool = this.tools.get("cron");
        spawnTool?.setContext?.(channel, chatId, sessionKey);
        cronTool?.setContext?.(channel, chatId);
        cronTool?.setCronContext?.(false);
    }
    resolveOutboundTarget(message) {
        const originChannel = message.metadata.originChannel;
        const originChatId = message.metadata.originChatId;
        return {
            channel: typeof originChannel === "string" ? originChannel : message.channel,
            chatId: typeof originChatId === "string" ? originChatId : message.chatId,
        };
    }
    setCronToolExecutionContext(message) {
        const cronTool = this.tools.get("cron");
        return cronTool?.setCronContext?.(message.metadata.cron === true || message.senderId === "cron");
    }
    resetCronToolExecutionContext(previous) {
        const cronTool = this.tools.get("cron");
        if (previous !== undefined) {
            cronTool?.resetCronContext?.(previous);
        }
    }
    scheduleConsolidation(sessionKey) {
        if (this.memoryStore === undefined) {
            return;
        }
        if (this.consolidatingSessions.has(sessionKey)) {
            return;
        }
        this.consolidatingSessions.add(sessionKey);
        const task = new Promise((resolve) => {
            setTimeout(() => {
                void (async () => {
                    try {
                        const session = await this.sessionManager.getSession(sessionKey);
                        const unconsolidatedCount = session.messages.length - session.lastConsolidated;
                        if (!this.memoryStore?.shouldConsolidate(unconsolidatedCount, this.memoryWindow)) {
                            return;
                        }
                        const consolidated = await this.memoryStore.consolidate(session, this.provider, this.model, { memoryWindow: this.memoryWindow });
                        if (consolidated) {
                            await this.sessionManager.saveSession(session);
                        }
                    }
                    catch {
                        // Memory consolidation failures should not break the main loop.
                    }
                    finally {
                        this.consolidatingSessions.delete(sessionKey);
                        resolve();
                    }
                })();
            }, 0);
        });
        this.backgroundTasks.add(task);
        void task.finally(() => {
            this.backgroundTasks.delete(task);
        });
    }
    getErrorMessage(error) {
        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    }
}
//# sourceMappingURL=loop.js.map