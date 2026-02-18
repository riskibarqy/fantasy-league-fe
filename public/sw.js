const SW_VERSION = "v1";
const IMAGE_CACHE = `fantasy-images-${SW_VERSION}`;
const STATIC_CACHE = `fantasy-static-${SW_VERSION}`;
const KNOWN_CACHES = [IMAGE_CACHE, STATIC_CACHE];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(["/", "/index.html", "/manifest.webmanifest"]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("fantasy-") && !KNOWN_CACHES.includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".svg", ".webp", ".avif", ".gif"];

const isImageRequest = (request) => {
  if (request.destination === "image") {
    return true;
  }

  const url = new URL(request.url);
  const pathname = url.pathname.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => pathname.endsWith(ext));
};

const canBeCached = (response) => {
  if (!response) {
    return false;
  }

  return response.ok || response.type === "opaque";
};

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET" || !isImageRequest(request)) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(IMAGE_CACHE);
      const cached = await cache.match(request);

      const networkFetch = fetch(request)
        .then((response) => {
          if (canBeCached(response)) {
            void cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(networkFetch);
        return cached;
      }

      const networkResponse = await networkFetch;
      if (networkResponse) {
        return networkResponse;
      }

      return new Response("", { status: 504, statusText: "Image Unavailable" });
    })()
  );
});
