import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { PassThrough } from "node:stream";
import { CliChannel } from "./channels/cli.js";
import { parseConfig } from "./config/index.js";
import { createNanobotApp } from "./index.js";
import { MockProvider } from "./providers/index.js";
const workspacePath = path.join(process.cwd(), "tmp", "mission15-app");
await rm(workspacePath, { recursive: true, force: true });
const provider = new MockProvider({
    defaultModel: "mock-model",
    responses: [{ content: "这是 Mission 15 的完整启动回复。" }],
});
const input = new PassThrough();
const output = new PassThrough();
let written = "";
output.on("data", (chunk) => {
    written += chunk.toString("utf-8");
});
const app = await createNanobotApp({
    config: parseConfig({
        agents: {
            defaults: {
                workspace: workspacePath,
                provider: "mock",
                model: "mock-model",
            },
        },
        channels: {
            cli: {
                enabled: true,
                allow_from: ["*"],
                prompt: "",
                assistant_prefix: "AI: ",
            },
        },
    }),
    provider,
    cliRuntime: {
        input,
        output,
        terminal: false,
    },
});
await app.start();
assert.equal(app.channelManager.getStatus().cli?.running, true);
assert.equal(app.cronService.status().enabled, true);
const cliChannel = app.channelManager.getChannel("cli");
assert.equal(cliChannel instanceof CliChannel, true);
cliChannel.receiveLine("请验证 Mission 15 的启动整合");
for (let attempt = 0; attempt < 20; attempt += 1) {
    if (written.includes("这是 Mission 15 的完整启动回复。")) {
        break;
    }
    await new Promise((resolve) => {
        setTimeout(resolve, 10);
    });
}
assert.match(written, /AI: 这是 Mission 15 的完整启动回复。/);
const history = await app.sessionManager.getHistory("cli:direct");
assert.deepEqual(history.map((message) => message.role), ["user", "assistant"]);
await app.stop();
assert.equal(app.channelManager.getStatus().cli?.running, false);
assert.equal(app.cronService.status().enabled, false);
console.log("Mission 15 app bootstrap checks passed.");
//# sourceMappingURL=index.test.js.map