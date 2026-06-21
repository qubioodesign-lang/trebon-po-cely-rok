"use client";

import { useEffect } from "react";
import { useMetriky } from "@/hooks/useMetriky";
import {
  bylaNavstevaVSession,
  oznacitNavstevuVSession,
  urcitZdrojNavstevy,
} from "@/lib/zdroj-navstev";
import { urcitZarizeniNavstevnika } from "@/lib/zarizeni-navstevnika";

/**
 * Zaznamená zdroj návštěvy jednou za relaci prohlížeče.
 * Metriky se odesílají stejným dávkovým mechanismem jako ostatní události.
 */
export function useAnalytics() {
  const { odeslat } = useMetriky();

  useEffect(() => {
    if (bylaNavstevaVSession()) {
      return;
    }

    oznacitNavstevuVSession();
    odeslat(
      "navsteva",
      undefined,
      urcitZdrojNavstevy(),
      urcitZarizeniNavstevnika()
    );
  }, [odeslat]);
}
