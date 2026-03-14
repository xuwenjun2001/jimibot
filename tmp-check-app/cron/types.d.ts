export type CronSchedule = CronAtSchedule | CronEverySchedule | CronExpressionSchedule;
export interface CronAtSchedule {
    kind: "at";
    atMs: number;
}
export interface CronEverySchedule {
    kind: "every";
    everyMs: number;
}
export interface CronExpressionSchedule {
    kind: "cron";
    expr: string;
    tz?: string;
}
export interface CronPayload {
    kind: "agent_turn" | "system_event";
    message: string;
    deliver: boolean;
    channel?: string;
    chatId?: string;
    sessionKeyOverride?: string;
    metadata?: Record<string, unknown>;
}
export type CronJobStatus = "ok" | "error" | "skipped";
export interface CronJobState {
    nextRunAtMs: number | null;
    lastRunAtMs: number | null;
    lastStatus: CronJobStatus | null;
    lastError?: string;
}
export interface CronJob {
    id: string;
    name: string;
    enabled: boolean;
    schedule: CronSchedule;
    payload: CronPayload;
    state: CronJobState;
    createdAtMs: number;
    updatedAtMs: number;
    deleteAfterRun: boolean;
}
export interface CronStore {
    version: number;
    jobs: CronJob[];
}
export declare function isCronAtSchedule(schedule: CronSchedule): schedule is CronAtSchedule;
export declare function isCronEverySchedule(schedule: CronSchedule): schedule is CronEverySchedule;
export declare function isCronExpressionSchedule(schedule: CronSchedule): schedule is CronExpressionSchedule;
//# sourceMappingURL=types.d.ts.map