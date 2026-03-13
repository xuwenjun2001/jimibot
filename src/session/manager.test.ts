import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { SessionManager } from "./manager.js";

const workspacePath = path.join(process.cwd(), "tmp", "session-manager-tests");

await rm(workspacePath, { recursive: true, force: true });

const manager = new SessionManager(workspacePath);

const emptyHistory = await manager.getHistory("telegram:chat-1");
assert.deepEqual(emptyHistory, []);

const firstUserMessage = await manager.append("telegram:chat-1", {
  role: "user",
  content: "hello",
  timestamp: "2026-03-13T10:00:00.000Z",
});

assert.equal(firstUserMessage.role, "user");
assert.equal(firstUserMessage.content, "hello");

await manager.append("telegram:chat-1", {
  role: "assistant",
  content: "hi there",
  timestamp: "2026-03-13T10:00:01.000Z",
});

await manager.append("telegram:chat-2", {
  role: "user",
  content: "another session",
  timestamp: "2026-03-13T10:00:02.000Z",
});

const chat1History = await manager.getHistory("telegram:chat-1");
assert.deepEqual(chat1History, [
  {
    role: "user",
    content: "hello",
    timestamp: "2026-03-13T10:00:00.000Z",
  },
  {
    role: "assistant",
    content: "hi there",
    timestamp: "2026-03-13T10:00:01.000Z",
  },
]);

const limitedHistory = await manager.getHistory("telegram:chat-1", 1);
assert.deepEqual(limitedHistory, [
  {
    role: "assistant",
    content: "hi there",
    timestamp: "2026-03-13T10:00:01.000Z",
  },
]);

const chat2History = await manager.getHistory("telegram:chat-2");
assert.deepEqual(chat2History, [
  {
    role: "user",
    content: "another session",
    timestamp: "2026-03-13T10:00:02.000Z",
  },
]);

const cachedSessionA = await manager.getSession("telegram:chat-1");
const cachedSessionB = await manager.getSession("telegram:chat-1");
assert.equal(cachedSessionA, cachedSessionB);

const reloadedManager = new SessionManager(workspacePath);
const reloadedHistory = await reloadedManager.getHistory("telegram:chat-1");
assert.deepEqual(reloadedHistory, chat1History);

const loadedSession = await reloadedManager.getSession("telegram:chat-1");
assert.equal(loadedSession.sessionKey, "telegram:chat-1");
assert.equal(loadedSession.createdAt, "2026-03-13T10:00:00.000Z");
assert.equal(loadedSession.updatedAt, "2026-03-13T10:00:01.000Z");
assert.equal(loadedSession.lastConsolidated, 0);

console.log("Mission 8 session manager checks passed.");
