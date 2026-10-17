import { klasifikovatOblast, type VstupOblasti } from "./oblast";
import type { BranaAnalytikaOblast } from "./model";

/** Oficiální hlavičky geolokace IP na Vercelu. Lokální vývoj je nenastavuje. */
export const HLAVICKA_VERCEL_ZEME = "x-vercel-ip-country";
export const HLAVICKA_VERCEL_SIRKA = "x-vercel-ip-latitude";
export const HLAVICKA_VERCEL_DELKA = "x-vercel-ip-longitude";

type Hlavicky = {
  get(name: string): string | null;
};

function cistCislo(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === "") {
    return undefined;
  }
  return Number(raw);
}

/** Přečte jen zemi a souřadnice. IP adresu, město ani kraj nečte a neukládá. */
export function vstupOblastiZHlavicek(headers: Hlavicky): VstupOblasti {
  return {
    zeme: headers.get(HLAVICKA_VERCEL_ZEME),
    zemepisnaSirka: cistCislo(headers.get(HLAVICKA_VERCEL_SIRKA)),
    zemepisnaDelka: cistCislo(headers.get(HLAVICKA_VERCEL_DELKA)),
  };
}

/** Vrátí jen kategorii. Souřadnice z funkce nepokračují do úložiště. */
export function klasifikovatOblastZHlavicek(headers: Hlavicky): BranaAnalytikaOblast {
  return klasifikovatOblast(vstupOblastiZHlavicek(headers));
}
