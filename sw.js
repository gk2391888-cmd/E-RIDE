const CACHE_NAME = "e-ride-v3";

const APP_SHELL = [
  "./",
  "./index.html",
  "./customer.html",
  "./driver.html",
  "./admin.html",
  "./manifest.json"
];

// ===============================
// INSTALL
// ===============================
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL).catch(() => {}))
  );

  self.skipWaiting();
});


// ===============================
// ACTIVATE
// ===============================
self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
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


// ===============================
// FETCH
// ===============================
self.addEventListener("fetch", event => {

  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  // Firebase / Firestore / Google APIs ko cache mat karo
  const isExternalApi =
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("gstatic.com") ||
    url.hostname.includes("firebaseapp.com");

  if (isExternalApi) {
    return;
  }

  // Navigation requests
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, copy))
            .catch(() => {});

          return response;
        })
        .catch(() => {
          return caches.match(event.request)
            .then(cached => {
              return cached || caches.match("./index.html");
            });
        })
    );

    return;
  }

  // Static files: Network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {

        // Sirf successful responses cache karo
        if (response && response.status === 200) {
          const copy = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, copy))
            .catch(() => {});
        }

        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});


// ===============================
// PUSH NOTIFICATION
// ===============================
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

  const title = data.title || "E RIDE";

  const options = {
    body: data.body || "You have a new update.",
    icon: data.icon || "./icon-192.png",
    badge: data.badge || "./icon-192.png",

    data: data.data || {
      url: data.url || "./"
    },

    vibrate: [200, 100, 200],

    tag: data.tag || "e-ride-notification",

    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});


// ===============================
// NOTIFICATION CLICK
// ===============================
self.addEventListener("notificationclick", event => {

  event.notification.close();

  const notificationData =
    event.notification.data || {};

  let targetUrl =
    notificationData.url ||
    notificationData.path ||
    "./";

  // Agar full URL hai
  let finalUrl;

  try {
    finalUrl = new URL(
      targetUrl,
      self.location.origin
    ).href;
  } catch (error) {
    finalUrl = new URL(
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

      // Existing E RIDE tab ko use karo
      for (const client of clientList) {

        if (
          client.url.startsWith(self.location.origin) &&
          "focus" in client
        ) {

          if ("navigate" in client) {
            client.navigate(finalUrl);
          }

          return client.focus();
        }
      }

      // Existing tab nahi mila
      if (clients.openWindow) {
        return clients.openWindow(finalUrl);
      }

    })
  );
});


// ===============================
// MESSAGE
// ===============================
self.addEventListener("message", event => {

  if (!event.data) {
    return;
  }

  // New service worker immediately activate
  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

});
