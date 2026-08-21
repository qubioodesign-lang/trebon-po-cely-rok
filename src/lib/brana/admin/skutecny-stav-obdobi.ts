/**
 * Dočasný read-only výběr skutečného stavu karet 21.–28. 8. 2026.
 * Nemění vstupní události. Žádný zápis.
 */

import {
  posledniPlatnyDenUdalosti,
  type BranaKonkretniUdalost,
  type BranaStavSchvaleni,
} from "./konkretni-udalost";

export const SKUTECNY_STAV_OD_ISO = "2026-08-21";
export const SKUTECNY_STAV_DO_ISO = "2026-08-28";

export type BranaSkutecnyStavPolozka = {
  datumOd: string;
  datumDo: string;
  cas: string;
  nazev: string;
  id: string;
  redakcniPolozkaId: string | null;
  typZdroje: "RYCHLY" | null;
  stavSchvaleni: BranaStavSchvaleni;
};

export type BranaSkutecnyStavSouhrn = {
  SCHVALENO: number;
  CEKA: number;
  VYRAZENO: number;
  JINE: number;
};

export type BranaSkutecnyStavVysledek = {
  polozky: BranaSkutecnyStavPolozka[];
  souhrn: BranaSkutecnyStavSouhrn;
  ceka: BranaSkutecnyStavPolozka[];
};

export function udalostZasahujeDoObdobi(
  udalost: Pick<BranaKonkretniUdalost, "datumOd" | "datumDo">,
  odIso: string = SKUTECNY_STAV_OD_ISO,
  doIso: string = SKUTECNY_STAV_DO_ISO,
): boolean {
  const zacatek = udalost.datumOd.trim();
  const konec = posledniPlatnyDenUdalosti(udalost);
  return zacatek <= doIso && konec >= odIso;
}

function doPolozky(udalost: BranaKonkretniUdalost): BranaSkutecnyStavPolozka {
  return {
    datumOd: udalost.datumOd,
    datumDo: udalost.datumDo,
    cas: udalost.cas,
    nazev: udalost.nazev,
    id: udalost.id,
    redakcniPolozkaId: udalost.redakcniPolozkaId,
    typZdroje: udalost.typZdroje === "RYCHLY" ? "RYCHLY" : null,
    stavSchvaleni: udalost.stavSchvaleni,
  };
}

function souhrnStavu(
  polozky: readonly BranaSkutecnyStavPolozka[],
): BranaSkutecnyStavSouhrn {
  const souhrn: BranaSkutecnyStavSouhrn = {
    SCHVALENO: 0,
    CEKA: 0,
    VYRAZENO: 0,
    JINE: 0,
  };
  for (const polozka of polozky) {
    if (polozka.stavSchvaleni === "SCHVALENO") {
      souhrn.SCHVALENO += 1;
    } else if (polozka.stavSchvaleni === "CEKA_NA_SCHVALENI") {
      souhrn.CEKA += 1;
    } else if (polozka.stavSchvaleni === "VYRAZENO") {
      souhrn.VYRAZENO += 1;
    } else {
      souhrn.JINE += 1;
    }
  }
  return souhrn;
}

/** Filtr 21.–28. 8. včetně. Nemění stavSchvaleni ani pořadí mimo řazení výpisu. */
export function sestavSkutecnyStavObdobi(
  udalosti: readonly BranaKonkretniUdalost[],
): BranaSkutecnyStavVysledek {
  const polozky = udalosti
    .filter((udalost) => udalostZasahujeDoObdobi(udalost))
    .map(doPolozky)
    .sort((a, b) => {
      const cmpDatum = a.datumOd.localeCompare(b.datumOd);
      if (cmpDatum !== 0) {
        return cmpDatum;
      }
      const cmpCas = a.cas.localeCompare(b.cas);
      return cmpCas !== 0 ? cmpCas : a.id.localeCompare(b.id);
    });

  return {
    polozky,
    souhrn: souhrnStavu(polozky),
    ceka: polozky.filter((p) => p.stavSchvaleni === "CEKA_NA_SCHVALENI"),
  };
}
