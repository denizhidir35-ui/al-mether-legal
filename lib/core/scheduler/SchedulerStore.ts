import { supabase } from "@/lib/supabase";
import type { SchedulerJob, SchedulerJobInput, SchedulerRunResult } from "./types";
import { createSchedulerJob } from "./SchedulerEngine";
import { CoreEvents } from "@/lib/core/events";

export class SchedulerStore {
  static async upsertJob(input: SchedulerJobInput): Promise<SchedulerRunResult> {
    try {
      const job = createSchedulerJob(input);

      const { error } = await supabase.from("core_scheduler_jobs").upsert({
        id: job.id,
        name: job.name,
        product: job.product,
        frequency: job.frequency,
        enabled: job.enabled,
        status: job.status,
        run_at: job.runAt || null,
        last_run_at: job.lastRunAt || null,
        next_run_at: job.nextRunAt || null,
        metadata: job.metadata || {},
        created_at: job.createdAt,
        updated_at: job.updatedAt,
      });

      if (error) {
        return {
          ok: false,
          job,
          error: error.message,
        };
      }

      await CoreEvents.publish({
        type: "scheduler.job.upserted",
        source: "system",
        product: job.product,
        payload: {
          job,
        },
      });

      return {
        ok: true,
        job,
      };
    } catch (error: any) {
      return {
        ok: false,
        error: error?.message || "SchedulerStore upsertJob hata verdi.",
      };
    }
  }

  static async listJobs(): Promise<{ ok: boolean; jobs: SchedulerJob[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from("core_scheduler_jobs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        return {
          ok: false,
          jobs: [],
          error: error.message,
        };
      }

      const jobs = (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        product: row.product,
        frequency: row.frequency,
        enabled: row.enabled,
        status: row.status,
        runAt: row.run_at || undefined,
        lastRunAt: row.last_run_at || undefined,
        nextRunAt: row.next_run_at || undefined,
        metadata: row.metadata || {},
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      return {
        ok: true,
        jobs,
      };
    } catch (error: any) {
      return {
        ok: false,
        jobs: [],
        error: error?.message || "SchedulerStore listJobs hata verdi.",
      };
    }
  }
}
