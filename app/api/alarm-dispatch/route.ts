import {
  NextRequest,
  NextResponse,
} from "next/server";

import webpush from "web-push";

import {
  getSupabaseAdmin,
} from "@/lib/supabaseAdmin";

function getCronSecret() {
  return (
    process.env.ALARM_CRON_SECRET ||
    ""
  );
}

function getTurkeyNowIso() {
  const now =
    new Date();

  return now.toISOString();
}

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT ||
    "mailto:admin@almether.com",

  process.env
    .NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    "",

  process.env
    .VAPID_PRIVATE_KEY ||
    ""
);

export async function POST(
  request: NextRequest
) {
  const expectedSecret =
    getCronSecret();

  const receivedSecret =
    request.headers.get(
      "x-alarm-cron-secret"
    ) || "";

  if (
    !expectedSecret ||
    receivedSecret !==
      expectedSecret
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Yetkisiz cron isteği.",
      },
      {
        status: 401,
      }
    );
  }

  const supabase =
    getSupabaseAdmin();

  const now =
    getTurkeyNowIso();

  /*
   * Zamanı gelmiş ve henüz gönderilmemiş
   * alarmları çekiyoruz.
   */
  const alarmResult =
    await supabase
      .from("alarms")
      .select(
        "id,user_id,calendar_event_id,alarm_time,alarm_type,message,status"
      )
      .eq(
        "status",
        "pending"
      )
      .lte(
        "alarm_time",
        now
      )
      .order(
        "alarm_time",
        {
          ascending: true,
        }
      )
      .limit(100);

  if (
    alarmResult.error
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          alarmResult
            .error
            .message,
      },
      {
        status: 500,
      }
    );
  }

  const alarms =
    alarmResult.data ||
    [];

  let sentCount = 0;
  let failedCount = 0;

  for (
    const alarm
    of alarms
  ) {
    const subscriptions =
      await supabase
        .from(
          "push_subscriptions"
        )
        .select(
          "id,endpoint,p256dh,auth,status"
        )
        .eq(
          "user_id",
          alarm.user_id
        )
        .eq(
          "status",
          "active"
        );

    if (
      subscriptions.error
    ) {
      failedCount += 1;
      continue;
    }

    let alarmSent = false;

    for (
      const subscription
      of subscriptions.data ||
      []
    ) {
      try {
        await webpush
          .sendNotification(
            {
              endpoint:
                subscription.endpoint,

              keys: {
                p256dh:
                  subscription.p256dh,

                auth:
                  subscription.auth,
              },
            },

            JSON.stringify({
              title:
                "AL METHER LEGAL",

              body:
                alarm.message,

              tag:
                alarm.id,

              requireInteraction:
                alarm.alarm_type ===
                  "same_day",

              url:
                `/calendar?event=${encodeURIComponent(
                  alarm.calendar_event_id
                )}`,
            })
          );

        alarmSent = true;
      } catch (
        pushError: any
      ) {
        /*
         * Push endpoint artık geçersizse
         * subscription'ı pasif yap.
         */
        if (
          pushError?.statusCode ===
            404 ||
          pushError?.statusCode ===
            410
        ) {
          await supabase
            .from(
              "push_subscriptions"
            )
            .update({
              status:
                "inactive",
            })
            .eq(
              "id",
              subscription.id
            );
        }
      }
    }

    if (
      alarmSent
    ) {
      await supabase
        .from("alarms")
        .update({
          status:
            "sent",
        })
        .eq(
          "id",
          alarm.id
        )
        .eq(
          "status",
          "pending"
        );

      sentCount += 1;
    } else {
      failedCount += 1;
    }
  }

  return NextResponse.json({
    ok: true,

    checked:
      alarms.length,

    sent:
      sentCount,

    failed:
      failedCount,
  });
}
