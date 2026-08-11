"use client";

import {
  useEffect,
  useState,
} from "react";

function urlBase64ToUint8Array(
  base64String: string
) {
  const padding =
    "=".repeat(
      (
        4 -
        (base64String.length % 4)
      ) % 4
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

export default function LegalPushPermissionPrompt() {
  const [
    visible,
    setVisible,
  ] =
    useState(false);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState("");

  useEffect(() => {
    if (
      !(
        "Notification" in
        window
      )
    ) {
      return;
    }

    if (
      Notification.permission ===
      "default"
    ) {
      setVisible(true);
    }
  }, []);

  async function enableNotifications() {
    try {
      setBusy(true);
      setMessage("");

      if (
        !(
          "serviceWorker" in
          navigator
        ) ||
        !(
          "PushManager" in
          window
        )
      ) {
        setMessage(
          "Bu cihaz Web Push desteklemiyor."
        );

        return;
      }

      const isIos =
        /iPhone|iPad|iPod/i.test(
          navigator.userAgent
        );

      const standalone =
        window.matchMedia(
          "(display-mode: standalone)"
        ).matches ||
        Boolean(
          (
            navigator as Navigator & {
              standalone?: boolean;
            }
          ).standalone
        );

      if (
        isIos &&
        !standalone
      ) {
        setMessage(
          "iPhone'da bildirim için uygulamayı Safari > Paylaş > Ana Ekrana Ekle ile yükleyin."
        );

        return;
      }

      const permission =
        await Notification
          .requestPermission();

      if (
        permission !==
        "granted"
      ) {
        setMessage(
          "Bildirim izni verilmedi."
        );

        return;
      }

      const publicKey =
        process.env
          .NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!publicKey) {
        setMessage(
          "Push anahtarı bulunamadı."
        );

        return;
      }

      const registration =
        await navigator
          .serviceWorker
          .register(
            "/legal-push-sw.js"
          );

      await navigator
        .serviceWorker
        .ready;

      let subscription =
        await registration
          .pushManager
          .getSubscription();

      if (!subscription) {
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

      const response =
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
                subscription
                  .toJSON()
              ),
          }
        );

      if (
        !response.ok
      ) {
        let error =
          "Push aboneliği kaydedilemedi.";

        try {
          const data =
            await response.json();

          error =
            data?.error ||
            error;
        } catch {}

        throw new Error(
          error
        );
      }

      setVisible(false);
    } catch (
      error: unknown
    ) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Bildirim etkinleştirilemedi."
      );
    } finally {
      setBusy(false);
    }
  }

  if (!visible) {
    return null;
  }

  return (
    <div className="legal-push-permission">
      <div>
        <strong>
          Hukuki alarm bildirimleri
        </strong>

        <span>
          Tebligat ve süre hatırlatmalarını cihazınızda görün.
        </span>

        {message && (
          <small>
            {message}
          </small>
        )}
      </div>

      <button
        type="button"
        onClick={
          enableNotifications
        }
        disabled={
          busy
        }
      >
        {busy
          ? "Açılıyor..."
          : "Bildirimleri Etkinleştir"}
      </button>
    </div>
  );
}
