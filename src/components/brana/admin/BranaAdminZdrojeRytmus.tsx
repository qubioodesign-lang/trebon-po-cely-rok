"use client";

import { useState, useTransition } from "react";
import { ulozitBranaZdrojeDlouhodobyIntervalAkce } from "@/app/brana/admin/actions";
import {
  BRANA_DLOUHODOBY_INTERVALY_DNI,
  BRANA_ZDROJE_RYTMUS_VYCHOZI,
  jeDlouhodobyIntervalDni,
  popisekDlouhodobehoIntervalu,
  popisekRychlehoRytmu,
  type BranaDlouhodobyIntervalDni,
} from "@/lib/brana/admin/zdroj";

const VSTUP =
  "border border-text-velmiJemny/25 bg-transparent px-1.5 py-1 text-sm text-text outline-none focus:border-text-jemny/50 disabled:opacity-50";

type Props = {
  dlouhodobyIntervalDni: BranaDlouhodobyIntervalDni;
  /** false při chybě čtení Blobu – select se zablokuje */
  uloziteniPovoleno: boolean;
  chybaCteni?: string | null;
};

/**
 * Nastavení rytmu kontroly podle typu zdroje.
 * Dlouhodobý interval se ukládá do PRIVATE Blobu; rychlý rytmus je pevný.
 */
export function BranaAdminZdrojeRytmus({
  dlouhodobyIntervalDni: pocatecniInterval,
  uloziteniPovoleno,
  chybaCteni = null,
}: Props) {
  const [dlouhodobyIntervalDni, setDlouhodobyIntervalDni] =
    useState<BranaDlouhodobyIntervalDni>(pocatecniInterval);
  const [chyba, setChyba] = useState<string | null>(chybaCteni);
  const [pending, startTransition] = useTransition();

  function zmenitInterval(novaHodnota: BranaDlouhodobyIntervalDni) {
    if (!uloziteniPovoleno || pending) {
      return;
    }
    if (novaHodnota === dlouhodobyIntervalDni) {
      return;
    }

    const predchozi = dlouhodobyIntervalDni;
    setChyba(null);
    setDlouhodobyIntervalDni(novaHodnota);

    startTransition(async () => {
      const vysledek =
        await ulozitBranaZdrojeDlouhodobyIntervalAkce(novaHodnota);
      if (!vysledek.uspech) {
        setDlouhodobyIntervalDni(predchozi);
        setChyba(vysledek.chyba);
        return;
      }
      setDlouhodobyIntervalDni(vysledek.dlouhodobyIntervalDni);
    });
  }

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
            disabled={!uloziteniPovoleno || pending}
            onChange={(e) => {
              const cislo = Number(e.target.value);
              if (jeDlouhodobyIntervalDni(cislo)) {
                zmenitInterval(cislo);
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

      {chyba ? (
        <p className="text-sm text-text" role="alert">
          {chyba}
        </p>
      ) : null}
    </div>
  );
}
