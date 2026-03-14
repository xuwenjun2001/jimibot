import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { MockProvider } from "../providers/mock.js";
import { SessionManager } from "../session/manager.js";
import { MemoryStore } from "./memory.js";

const workspacePath = path.join(process.cwd(), "tmp", "memory-store-tests");

await rm(workspacePath, { recursive: true, force: true });

const store = new MemoryStore(workspacePath);

assert.equal(await store.loadMemory(), "");
assert.equal(await store.loadHistory(), "");
assert.equal(store.shouldConsolidate(4, 5), false);
assert.equal(store.shouldConsolidate(5, 5), true);

await store.saveMemory("# Long-term Memory\n- User likes TypeScript");
assert.equal(
  await store.loadMemory(),
  "# Long-term Memory\n- User likes TypeScript",
);

await store.appendHistory("Discussed the refactoring roadmap.");
const initialHistory = await store.loadHistory();
assert.match(
  initialHistory,
  /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\] Discussed the refactoring roadmap\.\r?\n$/,
);

const sessionManager = new SessionManager(workspacePath);
await sessionManager.append("telegram:chat-1", {
  role: "user",
  content: "Please remember that I prefer TypeScript examples.",
  timestamp: "2026-03-14T09:00:00.000Z",
});
await sessionManager.append("telegram:chat-1", {
  role: "assistant",
  content: "Understood. I will try to use TypeScript examples.",
  timestamp: "2026-03-14T09:00:01.000Z",
});
await sessionManager.append("telegram:chat-1", {
  role: "user",
  content: "Also note that I am learning jimibot right now.",
  timestamp: "2026-03-14T09:05:00.000Z",
});
await sessionManager.append("telegram:chat-1", {
  role: "assistant",
  content: "Got it. I will explain things in the context of jimibot.",
  timestamp: "2026-03-14T09:05:01.000Z",
});

const session = await sessionManager.getSession("telegram:chat-1");
const provider = new MockProvider({
  responses: [
    {
      content: null,
      toolCalls: [
        {
          id: "memory_call_1",
          name: "save_memory",
          arguments: {
            history_entry:
              "[2026-03-14 09:05] User is learning jimibot and prefers TypeScript examples.",
            memory_update:
              "# Long-term Memory\n- User likes TypeScript examples.\n- User is learning jimibot.",
          },
        },
      ],
      finishReason: "tool_calls",
    },
  ],
});

const consolidated = await store.consolidate(session, provider, "mock-gpt", {
  memoryWindow: 4,
});

assert.equal(consolidated, true);
assert.equal(session.lastConsolidated, 2);
await sessionManager.saveSession(session);

assert.equal(
  await store.loadMemory(),
  "# Long-term Memory\n- User likes TypeScript examples.\n- User is learning jimibot.",
);

const finalHistory = await store.loadHistory();
assert.match(
  finalHistory,
  /\[2026-03-14 09:05\] User is learning jimibot and prefers TypeScript examples\./,
);

const reloadedManager = new SessionManager(workspacePath);
const reloadedSession = await reloadedManager.getSession("telegram:chat-1");
assert.equal(reloadedSession.lastConsolidated, 2);

console.log("Mission 10 memory store checks passed.");
