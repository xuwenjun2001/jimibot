import { AgentLoop, MemoryStore, SkillsLoader, SubagentManager } from "./agent/index.js";
import { ToolRegistry } from "./agent/tools/registry.js";
import { MessageBus } from "./bus/queue.js";
import { ChannelManager, type ChannelFactories, type CliChannelRuntimeOptions } from "./channels/index.js";
import { type Config } from "./config/index.js";
import { CronService } from "./cron/index.js";
import { type LLMProvider } from "./providers/index.js";
import { SessionManager } from "./session/index.js";
export interface CreateJimibotAppOptions {
    config?: Config;
    configPath?: string;
    provider?: LLMProvider;
    cliRuntime?: CliChannelRuntimeOptions;
    channelFactories?: ChannelFactories;
    builtinSkillsDir?: string;
    workspacePath?: string;
}
export interface JimibotApp {
    readonly config: Config;
    readonly workspacePath: string;
    readonly bus: MessageBus;
    readonly provider: LLMProvider;
    readonly tools: ToolRegistry;
    readonly sessionManager: SessionManager;
    readonly memoryStore: MemoryStore;
    readonly skillsLoader: SkillsLoader;
    readonly subagentManager: SubagentManager;
    readonly cronService: CronService;
    readonly loop: AgentLoop;
    readonly channelManager: ChannelManager;
    start(): Promise<void>;
    stop(): Promise<void>;
}
export declare function createJimibotApp(options?: CreateJimibotAppOptions): Promise<JimibotApp>;
export declare function runJimibot(options?: CreateJimibotAppOptions): Promise<JimibotApp>;
//# sourceMappingURL=index.d.ts.map