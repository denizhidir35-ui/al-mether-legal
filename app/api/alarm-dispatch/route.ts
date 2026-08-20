import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import webpush from "web-push";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type AlarmStatus = "pending" | "sent" | "failed" | "cancelled";

function isAuthorizedCronRequest(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET || "";
  const legacySecret = process.env.ALARM_CRON_SECRET || "";
  const authorization = request.headers.get("authorization") || "";
  const legacyHeader =
    request.headers.get("x-alarm-cron-secret") || "";

  return (
    (cronSecret && authorization === `Bearer ${cronSecret}`) ||
    (legacySecret && legacyHeader === legacySecret)
  );
}

function configureWebPush() {
  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";

  if (!publicKey || !privateKey) {
    throw new Error("VAPID production yapılandırması eksik.");
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@almether.com",
    publicKey,
    privateKey
  );
}

async function moveAlarmStatus(
  supabase: SupabaseClient,
  alarmId: string,
  from: AlarmStatus,
  to: AlarmStatus
) {
  const result = await supabase
    .from("alarms")
    .update({ status: to })
    .eq("id", alarmId)
    .eq("status", from)
    .select("id")
    .maybeSingle();

  return {
    claimed: Boolean(result.data),
    error: result.error,
  };
}

function isTestOrDemoEvent(event: { source?: unknown; raw?: unknown }) {
  const source =
    typeof event.source === "string"
      ? event.source.trim().toLowerCase()
      : "";
  const blockedSources = new Set(["demo", "test", "mock", "seed"]);

  if (blockedSources.has(source)) {
    return true;
  }

  if (!event.raw || typeof event.raw !== "object" || Array.isArray(event.raw)) {
    return false;
  }

  const raw = event.raw as Record<string, unknown>;

  return Boolean(
    raw.demo || raw.isDemo || raw.test || raw.isTest || raw.mock
  );
}

async function dispatchAlarms(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { ok: false, error: "Yetkisiz cron isteği." },
      { status: 401 }
    );
  }

  try {
    configureWebPush();
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Push yapılandırması geçersiz.",
      },
      { status: 503 }
    );
  }

  const supabase = getSupabaseAdmin();
  const alarmResult = await supabase
    .from("alarms")
    .select(
      "id,user_id,calendar_event_id,alarm_time,alarm_type,message,status"
    )
    .eq("status", "pending")
    .lte("alarm_time", new Date().toISOString())
    .order("alarm_time", { ascending: true })
    .limit(100);

  if (alarmResult.error) {
    return NextResponse.json(
      { ok: false, error: alarmResult.error.message },
      { status: 500 }
    );
  }

  const alarms = alarmResult.data || [];
  let claimedCount = 0;
  let sentCount = 0;
  let failedCount = 0;
  let retryCount = 0;
  let cancelledCount = 0;

  for (const alarm of alarms) {
    /*
     * pending -> sent koşullu güncellemesi atomik claim'dir. İki paralel
     * dispatcher aynı satırı okusa bile yalnız biri push gönderebilir.
     * Gönderim başarısızsa aşağıda pending/failed durumuna taşınır.
     */
    const claim = await moveAlarmStatus(
      supabase,
      alarm.id,
      "pending",
      "sent"
    );

    if (claim.error) {
      failedCount += 1;
      continue;
    }

    if (!claim.claimed) {
      continue;
    }

    claimedCount += 1;

    const eventResult = await supabase
      .from("calendar_events")
      .select("source,raw")
      .eq("id", alarm.calendar_event_id)
      .eq("user_id", alarm.user_id)
      .maybeSingle();

    if (eventResult.error) {
      const retry = await moveAlarmStatus(
        supabase,
        alarm.id,
        "sent",
        "pending"
      );

      retryCount += retry.claimed ? 1 : 0;
      failedCount += 1;
      continue;
    }

    if (!eventResult.data) {
      await moveAlarmStatus(supabase, alarm.id, "sent", "failed");
      failedCount += 1;
      continue;
    }

    if (isTestOrDemoEvent(eventResult.data)) {
      const cancelled = await moveAlarmStatus(
        supabase,
        alarm.id,
        "sent",
        "cancelled"
      );

      cancelledCount += cancelled.claimed ? 1 : 0;
      continue;
    }

    const subscriptions = await supabase
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth,status")
      .eq("user_id", alarm.user_id)
      .eq("status", "active");

    if (subscriptions.error) {
      const retry = await moveAlarmStatus(
        supabase,
        alarm.id,
        "sent",
        "pending"
      );

      retryCount += retry.claimed ? 1 : 0;
      failedCount += 1;
      continue;
    }

    const activeSubscriptions = subscriptions.data || [];

    if (activeSubscriptions.length === 0) {
      await moveAlarmStatus(supabase, alarm.id, "sent", "failed");
      failedCount += 1;
      continue;
    }

    let alarmSent = false;
    let transientFailure = false;

    for (const subscription of activeSubscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          JSON.stringify({
            title: "AL METHER LEGAL",
            body: alarm.message,
            tag: alarm.id,
            requireInteraction: alarm.alarm_type === "same_day",
            url: `/calendar?event=${encodeURIComponent(
              alarm.calendar_event_id
            )}`,
          }),
          { TTL: 300, urgency: "high" }
        );

        alarmSent = true;
      } catch (pushError: unknown) {
        const statusCode =
          typeof pushError === "object" &&
          pushError !== null &&
          "statusCode" in pushError &&
          typeof pushError.statusCode === "number"
            ? pushError.statusCode
            : null;

        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from("push_subscriptions")
            .update({ status: "inactive" })
            .eq("id", subscription.id)
            .eq("user_id", alarm.user_id);
        } else {
          transientFailure = true;
        }
      }
    }

    if (alarmSent) {
      sentCount += 1;
      continue;
    }

    const nextStatus: AlarmStatus =
      transientFailure ? "pending" : "failed";
    const moved = await moveAlarmStatus(
      supabase,
      alarm.id,
      "sent",
      nextStatus
    );

    if (nextStatus === "pending" && moved.claimed) {
      retryCount += 1;
    }

    failedCount += 1;
  }

  return NextResponse.json({
    ok: true,
    checked: alarms.length,
    claimed: claimedCount,
    sent: sentCount,
    failed: failedCount,
    retry: retryCount,
    cancelled: cancelledCount,
  });
}

export async function GET(request: NextRequest) {
  return dispatchAlarms(request);
}

export async function POST(request: NextRequest) {
  return dispatchAlarms(request);
}
