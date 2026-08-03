"use client";

import { useEffect } from "react";
import { ziskatNeboRegistrovatServiceWorker } from "@/lib/service-worker";
import { inicializovatTrebonPwaInstalaci } from "@/lib/trebon-pwa-instalace";

/** Registruje service worker Třeboně a posluchače instalačního promptu. */
export function RegistracePWA() {
  useEffect(() => {
    inicializovatTrebonPwaInstalaci();

    if ("serviceWorker" in navigator) {
      void ziskatNeboRegistrovatServiceWorker().catch(() => {
        // Service worker není kritický pro základní funkčnost
      });
    }
  }, []);

  return null;
}
