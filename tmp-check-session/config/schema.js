import { z } from "zod";
// Channel configs use field-level defaults so an omitted config block can still
// resolve to a usable internal shape after prefault({}) feeds in an empty object.
export const TelegramConfigSchema = z.object({
    enabled: z.boolean().default(false),
    token: z.string().default(""),
    allowFrom: z.array(z.string()).default([]),
});
export const AgentDefaultsSchema = z.object({
    workspace: z.string().default("~/.nanobot/workspace"),
    model: z.string().default("anthropic/claude-opus-4-5"),
    provider: z.string().default("auto"),
    maxTokens: z.number().int().positive().default(8192),
    temperature: z.number().min(0).max(2).default(0.1),
    maxToolIterations: z.number().int().positive().default(40),
    memoryWindow: z.number().int().nonnegative().default(100),
    reasoningEffort: z.string().nullable().default(null),
});
export const ExecToolConfigSchema = z.object({
    timeout: z.number().int().positive().default(60),
    pathAppend: z.string().default(""),
});
export const AgentsConfigSchema = z.object({
    defaults: AgentDefaultsSchema.prefault({}),
});
export const ChannelsConfigSchema = z.object({
    telegram: TelegramConfigSchema.prefault({}),
});
export const ToolsConfigSchema = z.object({
    exec: ExecToolConfigSchema.prefault({}),
});
export const ConfigSchema = z.object({
    // prefault({}) keeps nested defaults alive; default({}) would short-circuit
    // object parsing and skip the inner field defaults we rely on.
    agents: AgentsConfigSchema.prefault({}),
    channels: ChannelsConfigSchema.prefault({}),
    tools: ToolsConfigSchema.prefault({}),
});
//# sourceMappingURL=schema.js.map