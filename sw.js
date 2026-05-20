const CACHE_NAME = "opacka-v3";
const CACHE_PREFIX = "opacka-";
const APP_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      const oldAppCaches = keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME);
      await Promise.all(oldAppCaches.map((key) => caches.delete(key)));
      await self.clients.claim();

      if (!oldAppCaches.length) {
        return;
      }

      const clients = await self.clients.matchAll({ type: "window" });
      await Promise.all(clients.map((client) => client.navigate(client.url)));
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  if (requestUrl.hostname === "ckan2.multimediagdansk.pl") {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
