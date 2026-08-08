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

/**
 * Minimální interní Web Push handler.
 * Nemění install/activate/fetch ani installability.
 * Bez notificationclick – pouze zobrazení notifikace.
 */
self.addEventListener("push", (event) => {
  let title = "BRÁNA";
  let body = "V administraci BRÁNY je nové upozornění.";

  try {
    const data = event.data ? event.data.json() : null;
    if (data && typeof data === "object") {
      if (typeof data.title === "string" && data.title.trim()) {
        title = data.title.trim();
      }
      if (typeof data.body === "string" && data.body.trim()) {
        body = data.body.trim();
      }
    }
  } catch {
    // Neplatný / chybějící payload → bezpečný fallback výše.
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
    }),
  );
});
