export function isCronAtSchedule(schedule) {
    return schedule.kind === "at";
}
export function isCronEverySchedule(schedule) {
    return schedule.kind === "every";
}
export function isCronExpressionSchedule(schedule) {
    return schedule.kind === "cron";
}
//# sourceMappingURL=types.js.map