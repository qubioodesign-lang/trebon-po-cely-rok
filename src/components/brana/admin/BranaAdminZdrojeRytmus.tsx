"use client";

import { useState } from "react";
import {
  BRANA_DLOUHODOBY_INTERVALY_DNI,
  BRANA_ZDROJE_RYTMUS_VYCHOZI,
  jeDlouhodobyIntervalDni,
  popisekDlouhodobehoIntervalu,
  popisekRychlehoRytmu,
  type BranaDlouhodobyIntervalDni,
} from "@/lib/brana/admin/zdroj";

const VSTUP =
  "border border-text-velmiJemny/25 bg-transparent px-1.5 py-1 text-sm text-text outline-none focus:border-text-jemny/50";

type Props = {
  vychoziDlouhodobyIntervalDni?: BranaDlouhodobyIntervalDni;
};

/**
 * Malé nastavení rytmu kontroly podle typu zdroje.
 * Zatím bez trvalého uložení – výchozí hodnota 21 dní zůstává v modelu.
 */
export function BranaAdminZdrojeRytmus({
  vychoziDlouhodobyIntervalDni = BRANA_ZDROJE_RYTMUS_VYCHOZI.dlouhodobyIntervalDni,
}: Props) {
  const [dlouhodobyIntervalDni, setDlouhodobyIntervalDni] =
    useState<BranaDlouhodobyIntervalDni>(vychoziDlouhodobyIntervalDni);

  return (
    <div className="space-y-3" aria-label="Rytmus kontroly zdrojů">
      <div className="space-y-1.5">
        <h3 className="text-sm font-normal text-text-jemny">
          Dlouhodobé zdroje
        </h3>
        <label className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text">
          <span className="text-text-jemny">Kontrola:</span>
          <select
            className={VSTUP}
            value={String(dlouhodobyIntervalDni)}
            onChange={(e) => {
              const cislo = Number(e.target.value);
              if (jeDlouhodobyIntervalDni(cislo)) {
                setDlouhodobyIntervalDni(cislo);
              }
            }}
            aria-label="Interval kontroly dlouhodobých zdrojů"
          >
            {BRANA_DLOUHODOBY_INTERVALY_DNI.map((dny) => (
              <option key={dny} value={String(dny)}>
                {popisekDlouhodobehoIntervalu(dny)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-sm font-normal text-text-jemny">
          Rychlé zdroje
        </h3>
        <p className="text-sm text-text">
          <span className="text-text-jemny">Kontrola:</span>{" "}
          {popisekRychlehoRytmu(BRANA_ZDROJE_RYTMUS_VYCHOZI.rychlyRytmus)}
        </p>
      </div>
    </div>
  );
}
