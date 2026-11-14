"use client";

import { useEffect, useState } from "react";
import {
  dalsiPrekresleniParkuVedleVikendu,
  vetaParkuVedleAkciNaVikend,
} from "@/lib/brana/sdileni-akci-na-vikend";

type BranaZameckyParkDnesProps = {
  /** Věta spočítaná na serveru. null = při prvním vykreslení nic. */
  vychoziVeta: string | null;
  /** Konec ručního skrytí. null = park se řídí jen časem. */
  skrytoDo: string | null;
  /** Počet víkendového sdělení. null = park se jím neřídí. */
  pocetAkciNaVikend?: number | null;
  /** Pražský den víkendového sdělení. */
  oknoAkciNaVikend?: string | null;
};

const NAZEV = "Zámecký park";

/**
 * Řádek parku jen když je věta. Bez obalu, když věta není.
 * První text je serverový. Další hranici přepne prohlížeč bez nového dotazu.
 */
export function BranaZameckyParkDnes({
  vychoziVeta,
  skrytoDo,
  pocetAkciNaVikend = null,
  oknoAkciNaVikend = null,
}: BranaZameckyParkDnesProps) {
  const [veta, setVeta] = useState(vychoziVeta);

  useEffect(() => {
    let zruseno = false;
    let casovac: ReturnType<typeof setTimeout> | null = null;

    const naplanuj = () => {
      if (casovac) {
        clearTimeout(casovac);
      }
      const ted = new Date();
      if (!zruseno) {
        setVeta(
          vetaParkuVedleAkciNaVikend(
            ted,
            pocetAkciNaVikend,
            oknoAkciNaVikend,
            skrytoDo,
          ),
        );
      }
      const dalsi = dalsiPrekresleniParkuVedleVikendu(ted, skrytoDo);
      const prodleva = Math.max(dalsi.getTime() - Date.now(), 0) + 50;
      casovac = setTimeout(naplanuj, prodleva);
    };

    naplanuj();

    return () => {
      zruseno = true;
      if (casovac) {
        clearTimeout(casovac);
      }
    };
  }, [skrytoDo, pocetAkciNaVikend, oknoAkciNaVikend]);

  if (!veta?.startsWith(`${NAZEV} `)) {
    return null;
  }

  const stav = veta.slice(NAZEV.length);

  return (
    <p className="brana-zamecky-park">
      <span className="brana-akce-typ">{NAZEV}</span>
      {stav}
    </p>
  );
}
