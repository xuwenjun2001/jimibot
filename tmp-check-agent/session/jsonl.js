import { createReadStream } from "node:fs";
import { appendFile, mkdir, stat, writeFile } from "node:fs/promises";
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
//# sourceMappingURL=jsonl.js.map