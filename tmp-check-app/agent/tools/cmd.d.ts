import type { ToolParametersSchema } from "../../types/schema.js";
import { Tool } from "./base.js";
interface ExecToolOptions {
    timeoutSeconds?: number;
    workingDir?: string;
    denyPatterns?: string[];
}
export declare class ExecTool extends Tool {
    private readonly defaultTimeoutSeconds;
    private readonly workingDir;
    private readonly denyPatterns;
    constructor(options?: ExecToolOptions);
    get name(): string;
    get description(): string;
    get parameters(): ToolParametersSchema;
    execute(params: Record<string, unknown>): Promise<string>;
    private guardCommand;
    private runCommand;
    private formatResult;
    private getErrorMessage;
}
export {};
//# sourceMappingURL=cmd.d.ts.map