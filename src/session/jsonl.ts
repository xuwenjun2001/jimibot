import { createReadStream } from "node:fs";
import { appendFile, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

import {
  isSessionMessage,
  type SessionMessage,
} from "./types.js";

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001F]/g;

export function getSessionsDir(workspacePath: string): string {
  return path.join(workspacePath, "sessions");
}

export function sessionKeyToFilename(sessionKey: string): string {
  const normalized = sessionKey.trim();
  if (normalized.length === 0) {
    throw new Error("sessionKey must not be empty");
  }

  const safeBaseName = normalized
    .replaceAll(":", "__")
    .replace(INVALID_FILENAME_CHARS, "_");

  return `${safeBaseName}.jsonl`;
}

export function getSessionFilePath(
  workspacePath: string,
  sessionKey: string,
): string {
  return path.join(getSessionsDir(workspacePath), sessionKeyToFilename(sessionKey));
}

export async function ensureSessionsDir(workspacePath: string): Promise<string> {
  const sessionsDir = getSessionsDir(workspacePath);
  await mkdir(sessionsDir, { recursive: true });
  return sessionsDir;
}

export async function appendSessionMessage(
  workspacePath: string,
  sessionKey: string,
  message: SessionMessage,
): Promise<string> {
  if (!isSessionMessage(message)) {
    throw new Error("Invalid session message");
  }

  const filePath = getSessionFilePath(workspacePath, sessionKey);
  await ensureSessionsDir(workspacePath);
  await appendFile(filePath, `${JSON.stringify(message)}\n`, "utf-8");
  return filePath;
}

export async function writeSessionMessages(
  workspacePath: string,
  sessionKey: string,
  messages: SessionMessage[],
): Promise<string> {
  const filePath = getSessionFilePath(workspacePath, sessionKey);
  await ensureSessionsDir(workspacePath);

  for (const message of messages) {
    if (!isSessionMessage(message)) {
      throw new Error("Invalid session message");
    }
  }

  const content =
    messages.length === 0
      ? ""
      : `${messages.map((message) => JSON.stringify(message)).join("\n")}\n`;
  await writeFile(filePath, content, "utf-8");
  return filePath;
}

export async function readSessionMessages(
  workspacePath: string,
  sessionKey: string,
): Promise<SessionMessage[]> {
  const filePath = getSessionFilePath(workspacePath, sessionKey);

  try {
    await stat(filePath);
  } catch {
    return [];
  }

  const input = createReadStream(filePath, { encoding: "utf-8" });
  const lines = readline.createInterface({
    input,
    crlfDelay: Infinity,
  });

  const messages: SessionMessage[] = [];

  try {
    for await (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.length === 0) {
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(line) as unknown;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown JSON parse error";
        throw new Error(`Invalid JSONL in session file ${filePath}: ${message}`);
      }

      if (!isSessionMessage(parsed)) {
        throw new Error(`Invalid session message record in ${filePath}`);
      }

      messages.push(parsed);
    }
  } finally {
    lines.close();
    input.close();
  }

  return messages;
}
