/**
 * Jazyk BRÁNY po úspěšném matchingu.
 * Skládá kompatibilní mistoNeboTyp a volitelně strukturovaná verejne* pole.
 * Nazev zůstává vždy u volajícího ze zdroje (scanKlic / dedup).
 */

import {
  maStrukturovanyJazykPravidla,
  type BranaJazykSlot,
  type BranaRedakcniJazykVerejny,
} from "./redakcni-kostra";
import { jeCistyJednoslovnyTypAkce, rozdelTypAkce } from "./akce-rozlozeni";

export type BranaJazykPoSparovaniVstup = {
  /** Text Položka z úspěšně spárovaného pravidla */
  polozka: string;
  /** Místo ze scan kandidáta (JSON-LD location) */
  kandidatMisto: string;
  /** Fallback názvu zdroje – stejný jako dosavadní scan */
  zdrojNazev: string;
  /**
   * null = strukturovaný jazyk není nastaven (legacy).
   * objekt = nastavený jazyk (PEVNE / Z_UDALOSTI / NIC).
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
 * CO z události: známý typ z kandidátního mistoNeboTyp, jinak null
 * (bez odhadování z názvu filmu / programu).
 */
function coZUdalosti(kandidatMisto: string): string | null {
  const trim = kandidatMisto.trim();
  if (!trim) {
    return null;
  }
  const { typ, zbytek } = rozdelTypAkce(trim);
  if (zbytek && (jeCistyJednoslovnyTypAkce(typ) || typ === "Pro děti")) {
    return typ;
  }
  if (jeCistyJednoslovnyTypAkce(trim) || trim === "Pro děti") {
    return trim;
  }
  return null;
}

/**
 * KDE z události: místo kandidáta, jinak název zdroje; prázdné → null.
 */
function kdeZUdalosti(kandidatMisto: string, zdrojNazev: string): string | null {
  const text = (kandidatMisto.trim() || zdrojNazev.trim()).trim();
  return text || null;
}

function vyhodnotSlot(
  slot: BranaJazykSlot,
  zUdalosti: string | null,
): string | null {
  if (slot.rezim === "NIC") {
    return null;
  }
  if (slot.rezim === "PEVNE") {
    return slot.text;
  }
  return zUdalosti;
}

function sestavKompatibilniMistoNeboTyp(
  co: string | null,
  rozliseni: string | null,
  legacyFallback: string,
): string {
  const c = (co ?? "").trim();
  const r = (rozliseni ?? "").trim();
  if (c && r) {
    return `${c} ${r}`;
  }
  if (c) {
    return c;
  }
  if (r) {
    return r;
  }
  return legacyFallback;
}

/**
 * Po úspěšném sparovani: legacy mistoNeboTyp + případně strukturovaná pole.
 */
export function sestavJazykBranyPoSparovani(
  vstup: BranaJazykPoSparovaniVstup,
): BranaJazykPoSparovaniVysledek {
  const legacyMisto = sestavLegacyMistoNeboTyp(vstup);

  if (!maStrukturovanyJazykPravidla({ jazykVerejny: vstup.jazykVerejny })) {
    return { mistoNeboTyp: legacyMisto };
  }

  const jazyk = vstup.jazykVerejny as BranaRedakcniJazykVerejny;
  const verejneCo = vyhodnotSlot(
    jazyk.co,
    coZUdalosti(vstup.kandidatMisto),
  );
  const verejneRozliseni = vyhodnotSlot(
    jazyk.rozliseni,
    kdeZUdalosti(vstup.kandidatMisto, vstup.zdrojNazev),
  );

  return {
    mistoNeboTyp: sestavKompatibilniMistoNeboTyp(
      verejneCo,
      verejneRozliseni,
      legacyMisto,
    ),
    verejneCo,
    verejneRozliseni,
  };
}
