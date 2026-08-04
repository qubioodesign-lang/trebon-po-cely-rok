"use client";

import { useEffect } from "react";
import { inicializovatBranaPwaInstalaci } from "@/lib/brana/pwa-instalace";
import { ziskatNeboRegistrovatBranaServiceWorker } from "@/lib/brana/service-worker";

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  inicializovatBranaPwaInstalaci();
  void ziskatNeboRegistrovatBranaServiceWorker().catch(() => {
    // Service worker není kritický pro základní zobrazení BRÁNY
  });
}

/** Registruje SW a PWA posluchače – SW jen na subdoméně (viz service-worker.ts). */
export function BranaRegistracePWA() {
  useEffect(() => {
    inicializovatBranaPwaInstalaci();

    if ("serviceWorker" in navigator) {
      void ziskatNeboRegistrovatBranaServiceWorker().catch(() => {
        // Service worker není kritický pro základní zobrazení BRÁNY
      });
    }
  }, []);

  return null;
}
