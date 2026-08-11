/**
 * Jazyk BRÁNY po úspěšném matchingu.
 * Skládá kompatibilní mistoNeboTyp a volitelně strukturovaná verejne* pole.
 * Nazev zůstává vždy u volajícího ze zdroje (scanKlic / dedup).
 */

import {
  maStrukturovanyJazykPravidla,
  type BranaRedakcniJazykVerejny,
} from "./redakcni-kostra";
import { jeCistyJednoslovnyTypAkce } from "./akce-rozlozeni";

export type BranaJazykPoSparovaniVstup = {
  /** Text Položka z úspěšně spárovaného pravidla */
  polozka: string;
  /** Místo ze scan kandidáta (JSON-LD location) */
  kandidatMisto: string;
  /** Fallback názvu zdroje – stejný jako dosavadní scan */
  zdrojNazev: string;
  /**
   * null = strukturovaný jazyk není nastaven (legacy).
   * objekt = nastavený jazyk (co/rozliseni: string | null).
   */
  jazykVerejny: BranaRedakcniJazykVerejny | null;
};

export type BranaJazykPoSparovaniVysledek = {
  mistoNeboTyp: string;
  /**
   * Jen když pravidlo má strukturovaný jazyk.
   * Jinak pole chybí → legacy událost.
   */
  verejneCo?: string | null;
  verejneRozliseni?: string | null;
};

function normalizovatProSrovnani(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function sestavLegacyMistoNeboTyp(vstup: {
  polozka: string;
  kandidatMisto: string;
  zdrojNazev: string;
}): string {
  const polozka = vstup.polozka.trim();
  const kde =
    vstup.kandidatMisto.trim() || vstup.zdrojNazev.trim();

  if (!polozka) {
    return kde;
  }

  if (jeCistyJednoslovnyTypAkce(polozka)) {
    if (
      kde &&
      normalizovatProSrovnani(kde) !== normalizovatProSrovnani(polozka)
    ) {
      const prefix = `${polozka} `;
      if (kde.toLowerCase().startsWith(prefix.toLowerCase())) {
        return kde;
      }
      return `${polozka} ${kde}`;
    }
    return polozka;
  }

  return polozka;
}

/**
 * Po úspěšném sparovani: legacy mistoNeboTyp + případně strukturovaná pole.
 */
export function sestavJazykBranyPoSparovani(
  vstup: BranaJazykPoSparovaniVstup,
): BranaJazykPoSparovaniVysledek {
  const mistoNeboTyp = sestavLegacyMistoNeboTyp(vstup);

  if (!maStrukturovanyJazykPravidla({ jazykVerejny: vstup.jazykVerejny })) {
    return { mistoNeboTyp };
  }

  const jazyk = vstup.jazykVerejny as BranaRedakcniJazykVerejny;
  return {
    mistoNeboTyp,
    verejneCo: jazyk.co,
    verejneRozliseni: jazyk.rozliseni,
  };
}
