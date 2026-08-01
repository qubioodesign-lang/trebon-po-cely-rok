/**
 * Service Worker pro PWA a push notifikace.
 * Minimalistický – bez rušivých prvků.
 */

const CACHE_NAZEV = "trebon-v6";

// Soubory pro offline cache
const SOUBORY_CACHE = ["/", "/manifest.json"];

/** Launcher ikony vždy stahovat ze sítě – neukládat do cache. */
function jeLauncherIkona(url) {
  const cesta = url.pathname;
  return cesta === "/icon" || cesta === "/pwa-launcher-icon";
}

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

// Strategie: network first, fallback na cache (launcher ikony pouze network)
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (jeLauncherIkona(url)) {
    event.respondWith(fetch(event.request));
    return;
  }

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
  const text = data.text ?? "Na chvíli zpátky do Třeboně.";

  event.waitUntil(
    self.registration.showNotification(titulek, {
      body: text,
      icon: "/icon?v=6",
      badge: "/icon?v=6",
      tag: "trebon-novinka",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});
