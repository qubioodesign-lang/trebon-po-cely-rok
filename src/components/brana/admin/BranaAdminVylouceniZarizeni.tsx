"use client";

import { useEffect, useState } from "react";
import {
  jeBranaAnalytikaVyloucena,
  nastavitBranaVylouceniAnalytiky,
  zobrazitVylouceniPoUlozeni,
} from "@/lib/brana/analytika/vylouceni-zarizeni";

/**
 * Místní přepínač analytiky BRÁNY.
 * Nic neodesílá a nesahá na statistiky galerie.
 */
export function BranaAdminVylouceniZarizeni() {
  const [vylouceno, setVylouceno] = useState<boolean | null>(null);

  useEffect(() => {
    setVylouceno(jeBranaAnalytikaVyloucena());
  }, []);

  function prepnout(): void {
    if (vylouceno === null) {
      return;
    }
    const vysledek = nastavitBranaVylouceniAnalytiky(!vylouceno);
    setVylouceno(zobrazitVylouceniPoUlozeni(vylouceno, vysledek));
  }

  return (
    <section className="space-y-3" aria-labelledby="brana-admin-vylouceni-nadpis">
      <h2 id="brana-admin-vylouceni-nadpis" className="brana-nadpis-sekce text-text">
        Vyloučení zařízení
      </h2>
      <p className="brana-text-jemny">
        Platí jen v tomto prohlížeči na této adrese. Ostatní návštěvníci se nemění.
      </p>
      {vylouceno ? (
        <p className="brana-text-jemny">Toto zařízení je vyloučeno z analytiky.</p>
      ) : null}
      {vylouceno === null ? null : (
        <button type="button" onClick={prepnout} className="tlacitko-klidne">
          {vylouceno
            ? "Znovu započítávat toto zařízení"
            : "Vyloučit toto zařízení z analytiky"}
        </button>
      )}
    </section>
  );
}
