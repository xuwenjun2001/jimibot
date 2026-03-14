import { createReadStream } from "node:fs";
import { appendFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { isSessionMessage, } from "./types.js";
const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001F]/g;
export function getSessionsDir(workspacePath) {
    return path.join(workspacePath, "sessions");
}
export function sessionKeyToFilename(sessionKey) {
    const normalized = sessionKey.trim();
    if (normalized.length === 0) {
        throw new Error("sessionKey must not be empty");
    }
    const safeBaseName = normalized
        .replaceAll(":", "__")
        .replace(INVALID_FILENAME_CHARS, "_");
    return `${safeBaseName}.jsonl`;
}
export function getSessionFilePath(workspacePath, sessionKey) {
    return path.join(getSessionsDir(workspacePath), sessionKeyToFilename(sessionKey));
}
export function getSessionStateFilePath(workspacePath, sessionKey) {
    const sessionFilePath = getSessionFilePath(workspacePath, sessionKey);
    return `${sessionFilePath}.state.json`;
}
export async function ensureSessionsDir(workspacePath) {
    const sessionsDir = getSessionsDir(workspacePath);
    await mkdir(sessionsDir, { recursive: true });
    return sessionsDir;
}
export async function appendSessionMessage(workspacePath, sessionKey, message) {
    if (!isSessionMessage(message)) {
        throw new Error("Invalid session message");
    }
    const filePath = getSessionFilePath(workspacePath, sessionKey);
    await ensureSessionsDir(workspacePath);
    await appendFile(filePath, `${JSON.stringify(message)}\n`, "utf-8");
    return filePath;
}
export async function writeSessionMessages(workspacePath, sessionKey, messages) {
    const filePath = getSessionFilePath(workspacePath, sessionKey);
    await ensureSessionsDir(workspacePath);
    for (const message of messages) {
        if (!isSessionMessage(message)) {
            throw new Error("Invalid session message");
        }
    }
    const content = messages.length === 0
        ? ""
        : `${messages.map((message) => JSON.stringify(message)).join("\n")}\n`;
    await writeFile(filePath, content, "utf-8");
    return filePath;
}
export async function readSessionMessages(workspacePath, sessionKey) {
    const filePath = getSessionFilePath(workspacePath, sessionKey);
    try {
        await stat(filePath);
    }
    catch {
        return [];
    }
    const input = createReadStream(filePath, { encoding: "utf-8" });
    const lines = readline.createInterface({
        input,
        crlfDelay: Infinity,
    });
    const messages = [];
    try {
        for await (const rawLine of lines) {
            const line = rawLine.trim();
            if (line.length === 0) {
                continue;
            }
            let parsed;
            try {
                parsed = JSON.parse(line);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : "Unknown JSON parse error";
                throw new Error(`Invalid JSONL in session file ${filePath}: ${message}`);
            }
            if (!isSessionMessage(parsed)) {
                throw new Error(`Invalid session message record in ${filePath}`);
            }
            messages.push(parsed);
        }
    }
    finally {
        lines.close();
        input.close();
    }
    return messages;
}
export async function writeSessionState(workspacePath, session) {
    const filePath = getSessionStateFilePath(workspacePath, session.sessionKey);
    await ensureSessionsDir(workspacePath);
    const payload = {
        sessionKey: session.sessionKey,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        lastConsolidated: session.lastConsolidated,
        metadata: session.metadata,
    };
    await writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");
    return filePath;
}
export async function readSessionState(workspacePath, sessionKey) {
    const filePath = getSessionStateFilePath(workspacePath, sessionKey);
    try {
        await stat(filePath);
    }
    catch {
        return null;
    }
    let parsed;
    try {
        const raw = await readFile(filePath, "utf-8");
        parsed = JSON.parse(raw);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown JSON parse error";
        throw new Error(`Invalid session state file ${filePath}: ${message}`);
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`Invalid session state record in ${filePath}`);
    }
    const state = parsed;
    const output = {};
    if (typeof state.createdAt === "string") {
        output.createdAt = state.createdAt;
    }
    if (typeof state.updatedAt === "string") {
        output.updatedAt = state.updatedAt;
    }
    if (typeof state.lastConsolidated === "number") {
        output.lastConsolidated = state.lastConsolidated;
    }
    if (state.metadata !== null &&
        typeof state.metadata === "object" &&
        !Array.isArray(state.metadata)) {
        output.metadata = state.metadata;
    }
    return output;
}
//# sourceMappingURL=jsonl.js.map