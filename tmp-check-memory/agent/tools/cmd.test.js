import assert from "node:assert/strict";
import { ExecTool } from "./cmd.js";
const tool = new ExecTool();
const echoResult = await tool.execute({
    command: "echo hello",
});
console.log(`运行结果为 : ${echoResult}`);
assert.match(echoResult, /hello/i);
const blockedResult = await tool.execute({
    command: "rm -rf /",
});
assert.match(blockedResult, /blocked by safety guard/i);
const timeoutResult = await tool.execute({
    command: `node -e "setTimeout(() => console.log('done'), 1500)"`,
    timeout: 1,
});
assert.match(timeoutResult, /timed out/i);
await assert.rejects(() => tool.execute({}), /missing required command/);
console.log("Mission 4 ExecTool checks passed.");
//# sourceMappingURL=cmd.test.js.map