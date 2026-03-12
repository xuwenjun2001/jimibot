import { exec, type ExecException } from "node:child_process";

import type { ToolParametersSchema } from "../../types/schema.js";
import { Tool } from "./base.js";

const DEFAULT_DENY_PATTERNS = [
  String.raw`\brm\s+-[rf]{1,2}\b`,
  String.raw`\bdel\s+/[fq]\b`,
  String.raw`\brmdir\s+/s\b`,
  String.raw`(?:^|[;&|]\s*)format\b`,
  String.raw`\b(mkfs|diskpart)\b`,
  String.raw`\bdd\s+if=`,
  String.raw`>\s*/dev/sd`,
  String.raw`\b(shutdown|reboot|poweroff)\b`,
  String.raw`:\(\)\s*\{.*\};\s*:`,
];

const DEFAULT_TIMEOUT_SECONDS = 60;
const MAX_OUTPUT_CHARS = 10_000;
const EXEC_MAX_BUFFER = 1024 * 1024;

interface ExecToolOptions {
  timeoutSeconds?: number;
  workingDir?: string;
  denyPatterns?: string[];
}

interface CommandRunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  timeoutSeconds: number;
}

export class ExecTool extends Tool {
  private readonly defaultTimeoutSeconds: number;
  private readonly workingDir: string | undefined;
  private readonly denyPatterns: RegExp[];

  constructor(options: ExecToolOptions = {}) {
    super();
    this.defaultTimeoutSeconds = options.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;
    this.workingDir = options.workingDir;
    this.denyPatterns = (options.denyPatterns ?? DEFAULT_DENY_PATTERNS).map(
      (pattern) => new RegExp(pattern, "i"),
    );
  }

  get name(): string {
    return "exec";
  }

  get description(): string {
    return "Execute a shell command and return its output. Use with caution.";
  }

  get parameters(): ToolParametersSchema {
    return {
      type: "object",
      properties: {
        command: {
          type: "string",
          minLength: 1,
          description: "The shell command to execute.",
        },
        timeout: {
          type: "integer",
          minimum: 1,
          description: "Optional timeout in seconds. Defaults to 60.",
        },
        workingDir: {
          type: "string",
          minLength: 1,
          description: "Optional working directory for the command.",
        },
      },
      required: ["command"],
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const castedParams = this.castParams(params);
    const errors = this.validateParams(castedParams);
    if (errors.length > 0) {
      throw new Error(errors.join("\n"));
    }

    const { command, timeout, workingDir } = castedParams;

    if (typeof command !== "string") {
      throw new Error("command should be a string");
    }
    if (timeout !== undefined && !Number.isInteger(timeout)) {
      throw new Error("timeout should be an integer");
    }
    if (workingDir !== undefined && typeof workingDir !== "string") {
      throw new Error("workingDir should be a string");
    }

    const guardError = this.guardCommand(command);
    if (guardError) {
      return guardError;
    }

    try {
      const result = await this.runCommand(command, {
        timeoutSeconds:
          typeof timeout === "number" ? timeout : this.defaultTimeoutSeconds,
        workingDir: workingDir ?? this.workingDir,
      });

      return this.formatResult(result);
    } catch (error) {
      return `Error executing command: ${this.getErrorMessage(error)}`;
    }
  }

  private guardCommand(command: string): string | null {
    const normalized = command.trim();

    for (const pattern of this.denyPatterns) {
      if (pattern.test(normalized)) {
        return "Error: Command blocked by safety guard (dangerous pattern detected)";
      }
    }

    return null;
  }

  private runCommand(
    command: string,
    options: { timeoutSeconds: number; workingDir: string | undefined },
  ): Promise<CommandRunResult> {
    return new Promise((resolve, reject) => {
      let timedOut = false;

      const child = exec(
        command,
        {
          cwd: options.workingDir,
          encoding: "utf-8",
          maxBuffer: EXEC_MAX_BUFFER,
          windowsHide: true,
        },
        (error, stdout, stderr) => {
          clearTimeout(timer);

          if (timedOut) {
            resolve({
              stdout,
              stderr,
              exitCode: null,
              timedOut: true,
              timeoutSeconds: options.timeoutSeconds,
            });
            return;
          }

          if (error) {
            const execError = error as ExecException;
            if (typeof execError.code === "number") {
              resolve({
                stdout,
                stderr,
                exitCode: execError.code,
                timedOut: false,
                timeoutSeconds: options.timeoutSeconds,
              });
              return;
            }

            reject(error);
            return;
          }

          resolve({
            stdout,
            stderr,
            exitCode: 0,
            timedOut: false,
            timeoutSeconds: options.timeoutSeconds,
          });
        },
      );

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, options.timeoutSeconds * 1000);
    });
  }

  private formatResult(result: CommandRunResult): string {
    if (result.timedOut) {
      return `Error: Command timed out after ${result.timeoutSeconds} seconds`;
    }

    const outputParts: string[] = [];

    if (result.stdout) {
      outputParts.push(result.stdout);
    }

    if (result.stderr.trim()) {
      outputParts.push(`STDERR:\n${result.stderr}`);
    }

    if (result.exitCode !== null && result.exitCode !== 0) {
      outputParts.push(`\nExit code: ${result.exitCode}`);
    }

    const output = outputParts.length > 0 ? outputParts.join("\n") : "(no output)";
    if (output.length <= MAX_OUTPUT_CHARS) {
      return output;
    }

    return `${output.slice(0, MAX_OUTPUT_CHARS)}\n... (truncated, ${output.length - MAX_OUTPUT_CHARS} more chars)`;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
