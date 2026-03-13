import type { ToolParametersSchema } from "../../types/schema.js";
export interface ToolSchemaDefinition {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: ToolParametersSchema;
    };
}
export declare abstract class Tool {
    abstract get name(): string;
    abstract get description(): string;
    abstract get parameters(): ToolParametersSchema;
    abstract execute(params: Record<string, unknown>): Promise<string>;
    castParams(params: Record<string, unknown>): Record<string, unknown>;
    validateParams(params: unknown): string[];
    toSchema(): ToolSchemaDefinition;
    private castObject;
    private castValue;
    private validateValue;
    private validateEnum;
    private validateNumberBounds;
    private validateStringBounds;
    private validateRequired;
    private validateObjectProperties;
    private getChildPath;
    private isRecord;
    private getValueType;
}
//# sourceMappingURL=base.d.ts.map