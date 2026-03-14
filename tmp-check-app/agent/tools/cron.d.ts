import type { ToolParametersSchema } from "../../types/schema.js";
import type { CronService } from "../../cron/service.js";
import { Tool } from "./base.js";
export declare class CronTool extends Tool {
    private readonly cron;
    private channel;
    private chatId;
    private inCronContext;
    constructor(cron: CronService);
    get name(): string;
    get description(): string;
    get parameters(): ToolParametersSchema;
    setContext(channel: string, chatId: string): void;
    setCronContext(active: boolean): boolean;
    resetCronContext(previous: boolean): void;
    execute(params: Record<string, unknown>): Promise<string>;
    private addJob;
    private listJobs;
    private removeJob;
    private getErrorMessage;
}
//# sourceMappingURL=cron.d.ts.map