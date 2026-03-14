import { MessageBus } from "../bus/queue.js";
import { type CronJob, type CronPayload, type CronSchedule } from "./types.js";
export interface CronServiceOptions {
    bus: MessageBus;
    storePath: string;
    now?: () => number;
    idGenerator?: () => string;
}
export interface AddCronJobInput {
    name: string;
    schedule: CronSchedule;
    payload: CronPayload;
    deleteAfterRun?: boolean;
}
export declare class CronService {
    private readonly bus;
    private readonly storePath;
    private readonly now;
    private readonly idGenerator;
    private store;
    private timer;
    private running;
    constructor(options: CronServiceOptions);
    start(): Promise<void>;
    stop(): void;
    status(): {
        enabled: boolean;
        jobs: number;
        nextWakeAtMs: number | null;
    };
    listJobs(includeDisabled?: boolean): CronJob[];
    addJob(input: AddCronJobInput): Promise<CronJob>;
    removeJob(jobId: string): Promise<boolean>;
    enableJob(jobId: string, enabled?: boolean): Promise<CronJob | null>;
    runJob(jobId: string, force?: boolean): Promise<boolean>;
    runDueJobs(): Promise<void>;
    private executeJob;
    private dispatchJob;
    private loadStore;
    private saveStore;
    private recomputeNextRuns;
    private getNextWakeAtMs;
    private armTimer;
    private ensureStore;
}
export declare function computeNextRun(schedule: CronSchedule, nowMs: number): number | null;
//# sourceMappingURL=service.d.ts.map