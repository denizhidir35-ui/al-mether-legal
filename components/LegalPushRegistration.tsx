"use client";

import {
  useEffect,
} from "react";

import {
  openNotificationTarget,
} from "@/lib/notifications/clickThrough";

function urlBase64ToUint8Array(
  base64String: string
) {
  const padding =
    "=".repeat(
      (
        4 -
        (
          base64String.length %
          4
        )
      ) %
        4
    );

  const base64 =
    (
      base64String +
      padding
    )
      .replace(
        /-/g,
        "+"
      )
      .replace(
        /_/g,
        "/"
      );

  const rawData =
    window.atob(
      base64
    );

  const output =
    new Uint8Array(
      rawData.length
    );

  for (
    let index = 0;
    index <
    rawData.length;
    index += 1
  ) {
    output[index] =
      rawData.charCodeAt(
        index
      );
  }

  return output;
}

export default function LegalPushRegistration() {
  useEffect(() => {
    function handleNotificationOpen(event: MessageEvent) {
      if (event.data?.source !== "METHER_NOTIFICATION_OPEN") return;

      openNotificationTarget(event.data?.url);
    }

    navigator.serviceWorker?.addEventListener(
      "message",
      handleNotificationOpen
    );

    async function register() {
      try {
        if (
          !(
            "serviceWorker" in
            navigator
          ) ||
          !(
            "PushManager" in
            window
          ) ||
          !(
            "Notification" in
            window
          )
        ) {
          return;
        }

        if (
          Notification.permission !==
          "granted"
        ) {
          return;
        }

        const publicKey =
          process.env
            .NEXT_PUBLIC_VAPID_PUBLIC_KEY;

        if (
          !publicKey
        ) {
          return;
        }

        const registration =
          await navigator
            .serviceWorker
            .register(
              "/legal-push-sw.js"
            );

        let subscription =
          await registration
            .pushManager
            .getSubscription();

        if (
          !subscription
        ) {
          subscription =
            await registration
              .pushManager
              .subscribe({
                userVisibleOnly:
                  true,

                applicationServerKey:
                  urlBase64ToUint8Array(
                    publicKey
                  ),
              });
        }

        const json =
          subscription
            .toJSON();

        await fetch(
          "/api/push-subscription",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                json
              ),
          }
        );
      } catch (
        error
      ) {
        console.error(
          "LEGAL PUSH REGISTER ERROR:",
          error
        );
      }
    }

    register();

    return () => {
      navigator.serviceWorker?.removeEventListener(
        "message",
        handleNotificationOpen
      );
    };
  }, []);

  return null;
}
