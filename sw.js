const CACHE_NAME = "e-ride-v101";


// ========================================
// INSTALL
// ========================================

self.addEventListener("install", event => {

  console.log("E RIDE Service Worker installing...");

  // Immediately activate new service worker
  self.skipWaiting();

});


// ========================================
// ACTIVATE
// ========================================

self.addEventListener("activate", event => {

  event.waitUntil(

    (async () => {

      console.log("E RIDE Service Worker activated");

      const keys = await caches.keys();

      await Promise.all(

        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))

      );

      await self.clients.claim();

    })()

  );

});


// ========================================
// FETCH
// ========================================

self.addEventListener("fetch", event => {

  // Only GET requests
  if (event.request.method !== "GET") {
    return;
  }


  const url =
    new URL(event.request.url);


  // ======================================
  // Firebase / Google requests
  // NEVER intercept
  // ======================================

  const isExternalApi =
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("firebaseapp.com") ||
    url.hostname.includes("gstatic.com") ||
    url.hostname.includes("google.com");


  if (isExternalApi) {
    return;
  }


  // ======================================
  // HTML / PAGE NAVIGATION
  // ALWAYS NETWORK
  // ======================================

  if (event.request.mode === "navigate") {

    event.respondWith(

      fetch(event.request, {
        cache: "no-store"
      })

    );

    return;
  }


  // ======================================
  // OTHER STATIC FILES
  // Network first
  // ======================================

  event.respondWith(

    fetch(event.request)

      .then(response => {

        return response;

      })

      .catch(() => {

        return caches.match(
          event.request
        );

      })

  );

});


// ========================================
// PUSH NOTIFICATION
// ========================================

self.addEventListener("push", event => {

  let data = {};

  try {

    data = event.data
      ? event.data.json()
      : {};

  } catch (error) {

    data = {
      body: event.data
        ? event.data.text()
        : "New E RIDE update"
    };

  }


  const title =
    data.title || "E RIDE";


  const options = {

    body:
      data.body ||
      "You have a new update.",

    icon:
      data.icon ||
      "./icon-192.png",

    badge:
      data.badge ||
      "./icon-192.png",

    data:
      data.data ||
      {
        url:
          data.url ||
          "./"
      },

    vibrate:
      [200, 100, 200],

    tag:
      data.tag ||
      "e-ride-notification",

    renotify:
      true

  };


  event.waitUntil(

    self.registration.showNotification(
      title,
      options
    )

  );

});


// ========================================
// NOTIFICATION CLICK
// ========================================

self.addEventListener(
  "notificationclick",
  event => {

    event.notification.close();


    const notificationData =
      event.notification.data || {};


    let targetUrl =
      notificationData.url ||
      notificationData.path ||
      "./";


    let finalUrl;


    try {

      finalUrl =
        new URL(
          targetUrl,
          self.location.origin
        ).href;

    } catch (error) {

      finalUrl =
        new URL(
          "./",
          self.location.origin
        ).href;

    }


    event.waitUntil(

      clients.matchAll({
        type: "window",
        includeUncontrolled: true
      })

      .then(clientList => {

        for (
          const client of clientList
        ) {

          if (
            client.url.startsWith(
              self.location.origin
            ) &&
            "focus" in client
          ) {

            if (
              "navigate" in client
            ) {

              client.navigate(
                finalUrl
              );

            }

            return client.focus();

          }

        }


        if (clients.openWindow) {

          return clients.openWindow(
            finalUrl
          );

        }

      })

    );

  }
);


// ========================================
// MESSAGE
// ========================================

self.addEventListener(
  "message",
  event => {

    if (
      event.data &&
      event.data.type ===
      "SKIP_WAITING"
    ) {

      self.skipWaiting();

    }

  }
);
