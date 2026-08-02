/** Registruje service worker BRÁNY se scope /brana/ (odděleně od /sw.js). */
export async function ziskatNeboRegistrovatBranaServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    throw new Error("Service worker není v tomto prohlížeči podporován");
  }

  await navigator.serviceWorker.register("/brana/sw.js", {
    scope: "/brana/",
  });
  return navigator.serviceWorker.ready;
}
