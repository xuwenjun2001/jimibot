import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { createInboundMessage, getSessionKey } from "../bus/events.js";
import { appendSessionMessage, getSessionFilePath, readSessionMessages, writeSessionMessages, } from "./jsonl.js";
import { createSession, createSessionMessage } from "./types.js";
const workspacePath = path.join(process.cwd(), "tmp", "session-tests");
await rm(workspacePath, { recursive: true, force: true });
const inbound = createInboundMessage({
    channel: "telegram",
    senderId: "user-1",
    chatId: "chat-1",
    content: "hello",
});
assert.equal(getSessionKey(inbound), "telegram:chat-1");
const threadedInbound = createInboundMessage({
    channel: "telegram",
    senderId: "user-1",
    chatId: "chat-1",
    content: "hello in thread",
    sessionKeyOverride: "telegram:chat-1:thread-7",
});
assert.equal(getSessionKey(threadedInbound), "telegram:chat-1:thread-7");
const session = createSession({
    sessionKey: getSessionKey(inbound),
});
assert.equal(session.sessionKey, "telegram:chat-1");
assert.equal(session.lastConsolidated, 0);
assert.deepEqual(session.metadata, {});
assert.deepEqual(session.messages, []);
assert.equal(typeof session.createdAt, "string");
assert.equal(typeof session.updatedAt, "string");
const userMessage = createSessionMessage({
    role: "user",
    content: "hello",
});
assert.equal(userMessage.role, "user");
assert.equal(typeof userMessage.timestamp, "string");
await appendSessionMessage(workspacePath, session.sessionKey, userMessage);
const assistantMessage = createSessionMessage({
    role: "assistant",
    content: "hi there",
});
await appendSessionMessage(workspacePath, session.sessionKey, assistantMessage);
const filePath = getSessionFilePath(workspacePath, session.sessionKey);
assert.equal(path.extname(filePath), ".jsonl");
const loadedMessages = await readSessionMessages(workspacePath, session.sessionKey);
assert.deepEqual(loadedMessages, [userMessage, assistantMessage]);
const toolMessage = createSessionMessage({
    role: "tool",
    content: "tool result",
    tool_call_id: "call_1",
    name: "echo",
});
await writeSessionMessages(workspacePath, session.sessionKey, [
    userMessage,
    toolMessage,
]);
const rewrittenMessages = await readSessionMessages(workspacePath, session.sessionKey);
assert.deepEqual(rewrittenMessages, [userMessage, toolMessage]);
const missingMessages = await readSessionMessages(workspacePath, "telegram:missing-chat");
assert.deepEqual(missingMessages, []);
console.log("Mission 8 session JSONL checks passed.");
//# sourceMappingURL=jsonl.test.js.map