/**
 * Service Worker pro PWA a push notifikace.
 * Minimalistický – bez rušivých prvků.
 */

const CACHE_NAZEV = "trebon-v1";

// Soubory pro offline cache
const SOUBORY_CACHE = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAZEV).then((cache) => cache.addAll(SOUBORY_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((klice) =>
      Promise.all(
        klice
          .filter((klic) => klic !== CACHE_NAZEV)
          .map((klic) => caches.delete(klic))
      )
    )
  );
  self.clients.claim();
});

// Strategie: network first, fallback na cache
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const klon = response.clone();
        caches.open(CACHE_NAZEV).then((cache) => cache.put(event.request, klon));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push notifikace – klidný tón
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const titulek = data.titulek ?? "Třeboň po celý rok";
  const text = data.text ?? "Na vás čeká další malý kousek Třeboně.";

  event.waitUntil(
    self.registration.showNotification(titulek, {
      body: text,
      icon: "/icon",
      badge: "/icon",
      tag: "trebon-novinka",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});
