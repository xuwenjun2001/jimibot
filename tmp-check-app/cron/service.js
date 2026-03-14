import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInboundMessage } from "../bus/events.js";
import { MessageBus } from "../bus/queue.js";
import { isCronAtSchedule, isCronEverySchedule, isCronExpressionSchedule, } from "./types.js";
const STORE_VERSION = 1;
const MAX_TIMEOUT_MS = 2_147_483_647;
const CRON_SCAN_LIMIT_MINUTES = 366 * 24 * 60;
export class CronService {
    bus;
    storePath;
    now;
    idGenerator;
    store = null;
    timer = null;
    running = false;
    constructor(options) {
        this.bus = options.bus;
        this.storePath = options.storePath;
        this.now = options.now ?? (() => Date.now());
        this.idGenerator =
            options.idGenerator ?? (() => Math.random().toString(36).slice(2, 10));
    }
    async start() {
        if (this.running) {
            return;
        }
        this.running = true;
        await this.loadStore();
        this.recomputeNextRuns();
        await this.saveStore();
        this.armTimer();
    }
    stop() {
        this.running = false;
        if (this.timer !== null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
    status() {
        const store = this.ensureStore();
        return {
            enabled: this.running,
            jobs: store.jobs.length,
            nextWakeAtMs: this.getNextWakeAtMs(),
        };
    }
    listJobs(includeDisabled = false) {
        const store = this.ensureStore();
        const jobs = includeDisabled
            ? store.jobs
            : store.jobs.filter((job) => job.enabled);
        return jobs
            .slice()
            .sort((left, right) => (left.state.nextRunAtMs ?? Number.MAX_SAFE_INTEGER) -
            (right.state.nextRunAtMs ?? Number.MAX_SAFE_INTEGER))
            .map((job) => cloneJob(job));
    }
    async addJob(input) {
        validateScheduleForAdd(input.schedule);
        const store = await this.loadStore();
        const nowMs = this.now();
        const job = {
            id: this.idGenerator(),
            name: input.name,
            enabled: true,
            schedule: cloneSchedule(input.schedule),
            payload: clonePayload(input.payload),
            state: {
                nextRunAtMs: computeNextRun(input.schedule, nowMs),
                lastRunAtMs: null,
                lastStatus: null,
            },
            createdAtMs: nowMs,
            updatedAtMs: nowMs,
            deleteAfterRun: input.deleteAfterRun ?? false,
        };
        store.jobs.push(job);
        await this.saveStore();
        this.armTimer();
        return cloneJob(job);
    }
    async removeJob(jobId) {
        const store = await this.loadStore();
        const previousLength = store.jobs.length;
        store.jobs = store.jobs.filter((job) => job.id !== jobId);
        const removed = store.jobs.length !== previousLength;
        if (removed) {
            await this.saveStore();
            this.armTimer();
        }
        return removed;
    }
    async enableJob(jobId, enabled = true) {
        const store = await this.loadStore();
        const job = store.jobs.find((entry) => entry.id === jobId);
        if (job === undefined) {
            return null;
        }
        job.enabled = enabled;
        job.updatedAtMs = this.now();
        job.state.nextRunAtMs = enabled
            ? computeNextRun(job.schedule, this.now())
            : null;
        await this.saveStore();
        this.armTimer();
        return cloneJob(job);
    }
    async runJob(jobId, force = false) {
        const store = await this.loadStore();
        const job = store.jobs.find((entry) => entry.id === jobId);
        if (job === undefined) {
            return false;
        }
        if (!force && !job.enabled) {
            return false;
        }
        await this.executeJob(job);
        await this.saveStore();
        this.armTimer();
        return true;
    }
    async runDueJobs() {
        const store = await this.loadStore();
        const nowMs = this.now();
        const dueJobs = store.jobs.filter((job) => job.enabled &&
            job.state.nextRunAtMs !== null &&
            nowMs >= job.state.nextRunAtMs);
        for (const job of dueJobs) {
            await this.executeJob(job);
        }
        await this.saveStore();
        this.armTimer();
    }
    async executeJob(job) {
        const startedAt = this.now();
        try {
            await this.dispatchJob(job);
            job.state.lastStatus = "ok";
            delete job.state.lastError;
        }
        catch (error) {
            job.state.lastStatus = "error";
            job.state.lastError = getErrorMessage(error);
        }
        job.state.lastRunAtMs = startedAt;
        job.updatedAtMs = this.now();
        if (isCronAtSchedule(job.schedule)) {
            if (job.deleteAfterRun) {
                const store = this.ensureStore();
                store.jobs = store.jobs.filter((entry) => entry.id !== job.id);
            }
            else {
                job.enabled = false;
                job.state.nextRunAtMs = null;
            }
            return;
        }
        job.state.nextRunAtMs = computeNextRun(job.schedule, this.now());
    }
    async dispatchJob(job) {
        const metadata = {
            ...(job.payload.metadata ?? {}),
            cronJobId: job.id,
            cron: true,
            cronDeliver: job.payload.deliver,
        };
        this.bus.publishInbound(createInboundMessage({
            channel: job.payload.channel ?? "cli",
            senderId: "cron",
            chatId: job.payload.chatId ?? job.id,
            content: job.payload.message,
            metadata,
            sessionKeyOverride: job.payload.sessionKeyOverride ?? `cron:${job.id}`,
        }));
    }
    async loadStore() {
        if (this.store !== null) {
            return this.store;
        }
        try {
            const raw = await readFile(this.storePath, "utf-8");
            const parsed = JSON.parse(raw);
            this.store = normalizeCronStore(parsed);
        }
        catch {
            this.store = {
                version: STORE_VERSION,
                jobs: [],
            };
        }
        return this.store;
    }
    async saveStore() {
        const store = this.ensureStore();
        await mkdir(path.dirname(this.storePath), { recursive: true });
        await writeFile(this.storePath, JSON.stringify(store, null, 2), "utf-8");
    }
    recomputeNextRuns() {
        const store = this.ensureStore();
        const nowMs = this.now();
        for (const job of store.jobs) {
            if (!job.enabled) {
                job.state.nextRunAtMs = null;
                continue;
            }
            job.state.nextRunAtMs = computeNextRun(job.schedule, nowMs);
        }
    }
    getNextWakeAtMs() {
        const store = this.ensureStore();
        const wakeTimes = store.jobs
            .filter((job) => job.enabled && job.state.nextRunAtMs !== null)
            .map((job) => job.state.nextRunAtMs);
        return wakeTimes.length === 0 ? null : Math.min(...wakeTimes);
    }
    armTimer() {
        if (this.timer !== null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (!this.running) {
            return;
        }
        const nextWakeAtMs = this.getNextWakeAtMs();
        if (nextWakeAtMs === null) {
            return;
        }
        const delayMs = Math.max(0, nextWakeAtMs - this.now());
        this.timer = setTimeout(() => {
            void this.runDueJobs();
        }, Math.min(delayMs, MAX_TIMEOUT_MS));
    }
    ensureStore() {
        if (this.store === null) {
            this.store = {
                version: STORE_VERSION,
                jobs: [],
            };
        }
        return this.store;
    }
}
export function computeNextRun(schedule, nowMs) {
    if (isCronAtSchedule(schedule)) {
        return schedule.atMs > nowMs ? schedule.atMs : null;
    }
    if (isCronEverySchedule(schedule)) {
        return schedule.everyMs > 0 ? nowMs + schedule.everyMs : null;
    }
    if (isCronExpressionSchedule(schedule)) {
        return computeNextCronRun(schedule, nowMs);
    }
    return null;
}
function computeNextCronRun(schedule, nowMs) {
    const cron = parseCronExpression(schedule.expr);
    if (cron === null) {
        return null;
    }
    let candidate = Math.floor(nowMs / 60_000) * 60_000 + 60_000;
    for (let index = 0; index < CRON_SCAN_LIMIT_MINUTES; index += 1) {
        if (matchesCronExpression(cron, candidate, schedule.tz)) {
            return candidate;
        }
        candidate += 60_000;
    }
    return null;
}
function parseCronExpression(expr) {
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) {
        return null;
    }
    const minute = parts[0];
    const hour = parts[1];
    const day = parts[2];
    const month = parts[3];
    const weekday = parts[4];
    if (minute === undefined ||
        hour === undefined ||
        day === undefined ||
        month === undefined ||
        weekday === undefined) {
        return null;
    }
    const minuteMatcher = parseCronField(minute, 0, 59);
    const hourMatcher = parseCronField(hour, 0, 23);
    const dayMatcher = parseCronField(day, 1, 31);
    const monthMatcher = parseCronField(month, 1, 12);
    const weekdayMatcher = parseCronField(weekday, 0, 7, {
        normalize: (value) => (value === 7 ? 0 : value),
    });
    if (minuteMatcher === null ||
        hourMatcher === null ||
        dayMatcher === null ||
        monthMatcher === null ||
        weekdayMatcher === null) {
        return null;
    }
    return {
        minute: minuteMatcher,
        hour: hourMatcher,
        day: dayMatcher,
        month: monthMatcher,
        weekday: weekdayMatcher,
    };
}
function parseCronField(field, min, max, options = {}) {
    const normalize = options.normalize ?? ((value) => value);
    const values = new Set();
    for (const token of field.split(",")) {
        const parsed = parseCronToken(token.trim(), min, max);
        if (parsed === null) {
            return null;
        }
        for (const value of parsed) {
            values.add(normalize(value));
        }
    }
    return (value) => values.has(normalize(value));
}
function parseCronToken(token, min, max) {
    if (token === "*") {
        return buildRange(min, max, 1);
    }
    const stepMatch = token.match(/^(\*|\d+-\d+)\/(\d+)$/);
    if (stepMatch !== null) {
        const base = stepMatch[1];
        const stepRaw = stepMatch[2];
        if (base === undefined || stepRaw === undefined) {
            return null;
        }
        const step = Number.parseInt(stepRaw, 10);
        if (!Number.isInteger(step) || step <= 0) {
            return null;
        }
        if (base === "*") {
            return buildRange(min, max, step);
        }
        const [rangeStartRaw, rangeEndRaw] = base.split("-");
        if (rangeStartRaw === undefined || rangeEndRaw === undefined) {
            return null;
        }
        const rangeStart = Number.parseInt(rangeStartRaw, 10);
        const rangeEnd = Number.parseInt(rangeEndRaw, 10);
        if (!isWithinRange(rangeStart, min, max) ||
            !isWithinRange(rangeEnd, min, max) ||
            rangeStart > rangeEnd) {
            return null;
        }
        return buildRange(rangeStart, rangeEnd, step);
    }
    if (token.includes("-")) {
        const [rangeStartRaw, rangeEndRaw] = token.split("-");
        if (rangeStartRaw === undefined || rangeEndRaw === undefined) {
            return null;
        }
        const rangeStart = Number.parseInt(rangeStartRaw, 10);
        const rangeEnd = Number.parseInt(rangeEndRaw, 10);
        if (!isWithinRange(rangeStart, min, max) ||
            !isWithinRange(rangeEnd, min, max) ||
            rangeStart > rangeEnd) {
            return null;
        }
        return buildRange(rangeStart, rangeEnd, 1);
    }
    const value = Number.parseInt(token, 10);
    if (!isWithinRange(value, min, max)) {
        return null;
    }
    return [value];
}
function buildRange(start, end, step) {
    const values = [];
    for (let value = start; value <= end; value += step) {
        values.push(value);
    }
    return values;
}
function isWithinRange(value, min, max) {
    return Number.isInteger(value) && value >= min && value <= max;
}
function matchesCronExpression(expression, candidateMs, timeZone) {
    const parts = getDateParts(candidateMs, timeZone);
    return (expression.minute(parts.minute) &&
        expression.hour(parts.hour) &&
        expression.day(parts.day) &&
        expression.month(parts.month) &&
        expression.weekday(parts.weekday));
}
function getDateParts(timestampMs, timeZone) {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        minute: "numeric",
        hour: "numeric",
        day: "numeric",
        month: "numeric",
        weekday: "short",
        hour12: false,
    });
    const parts = formatter.formatToParts(new Date(timestampMs));
    const values = new Map(parts.map((part) => [part.type, part.value]));
    return {
        minute: Number.parseInt(values.get("minute") ?? "0", 10),
        hour: Number.parseInt(values.get("hour") ?? "0", 10),
        day: Number.parseInt(values.get("day") ?? "1", 10),
        month: Number.parseInt(values.get("month") ?? "1", 10),
        weekday: mapWeekday(values.get("weekday") ?? "Sun"),
    };
}
function mapWeekday(weekday) {
    switch (weekday) {
        case "Mon":
            return 1;
        case "Tue":
            return 2;
        case "Wed":
            return 3;
        case "Thu":
            return 4;
        case "Fri":
            return 5;
        case "Sat":
            return 6;
        default:
            return 0;
    }
}
function validateScheduleForAdd(schedule) {
    if (isCronAtSchedule(schedule)) {
        if (!Number.isInteger(schedule.atMs) || schedule.atMs <= 0) {
            throw new Error("atMs must be a positive integer");
        }
        return;
    }
    if (isCronEverySchedule(schedule)) {
        if (!Number.isInteger(schedule.everyMs) || schedule.everyMs <= 0) {
            throw new Error("everyMs must be a positive integer");
        }
        return;
    }
    if (schedule.tz !== undefined) {
        new Intl.DateTimeFormat("en-US", {
            timeZone: schedule.tz,
        });
    }
    if (parseCronExpression(schedule.expr) === null) {
        throw new Error(`invalid cron expression: ${schedule.expr}`);
    }
}
function normalizeCronStore(raw) {
    if (!isRecord(raw) || !Array.isArray(raw.jobs)) {
        return {
            version: STORE_VERSION,
            jobs: [],
        };
    }
    return {
        version: typeof raw.version === "number" && Number.isInteger(raw.version)
            ? raw.version
            : STORE_VERSION,
        jobs: raw.jobs.flatMap((entry) => {
            const job = normalizeCronJob(entry);
            return job === null ? [] : [job];
        }),
    };
}
function normalizeCronJob(raw) {
    if (!isRecord(raw)) {
        return null;
    }
    const schedule = normalizeSchedule(raw.schedule);
    const payload = normalizePayload(raw.payload);
    const state = normalizeJobState(raw.state);
    if (schedule === null || payload === null || state === null) {
        return null;
    }
    const id = typeof raw.id === "string" ? raw.id : null;
    const name = typeof raw.name === "string" ? raw.name : null;
    if (id === null || name === null) {
        return null;
    }
    return {
        id,
        name,
        enabled: raw.enabled !== false,
        schedule,
        payload,
        state,
        createdAtMs: typeof raw.createdAtMs === "number" ? Math.trunc(raw.createdAtMs) : 0,
        updatedAtMs: typeof raw.updatedAtMs === "number" ? Math.trunc(raw.updatedAtMs) : 0,
        deleteAfterRun: raw.deleteAfterRun === true,
    };
}
function normalizeSchedule(raw) {
    if (!isRecord(raw) || typeof raw.kind !== "string") {
        return null;
    }
    switch (raw.kind) {
        case "at":
            if (typeof raw.atMs !== "number") {
                return null;
            }
            return { kind: "at", atMs: Math.trunc(raw.atMs) };
        case "every":
            if (typeof raw.everyMs !== "number") {
                return null;
            }
            return { kind: "every", everyMs: Math.trunc(raw.everyMs) };
        case "cron":
            if (typeof raw.expr !== "string") {
                return null;
            }
            if (typeof raw.tz === "string") {
                return { kind: "cron", expr: raw.expr, tz: raw.tz };
            }
            return { kind: "cron", expr: raw.expr };
        default:
            return null;
    }
}
function normalizePayload(raw) {
    if (!isRecord(raw) || typeof raw.message !== "string") {
        return null;
    }
    const payload = {
        kind: raw.kind === "system_event" ? "system_event" : "agent_turn",
        message: raw.message,
        deliver: raw.deliver === true,
    };
    if (typeof raw.channel === "string") {
        payload.channel = raw.channel;
    }
    if (typeof raw.chatId === "string") {
        payload.chatId = raw.chatId;
    }
    if (typeof raw.sessionKeyOverride === "string") {
        payload.sessionKeyOverride = raw.sessionKeyOverride;
    }
    if (isRecord(raw.metadata)) {
        payload.metadata = { ...raw.metadata };
    }
    return payload;
}
function normalizeJobState(raw) {
    if (!isRecord(raw)) {
        return {
            nextRunAtMs: null,
            lastRunAtMs: null,
            lastStatus: null,
        };
    }
    const state = {
        nextRunAtMs: typeof raw.nextRunAtMs === "number" ? Math.trunc(raw.nextRunAtMs) : null,
        lastRunAtMs: typeof raw.lastRunAtMs === "number" ? Math.trunc(raw.lastRunAtMs) : null,
        lastStatus: raw.lastStatus === "ok" ||
            raw.lastStatus === "error" ||
            raw.lastStatus === "skipped"
            ? raw.lastStatus
            : null,
    };
    if (typeof raw.lastError === "string") {
        state.lastError = raw.lastError;
    }
    return state;
}
function cloneJob(job) {
    return {
        ...job,
        schedule: cloneSchedule(job.schedule),
        payload: clonePayload(job.payload),
        state: {
            ...job.state,
        },
    };
}
function cloneSchedule(schedule) {
    if (isCronAtSchedule(schedule)) {
        const result = { kind: "at", atMs: schedule.atMs };
        return result;
    }
    if (isCronEverySchedule(schedule)) {
        const result = {
            kind: "every",
            everyMs: schedule.everyMs,
        };
        return result;
    }
    const result = {
        kind: "cron",
        expr: schedule.expr,
    };
    if (schedule.tz !== undefined) {
        result.tz = schedule.tz;
    }
    return result;
}
function clonePayload(payload) {
    const result = {
        kind: payload.kind,
        message: payload.message,
        deliver: payload.deliver,
    };
    if (payload.channel !== undefined) {
        result.channel = payload.channel;
    }
    if (payload.chatId !== undefined) {
        result.chatId = payload.chatId;
    }
    if (payload.sessionKeyOverride !== undefined) {
        result.sessionKeyOverride = payload.sessionKeyOverride;
    }
    if (payload.metadata !== undefined) {
        result.metadata = { ...payload.metadata };
    }
    return result;
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function getErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
//# sourceMappingURL=service.js.map