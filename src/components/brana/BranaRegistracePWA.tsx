"use client";

import { useEffect } from "react";
import { ziskatNeboRegistrovatServiceWorker } from "@/lib/service-worker";

/** Registruje service worker pro instalovatelnost BRÁNY při přímé návštěvě /brana. */
export function BranaRegistracePWA() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void ziskatNeboRegistrovatServiceWorker().catch(() => {
        // Service worker není kritický pro základní zobrazení BRÁNY
      });
    }
  }, []);

  return null;
}
