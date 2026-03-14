import type { ToolParametersSchema } from "../../types/schema.js";
import { Tool } from "./base.js";
export declare class ReadFileTool extends Tool {
    _MAX_CHARS: number;
    get name(): string;
    get description(): string;
    get parameters(): ToolParametersSchema;
    execute(params: Record<string, unknown>): Promise<string>;
}
//# sourceMappingURL=FileTool.d.ts.map