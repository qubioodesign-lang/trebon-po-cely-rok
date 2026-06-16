"use client";

import { useEffect } from "react";
import { useMetriky } from "@/hooks/useMetriky";

/** Registruje service worker pro PWA a push notifikace */
export function RegistracePWA() {
  const { odeslat } = useMetriky();

  useEffect(() => {
    // Zaznamenání návštěvy
    odeslat("navsteva");

    // Registrace service workeru
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Service worker není kritický pro základní funkčnost
      });
    }
  }, [odeslat]);

  return null;
}
