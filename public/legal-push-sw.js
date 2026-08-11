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
          "/calendar",
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

self.addEventListener(
  "notificationclick",
  function (event) {
    event.notification.close();

    const targetUrl =
      event.notification
        ?.data
        ?.url ||
      "/calendar";

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
                client.navigate(
                  targetUrl
                );

                return client.focus();
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
