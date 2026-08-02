/**
 * Service worker pro instalovatelnost BRÁNY (scope /brana/).
 * Oddělený od hlavního /sw.js projektu Třeboň po celý rok.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/** Network-only – neukládá HTML/JS do cache, aby neblokoval aktualizace ani instalaci. */
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(fetch(event.request));
});
