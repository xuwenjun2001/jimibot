import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { createInboundMessage, createOutboundMessage, getSessionKey, } from "../bus/events.js";
import { createAssistantSessionMessage, createToolSessionMessage, createUserSessionMessageFromInbound, } from "./adapters.js";
import { SessionManager } from "./manager.js";
const workspacePath = path.join(process.cwd(), "tmp", "session-flow-tests");
await rm(workspacePath, { recursive: true, force: true });
const manager = new SessionManager(workspacePath);
const firstInbound = createInboundMessage({
    channel: "telegram",
    senderId: "user-1",
    chatId: "chat-99",
    content: "请帮我列出当前目录",
    timestamp: new Date("2026-03-13T12:00:00.000Z"),
});
const sessionKey = getSessionKey(firstInbound);
assert.equal(sessionKey, "telegram:chat-99");
const beforeFirstTurn = await manager.getHistory(sessionKey);
assert.deepEqual(beforeFirstTurn, []);
const firstUserMessage = createUserSessionMessageFromInbound(firstInbound);
await manager.append(sessionKey, firstUserMessage);
const toolMessage = createToolSessionMessage({
    name: "exec",
    content: "README.md\nsrc\npackage.json",
    toolCallId: "call_1",
    timestamp: "2026-03-13T12:00:01.000Z",
});
await manager.append(sessionKey, toolMessage);
const outbound = createOutboundMessage({
    channel: "telegram",
    chatId: "chat-99",
    content: "当前目录里有 README.md、src、package.json。",
});
const assistantMessage = createAssistantSessionMessage(outbound.content, "2026-03-13T12:00:02.000Z");
await manager.append(sessionKey, assistantMessage);
const secondInbound = createInboundMessage({
    channel: "telegram",
    senderId: "user-1",
    chatId: "chat-99",
    content: "那 src 下面有什么？",
    timestamp: new Date("2026-03-13T12:01:00.000Z"),
});
const beforeSecondTurn = await manager.getHistory(getSessionKey(secondInbound));
assert.deepEqual(beforeSecondTurn, [
    {
        role: "user",
        content: "请帮我列出当前目录",
        timestamp: "2026-03-13T12:00:00.000Z",
    },
    {
        role: "tool",
        content: "README.md\nsrc\npackage.json",
        timestamp: "2026-03-13T12:00:01.000Z",
        tool_call_id: "call_1",
        name: "exec",
    },
    {
        role: "assistant",
        content: "当前目录里有 README.md、src、package.json。",
        timestamp: "2026-03-13T12:00:02.000Z",
    },
]);
const anotherChatMessage = createInboundMessage({
    channel: "telegram",
    senderId: "user-1",
    chatId: "chat-100",
    content: "这是另一个会话",
});
const anotherChatHistory = await manager.getHistory(getSessionKey(anotherChatMessage));
assert.deepEqual(anotherChatHistory, []);
console.log("Mission 8 session flow checks passed.");
//# sourceMappingURL=flow.test.js.map