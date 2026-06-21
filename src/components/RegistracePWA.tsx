"use client";

import { useEffect } from "react";
import { ziskatNeboRegistrovatServiceWorker } from "@/lib/service-worker";

/** Registruje service worker pro PWA a push notifikace */
export function RegistracePWA() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void ziskatNeboRegistrovatServiceWorker().catch(() => {
        // Service worker není kritický pro základní funkčnost
      });
    }
  }, []);

  return null;
}
