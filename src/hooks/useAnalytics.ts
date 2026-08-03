"use client";

import { useEffect } from "react";
import { useMetriky } from "@/hooks/useMetriky";
import {
  bylaNavstevaVSession,
  oznacitNavstevuVSession,
  urcitZdrojNavstevy,
} from "@/lib/zdroj-navstev";
import { urcitZarizeniNavstevnika } from "@/lib/zarizeni-navstevnika";
import { jeVyloucenoZeStatistik } from "@/lib/metriky-vylouceni";
import { jePWA } from "@/lib/uloziste";

/** Samostatný session příznak – nezávislý na obecné návštěvě */
const KLIC_STANDALONE_SESSION = "trebon_analytics_navsteva_standalone";

function bylaStandaloneNavstevaVSession(): boolean {
  if (typeof sessionStorage === "undefined") {
    return false;
  }

  try {
    return sessionStorage.getItem(KLIC_STANDALONE_SESSION) === "1";
  } catch {
    return false;
  }
}

function oznacitStandaloneNavstevuVSession(): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }

  try {
    sessionStorage.setItem(KLIC_STANDALONE_SESSION, "1");
  } catch {
    // sessionStorage může být nedostupné
  }
}

/**
 * Zaznamená zdroj návštěvy jednou za relaci prohlížeče.
 * Metriky se odesílají stejným dávkovým mechanismem jako ostatní události.
 * Standalone návštěva má vlastní session bránu (nezávislou na obecné návštěvě).
 */
export function useAnalytics() {
  const { odeslat } = useMetriky();

  useEffect(() => {
    if (jeVyloucenoZeStatistik()) {
      return;
    }

    if (!bylaNavstevaVSession()) {
      oznacitNavstevuVSession();
      odeslat(
        "navsteva",
        undefined,
        urcitZdrojNavstevy(),
        urcitZarizeniNavstevnika(),
      );
    }

    if (jePWA() && !bylaStandaloneNavstevaVSession()) {
      oznacitStandaloneNavstevuVSession();
      odeslat("navsteva_standalone");
    }
  }, [odeslat]);
}
