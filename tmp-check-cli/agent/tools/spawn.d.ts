import type { ToolParametersSchema } from "../../types/schema.js";
import { Tool } from "./base.js";
import type { SubagentManager } from "../subagent.js";
export declare class SpawnTool extends Tool {
    private readonly manager;
    private originChannel;
    private originChatId;
    private sessionKey;
    constructor(manager: SubagentManager);
    get name(): string;
    get description(): string;
    get parameters(): ToolParametersSchema;
    setContext(channel: string, chatId: string, sessionKey: string): void;
    execute(params: Record<string, unknown>): Promise<string>;
}
//# sourceMappingURL=spawn.d.ts.map