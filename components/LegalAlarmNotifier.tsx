"use client";

import {
  useEffect,
} from "react";

type AlarmRow = {
  id: string;
  calendar_event_id: string;
  legal_deadline_id: string;
  alarm_time: string;
  alarm_type: string;
  message: string;
  status: string;
};

function toTurkeyComparable(
  value: string
) {
  /*
   * Alarm motoru zamanı timezone suffix olmadan
   * Europe/Istanbul yerel saati olarak üretiyor.
   */
  const normalized =
    value.includes("Z") ||
    /[+-]\d\d:\d\d$/.test(value)
      ? value
      : `${value}+03:00`;

  return new Date(
    normalized
  ).getTime();
}

export default function LegalAlarmNotifier() {
  useEffect(() => {
    let disposed = false;

    async function requestPermission() {
      if (
        !("Notification" in window)
      ) {
        return;
      }

      if (
        Notification.permission ===
        "default"
      ) {
        try {
          await Notification
            .requestPermission();
        } catch {
          // Kullanıcı izin vermeyebilir.
        }
      }
    }

    async function checkAlarms() {
      try {
        const response =
          await fetch(
            "/api/alarms",
            {
              cache:
                "no-store",
            }
          );

        if (
          !response.ok
        ) {
          return;
        }

        const data =
          await response.json();

        const alarms:
          AlarmRow[] =
          Array.isArray(
            data?.alarms
          )
            ? data.alarms
            : [];

        const now =
          Date.now();

        for (
          const alarm
          of alarms
        ) {
          if (
            disposed ||
            alarm.status !==
              "pending"
          ) {
            continue;
          }

          const trigger =
            toTurkeyComparable(
              alarm.alarm_time
            );

          if (
            Number.isNaN(
              trigger
            ) ||
            trigger > now
          ) {
            continue;
          }

          const seenKey =
            `legal-alarm-notified:${alarm.id}`;

          if (
            window.localStorage
              .getItem(
                seenKey
              )
          ) {
            continue;
          }

          if (
            "Notification" in
              window &&
            Notification.permission ===
              "granted"
          ) {
            const notification =
              new Notification(
                "AL METHER LEGAL",
                {
                  body:
                    alarm.message,

                  tag:
                    alarm.id,

                  requireInteraction:
                    alarm.alarm_type ===
                      "same_day",
                }
              );

            notification.onclick =
              () => {
                window.focus();

                window.location.href =
                  `/calendar?event=${encodeURIComponent(
                    alarm.calendar_event_id
                  )}`;

                notification.close();
              };
          }

          window.localStorage
            .setItem(
              seenKey,
              new Date()
                .toISOString()
            );
        }
      } catch {
        /*
         * Alarm kontrolü kullanıcı deneyimini
         * bozmayacak; bir sonraki kontrolde tekrar dener.
         */
      }
    }

    requestPermission();

    checkAlarms();

    const interval =
      window.setInterval(
        checkAlarms,
        60 * 1000
      );

    return () => {
      disposed = true;

      window.clearInterval(
        interval
      );
    };
  }, []);

  return null;
}
