"use client";

import { useCallback, useEffect, useState } from "react";
import {
  jeVyloucenoZeStatistik,
  nastavitVylouceniZeStatistik,
} from "@/lib/metriky-vylouceni";

export function AdminVylouceniZeStatistik() {
  const [vylouceno, setVylouceno] = useState(false);

  useEffect(() => {
    setVylouceno(jeVyloucenoZeStatistik());
  }, []);

  const handlePrepnout = useCallback(() => {
    const dalsi = !vylouceno;
    nastavitVylouceniZeStatistik(dalsi);
    setVylouceno(dalsi);
  }, [vylouceno]);

  return (
    <section className="space-y-3 border border-text-velmiJemny/20 p-4">
      <h2 className="text-sm font-light text-text-jemny">vyloučení ze statistik</h2>
      <p className="text-xs text-text-velmiJemny">
        Toto nastavení platí pouze pro prohlížeč v tomto zařízení. Ostatní návštěvníci
        se statistik neovlivní.
      </p>

      {vylouceno ? (
        <p className="text-xs text-text-jemny">Toto zařízení je vyloučeno ze statistik.</p>
      ) : null}

      <button
        type="button"
        onClick={handlePrepnout}
        className="tlacitko-klidne"
      >
        {vylouceno
          ? "Znovu započítávat toto zařízení"
          : "Vyloučit toto zařízení ze statistik"}
      </button>
    </section>
  );
}
