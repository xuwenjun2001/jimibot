import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { createInboundMessage } from "../bus/events.js";
import { MessageBus } from "../bus/queue.js";
import { MockProvider } from "../providers/mock.js";
import { MemoryStore } from "./memory.js";
import { SessionManager } from "../session/manager.js";
import { AgentLoop } from "./loop.js";
import { Tool } from "./tools/base.js";
import { ToolRegistry } from "./tools/registry.js";
class EchoTool extends Tool {
    get name() {
        return "echo";
    }
    get description() {
        return "Echo input text.";
    }
    get parameters() {
        return {
            type: "object",
            properties: {
                text: {
                    type: "string",
                },
            },
            required: ["text"],
        };
    }
    async execute(params) {
        return String(params.text ?? "");
    }
}
class FailingTool extends Tool {
    get name() {
        return "explode";
    }
    get description() {
        return "Always throws.";
    }
    get parameters() {
        return {
            type: "object",
            properties: {},
            required: [],
        };
    }
    async execute() {
        throw new Error("tool failed");
    }
}
async function createLoopHarness(subdir) {
    const workspacePath = path.join(process.cwd(), "tmp", subdir);
    await rm(workspacePath, { recursive: true, force: true });
    return {
        workspacePath,
        bus: new MessageBus(),
        sessionManager: new SessionManager(workspacePath),
    };
}
{
    const { bus, sessionManager } = await createLoopHarness("agent-loop-basic");
    const provider = new MockProvider({
        defaultModel: "mock-gpt",
        responses: [
            { content: "你好，我已经记住你的第一句话。" },
            { content: "你上一句是：你好，先认识一下你自己。" },
        ],
    });
    const loop = new AgentLoop({
        bus,
        provider,
        sessionManager,
    });
    loop.start();
    const firstOutbound = new Promise((resolve) => {
        bus.onOutbound(async (message) => {
            resolve(message.content);
        });
    });
    bus.publishInbound(createInboundMessage({
        channel: "telegram",
        senderId: "user-1",
        chatId: "chat-1",
        content: "你好，先认识一下你自己。",
    }));
    assert.equal(await firstOutbound, "你好，我已经记住你的第一句话。");
    assert.equal(provider.requests.length, 1);
    assert.deepEqual(provider.requests[0]?.messages, [
        {
            role: "user",
            content: "你好，先认识一下你自己。",
        },
    ]);
    const secondOutbound = new Promise((resolve) => {
        bus.onOutbound(async (message) => {
            if (message.content.includes("你上一句是")) {
                resolve(message.content);
            }
        });
    });
    bus.publishInbound(createInboundMessage({
        channel: "telegram",
        senderId: "user-1",
        chatId: "chat-1",
        content: "我上一句说了什么？",
    }));
    assert.equal(await secondOutbound, "你上一句是：你好，先认识一下你自己。");
    assert.equal(provider.requests.length, 2);
    assert.deepEqual(provider.requests[1]?.messages, [
        {
            role: "user",
            content: "你好，先认识一下你自己。",
        },
        {
            role: "assistant",
            content: "你好，我已经记住你的第一句话。",
        },
        {
            role: "user",
            content: "我上一句说了什么？",
        },
    ]);
    const storedHistory = await sessionManager.getHistory("telegram:chat-1");
    assert.deepEqual(storedHistory.map((message) => message.role), [
        "user",
        "assistant",
        "user",
        "assistant",
    ]);
}
{
    const { sessionManager } = await createLoopHarness("agent-loop-tools");
    const provider = new MockProvider({
        responses: [
            {
                content: null,
                toolCalls: [
                    {
                        id: "call_1",
                        name: "echo",
                        arguments: { text: "hello from tool" },
                    },
                ],
                finishReason: "tool_calls",
            },
            {
                content: "工具已经返回：hello from tool",
            },
        ],
    });
    const tools = new ToolRegistry();
    tools.register(new EchoTool());
    const loop = new AgentLoop({
        bus: new MessageBus(),
        provider,
        sessionManager,
        tools,
    });
    const outbound = await loop.processInboundMessage(createInboundMessage({
        channel: "telegram",
        senderId: "user-1",
        chatId: "chat-2",
        content: "请调用 echo 工具",
    }));
    assert.equal(outbound.content, "工具已经返回：hello from tool");
    assert.equal(provider.requests.length, 2);
    assert.equal(provider.requests[1]?.messages[1]?.role, "assistant");
    assert.equal(provider.requests[1]?.messages[1]?.content, null);
    assert.equal(provider.requests[1]?.messages[2]?.role, "tool");
    assert.equal(provider.requests[1]?.messages[2]?.content, "hello from tool");
    const history = await sessionManager.getHistory("telegram:chat-2");
    assert.deepEqual(history.map((message) => message.role), [
        "user",
        "assistant",
        "tool",
        "assistant",
    ]);
}
{
    const { sessionManager } = await createLoopHarness("agent-loop-tool-errors");
    const provider = new MockProvider({
        responses: [
            {
                content: null,
                toolCalls: [
                    {
                        id: "call_1",
                        name: "explode",
                        arguments: {},
                    },
                ],
                finishReason: "tool_calls",
            },
            {
                content: "我已经收到工具报错，并改为直接回复你。",
            },
        ],
    });
    const tools = new ToolRegistry();
    tools.register(new FailingTool());
    const loop = new AgentLoop({
        bus: new MessageBus(),
        provider,
        sessionManager,
        tools,
    });
    const outbound = await loop.processInboundMessage(createInboundMessage({
        channel: "telegram",
        senderId: "user-1",
        chatId: "chat-3",
        content: "请试试会失败的工具",
    }));
    assert.equal(outbound.content, "我已经收到工具报错，并改为直接回复你。");
    assert.equal(provider.requests[1]?.messages[2]?.content, "Error: tool failed");
}
{
    const { sessionManager } = await createLoopHarness("agent-loop-max-iterations");
    const provider = new MockProvider({
        responses: [
            {
                content: null,
                toolCalls: [
                    {
                        id: "call_1",
                        name: "echo",
                        arguments: { text: "loop-1" },
                    },
                ],
                finishReason: "tool_calls",
            },
            {
                content: null,
                toolCalls: [
                    {
                        id: "call_2",
                        name: "echo",
                        arguments: { text: "loop-2" },
                    },
                ],
                finishReason: "tool_calls",
            },
            {
                content: "this response should never be reached",
            },
        ],
    });
    const tools = new ToolRegistry();
    tools.register(new EchoTool());
    const loop = new AgentLoop({
        bus: new MessageBus(),
        provider,
        sessionManager,
        tools,
        maxIterations: 2,
    });
    const outbound = await loop.processInboundMessage(createInboundMessage({
        channel: "telegram",
        senderId: "user-1",
        chatId: "chat-4",
        content: "陷入循环吧",
    }));
    assert.equal(outbound.content, "I reached the maximum number of tool call iterations (2) without completing the task.");
    assert.equal(provider.requests.length, 2);
}
{
    const { workspacePath, sessionManager } = await createLoopHarness("agent-loop-memory-context");
    const memoryStore = new MemoryStore(workspacePath);
    await memoryStore.saveMemory("# Long-term Memory\n- User prefers code examples.");
    const provider = new MockProvider({
        responses: [{ content: "我会继续给你代码例子。" }],
    });
    const loop = new AgentLoop({
        bus: new MessageBus(),
        provider,
        sessionManager,
        memoryStore,
    });
    const outbound = await loop.processInboundMessage(createInboundMessage({
        channel: "telegram",
        senderId: "user-1",
        chatId: "chat-5",
        content: "继续讲解 mission10",
    }));
    assert.equal(outbound.content, "我会继续给你代码例子。");
    assert.equal(provider.requests[0]?.messages[0]?.role, "system");
    assert.match(String(provider.requests[0]?.messages[0]?.content ?? ""), /User prefers code examples\./);
}
{
    const { workspacePath, sessionManager } = await createLoopHarness("agent-loop-memory-background");
    const memoryStore = new MemoryStore(workspacePath);
    const provider = new MockProvider({
        responses: [
            {
                content: "这是本轮正常回复。",
            },
            {
                content: null,
                toolCalls: [
                    {
                        id: "memory_call_1",
                        name: "save_memory",
                        arguments: {
                            history_entry: "[2026-03-14 10:00] User asked for Mission 10 explanation and wants code examples.",
                            memory_update: "# Long-term Memory\n- User wants code-based explanations for each mission.",
                        },
                    },
                ],
                finishReason: "tool_calls",
            },
        ],
    });
    const loop = new AgentLoop({
        bus: new MessageBus(),
        provider,
        sessionManager,
        memoryStore,
        memoryWindow: 2,
    });
    const outbound = await loop.processInboundMessage(createInboundMessage({
        channel: "telegram",
        senderId: "user-1",
        chatId: "chat-6",
        content: "开始讲 mission10",
        timestamp: new Date("2026-03-14T10:00:00.000Z"),
    }));
    assert.equal(outbound.content, "这是本轮正常回复。");
    await loop.waitForBackgroundTasks();
    assert.match(await memoryStore.loadMemory(), /User wants code-based explanations for each mission\./);
    assert.match(await memoryStore.loadHistory(), /\[2026-03-14 10:00\] User asked for Mission 10 explanation and wants code examples\./);
    const reloadedManager = new SessionManager(workspacePath);
    const reloadedSession = await reloadedManager.getSession("telegram:chat-6");
    assert.equal(reloadedSession.lastConsolidated, 1);
}
console.log("Mission 9 agent loop checks passed.");
//# sourceMappingURL=loop.test.js.map