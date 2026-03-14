import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const SAVE_MEMORY_TOOL = [
    {
        type: "function",
        function: {
            name: "save_memory",
            description: "Save the memory consolidation result to persistent storage.",
            parameters: {
                type: "object",
                properties: {
                    history_entry: {
                        type: "string",
                        description: "A single-line summary prefixed with [YYYY-MM-DD HH:MM].",
                    },
                    memory_update: {
                        type: "string",
                        description: "The full updated long-term memory markdown.",
                    },
                },
                required: ["history_entry", "memory_update"],
            },
        },
    },
];
const HISTORY_ENTRY_PATTERN = /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\]\s+/;
export class MemoryStore {
    workspacePath;
    memoryDir;
    memoryFile;
    historyFile;
    constructor(workspacePath) {
        this.workspacePath = workspacePath;
        this.memoryDir = path.join(workspacePath, "memory");
        this.memoryFile = path.join(this.memoryDir, "MEMORY.md");
        this.historyFile = path.join(this.memoryDir, "HISTORY.md");
    }
    async loadMemory() {
        await this.ensureMemoryDir();
        try {
            return await readFile(this.memoryFile, "utf-8");
        }
        catch {
            return "";
        }
    }
    async saveMemory(content) {
        await this.ensureMemoryDir();
        await writeFile(this.memoryFile, content, "utf-8");
    }
    async loadHistory() {
        await this.ensureMemoryDir();
        try {
            return await readFile(this.historyFile, "utf-8");
        }
        catch {
            return "";
        }
    }
    async appendHistory(entry) {
        await this.ensureMemoryDir();
        await appendFile(this.historyFile, `${this.normalizeHistoryEntry(entry)}\n`, "utf-8");
    }
    async getMemoryContext() {
        const longTerm = (await this.loadMemory()).trim();
        return longTerm.length > 0 ? `## Long-term Memory\n${longTerm}` : "";
    }
    shouldConsolidate(messageCount, threshold) {
        return threshold > 0 && messageCount >= threshold;
    }
    async consolidate(session, provider, model, options = {}) {
        const archiveAll = options.archiveAll ?? false;
        const memoryWindow = options.memoryWindow ?? 50;
        const keepCount = archiveAll ? 0 : Math.max(1, Math.floor(memoryWindow / 2));
        const oldMessages = archiveAll
            ? session.messages
            : session.messages.slice(session.lastConsolidated, -keepCount);
        if (oldMessages.length === 0) {
            return true;
        }
        const currentMemory = await this.loadMemory();
        const transcript = this.buildConversationTranscript(oldMessages);
        if (transcript.length === 0) {
            session.lastConsolidated = archiveAll
                ? 0
                : Math.max(session.lastConsolidated, session.messages.length - keepCount);
            return true;
        }
        const response = await provider.chat({
            messages: [
                {
                    role: "system",
                    content: "You are a memory consolidation agent. Call the save_memory tool with your consolidation result.",
                },
                {
                    role: "user",
                    content: [
                        "Process this conversation and call the save_memory tool.",
                        "",
                        "## Current Long-term Memory",
                        currentMemory || "(empty)",
                        "",
                        "## Conversation to Process",
                        transcript,
                    ].join("\n"),
                },
            ],
            tools: SAVE_MEMORY_TOOL,
            model,
        });
        if (!response.hasToolCalls) {
            return false;
        }
        const saveMemoryCall = response.toolCalls.find((toolCall) => toolCall.name === "save_memory") ??
            response.toolCalls[0];
        if (saveMemoryCall === undefined) {
            return false;
        }
        const args = saveMemoryCall.arguments;
        const historyEntry = this.toStringValue(args.history_entry);
        const memoryUpdate = this.toStringValue(args.memory_update);
        if (historyEntry === null || memoryUpdate === null) {
            return false;
        }
        await this.appendHistory(historyEntry);
        if (memoryUpdate !== currentMemory) {
            await this.saveMemory(memoryUpdate);
        }
        session.lastConsolidated = archiveAll
            ? 0
            : Math.max(session.lastConsolidated, session.messages.length - keepCount);
        return true;
    }
    async ensureMemoryDir() {
        await mkdir(this.memoryDir, { recursive: true });
    }
    normalizeHistoryEntry(entry) {
        const normalized = entry.replace(/\s+/g, " ").trim();
        if (normalized.length === 0) {
            return `${this.formatHistoryTimestamp(new Date())} (empty summary)`;
        }
        if (HISTORY_ENTRY_PATTERN.test(normalized)) {
            return normalized;
        }
        return `${this.formatHistoryTimestamp(new Date())} ${normalized}`;
    }
    formatHistoryTimestamp(value) {
        const date = typeof value === "string" ? new Date(value) : value;
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        const hh = String(date.getHours()).padStart(2, "0");
        const min = String(date.getMinutes()).padStart(2, "0");
        return `[${yyyy}-${mm}-${dd} ${hh}:${min}]`;
    }
    buildConversationTranscript(messages) {
        return messages
            .filter((message) => message.content.trim().length > 0)
            .map((message) => {
            const timestamp = this.formatHistoryTimestamp(message.timestamp);
            const roleLabel = message.role === "tool" && message.name !== undefined
                ? `TOOL(${message.name})`
                : message.role.toUpperCase();
            const content = message.content.replace(/\s+/g, " ").trim();
            return `${timestamp} ${roleLabel}: ${content}`;
        })
            .join("\n");
    }
    toStringValue(value) {
        if (typeof value === "string") {
            return value;
        }
        if (value === undefined) {
            return null;
        }
        try {
            return JSON.stringify(value, null, 2);
        }
        catch {
            return String(value);
        }
    }
}
//# sourceMappingURL=memory.js.map