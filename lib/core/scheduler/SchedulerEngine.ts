import type { SchedulerJob, SchedulerJobFrequency, SchedulerJobInput } from "./types";

function addHours(date: Date, hours: number) {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function calculateNextRun(
  frequency: SchedulerJobFrequency,
  fromDate = new Date()
) {
  if (frequency === "hourly") return addHours(fromDate, 1).toISOString();
  if (frequency === "daily") return addDays(fromDate, 1).toISOString();
  if (frequency === "weekly") return addDays(fromDate, 7).toISOString();
  if (frequency === "monthly") return addMonths(fromDate, 1).toISOString();
  return undefined;
}

export function createSchedulerJob(input: SchedulerJobInput): SchedulerJob {
  const now = new Date().toISOString();

  return {
    ...input,
    status: input.enabled ? "idle" : "disabled",
    nextRunAt: input.enabled ? calculateNextRun(input.frequency) : undefined,
    createdAt: now,
    updatedAt: now,
  };
}
