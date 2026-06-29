import { supabase } from "@/lib/supabase";
import type { HealthCheckItem, HealthCheckResult } from "./types";

async function runCheck(
  name: string,
  fn: () => Promise<string>
): Promise<HealthCheckItem> {
  const start = Date.now();

  try {
    const message = await fn();

    return {
      name,
      status: "ok",
      message,
      durationMs: Date.now() - start,
    };
  } catch (error: any) {
    return {
      name,
      status: "fail",
      message: error?.message || "Kontrol başarısız.",
      durationMs: Date.now() - start,
    };
  }
}

export class HealthCheckEngine {
  static async run(): Promise<HealthCheckResult> {
    const start = Date.now();

    const checks = await Promise.all([
      runCheck("environment", async () => {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
          throw new Error("NEXT_PUBLIC_SUPABASE_URL eksik.");
        }

        if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY eksik.");
        }

        if (!process.env.GEMINI_API_KEY) {
          throw new Error("GEMINI_API_KEY eksik.");
        }

        return "Environment değişkenleri hazır.";
      }),

      runCheck("supabase.deadlines", async () => {
        const { error } = await supabase.from("deadlines").select("id").limit(1);

        if (error) {
          throw new Error(error.message);
        }

        return "Deadlines tablosu erişilebilir.";
      }),

      runCheck("supabase.calendar_events", async () => {
        const { error } = await supabase.from("calendar_events").select("id").limit(1);

        if (error) {
          throw new Error(error.message);
        }

        return "Calendar events tablosu erişilebilir.";
      }),

      runCheck("supabase.calendar_reminders", async () => {
        const { error } = await supabase.from("calendar_reminders").select("id").limit(1);

        if (error) {
          throw new Error(error.message);
        }

        return "Calendar reminders tablosu erişilebilir.";
      }),

      runCheck("supabase.core_events", async () => {
        const { error } = await supabase.from("core_events").select("id").limit(1);

        if (error) {
          throw new Error(error.message);
        }

        return "Core events tablosu erişilebilir.";
      }),

      runCheck("supabase.core_notifications", async () => {
        const { error } = await supabase.from("core_notifications").select("id").limit(1);

        if (error) {
          throw new Error(error.message);
        }

        return "Core notifications tablosu erişilebilir.";
      }),

      runCheck("supabase.core_scheduler_jobs", async () => {
        const { error } = await supabase.from("core_scheduler_jobs").select("id").limit(1);

        if (error) {
          throw new Error(error.message);
        }

        return "Core scheduler jobs tablosu erişilebilir.";
      }),
    ]);

    return {
      ok: checks.every((check) => check.status === "ok"),
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      checks,
    };
  }
}
