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

/**
 * Zaznamená zdroj návštěvy jednou za relaci prohlížeče.
 * Metriky se odesílají stejným dávkovým mechanismem jako ostatní události.
 */
export function useAnalytics() {
  const { odeslat } = useMetriky();

  useEffect(() => {
    if (bylaNavstevaVSession() || jeVyloucenoZeStatistik()) {
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
