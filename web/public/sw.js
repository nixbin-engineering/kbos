const CACHE = "kbos-v1";
const PRECACHE = ["/", "/manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first strategy: always try network, fall back to cache for navigation
self.addEventListener("fetch", (e) => {
  const { request } = e;
  // Only handle GET requests
  if (request.method !== "GET") return;
  // Don't intercept API calls — always network
  if (request.url.includes("/api/")) return;

  e.respondWith(
    fetch(request)
      .then((res) => {
        // Cache successful navigation responses
        if (res.ok && request.mode === "navigate") {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request).then((r) => r ?? caches.match("/")))
  );
});
