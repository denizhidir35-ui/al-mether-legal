export type HealthCheckStatus = "ok" | "fail";

export type HealthCheckItem = {
  name: string;
  status: HealthCheckStatus;
  message: string;
  durationMs: number;
};

export type HealthCheckResult = {
  ok: boolean;
  checkedAt: string;
  durationMs: number;
  checks: HealthCheckItem[];
};
