import { z } from "zod";
export declare const TelegramConfigSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    token: z.ZodDefault<z.ZodString>;
    allowFrom: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type TelegramConfig = z.infer<typeof TelegramConfigSchema>;
export declare const AgentDefaultsSchema: z.ZodObject<{
    workspace: z.ZodDefault<z.ZodString>;
    model: z.ZodDefault<z.ZodString>;
    provider: z.ZodDefault<z.ZodString>;
    maxTokens: z.ZodDefault<z.ZodNumber>;
    temperature: z.ZodDefault<z.ZodNumber>;
    maxToolIterations: z.ZodDefault<z.ZodNumber>;
    memoryWindow: z.ZodDefault<z.ZodNumber>;
    reasoningEffort: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type AgentDefaults = z.infer<typeof AgentDefaultsSchema>;
export declare const ExecToolConfigSchema: z.ZodObject<{
    timeout: z.ZodDefault<z.ZodNumber>;
    pathAppend: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export type ExecToolConfig = z.infer<typeof ExecToolConfigSchema>;
export declare const AgentsConfigSchema: z.ZodObject<{
    defaults: z.ZodPrefault<z.ZodObject<{
        workspace: z.ZodDefault<z.ZodString>;
        model: z.ZodDefault<z.ZodString>;
        provider: z.ZodDefault<z.ZodString>;
        maxTokens: z.ZodDefault<z.ZodNumber>;
        temperature: z.ZodDefault<z.ZodNumber>;
        maxToolIterations: z.ZodDefault<z.ZodNumber>;
        memoryWindow: z.ZodDefault<z.ZodNumber>;
        reasoningEffort: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type AgentsConfig = z.infer<typeof AgentsConfigSchema>;
export declare const ChannelsConfigSchema: z.ZodObject<{
    telegram: z.ZodPrefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        token: z.ZodDefault<z.ZodString>;
        allowFrom: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ChannelsConfig = z.infer<typeof ChannelsConfigSchema>;
export declare const ToolsConfigSchema: z.ZodObject<{
    exec: z.ZodPrefault<z.ZodObject<{
        timeout: z.ZodDefault<z.ZodNumber>;
        pathAppend: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ToolsConfig = z.infer<typeof ToolsConfigSchema>;
export declare const ConfigSchema: z.ZodObject<{
    agents: z.ZodPrefault<z.ZodObject<{
        defaults: z.ZodPrefault<z.ZodObject<{
            workspace: z.ZodDefault<z.ZodString>;
            model: z.ZodDefault<z.ZodString>;
            provider: z.ZodDefault<z.ZodString>;
            maxTokens: z.ZodDefault<z.ZodNumber>;
            temperature: z.ZodDefault<z.ZodNumber>;
            maxToolIterations: z.ZodDefault<z.ZodNumber>;
            memoryWindow: z.ZodDefault<z.ZodNumber>;
            reasoningEffort: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    channels: z.ZodPrefault<z.ZodObject<{
        telegram: z.ZodPrefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            token: z.ZodDefault<z.ZodString>;
            allowFrom: z.ZodDefault<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    tools: z.ZodPrefault<z.ZodObject<{
        exec: z.ZodPrefault<z.ZodObject<{
            timeout: z.ZodDefault<z.ZodNumber>;
            pathAppend: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type Config = z.infer<typeof ConfigSchema>;
//# sourceMappingURL=schema.d.ts.map