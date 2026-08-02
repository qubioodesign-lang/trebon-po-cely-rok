"use client";

import { useEffect } from "react";
import { inicializovatBranaPwaInstalaci } from "@/lib/brana/pwa-instalace";
import { ziskatNeboRegistrovatServiceWorker } from "@/lib/service-worker";

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  inicializovatBranaPwaInstalaci();
  void ziskatNeboRegistrovatServiceWorker().catch(() => {
    // Service worker není kritický pro základní zobrazení BRÁNY
  });
}

/** Registruje service worker a PWA posluchače pro instalovatelnost BRÁNY. */
export function BranaRegistracePWA() {
  useEffect(() => {
    inicializovatBranaPwaInstalaci();

    if ("serviceWorker" in navigator) {
      void ziskatNeboRegistrovatServiceWorker().catch(() => {
        // Service worker není kritický pro základní zobrazení BRÁNY
      });
    }
  }, []);

  return null;
}
