import { type Writable } from "node:stream";
import readline, { type Interface } from "node:readline";

import type { OutboundMessage } from "../bus/events.js";
import { MessageBus } from "../bus/queue.js";
import {
  BaseChannel,
  type ChannelInboundInput,
  type ChannelLifecycleConfig,
} from "./base.js";

const DEFAULT_ASSISTANT_PREFIX = "AI: ";
const DEFAULT_EXIT_COMMANDS = ["exit", "quit", "/exit", "/quit"];
const DEFAULT_PROMPT = "";

export interface CliChannelConfig extends ChannelLifecycleConfig {
  senderId: string;
  chatId: string;
  prompt: string;
  assistantPrefix: string;
  exitCommands: string[];
}

export interface CliChannelRuntimeOptions {
  input?: NodeJS.ReadableStream;
  output?: Writable;
  terminal?: boolean;
}

export class CliChannel extends BaseChannel<CliChannelConfig> {
  private readonly input: NodeJS.ReadableStream;
  private readonly output: Writable;
  private readonly terminal: boolean;
  private rl: Interface | null = null;

  constructor(
    config: CliChannelConfig,
    bus: MessageBus,
    options: CliChannelRuntimeOptions = {},
  ) {
    super(config, bus);
    this.input = options.input ?? process.stdin;
    this.output = options.output ?? process.stdout;
    this.terminal = options.terminal ?? Boolean(process.stdout.isTTY);
  }

  get name(): string {
    return "cli";
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.rl = readline.createInterface({
      input: this.input,
      output: this.output,
      terminal: this.terminal,
    });

    this.rl.on("line", (line) => {
      this.receiveLine(line);
    });
    this.rl.on("close", () => {
      this.setRunning(false);
      this.rl = null;
    });

    this.setRunning(true);
    this.prompt();
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    const rl = this.rl;
    this.rl = null;
    this.setRunning(false);
    rl?.close();
  }

  async send(message: OutboundMessage): Promise<void> {
    this.output.write(`${this.config.assistantPrefix}${message.content}\n`);
    this.prompt();
  }

  receiveLine(line: string): void {
    if (!this.isRunning) {
      return;
    }

    const trimmed = line.trim();
    if (trimmed.length === 0) {
      this.prompt();
      return;
    }

    if (this.isExitCommand(trimmed)) {
      void this.stop();
      return;
    }

    const input: ChannelInboundInput = {
      senderId: this.config.senderId,
      chatId: this.config.chatId,
      content: trimmed,
      metadata: {
        source: "cli",
      },
    };
    this.handleMessage(input);
    this.prompt();
  }

  private isExitCommand(line: string): boolean {
    const normalized = line.trim().toLowerCase();
    return this.config.exitCommands.some(
      (command) => command.toLowerCase() === normalized,
    );
  }

  private prompt(): void {
    if (this.rl === null || this.config.prompt === DEFAULT_PROMPT) {
      return;
    }

    this.rl.setPrompt(this.config.prompt);
    this.rl.prompt();
  }
}

export function createCliChannelConfig(
  input: Partial<CliChannelConfig> = {},
): CliChannelConfig {
  return {
    enabled: input.enabled ?? true,
    allowFrom: input.allowFrom ?? ["*"],
    senderId: input.senderId ?? "cli-user",
    chatId: input.chatId ?? "direct",
    prompt: input.prompt ?? DEFAULT_PROMPT,
    assistantPrefix: input.assistantPrefix ?? DEFAULT_ASSISTANT_PREFIX,
    exitCommands: input.exitCommands ?? [...DEFAULT_EXIT_COMMANDS],
  };
}
