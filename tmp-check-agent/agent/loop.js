import { createOutboundMessage, getSessionKey, } from "../bus/events.js";
import { MessageBus } from "../bus/queue.js";
import { LLMProvider, } from "../providers/base.js";
import { SessionManager, createAssistantSessionMessage, createToolSessionMessage, createUserSessionMessageFromInbound, } from "../session/index.js";
import { ToolRegistry } from "./tools/registry.js";
const DEFAULT_MAX_ITERATIONS = 8;
const DEFAULT_HISTORY_LIMIT = 100;
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;
export class AgentLoop {
    bus;
    provider;
    sessionManager;
    tools;
    model;
    maxIterations;
    historyLimit;
    maxTokens;
    temperature;
    reasoningEffort;
    running = false;
    inboundSubscribed = false;
    constructor(options) {
        this.bus = options.bus;
        this.provider = options.provider;
        this.sessionManager = options.sessionManager;
        this.tools = options.tools ?? new ToolRegistry();
        this.model = options.model ?? this.provider.getDefaultModel();
        this.maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
        this.historyLimit = options.historyLimit ?? DEFAULT_HISTORY_LIMIT;
        this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
        this.temperature = options.temperature ?? DEFAULT_TEMPERATURE;
        this.reasoningEffort = options.reasoningEffort;
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
    async processInboundMessage(message) {
        const sessionKey = getSessionKey(message);
        const history = await this.sessionManager.getHistory(sessionKey, this.historyLimit);
        const currentUserMessage = createUserSessionMessageFromInbound(message);
        const context = this.buildContext(history, currentUserMessage);
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
        return createOutboundMessage({
            channel: message.channel,
            chatId: message.chatId,
            content: finalContent,
            metadata: message.metadata,
        });
    }
    ensureInboundSubscription() {
        if (this.inboundSubscribed) {
            return;
        }
        this.inboundSubscribed = true;
        this.bus.onInbound(async (message) => {
            if (!this.running) {
                return;
            }
            try {
                const outbound = await this.processInboundMessage(message);
                this.bus.publishOutbound(outbound);
            }
            catch {
                this.bus.publishOutbound(createOutboundMessage({
                    channel: message.channel,
                    chatId: message.chatId,
                    content: "Sorry, I encountered an error.",
                    metadata: message.metadata,
                }));
            }
        });
    }
    buildContext(history, currentUserMessage) {
        return [
            ...history.map((message) => this.toChatMessage(message)),
            this.toChatMessage(currentUserMessage),
        ];
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
    getErrorMessage(error) {
        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    }
}
//# sourceMappingURL=loop.js.map