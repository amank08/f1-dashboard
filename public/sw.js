const CACHE_NAME = "undercut-v2";
const PRECACHE_URLS = ["/", "/live"];
const IS_LOCAL_DEV =
  self.location.hostname === "localhost" ||
  self.location.hostname === "127.0.0.1";

if (IS_LOCAL_DEV) {
  self.addEventListener("install", () => {
    self.skipWaiting();
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .then(() => self.registration.unregister())
    );
  });
} else {
  self.addEventListener("install", (event) => {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
    );
    self.skipWaiting();
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
    );
    self.clients.claim();
  });

  self.addEventListener("fetch", (event) => {
    const { request } = event;

    // Skip non-GET, API/data, and Next internals.
    if (request.method !== "GET") return;
    const url = new URL(request.url);
    if (
      url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/_next/") ||
      url.pathname === "/sw.js"
    ) {
      return;
    }

    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && url.pathname.match(/\.(svg|png|ico|woff2?)$/)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            if (request.mode === "navigate") {
              return caches.match("/");
            }
            return new Response("Offline", { status: 503 });
          });
        })
    );
  });
}
