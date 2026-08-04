import { jeBranaSubdomenaHost } from "./cesty";

/**
 * Registruje service worker BRÁNY pouze na instalačním originu (subdoména).
 * Na www se BRÁNA SW neregistruje – Třeboň má vlastní /sw.js.
 */
export async function ziskatNeboRegistrovatBranaServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    throw new Error("Service worker není v tomto prohlížeči podporován");
  }

  if (!jeBranaSubdomenaHost(window.location.host)) {
    return null;
  }

  await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
  });
  return navigator.serviceWorker.ready;
}
