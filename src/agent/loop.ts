import {
  createOutboundMessage,
  getSessionKey,
  type InboundMessage,
  type OutboundMessage,
} from "../bus/events.js";
import { MessageBus } from "../bus/queue.js";
import {
  LLMProvider,
  type ChatMessage,
  type ToolCallRequest,
} from "../providers/base.js";
import {
  SessionManager,
  createAssistantSessionMessage,
  createToolSessionMessage,
  createUserSessionMessageFromInbound,
  type SessionMessage,
} from "../session/index.js";
import { MemoryStore } from "./memory.js";
import { SkillsLoader } from "./skills.js";
import { ToolRegistry } from "./tools/registry.js";

const DEFAULT_MAX_ITERATIONS = 8;
const DEFAULT_HISTORY_LIMIT = 100;
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;

export interface AgentLoopOptions {
  bus: MessageBus;
  provider: LLMProvider;
  sessionManager: SessionManager;
  memoryStore?: MemoryStore;
  skillsLoader?: SkillsLoader;
  tools?: ToolRegistry;
  skillNames?: string[];
  model?: string;
  maxIterations?: number;
  historyLimit?: number;
  memoryWindow?: number;
  maxTokens?: number;
  temperature?: number;
  reasoningEffort?: string | null;
}

export class AgentLoop {
  private readonly bus: MessageBus;
  private readonly provider: LLMProvider;
  private readonly sessionManager: SessionManager;
  private readonly memoryStore: MemoryStore | undefined;
  private readonly skillsLoader: SkillsLoader | undefined;
  private readonly tools: ToolRegistry;
  private readonly skillNames: string[];
  private readonly model: string;
  private readonly maxIterations: number;
  private readonly historyLimit: number;
  private readonly memoryWindow: number;
  private readonly maxTokens: number;
  private readonly temperature: number;
  private readonly reasoningEffort: string | null | undefined;

  private running = false;
  private inboundSubscribed = false;
  private readonly backgroundTasks = new Set<Promise<void>>();
  private readonly consolidatingSessions = new Set<string>();

  constructor(options: AgentLoopOptions) {
    this.bus = options.bus;
    this.provider = options.provider;
    this.sessionManager = options.sessionManager;
    this.memoryStore = options.memoryStore;
    this.skillsLoader = options.skillsLoader;
    this.tools = options.tools ?? new ToolRegistry();
    this.skillNames = options.skillNames ?? [];
    this.model = options.model ?? this.provider.getDefaultModel();
    this.maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    this.historyLimit = options.historyLimit ?? DEFAULT_HISTORY_LIMIT;
    this.memoryWindow = options.memoryWindow ?? DEFAULT_HISTORY_LIMIT;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.temperature = options.temperature ?? DEFAULT_TEMPERATURE;
    this.reasoningEffort = options.reasoningEffort;
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    this.running = true;
    this.ensureInboundSubscription();
  }

  stop(): void {
    this.running = false;
  }

  async waitForBackgroundTasks(): Promise<void> {
    await Promise.all([...this.backgroundTasks]);
  }

  async processInboundMessage(message: InboundMessage): Promise<OutboundMessage> {
    const sessionKey = getSessionKey(message);
    const history = await this.sessionManager.getHistory(
      sessionKey,
      this.historyLimit,
    );
    const currentUserMessage = createUserSessionMessageFromInbound(message);
    const memoryContext = await this.loadMemoryContext();
    const skillsContext = await this.loadSkillsContext();
    const skillsSummary = await this.loadSkillsSummary();
    const context = this.buildContext(
      history,
      currentUserMessage,
      memoryContext,
      skillsContext,
      skillsSummary,
    );
    const turnMessages: SessionMessage[] = [currentUserMessage];

    let finalContent: string | null = null;
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
      channel: message.channel,
      chatId: message.chatId,
      content: finalContent,
      metadata: message.metadata,
    });
  }

  private ensureInboundSubscription(): void {
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
      } catch {
        this.bus.publishOutbound(
          createOutboundMessage({
            channel: message.channel,
            chatId: message.chatId,
            content: "Sorry, I encountered an error.",
            metadata: message.metadata,
          }),
        );
      }
    });
  }

  private buildContext(
    history: SessionMessage[],
    currentUserMessage: SessionMessage,
    memoryContext: string,
    skillsContext: string,
    skillsSummary: string,
  ): ChatMessage[] {
    const context: ChatMessage[] = [];

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

  private buildChatOptions(messages: ChatMessage[]) {
    const options = {
      messages,
      model: this.model,
      maxTokens: this.maxTokens,
      temperature: this.temperature,
    } as {
      messages: ChatMessage[];
      model: string;
      maxTokens: number;
      temperature: number;
      reasoningEffort?: string | null;
      tools?: ReturnType<ToolRegistry["getDefinitions"]>;
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

  private async runToolCalls(
    toolCalls: ToolCallRequest[],
  ): Promise<SessionMessage[]> {
    const results: SessionMessage[] = [];

    for (const toolCall of toolCalls) {
      let content: string;
      try {
        content = await this.tools.execute(toolCall.name, toolCall.arguments);
      } catch (error) {
        content = `Error: ${this.getErrorMessage(error)}`;
      }

      results.push(
        createToolSessionMessage({
          name: toolCall.name,
          content,
          toolCallId: toolCall.id,
        }),
      );
    }

    return results;
  }

  private createAssistantToolCallMessage(
    response: { content: string | null; toolCalls: ToolCallRequest[] },
  ): SessionMessage {
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

  private toChatMessage(message: SessionMessage): ChatMessage {
    const chatMessage: ChatMessage = {
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

  private async persistTurn(
    sessionKey: string,
    messages: SessionMessage[],
  ): Promise<void> {
    for (const message of messages) {
      await this.sessionManager.append(sessionKey, message);
    }
  }

  private async loadMemoryContext(): Promise<string> {
    if (this.memoryStore === undefined) {
      return "";
    }

    return this.memoryStore.getMemoryContext();
  }

  private async loadSkillsContext(): Promise<string> {
    if (this.skillsLoader === undefined) {
      return "";
    }

    const alwaysSkills = await this.skillsLoader.getAlwaysLoadSkills();
    const names = new Set<string>([
      ...alwaysSkills.map((skill) => skill.name),
      ...this.skillNames,
    ]);

    return this.skillsLoader.loadSkillsForContext([...names]);
  }

  private async loadSkillsSummary(): Promise<string> {
    if (this.skillsLoader === undefined) {
      return "";
    }

    return this.skillsLoader.buildSkillsSummary();
  }

  private scheduleConsolidation(sessionKey: string): void {
    if (this.memoryStore === undefined) {
      return;
    }
    if (this.consolidatingSessions.has(sessionKey)) {
      return;
    }

    this.consolidatingSessions.add(sessionKey);
    const task = new Promise<void>((resolve) => {
      setTimeout(() => {
        void (async () => {
          try {
            const session = await this.sessionManager.getSession(sessionKey);
            const unconsolidatedCount =
              session.messages.length - session.lastConsolidated;

            if (
              !this.memoryStore?.shouldConsolidate(
                unconsolidatedCount,
                this.memoryWindow,
              )
            ) {
              return;
            }

            const consolidated = await this.memoryStore.consolidate(
              session,
              this.provider,
              this.model,
              { memoryWindow: this.memoryWindow },
            );

            if (consolidated) {
              await this.sessionManager.saveSession(session);
            }
          } catch {
            // Memory consolidation failures should not break the main loop.
          } finally {
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

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
