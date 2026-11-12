"use client";

import { useEffect, useState } from "react";
import {
  dalsiKontrolaAkciNaVikend,
  maSeZobrazitAkciNaVikend,
  POPISEK_AKCI_NA_VIKEND,
} from "@/lib/brana/sdileni-akci-na-vikend";

type BranaAkciNaVikendProps = {
  /** Počet z načtení stránky. null = věta se nemá objevit. */
  pocet: number | null;
  /** Pražský den, ke kterému počet patří. */
  oknoIso: string | null;
};

/**
 * Stejný odstavec jako park. První vykreslení je serverové.
 * Otevřená stránka počet nepřepočítává, jen ho včas skryje.
 */
export function BranaAkciNaVikend({ pocet, oknoIso }: BranaAkciNaVikendProps) {
  const [viditelne, setViditelne] = useState(
    pocet != null && pocet > 0 && oknoIso != null,
  );

  useEffect(() => {
    let zruseno = false;
    let casovac: ReturnType<typeof setTimeout> | null = null;

    const naplanuj = () => {
      if (casovac) {
        clearTimeout(casovac);
      }
      const ted = new Date();
      if (!zruseno) {
        setViditelne(maSeZobrazitAkciNaVikend(ted, pocet, oknoIso));
      }
      const dalsi = dalsiKontrolaAkciNaVikend(ted);
      const prodleva = Math.max(dalsi.getTime() - Date.now(), 0);
      casovac = setTimeout(naplanuj, prodleva);
    };

    naplanuj();

    return () => {
      zruseno = true;
      if (casovac) {
        clearTimeout(casovac);
      }
    };
  }, [pocet, oknoIso]);

  if (!viditelne || pocet == null || pocet < 1) {
    return null;
  }

  return (
    <p className="brana-zamecky-park">
      <span className="brana-akce-typ">{POPISEK_AKCI_NA_VIKEND}</span>
      <span style={{ marginLeft: 9 }}>{pocet}</span>
    </p>
  );
}
