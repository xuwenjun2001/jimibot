import { MessageBus } from "../bus/queue.js";
import { LLMProvider } from "../providers/base.js";
import { SkillsLoader } from "./skills.js";
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
export declare class SubagentManager {
    private readonly bus;
    private readonly provider;
    private readonly workspacePath;
    private readonly skillsLoader;
    private readonly model;
    private readonly maxIterations;
    private readonly maxTokens;
    private readonly temperature;
    private readonly reasoningEffort;
    private readonly runningTasks;
    private readonly sessionTasks;
    constructor(options: SubagentManagerOptions);
    spawn(task: string, options: SpawnSubagentOptions): Promise<string>;
    getRunningCount(): number;
    waitForAll(): Promise<void>;
    private runSubagent;
    private buildTools;
    private buildPrompt;
    private runToolCalls;
    private createAssistantToolCallMessage;
    private announceResult;
    private truncateLabel;
    private createTaskId;
    private getErrorMessage;
}
//# sourceMappingURL=subagent.d.ts.map