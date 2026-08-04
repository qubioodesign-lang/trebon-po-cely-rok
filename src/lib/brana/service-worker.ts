import { jeBranaSubdomenaHost } from "./cesty";

/**
 * Odstraní pouze starou experimentální registraci `/sw.js` na originu BRÁNY.
 * Nikdy neregistruje ani nemaže `/brana/sw.js` ani nic na www.
 */
async function odstranitStarouKorovouRegistraciSw(): Promise<void> {
  const registrace = await navigator.serviceWorker.getRegistrations();

  await Promise.all(
    registrace.map(async (reg) => {
      const scriptUrl =
        reg.active?.scriptURL ??
        reg.waiting?.scriptURL ??
        reg.installing?.scriptURL ??
        "";

      if (!scriptUrl) {
        return;
      }

      try {
        const cesta = new URL(scriptUrl).pathname;

        // Jen přesný kořenový /sw.js – ne /brana/sw.js.
        if (cesta === "/sw.js") {
          await reg.unregister();
        }
      } catch {
        // Neplatná scriptURL – přeskočit.
      }
    }),
  );
}

/**
 * Registruje service worker BRÁNY pouze na instalačním originu (subdoména).
 * Přímá cesta /brana/sw.js + scope / (jako ve funkčním stavu db1ec6f).
 * Na www se BRÁNA SW neregistruje – Třeboň má vlastní /sw.js.
 */
export async function ziskatNeboRegistrovatBranaServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    throw new Error("Service worker není v tomto prohlížeči podporován");
  }

  if (!jeBranaSubdomenaHost(window.location.host)) {
    return null;
  }

  await odstranitStarouKorovouRegistraciSw();

  await navigator.serviceWorker.register("/brana/sw.js", {
    scope: "/",
  });
  return navigator.serviceWorker.ready;
}
