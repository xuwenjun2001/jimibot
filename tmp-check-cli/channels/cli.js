import {} from "node:stream";
import readline, {} from "node:readline";
import { MessageBus } from "../bus/queue.js";
import { BaseChannel, } from "./base.js";
const DEFAULT_ASSISTANT_PREFIX = "AI: ";
const DEFAULT_EXIT_COMMANDS = ["exit", "quit", "/exit", "/quit"];
const DEFAULT_PROMPT = "";
export class CliChannel extends BaseChannel {
    input;
    output;
    terminal;
    rl = null;
    constructor(config, bus, options = {}) {
        super(config, bus);
        this.input = options.input ?? process.stdin;
        this.output = options.output ?? process.stdout;
        this.terminal = options.terminal ?? Boolean(process.stdout.isTTY);
    }
    get name() {
        return "cli";
    }
    async start() {
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
    async stop() {
        if (!this.isRunning) {
            return;
        }
        const rl = this.rl;
        this.rl = null;
        this.setRunning(false);
        rl?.close();
    }
    async send(message) {
        this.output.write(`${this.config.assistantPrefix}${message.content}\n`);
        this.prompt();
    }
    receiveLine(line) {
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
        const input = {
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
    isExitCommand(line) {
        const normalized = line.trim().toLowerCase();
        return this.config.exitCommands.some((command) => command.toLowerCase() === normalized);
    }
    prompt() {
        if (this.rl === null || this.config.prompt === DEFAULT_PROMPT) {
            return;
        }
        this.rl.setPrompt(this.config.prompt);
        this.rl.prompt();
    }
}
export function createCliChannelConfig(input = {}) {
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
//# sourceMappingURL=cli.js.map