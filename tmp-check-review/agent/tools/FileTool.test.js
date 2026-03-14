import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ReadFileTool } from "./FileTool.js";
const tool = new ReadFileTool();
const fixtureDir = path.join(process.cwd(), "tmp", "tool-tests");
await fs.mkdir(fixtureDir, { recursive: true });
const smallFilePath = "C:\\Users\\jikai2001\\Desktop\\test.txt";
const smallFileContent = await tool.execute({
    path: smallFilePath,
});
console.log(smallFileContent);
console.log("Mission 4 ReadFileTool checks passed.");
//# sourceMappingURL=FileTool.test.js.map