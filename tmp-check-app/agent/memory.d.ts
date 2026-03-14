import type { LLMProvider } from "../providers/base.js";
import type { Session } from "../session/index.js";
export interface ConsolidateMemoryOptions {
    archiveAll?: boolean;
    memoryWindow?: number;
}
export declare class MemoryStore {
    private readonly workspacePath;
    readonly memoryDir: string;
    readonly memoryFile: string;
    readonly historyFile: string;
    constructor(workspacePath: string);
    loadMemory(): Promise<string>;
    saveMemory(content: string): Promise<void>;
    loadHistory(): Promise<string>;
    appendHistory(entry: string): Promise<void>;
    getMemoryContext(): Promise<string>;
    shouldConsolidate(messageCount: number, threshold: number): boolean;
    consolidate(session: Session, provider: LLMProvider, model: string, options?: ConsolidateMemoryOptions): Promise<boolean>;
    private ensureMemoryDir;
    private normalizeHistoryEntry;
    private formatHistoryTimestamp;
    private buildConversationTranscript;
    private toStringValue;
}
//# sourceMappingURL=memory.d.ts.map