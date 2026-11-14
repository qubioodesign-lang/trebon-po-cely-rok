"use client";

import { useEffect, useState } from "react";
import {
  dalsiKontrolaAkciNaVikend,
  DODATEK_TRHY_JSOU,
  DODATEK_TRHY_NEJSOU,
  maSeZobrazitAkciNaVikend,
  POPISEK_AKCI_NA_VIKEND,
} from "@/lib/brana/sdileni-akci-na-vikend";

type BranaAkciNaVikendProps = {
  /** Počet z načtení stránky. null = věta se nemá objevit. */
  pocet: number | null;
  /** Pražský den, ke kterému počet patří. */
  oknoIso: string | null;
  /** null = věta se neskládá. */
  jsouTrhy: boolean | null;
  /** První vykreslení. Během upozornění parku je false, počet už je připravený. */
  vychoziViditelne: boolean;
};

/**
 * Stejný odstavec jako park. První vykreslení je serverové.
 * Otevřená stránka počet nepřepočítává, jen ho včas skryje a po zavření parku vrátí.
 */
export function BranaAkciNaVikend({
  pocet,
  oknoIso,
  jsouTrhy,
  vychoziViditelne,
}: BranaAkciNaVikendProps) {
  const [viditelne, setViditelne] = useState(vychoziViditelne);

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
      const naHranici = maSeZobrazitAkciNaVikend(dalsi, pocet, oknoIso);
      const prodleva =
        Math.max(dalsi.getTime() - Date.now(), 0) + (naHranici ? 100 : 0);
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

  if (!viditelne || pocet == null || pocet < 1 || jsouTrhy == null) {
    return null;
  }

  return (
    <p className="brana-zamecky-park">
      <span className="brana-akce-typ">{POPISEK_AKCI_NA_VIKEND}</span>
      <span style={{ marginLeft: 9 }}>{pocet}</span>
      <span className="brana-akce-typ">
        {jsouTrhy ? DODATEK_TRHY_JSOU : DODATEK_TRHY_NEJSOU}
      </span>
    </p>
  );
}
