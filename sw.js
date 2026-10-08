const CACHE_NAME = "e-ride-v100";

const STATIC_CACHE = [
  "./manifest.json"
];


// ========================================
// INSTALL
// ========================================

self.addEventListener("install", event => {

  event.waitUntil(

    caches.open(CACHE_NAME)
      .then(cache => {

        return cache.addAll(STATIC_CACHE);

      })
      .catch(error => {

        console.warn(
          "E RIDE cache install error:",
          error
        );

      })

  );

  // New SW immediately activate
  self.skipWaiting();

});


// ========================================
// ACTIVATE
// ========================================

self.addEventListener("activate", event => {

  event.waitUntil(

    (async () => {

      const keys =
        await caches.keys();

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

  if(event.request.method !== "GET"){
    return;
  }


  const url =
    new URL(event.request.url);


  /*
    Firebase / Google / Firestore
    ko Service Worker touch nahi karega.
  */

  const isFirebase =
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("firebaseapp.com") ||
    url.hostname.includes("gstatic.com") ||
    url.hostname.includes("google.com");


  if(isFirebase){
    return;
  }


  /*
    IMPORTANT:
    HTML/navigation ko CACHE NAHI KARNA.

    Isse GitHub Pages hamesha latest
    index.html / customer.html / driver.html
    serve karega.
  */

  if(event.request.mode === "navigate"){

    event.respondWith(

      fetch(event.request, {
        cache: "no-store"
      })

      .then(response => {

        return response;

      })

      .catch(() => {

        /*
          Network unavailable hone par
          browser ka normal error page use hoga.

          Purana index.html inject nahi karenge.
        */

        return new Response(
          `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <title>E RIDE</title>
            <style>
              body{
                margin:0;
                min-height:100vh;
                display:flex;
                align-items:center;
                justify-content:center;
                background:#070a10;
                color:white;
                font-family:Arial,sans-serif;
                text-align:center;
              }
              div{
                padding:30px;
              }
              button{
                margin-top:15px;
                padding:12px 20px;
                border:0;
                border-radius:10px;
                background:#22c55e;
                font-weight:bold;
              }
            </style>
          </head>
          <body>
            <div>
              <h2>E RIDE</h2>
              <p>Internet connection required.</p>
              <button onclick="location.reload()">
                Retry
              </button>
            </div>
          </body>
          </html>
          `,
          {
            status:503,
            headers:{
              "Content-Type":
                "text/html; charset=utf-8"
            }
          }
        );

      })

    );

    return;
  }


  /*
    Static files:
    network first → cache fallback
  */

  event.respondWith(

    fetch(event.request)

      .then(response => {

        if(
          response &&
          response.status === 200 &&
          response.type === "basic"
        ){

          const copy =
            response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {

              cache.put(
                event.request,
                copy
              );

            })
            .catch(() => {});

        }

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

  try{

    data =
      event.data
        ? event.data.json()
        : {};

  }
  catch(error){

    data = {

      body:
        event.data
          ? event.data.text()
          : "New E RIDE update"

    };

  }


  const title =
    data.title ||
    "E RIDE";


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
      [200,100,200],

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


    try{

      finalUrl =
        new URL(
          targetUrl,
          self.location.origin
        ).href;

    }
    catch(error){

      finalUrl =
        new URL(
          "./",
          self.location.origin
        ).href;

    }


    event.waitUntil(

      clients.matchAll({

        type:"window",

        includeUncontrolled:true

      })

      .then(clientList => {

        for(
          const client of clientList
        ){

          if(
            client.url.startsWith(
              self.location.origin
            ) &&
            "focus" in client
          ){

            if(
              "navigate" in client
            ){

              client.navigate(
                finalUrl
              );

            }

            return client.focus();

          }

        }


        if(
          clients.openWindow
        ){

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

    if(
      event.data?.type ===
      "SKIP_WAITING"
    ){

      self.skipWaiting();

    }

  }
);
