import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { SkillsLoader } from "./skills.js";

const workspacePath = path.join(process.cwd(), "tmp", "skills-loader-tests");
const builtinSkillsPath = path.join(process.cwd(), "tmp", "skills-loader-builtins");

await rm(workspacePath, { recursive: true, force: true });
await rm(builtinSkillsPath, { recursive: true, force: true });

await mkdir(path.join(workspacePath, "skills", "memory"), { recursive: true });
await mkdir(path.join(workspacePath, "skills", "docker"), { recursive: true });
await mkdir(path.join(builtinSkillsPath, "cron"), { recursive: true });
await mkdir(path.join(builtinSkillsPath, "memory"), { recursive: true });

process.env.TEST_SKILL_ENV = "enabled";

await writeFile(
  path.join(workspacePath, "skills", "memory", "SKILL.md"),
  [
    "---",
    "name: memory",
    "description: Remember durable user facts.",
    "alwaysLoad: true",
    "requires:",
    "  bins:",
    "    - node",
    "  env:",
    "    - TEST_SKILL_ENV",
    "---",
    "Use this skill to keep stable user preferences and project facts.",
  ].join("\n"),
  "utf-8",
);

await writeFile(
  path.join(workspacePath, "skills", "docker", "SKILL.md"),
  [
    "---",
    "description: Build and run Docker workflows.",
    "alwaysLoad: false",
    "requires:",
    "  bins:",
    "    - definitely-missing-bin",
    "---",
    "Use this skill when container workflows are needed.",
  ].join("\n"),
  "utf-8",
);

await writeFile(
  path.join(builtinSkillsPath, "cron", "SKILL.md"),
  [
    "---",
    "description: Schedule recurring jobs.",
    "alwaysLoad: true",
    "---",
    "Use this skill to reason about periodic tasks.",
  ].join("\n"),
  "utf-8",
);

await writeFile(
  path.join(builtinSkillsPath, "memory", "SKILL.md"),
  [
    "---",
    "description: Builtin memory fallback.",
    "---",
    "This builtin memory skill should be shadowed by the workspace one.",
  ].join("\n"),
  "utf-8",
);

const loader = new SkillsLoader(workspacePath, builtinSkillsPath);

const allSkills = await loader.listSkills(false);
assert.deepEqual(
  allSkills.map((skill) => ({
    name: skill.name,
    source: skill.source,
    available: skill.available,
  })),
  [
    { name: "cron", source: "builtin", available: true },
    { name: "docker", source: "workspace", available: false },
    { name: "memory", source: "workspace", available: true },
  ],
);

const availableSkills = await loader.listSkills(true);
assert.deepEqual(
  availableSkills.map((skill) => skill.name),
  ["cron", "memory"],
);

const memorySkill = await loader.loadSkill("memory");
assert.equal(memorySkill?.source, "workspace");
assert.equal(memorySkill?.alwaysLoad, true);
assert.equal(memorySkill?.description, "Remember durable user facts.");
assert.match(
  String(memorySkill?.content ?? ""),
  /stable user preferences and project facts/i,
);

const alwaysSkills = await loader.getAlwaysLoadSkills();
assert.deepEqual(
  alwaysSkills.map((skill) => skill.name),
  ["cron", "memory"],
);

const loadedContext = await loader.loadSkillsForContext(["memory", "cron", "memory"]);
assert.match(loadedContext, /### Skill: memory/);
assert.match(loadedContext, /### Skill: cron/);
assert.doesNotMatch(loadedContext, /Builtin memory fallback/);

const summary = await loader.buildSkillsSummary();
assert.match(summary, /<skills>/);
assert.match(summary, /<name>docker<\/name>/);
assert.match(summary, /available="false"/);
assert.match(summary, /CLI: definitely-missing-bin/);

console.log("Mission 11 skills loader checks passed.");
