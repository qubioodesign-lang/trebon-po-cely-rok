/**
 * Service worker jen pro správcovské upozornění na vzkaz Třeboně.
 * Scope je adresář /admin/. Galerijní /sw.js nemění a neřídí.
 * Bez fetch a bez notificationclick.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let title = "Třeboň po celý rok";
  let body = "Vzkaz";

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
    // Neplatný payload → pevný text výše.
  }

  event.waitUntil(self.registration.showNotification(title, { body }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
});
