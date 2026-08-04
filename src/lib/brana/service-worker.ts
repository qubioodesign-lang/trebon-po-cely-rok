import { jeBranaSubdomenaHost } from "./cesty";

/**
 * Odstraní pouze experimentální registraci `/sw.js` na originu BRÁNY.
 * Nikdy neregistruje ani nemaže jiné workery (včetně `/brana/sw.js`).
 * Idempotentní – absence staré registrace není chyba.
 */
async function odstranitExperimentalniKorovouRegistraciSw(): Promise<void> {
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
 * Model db1ec6f: `/brana/sw.js` + scope `/` (hlavička Service-Worker-Allowed v middleware).
 * Na www se BRÁNA SW neregistruje – Třeboň má vlastní /sw.js.
 */
export async function ziskatNeboRegistrovatBranaServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    throw new Error("Service worker není v tomto prohlížeči podporován");
  }

  if (!jeBranaSubdomenaHost(window.location.host)) {
    return null;
  }

  try {
    await odstranitExperimentalniKorovouRegistraciSw();
  } catch {
    // Cleanup nesmí blokovat registraci.
  }

  await navigator.serviceWorker.register("/brana/sw.js", {
    scope: "/",
  });
  return navigator.serviceWorker.ready;
}
