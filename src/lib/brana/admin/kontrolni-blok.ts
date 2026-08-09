/**
 * Časová logika pravidelné redakční kontroly:
 * 7denní rezerva (= veřejné „7 dní“) + navazující pevný 21denní kontrolní blok.
 * Europe/Prague přes obdobi7DniVPraze / zitraVPraze.
 */

import { pridatDny, zitraVPraze } from "@/lib/brana/cas";
import { BRANA_DLOUHODOBY_INTERVAL_VYCHOZI } from "@/lib/brana/admin/zdroj";
import { isoDnyObdobi7DniVPraze } from "@/lib/brana/admin/obdobi-7-dni";
import type { BranaKonkretniUdalost } from "@/lib/brana/admin/konkretni-udalost";

function branaDatumNaIso(rok: number, mesic: number, den: number): string {
  return `${rok}-${String(mesic).padStart(2, "0")}-${String(den).padStart(2, "0")}`;
}

/** Délka kontrolního bloku – pevných 21 dní z autoritativní konstanty. */
export const BRANA_KONTROLNI_BLOK_DNI = BRANA_DLOUHODOBY_INTERVAL_VYCHOZI;

export type BranaKontrolniBlok = {
  /** ISO dny 7denní rezervy (veřejné „7 dní“) */
  rezervaIsoDny: string[];
  /** První den 21denního kontrolního bloku (YYYY-MM-DD) */
  blokOdIso: string;
  /** Poslední den 21denního kontrolního bloku (YYYY-MM-DD), inclusive */
  blokDoIso: string;
  /** Všech 21 ISO dnů bloku */
  blokIsoDny: string[];
};

/**
 * 7denní rezerva + navazující 21denní kontrolní blok podle Europe/Prague „nyní“.
 * Rezerva = isoDnyObdobi7DniVPraze(); blok začíná dnem hned za ní.
 */
export function kontrolniBlokVPraze(): BranaKontrolniBlok {
  const rezervaIsoDny = isoDnyObdobi7DniVPraze();
  const zitra = zitraVPraze();
  const prvniBlok = pridatDny(zitra, rezervaIsoDny.length);
  const blokIsoDny = Array.from({ length: BRANA_KONTROLNI_BLOK_DNI }, (_, index) => {
    const den = pridatDny(prvniBlok, index);
    return branaDatumNaIso(den.rok, den.mesic, den.den);
  });

  return {
    rezervaIsoDny,
    blokOdIso: blokIsoDny[0],
    blokDoIso: blokIsoDny[blokIsoDny.length - 1],
    blokIsoDny,
  };
}

/**
 * Poslední ISO den kontrolního bloku – za tímto dnem patří orientační linka.
 */
export function isoDenPoslednihoDneKontrolnihoBlokuVPraze(): string {
  return kontrolniBlokVPraze().blokDoIso;
}

function normalizujRozsahUdalosti(udalost: {
  datumOd: string;
  datumDo?: string | null;
}): { od: string; do: string } {
  const od = udalost.datumOd.trim();
  const doSurove = udalost.datumDo?.trim() ?? "";
  // Chybějící datumDo = jednodenní událost (současná logika).
  const doDne = doSurove.length > 0 ? doSurove : od;
  if (doDne < od) {
    return { od, do: od };
  }
  return { od, do: doDne };
}

/**
 * Událost patří do kontrolního bloku, pokud má alespoň jeden den společný
 * s rozsahem bloku (průnik intervalů datumOd–datumDo × blokOd–blokDo).
 */
export function patriUdalostDoKontrolnihoBloku(
  udalost: Pick<BranaKonkretniUdalost, "datumOd" | "datumDo"> | {
    datumOd: string;
    datumDo?: string | null;
  },
  blok: Pick<BranaKontrolniBlok, "blokOdIso" | "blokDoIso"> = kontrolniBlokVPraze(),
): boolean {
  const { od, do: doDne } = normalizujRozsahUdalosti(udalost);
  return od <= blok.blokDoIso && doDne >= blok.blokOdIso;
}
