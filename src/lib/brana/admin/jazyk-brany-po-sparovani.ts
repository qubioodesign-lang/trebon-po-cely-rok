/**
 * Jazyk BRÁNY po úspěšném matchingu – pouze skladba mistoNeboTyp.
 * Nazev zůstává vždy u volajícího ze zdroje (scanKlic / dedup).
 */

import { jeCistyJednoslovnyTypAkce } from "./akce-rozlozeni";

export type BranaJazykPoSparovaniVstup = {
  /** Text Položka z úspěšně spárovaného pravidla */
  polozka: string;
  /** Místo ze scan kandidáta (JSON-LD location) */
  kandidatMisto: string;
  /** Fallback názvu zdroje – stejný jako dosavadní scan */
  zdrojNazev: string;
};

export type BranaJazykPoSparovaniVysledek = {
  mistoNeboTyp: string;
};

function normalizovatProSrovnani(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Po úspěšném sparovani: specifická kotva → polozka;
 * čistý typ + jiné KDE → „Typ KDE“; jinak polozka / fallback jako dřív.
 */
export function sestavJazykBranyPoSparovani(
  vstup: BranaJazykPoSparovaniVstup,
): BranaJazykPoSparovaniVysledek {
  const polozka = vstup.polozka.trim();
  const kde =
    vstup.kandidatMisto.trim() || vstup.zdrojNazev.trim();

  if (!polozka) {
    return { mistoNeboTyp: kde };
  }

  if (jeCistyJednoslovnyTypAkce(polozka)) {
    if (
      kde &&
      normalizovatProSrovnani(kde) !== normalizovatProSrovnani(polozka)
    ) {
      const prefix = `${polozka} `;
      if (kde.toLowerCase().startsWith(prefix.toLowerCase())) {
        return { mistoNeboTyp: kde };
      }
      return { mistoNeboTyp: `${polozka} ${kde}` };
    }
    return { mistoNeboTyp: polozka };
  }

  return { mistoNeboTyp: polozka };
}
