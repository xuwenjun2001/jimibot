import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { MessageBus } from "../bus/queue.js";
import { MockProvider } from "../providers/mock.js";
import { SkillsLoader } from "./skills.js";
import { SubagentManager } from "./subagent.js";
const workspacePath = path.join(process.cwd(), "tmp", "subagent-manager");
const builtinSkillsPath = path.join(process.cwd(), "tmp", "subagent-builtins");
await rm(workspacePath, { recursive: true, force: true });
await rm(builtinSkillsPath, { recursive: true, force: true });
await mkdir(path.join(workspacePath, "skills", "review"), { recursive: true });
await mkdir(path.join(builtinSkillsPath, "shell"), { recursive: true });
await writeFile(path.join(workspacePath, "skills", "review", "SKILL.md"), [
    "---",
    "description: Review project files before making changes.",
    "alwaysLoad: false",
    "---",
    "Use this skill when you need to inspect code before editing it.",
].join("\n"), "utf-8");
await writeFile(path.join(builtinSkillsPath, "shell", "SKILL.md"), [
    "---",
    "description: Use shell commands for workspace inspection.",
    "alwaysLoad: true",
    "---",
    "Use exec for simple environment checks.",
].join("\n"), "utf-8");
const bus = new MessageBus();
const provider = new MockProvider({
    defaultModel: "mock-gpt",
    responses: [
        {
            content: null,
            toolCalls: [
                {
                    id: "sub_call_1",
                    name: "exec",
                    arguments: { command: "echo subagent-ok" },
                },
            ],
            finishReason: "tool_calls",
        },
        {
            content: "The command succeeded and returned subagent-ok.",
        },
    ],
});
const skillsLoader = new SkillsLoader(workspacePath, builtinSkillsPath);
const subagents = new SubagentManager({
    bus,
    provider,
    workspacePath,
    skillsLoader,
});
const announced = new Promise((resolve) => {
    bus.onInbound(async (message) => {
        if (message.channel === "system" && message.senderId === "subagent") {
            resolve(message);
        }
    });
});
const started = await subagents.spawn("Inspect the workspace and report back.", {
    label: "inspect workspace",
    origin: {
        channel: "telegram",
        chatId: "chat-sub",
        sessionKey: "telegram:chat-sub",
    },
});
assert.match(started, /Background task \[inspect workspace\] started\./);
const announcedMessage = await announced;
await subagents.waitForAll();
assert.equal(announcedMessage.sessionKeyOverride, "telegram:chat-sub");
assert.equal(announcedMessage.metadata.originChannel, "telegram");
assert.equal(announcedMessage.metadata.originChatId, "chat-sub");
assert.match(announcedMessage.content, /Background task 'inspect workspace'/);
assert.match(announcedMessage.content, /The command succeeded and returned subagent-ok\./);
assert.equal(provider.requests.length, 2);
assert.equal(provider.requests[0]?.messages[0]?.role, "system");
assert.match(String(provider.requests[0]?.messages[0]?.content ?? ""), /Use read_file on a SKILL\.md path if a listed skill is relevant\./);
const toolNames = provider.requests[0]?.tools?.map((tool) => tool.function.name).sort() ?? [];
assert.deepEqual(toolNames, ["exec", "read_file"]);
console.log("Mission 12 subagent manager checks passed.");
//# sourceMappingURL=subagent.test.js.map