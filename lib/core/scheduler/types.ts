export type SchedulerJobStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "disabled";

export type SchedulerJobFrequency =
  | "manual"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | string;

export type SchedulerJobInput = {
  id: string;
  name: string;
  product: string;
  frequency: SchedulerJobFrequency;
  enabled: boolean;
  runAt?: string;
  metadata?: Record<string, unknown>;
};

export type SchedulerJob = SchedulerJobInput & {
  status: SchedulerJobStatus;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type SchedulerRunResult = {
  ok: boolean;
  job?: SchedulerJob;
  error?: string;
};
