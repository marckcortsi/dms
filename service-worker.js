const CACHE_NAME = "revko-cache-v1";
const urlsToCache = [
  "/",            
  "/index.html",
  "/style.css",
  "/app.js",
  "/manifest.json",
  "/alerta.mp3",
  "/logo.webp"
];

// Install SW
self.addEventListener("install", (event) => {
  console.log("[ServiceWorker] Install");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[ServiceWorker] Caching app shell");
      return cache.addAll(urlsToCache);
    })
  );
});

// Activate SW
self.addEventListener("activate", (event) => {
  console.log("[ServiceWorker] Activate");
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log("[ServiceWorker] Removing old cache", key);
          return caches.delete(key);
        }
      }));
    })
  );
});

// Fetch
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // return from cache if present
      if (response) {
        return response;
      }
      // if not, fetch from network
      return fetch(event.request);
    })
  );
});