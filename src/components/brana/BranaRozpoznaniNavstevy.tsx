"use client";

import { useEffect } from "react";
import {
  BRANA_ANALYTIKA_PRIJEM_ZAPNUT,
  type BranaAnalytikaPohled,
} from "@/lib/brana/analytika/model";

/**
 * Veřejné obrazovky Kalendáře. Pohled je stránka, která se opravdu vykreslila.
 * Při vypnutém příjmu se efekt hned vrací a měření se nenačítá. Nic nevykresluje.
 */
export function BranaRozpoznaniNavstevy({
  stranka,
}: {
  stranka: BranaAnalytikaPohled;
}) {
  useEffect(() => {
    if (!BRANA_ANALYTIKA_PRIJEM_ZAPNUT) {
      return;
    }

    let zrusit = false;
    let uklid = () => {};

    void import("@/lib/brana/analytika/napojeni-navstevy").then((modul) => {
      if (zrusit) {
        return;
      }
      uklid = modul.spustitRozpoznaniNavstevyVOkne(stranka);
    });

    return () => {
      zrusit = true;
      uklid();
    };
  }, [stranka]);

  return null;
}
