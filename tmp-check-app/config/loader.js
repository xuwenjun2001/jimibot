import { readFile } from "node:fs/promises";
import { z } from "zod";
import { ConfigSchema } from "./schema.js";
const KEY_MAP = {
    allow_from: "allowFrom",
    assistant_prefix: "assistantPrefix",
    chat_id: "chatId",
    exit_commands: "exitCommands",
    max_tokens: "maxTokens",
    max_tool_iterations: "maxToolIterations",
    memory_window: "memoryWindow",
    path_append: "pathAppend",
    reasoning_effort: "reasoningEffort",
    sender_id: "senderId",
};
function normalizeKeys(value) {
    if (Array.isArray(value)) {
        return value.map(normalizeKeys);
    }
    if (value === null || typeof value !== "object") {
        return value;
    }
    const result = {};
    for (const [key, entry] of Object.entries(value)) {
        const normalizedKey = KEY_MAP[key] ?? key;
        result[normalizedKey] = normalizeKeys(entry);
    }
    return result;
}
export function normalizeConfigInput(input) {
    return normalizeKeys(input);
}
export function parseConfig(input) {
    // External config may arrive in snake_case, but the rest of the TS codebase
    // stays on camelCase. Normalize once at the boundary, then parse normally.
    const normalized = normalizeConfigInput(input);
    return ConfigSchema.parse(normalized);
}
export async function loadConfig(path) {
    // File loading is kept separate from parseConfig() so tests can validate
    // normalization and schema parsing without touching the filesystem.
    const content = await readFile(path, "utf-8");
    let raw;
    try {
        raw = JSON.parse(content);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid JSON in config file: ${message}`);
    }
    try {
        return parseConfig(raw);
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            throw new Error(`Invalid config:\n${z.prettifyError(error)}`);
        }
        throw error;
    }
}
//# sourceMappingURL=loader.js.map