/* Vineys Reader service worker
 * Bump CACHE_VERSION every time you upload a new index.html / manuscript.
 * Pages (index.html, buy.html) are fetched network-first, so readers get the
 * newest book whenever they are online, and the cached copy when they are not.
 */
const CACHE_VERSION = "vineys-2026-10-29-v1";
const CACHE_NAME = CACHE_VERSION;

const CORE_ASSETS = [
  "./",
  "index.html",
  "buy.html",
  "manifest.json",
  "cover.jpg",
  "icons/favicon-16.png",
  "icons/favicon-32.png",
  "icons/apple-touch-icon.png"
];

// Never cached, never served from cache (admin tool and payment checks)
const NEVER_CACHE = ["keygen.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Add one by one so a missing file can't break the whole install
      Promise.all(CORE_ASSETS.map((url) => cache.add(url).catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isFontRequest(url) {
  return url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
}

function networkFirst(request) {
  return fetch(request)
    .then((response) => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    })
    .catch(() =>
      caches.match(request, { ignoreSearch: true }).then((hit) => hit || caches.match("index.html"))
    );
}

function staleWhileRevalidate(request) {
  return caches.match(request).then((hit) => {
    const fresh = fetch(request)
      .then((response) => {
        if (response && (response.ok || response.type === "opaque")) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => hit);
    return hit || fresh;
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return; // payment/verify POSTs go straight to the network

  const url = new URL(request.url);

  if (isFontRequest(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (url.origin !== self.location.origin) return; // payment worker etc.: untouched

  if (NEVER_CACHE.some((name) => url.pathname.endsWith("/" + name) || url.pathname === "/" + name)) {
    return; // let the browser handle it normally
  }

  const isPage = request.mode === "navigate" ||
    url.pathname.endsWith(".html") || url.pathname.endsWith("/") || url.pathname.endsWith("manifest.json");

  event.respondWith(isPage ? networkFirst(request) : staleWhileRevalidate(request));
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});
