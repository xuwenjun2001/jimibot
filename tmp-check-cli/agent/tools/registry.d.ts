import { Tool, type ToolSchemaDefinition } from "./base.js";
export declare class ToolRegistry {
    private readonly tools;
    register(tool: Tool): void;
    get(name: string): Tool | undefined;
    list(): Tool[];
    execute(name: string, params: Record<string, unknown>): Promise<string>;
    getDefinitions(): ToolSchemaDefinition[];
}
//# sourceMappingURL=registry.d.ts.map