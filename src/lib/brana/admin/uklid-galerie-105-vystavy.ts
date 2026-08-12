/**
 * Dočasný jednorázový výběr chybných výstav Galerie 105 (první scan).
 * Pouze výběr / preview – žádný zápis do Blobu.
 * Po dokončení úklidu tento modul odstranit.
 */

import type { BranaKonkretniUdalost } from "./konkretni-udalost";

/** Očekávaný počet CEKA výstav z prvního chybného scanu */
export const BRANA_UKLID_GALERIE_105_VYSTAV_OCEKAVANY_POCET = 19;

export type BranaUklidGalerie105VystavaNalez = {
  id: string;
  nazev: string;
  datumOd: string;
  datumDo: string;
  cas: string;
  stavSchvaleni: BranaKonkretniUdalost["stavSchvaleni"];
  redakcniPolozkaId: string;
};

export type BranaUklidGalerie105VystavyPreview =
  | {
      ok: true;
      vybrano: BranaUklidGalerie105VystavaNalez[];
      spravneAkceSCasemVeVyberu: 0;
    }
  | {
      ok: false;
      duvod: "POCET_NEODPOVIDA";
      skutecnyPocet: number;
      vybrano: BranaUklidGalerie105VystavaNalez[];
      spravneAkceSCasemVeVyberu: number;
    };

/**
 * Filtr konkrétní dávky: galerie-105 + CEKA + scanKlic + prázdný cas.
 * Správné Akce mají neprázdný cas → do výběru nepatří.
 */
export function vybratGalerie105VystavyCekaKUklidu(
  udalosti: readonly BranaKonkretniUdalost[],
): BranaUklidGalerie105VystavaNalez[] {
  const out: BranaUklidGalerie105VystavaNalez[] = [];
  for (const u of udalosti) {
    if (u.redakcniPolozkaId !== "galerie-105") {
      continue;
    }
    if (u.stavSchvaleni !== "CEKA_NA_SCHVALENI") {
      continue;
    }
    if (typeof u.scanKlic !== "string" || u.scanKlic.trim().length === 0) {
      continue;
    }
    if (u.cas.trim() !== "") {
      continue;
    }
    out.push({
      id: u.id,
      nazev: u.nazev,
      datumOd: u.datumOd,
      datumDo: u.datumDo,
      cas: u.cas,
      stavSchvaleni: u.stavSchvaleni,
      redakcniPolozkaId: u.redakcniPolozkaId,
    });
  }
  out.sort((a, b) =>
    a.datumOd === b.datumOd
      ? a.nazev.localeCompare(b.nazev, "cs")
      : a.datumOd.localeCompare(b.datumOd),
  );
  return out;
}

/**
 * Fail-closed preview: ok jen při přesně očekávaném počtu.
 * Žádný zápis – čistá funkce.
 */
export function sestavPreviewUklidGalerie105Vystavy(
  udalosti: readonly BranaKonkretniUdalost[],
): BranaUklidGalerie105VystavyPreview {
  const vybrano = vybratGalerie105VystavyCekaKUklidu(udalosti);
  const spravneAkceSCasemVeVyberu = vybrano.filter(
    (u) => u.cas.trim() !== "",
  ).length;

  if (
    vybrano.length === BRANA_UKLID_GALERIE_105_VYSTAV_OCEKAVANY_POCET &&
    spravneAkceSCasemVeVyberu === 0
  ) {
    return {
      ok: true,
      vybrano,
      spravneAkceSCasemVeVyberu: 0,
    };
  }

  return {
    ok: false,
    duvod: "POCET_NEODPOVIDA",
    skutecnyPocet: vybrano.length,
    vybrano,
    spravneAkceSCasemVeVyberu,
  };
}
