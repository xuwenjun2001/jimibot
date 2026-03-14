import { z } from "zod";

// Channel configs use field-level defaults so an omitted config block can still
// resolve to a usable internal shape after prefault({}) feeds in an empty object.
export const TelegramConfigSchema = z.object({
  enabled: z.boolean().default(false),
  token: z.string().default(""),
  allowFrom: z.array(z.string()).default([]),
});

export type TelegramConfig = z.infer<typeof TelegramConfigSchema>;

export const CliConfigSchema = z.object({
  enabled: z.boolean().default(false),
  allowFrom: z.array(z.string()).default(["*"]),
  senderId: z.string().default("cli-user"),
  chatId: z.string().default("direct"),
  prompt: z.string().default(""),
  assistantPrefix: z.string().default("AI: "),
  exitCommands: z
    .array(z.string())
    .default(["exit", "quit", "/exit", "/quit"]),
});

export type CliConfig = z.infer<typeof CliConfigSchema>;

export const AgentDefaultsSchema = z.object({
  workspace: z.string().default("~/.jimibot/workspace"),
  model: z.string().default("anthropic/claude-opus-4-5"),
  provider: z.string().default("auto"),
  maxTokens: z.number().int().positive().default(8192),
  temperature: z.number().min(0).max(2).default(0.1),
  maxToolIterations: z.number().int().positive().default(40),
  memoryWindow: z.number().int().nonnegative().default(100),
  reasoningEffort: z.string().nullable().default(null),
});

export type AgentDefaults = z.infer<typeof AgentDefaultsSchema>;

export const ExecToolConfigSchema = z.object({
  timeout: z.number().int().positive().default(60),
  pathAppend: z.string().default(""),
});

export type ExecToolConfig = z.infer<typeof ExecToolConfigSchema>;

export const AgentsConfigSchema = z.object({
  defaults: AgentDefaultsSchema.prefault({}),
});

export type AgentsConfig = z.infer<typeof AgentsConfigSchema>;

export const ChannelsConfigSchema = z.object({
  cli: CliConfigSchema.prefault({}),
  telegram: TelegramConfigSchema.prefault({}),
});

export type ChannelsConfig = z.infer<typeof ChannelsConfigSchema>;

export const ToolsConfigSchema = z.object({
  exec: ExecToolConfigSchema.prefault({}),
});

export type ToolsConfig = z.infer<typeof ToolsConfigSchema>;

export const ConfigSchema = z.object({
  // prefault({}) keeps nested defaults alive; default({}) would short-circuit
  // object parsing and skip the inner field defaults we rely on.
  agents: AgentsConfigSchema.prefault({}),
  channels: ChannelsConfigSchema.prefault({}),
  tools: ToolsConfigSchema.prefault({}),
});

export type Config = z.infer<typeof ConfigSchema>;
