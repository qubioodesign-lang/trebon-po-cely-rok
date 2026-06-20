/** Registruje service worker a vrátí aktivní registraci (pro push) */
export async function ziskatNeboRegistrovatServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    throw new Error("Service worker není v tomto prohlížeči podporován");
  }

  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}
