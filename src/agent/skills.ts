import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export interface SkillRequirements {
  bins: string[];
  env: string[];
}

export type SkillSource = "workspace" | "builtin";

export interface Skill {
  name: string;
  description: string;
  content: string;
  alwaysLoad: boolean;
  requires: SkillRequirements;
  path: string;
  source: SkillSource;
  available: boolean;
  missingRequirements: string[];
}

interface SkillFrontmatter {
  name?: string;
  description?: string;
  alwaysLoad?: boolean;
  always?: boolean;
  requires?: {
    bins?: unknown;
    env?: unknown;
  };
}

interface ParsedSkillFile {
  frontmatter: SkillFrontmatter;
  body: string;
}

export class SkillsLoader {
  readonly workspaceSkillsDir: string;
  readonly builtinSkillsDir: string;

  constructor(
    workspacePath: string,
    builtinSkillsDir = path.join(process.cwd(), "skills"),
  ) {
    this.workspaceSkillsDir = path.join(workspacePath, "skills");
    this.builtinSkillsDir = builtinSkillsDir;
  }

  async listSkills(filterUnavailable = true): Promise<Skill[]> {
    const workspaceSkills = await this.scanSkillsDir(
      this.workspaceSkillsDir,
      "workspace",
    );
    const builtinSkills = await this.scanSkillsDir(
      this.builtinSkillsDir,
      "builtin",
    );

    const merged = new Map<string, Skill>();
    for (const skill of [...builtinSkills, ...workspaceSkills]) {
      merged.set(skill.name, skill);
    }

    const skills = [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
    return filterUnavailable
      ? skills.filter((skill) => skill.available)
      : skills;
  }

  async loadSkill(name: string): Promise<Skill | null> {
    const workspacePath = path.join(this.workspaceSkillsDir, name, "SKILL.md");
    if (await this.fileExists(workspacePath)) {
      return this.readSkillFile(workspacePath, "workspace", name);
    }

    const builtinPath = path.join(this.builtinSkillsDir, name, "SKILL.md");
    if (await this.fileExists(builtinPath)) {
      return this.readSkillFile(builtinPath, "builtin", name);
    }

    return null;
  }

  async loadSkillsForContext(skillNames: string[]): Promise<string> {
    const chunks: string[] = [];
    const seen = new Set<string>();

    for (const name of skillNames) {
      if (seen.has(name)) {
        continue;
      }
      seen.add(name);

      const skill = await this.loadSkill(name);
      if (skill === null || !skill.available) {
        continue;
      }

      chunks.push(`### Skill: ${skill.name}\n\n${skill.content}`);
    }

    return chunks.join("\n\n---\n\n");
  }

  async getAlwaysLoadSkills(): Promise<Skill[]> {
    const skills = await this.listSkills(false);
    return skills.filter((skill) => skill.alwaysLoad && skill.available);
  }

  async buildSkillsSummary(): Promise<string> {
    const skills = await this.listSkills(false);
    if (skills.length === 0) {
      return "";
    }

    const lines = ["<skills>"];
    for (const skill of skills) {
      lines.push(`  <skill available="${String(skill.available)}">`);
      lines.push(`    <name>${escapeXml(skill.name)}</name>`);
      lines.push(`    <description>${escapeXml(skill.description)}</description>`);
      lines.push(`    <location>${escapeXml(skill.path)}</location>`);
      lines.push(`    <source>${skill.source}</source>`);

      if (!skill.available && skill.missingRequirements.length > 0) {
        lines.push(
          `    <requires>${escapeXml(skill.missingRequirements.join(", "))}</requires>`,
        );
      }

      lines.push("  </skill>");
    }
    lines.push("</skills>");

    return lines.join("\n");
  }

  async checkRequirements(
    requirements: SkillRequirements,
  ): Promise<{ available: boolean; missingRequirements: string[] }> {
    const missing: string[] = [];

    for (const bin of requirements.bins) {
      if (!commandExists(bin)) {
        missing.push(`CLI: ${bin}`);
      }
    }

    for (const envName of requirements.env) {
      if ((process.env[envName] ?? "").length === 0) {
        missing.push(`ENV: ${envName}`);
      }
    }

    return {
      available: missing.length === 0,
      missingRequirements: missing,
    };
  }

  private async scanSkillsDir(
    dirPath: string,
    source: SkillSource,
  ): Promise<Skill[]> {
    try {
      const directoryEntries = await readdir(dirPath, { withFileTypes: true });
      const skills: Skill[] = [];

      for (const entry of directoryEntries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const skillPath = path.join(dirPath, entry.name, "SKILL.md");
        if (!(await this.fileExists(skillPath))) {
          continue;
        }

        skills.push(await this.readSkillFile(skillPath, source, entry.name));
      }

      return skills;
    } catch {
      return [];
    }
  }

  private async readSkillFile(
    skillPath: string,
    source: SkillSource,
    fallbackName: string,
  ): Promise<Skill> {
    const raw = await readFile(skillPath, "utf-8");
    const parsed = parseSkillFile(raw);
    const name = parsed.frontmatter.name?.trim() || fallbackName;
    const description = parsed.frontmatter.description?.trim() || name;
    const alwaysLoad =
      parsed.frontmatter.alwaysLoad ?? parsed.frontmatter.always ?? false;
    const requirements = normalizeRequirements(parsed.frontmatter.requires);
    const requirementStatus = await this.checkRequirements(requirements);

    return {
      name,
      description,
      content: parsed.body,
      alwaysLoad,
      requires: requirements,
      path: skillPath,
      source,
      available: requirementStatus.available,
      missingRequirements: requirementStatus.missingRequirements,
    };
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      const fileStat = await stat(filePath);
      return fileStat.isFile();
    } catch {
      return false;
    }
  }
}

function parseSkillFile(content: string): ParsedSkillFile {
  if (!content.startsWith("---\n")) {
    return {
      frontmatter: {},
      body: content.trim(),
    };
  }

  const endMarkerIndex = content.indexOf("\n---\n", 4);
  if (endMarkerIndex === -1) {
    return {
      frontmatter: {},
      body: content.trim(),
    };
  }

  const frontmatterBlock = content.slice(4, endMarkerIndex);
  const body = content.slice(endMarkerIndex + 5).trim();

  return {
    frontmatter: parseSimpleYaml(frontmatterBlock) as SkillFrontmatter,
    body,
  };
}

function parseSimpleYaml(block: string): Record<string, unknown> {
  const lines = block.split(/\r?\n/);
  const [parsed] = parseYamlObject(lines, 0, 0);
  return parsed;
}

function parseYamlObject(
  lines: string[],
  startIndex: number,
  indent: number,
): [Record<string, unknown>, number] {
  const result: Record<string, unknown> = {};
  let index = startIndex;

  while (index < lines.length) {
    const rawLine = lines[index] ?? "";
    if (isIgnorableYamlLine(rawLine)) {
      index += 1;
      continue;
    }

    const currentIndent = getIndent(rawLine);
    if (currentIndent < indent) {
      break;
    }
    if (currentIndent > indent) {
      index += 1;
      continue;
    }

    const trimmed = rawLine.trim();
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) {
      index += 1;
      continue;
    }

    const key = trimmed.slice(0, colonIndex).trim();
    const valuePart = trimmed.slice(colonIndex + 1).trim();

    if (valuePart.length > 0) {
      result[key] = parseScalar(valuePart);
      index += 1;
      continue;
    }

    const nextIndex = findNextMeaningfulLine(lines, index + 1);
    if (nextIndex === -1 || getIndent(lines[nextIndex] ?? "") <= currentIndent) {
      result[key] = {};
      index += 1;
      continue;
    }

    const nextLine = lines[nextIndex] ?? "";
    if (nextLine.trim().startsWith("- ")) {
      const [arrayValue, afterIndex] = parseYamlArray(
        lines,
        nextIndex,
        getIndent(nextLine),
      );
      result[key] = arrayValue;
      index = afterIndex;
      continue;
    }

    const [childObject, afterIndex] = parseYamlObject(
      lines,
      nextIndex,
      getIndent(nextLine),
    );
    result[key] = childObject;
    index = afterIndex;
  }

  return [result, index];
}

function parseYamlArray(
  lines: string[],
  startIndex: number,
  indent: number,
): [unknown[], number] {
  const result: unknown[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const rawLine = lines[index] ?? "";
    if (isIgnorableYamlLine(rawLine)) {
      index += 1;
      continue;
    }

    const currentIndent = getIndent(rawLine);
    if (currentIndent < indent) {
      break;
    }
    if (currentIndent !== indent) {
      index += 1;
      continue;
    }

    const trimmed = rawLine.trim();
    if (!trimmed.startsWith("- ")) {
      break;
    }

    result.push(parseScalar(trimmed.slice(2).trim()));
    index += 1;
  }

  return [result, index];
}

function findNextMeaningfulLine(lines: string[], startIndex: number): number {
  for (let index = startIndex; index < lines.length; index += 1) {
    if (!isIgnorableYamlLine(lines[index] ?? "")) {
      return index;
    }
  }

  return -1;
}

function isIgnorableYamlLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length === 0 || trimmed.startsWith("#");
}

function getIndent(line: string): number {
  return line.length - line.trimStart().length;
}

function parseScalar(value: string): unknown {
  const normalized = stripQuotes(value.trim());

  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  if (/^-?\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }

  return normalized;
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function normalizeRequirements(
  value: SkillFrontmatter["requires"],
): SkillRequirements {
  const bins = Array.isArray(value?.bins)
    ? value.bins.filter(isString)
    : [];
  const env = Array.isArray(value?.env)
    ? value.env.filter(isString)
    : [];

  return { bins, env };
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function commandExists(command: string): boolean {
  if (command.includes(path.sep) || command.includes("/")) {
    return existsSync(command);
  }

  const pathEntries = (process.env.PATH ?? "")
    .split(path.delimiter)
    .filter((entry) => entry.length > 0);
  const extensions =
    process.platform === "win32"
      ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM")
          .split(";")
          .filter((entry) => entry.length > 0)
      : [""];

  for (const entry of pathEntries) {
    for (const extension of extensions) {
      const candidate =
        extension.length > 0 &&
        !command.toLowerCase().endsWith(extension.toLowerCase())
          ? path.join(entry, `${command}${extension}`)
          : path.join(entry, command);

      if (existsSync(candidate)) {
        return true;
      }
    }
  }

  return false;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
