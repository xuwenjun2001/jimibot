import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { AgentLoop, MemoryStore, SkillsLoader, SubagentManager } from "./agent/index.js";
import { ExecTool } from "./agent/tools/cmd.js";
import { ReadFileTool } from "./agent/tools/FileTool.js";
import { ToolRegistry } from "./agent/tools/registry.js";
import { MessageBus } from "./bus/queue.js";
import {
  ChannelManager,
  CliChannel,
  type ChannelFactories,
  type CliChannelRuntimeOptions,
} from "./channels/index.js";
import { loadConfig, parseConfig, type Config } from "./config/index.js";
import { CronService } from "./cron/index.js";
import { MockProvider, OpenAIProvider, type LLMProvider } from "./providers/index.js";
import { SessionManager } from "./session/index.js";

const DEFAULT_CONFIG_FILENAME = "jimibot.config.json";

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

export async function createJimibotApp(
  options: CreateJimibotAppOptions = {},
): Promise<JimibotApp> {
  const baseConfig = await loadRuntimeConfig(options);
  const config = ensureUsableConfig(baseConfig);
  const workspacePath = resolveWorkspacePath(
    options.workspacePath ?? config.agents.defaults.workspace,
  );
  await mkdir(workspacePath, { recursive: true });

  const bus = new MessageBus();
  const provider = options.provider ?? createProviderFromConfig(config);
  const tools = createDefaultTools(config, workspacePath);
  const sessionManager = new SessionManager(workspacePath);
  const memoryStore = new MemoryStore(workspacePath);
  const skillsLoader = new SkillsLoader(
    workspacePath,
    resolveBuiltinSkillsDir(options.builtinSkillsDir),
  );
  const cronService = new CronService({
    bus,
    storePath: path.join(workspacePath, "cron", "jobs.json"),
  });
  const subagentManager = new SubagentManager({
    bus,
    provider,
    workspacePath,
    skillsLoader,
    model: config.agents.defaults.model,
    maxIterations: Math.max(1, Math.floor(config.agents.defaults.maxToolIterations / 2)),
    maxTokens: config.agents.defaults.maxTokens,
    temperature: config.agents.defaults.temperature,
    reasoningEffort: config.agents.defaults.reasoningEffort,
  });
  const loop = new AgentLoop({
    bus,
    provider,
    sessionManager,
    memoryStore,
    skillsLoader,
    subagentManager,
    cronService,
    tools,
    model: config.agents.defaults.model,
    maxIterations: config.agents.defaults.maxToolIterations,
    historyLimit: Math.max(100, config.agents.defaults.memoryWindow * 2),
    memoryWindow: config.agents.defaults.memoryWindow,
    maxTokens: config.agents.defaults.maxTokens,
    temperature: config.agents.defaults.temperature,
    reasoningEffort: config.agents.defaults.reasoningEffort,
  });

  const channelFactories = createChannelFactories(
    options.cliRuntime,
    options.channelFactories,
  );
  const channelManager = new ChannelManager(config, bus, channelFactories);

  let started = false;

  return {
    config,
    workspacePath,
    bus,
    provider,
    tools,
    sessionManager,
    memoryStore,
    skillsLoader,
    subagentManager,
    cronService,
    loop,
    channelManager,
    async start(): Promise<void> {
      if (started) {
        return;
      }

      started = true;
      await cronService.start();
      loop.start();
      await channelManager.startAll();
    },
    async stop(): Promise<void> {
      if (!started) {
        return;
      }

      started = false;
      loop.stop();
      cronService.stop();
      await subagentManager.waitForAll();
      await loop.waitForBackgroundTasks();
      await channelManager.stopAll();
    },
  };
}

export async function runJimibot(
  options: CreateJimibotAppOptions = {},
): Promise<JimibotApp> {
  const app = await createJimibotApp(options);
  await app.start();
  return app;
}

async function loadRuntimeConfig(
  options: CreateJimibotAppOptions,
): Promise<Config> {
  if (options.config !== undefined) {
    return options.config;
  }

  const configPath = options.configPath ?? getDefaultConfigPath();
  if (existsSync(configPath)) {
    return loadConfig(configPath);
  }

  return parseConfig({});
}

function ensureUsableConfig(config: Config): Config {
  const supportedEnabled = config.channels.cli.enabled;
  if (supportedEnabled) {
    return config;
  }

  return {
    ...config,
    channels: {
      ...config.channels,
      cli: {
        ...config.channels.cli,
        enabled: true,
        allowFrom:
          config.channels.cli.allowFrom.length > 0
            ? [...config.channels.cli.allowFrom]
            : ["*"],
      },
    },
  };
}

function createProviderFromConfig(config: Config): LLMProvider {
  const providerName = config.agents.defaults.provider.toLowerCase();
  const model = config.agents.defaults.model;

  if (providerName === "mock" || model.toLowerCase().includes("mock")) {
    return new MockProvider({
      defaultModel: model,
    });
  }

  if (providerName === "openai" || providerName === "auto") {
    const providerOptions = {
      defaultModel: model,
    } as {
      defaultModel: string;
      apiKey?: string;
      apiBase?: string;
    };

    if (process.env.OPENAI_API_KEY !== undefined) {
      providerOptions.apiKey = process.env.OPENAI_API_KEY;
    }
    if (process.env.OPENAI_API_BASE !== undefined) {
      providerOptions.apiBase = process.env.OPENAI_API_BASE;
    }

    return new OpenAIProvider(providerOptions);
  }

  throw new Error(`Unsupported provider for Mission 15 bootstrap: ${providerName}`);
}

function createDefaultTools(config: Config, workspacePath: string): ToolRegistry {
  const tools = new ToolRegistry();
  tools.register(new ReadFileTool());
  tools.register(
    new ExecTool({
      workingDir: workspacePath,
      timeoutSeconds: config.tools.exec.timeout,
    }),
  );
  return tools;
}

function createChannelFactories(
  cliRuntime: CliChannelRuntimeOptions | undefined,
  overrides: ChannelFactories | undefined,
): ChannelFactories {
  return {
    cli: (channelConfig, bus) => new CliChannel(channelConfig, bus, cliRuntime),
    ...(overrides ?? {}),
  };
}

function resolveWorkspacePath(workspacePath: string): string {
  if (workspacePath === "~") {
    return homedir();
  }
  if (workspacePath.startsWith("~/")) {
    return path.join(homedir(), workspacePath.slice(2));
  }

  return path.resolve(workspacePath);
}

function resolveBuiltinSkillsDir(override?: string): string {
  if (override !== undefined) {
    return override;
  }

  const repoSkillsDir = path.resolve(process.cwd(), "..", "nanobot", "nanobot", "skills");
  if (existsSync(repoSkillsDir)) {
    return repoSkillsDir;
  }

  return path.resolve(process.cwd(), "skills");
}

function getDefaultConfigPath(): string {
  return process.env.NANOBOT_CONFIG_PATH
    ? path.resolve(process.env.NANOBOT_CONFIG_PATH)
    : path.resolve(process.cwd(), DEFAULT_CONFIG_FILENAME);
}

function installSignalHandlers(app: JimibotApp): void {
  let stopping = false;
  const stop = async (signal: string) => {
    if (stopping) {
      return;
    }

    stopping = true;
    console.log(`\nReceived ${signal}, shutting down...`);
    try {
      await app.stop();
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", () => {
    void stop("SIGINT");
  });
  process.on("SIGTERM", () => {
    void stop("SIGTERM");
  });
}

async function main(): Promise<void> {
  const configPathArg = process.argv[2];
  const runOptions = {} as {
    configPath?: string;
  };
  if (configPathArg !== undefined) {
    runOptions.configPath = configPathArg;
  }

  const app = await runJimibot(runOptions);

  installSignalHandlers(app);

  console.log("Jimibot starting...");
  console.log(`Workspace: ${app.workspacePath}`);
  console.log(`Model: ${app.config.agents.defaults.model}`);
  console.log(
    `Channels: ${app.channelManager.enabledChannels.join(", ") || "(none)"}`,
  );
}

function isMainModule(): boolean {
  const entryPath = process.argv[1];
  if (entryPath === undefined) {
    return false;
  }

  return import.meta.url === pathToFileURL(entryPath).toString();
}

if (isMainModule()) {
  void main().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(`Failed to start Jimibot: ${message}`);
    process.exitCode = 1;
  });
}
