import { jeBranaSubdomenaHost } from "./cesty";

/** Scope SW podle hostitele – subdoména /, jinak /brana/ (odděleně od /sw.js). */
function branaServiceWorkerScope(): string {
  if (typeof window === "undefined") {
    return "/brana/";
  }

  return jeBranaSubdomenaHost(window.location.host) ? "/" : "/brana/";
}

/** Registruje service worker BRÁNY (odděleně od /sw.js). */
export async function ziskatNeboRegistrovatBranaServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    throw new Error("Service worker není v tomto prohlížeči podporován");
  }

  await navigator.serviceWorker.register("/brana/sw.js", {
    scope: branaServiceWorkerScope(),
  });
  return navigator.serviceWorker.ready;
}
