self.addEventListener(
  "push",
  function (event) {
    let data = {};

    try {
      data =
        event.data
          ? event.data.json()
          : {};
    } catch {
      data = {
        title:
          "AL METHER LEGAL",

        body:
          event.data
            ? event.data.text()
            : "Hukuki süre hatırlatması",
      };
    }

    const title =
      data.title ||
      "AL METHER LEGAL";

    const options = {
      body:
        data.body ||
        "Hukuki süre hatırlatması",

      tag:
        data.tag ||
        "al-mether-legal-alarm",

      requireInteraction:
        Boolean(
          data.requireInteraction
        ),

      data: {
        url:
          data.url ||
          "/inbox",
      },
    };

    event.waitUntil(
      self.registration
        .showNotification(
          title,
          options
        )
    );
  }
);

function safeNotificationTarget(value) {
  let url;

  try {
    url = new URL(
      String(value || "/inbox"),
      self.location.origin
    );
  } catch {
    return "/inbox";
  }

  if (url.origin !== self.location.origin) {
    return "/inbox";
  }

  const idPattern = /^[A-Za-z0-9_-]{1,160}$/;

  if (url.pathname === "/calendar") {
    const eventId = url.searchParams.get("event") || "";

    return idPattern.test(eventId)
      ? `/calendar?event=${encodeURIComponent(eventId)}`
      : "/calendar";
  }

  if (url.pathname === "/cases") {
    const caseId = url.searchParams.get("case") || "";

    return idPattern.test(caseId)
      ? `/cases?case=${encodeURIComponent(caseId)}`
      : "/cases";
  }

  return url.pathname === "/inbox" ? "/inbox" : "/inbox";
}

self.addEventListener(
  "notificationclick",
  function (event) {
    event.notification.close();

    const targetUrl = safeNotificationTarget(
      event.notification?.data?.url
    );

    event.waitUntil(
      clients
        .matchAll({
          type: "window",
          includeUncontrolled:
            true,
        })
        .then(
          function (
            clientList
          ) {
            for (
              const client
              of clientList
            ) {
              if (
                "focus" in client
              ) {
                client.postMessage({
                  source:
                    "METHER_NOTIFICATION_OPEN",
                  url: targetUrl,
                });

                return client
                  .focus()
                  .then(() =>
                    client.navigate(
                      targetUrl
                    )
                  );
              }
            }

            if (
              clients.openWindow
            ) {
              return clients
                .openWindow(
                  targetUrl
                );
            }
          }
        )
    );
  }
);
