/**
 * Přiřazení nalezené události k existující položce Redakčního pořadí.
 * Nevytváří nová pravidla – jen hledá shodu.
 */

import type { BranaRedakcniPolozkaStav } from "./redakcni-kostra";
import type { BranaScanKandidat } from "./zdroj-scan-parser";

/** Přesná shoda položky s místem/názvem kandidáta */
const SKORE_PRESNA_POLOZKA = 100;
/**
 * Přesná shoda názvu zdroje s aktivní položkou / poznámkou.
 * Silnější než substring (70), slabší než přesná shoda textu události (100).
 */
const SKORE_PRESNA_IDENTITA_ZDROJE = 95;
/** Přesná shoda poznámky s místem/názvem kandidáta */
const SKORE_PRESNA_POZNAMKA = 90;
/** Podřetězcová shoda položky s místem/názvem */
const SKORE_SUBSTRING = 70;

function normalizovatProShodu(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type SparovaniVysledek =
  | { ok: true; redakcniPolozkaId: string }
  | { ok: false };

export type SparovaniVolby = {
  /**
   * Název známého zdroje ze scanu (např. „Třeboňská nocturna“).
   * Pouze doplňkový signál – přesná shoda s aktivní položkou Prioritního seznamu.
   */
  zdrojNazev?: string;
};

/**
 * Hledá existující redakcniPolozkaId podle místa / názvu / poznámky
 * a volitelně podle přesné identity zdroje.
 * Produkční scan: pouze pravidla Používat = ANO (NE se ignorují).
 * Při nejednoznačnosti bere nejdelší shodu na poli „položka“; při remíze skóre → NO-MATCH.
 */
export function sparovatSRedakcniPolozkou(
  kandidat: BranaScanKandidat,
  polozky: readonly BranaRedakcniPolozkaStav[],
  volby?: SparovaniVolby,
): SparovaniVysledek {
  const misto = normalizovatProShodu(kandidat.mistoNeboTyp);
  const nazev = normalizovatProShodu(kandidat.nazev);
  const zdrojNazev = normalizovatProShodu(volby?.zdrojNazev ?? "");
  if (!misto && !nazev && !zdrojNazev) {
    return { ok: false };
  }

  type Skore = { id: string; skore: number; delka: number };
  const shody: Skore[] = [];

  for (const p of polozky) {
    if (p.pouzivat !== "ANO") {
      continue;
    }

    const polozka = normalizovatProShodu(p.polozka);
    const poznamka = normalizovatProShodu(p.poznamka);
    if (!polozka && !poznamka) {
      continue;
    }

    let skore = 0;
    if (polozka && (polozka === misto || polozka === nazev)) {
      skore = SKORE_PRESNA_POLOZKA;
    } else if (poznamka && (poznamka === misto || poznamka === nazev)) {
      skore = SKORE_PRESNA_POZNAMKA;
    } else if (
      polozka.length >= 5 &&
      ((misto && (misto.includes(polozka) || polozka.includes(misto))) ||
        (nazev && (nazev.includes(polozka) || polozka.includes(nazev))))
    ) {
      skore = SKORE_SUBSTRING;
    }

    // Doplňkový signál: přesná identita zdroje × aktivní položka / poznámka.
    // Agregátory (iTřeboň, VisitTřeboň) sem typicky nepadnou – nemají stejnojmennou položku.
    if (
      zdrojNazev &&
      ((polozka && polozka === zdrojNazev) ||
        (poznamka && poznamka === zdrojNazev))
    ) {
      skore = Math.max(skore, SKORE_PRESNA_IDENTITA_ZDROJE);
    }

    if (skore > 0) {
      shody.push({ id: p.id, skore, delka: polozka.length });
    }
  }

  if (shody.length === 0) {
    return { ok: false };
  }

  shody.sort((a, b) => b.skore - a.skore || b.delka - a.delka);
  const nejlepsi = shody[0];
  // Ambiguity: dvě stejně silné různé položky → nezařadit
  if (
    shody.length > 1 &&
    shody[1].skore === nejlepsi.skore &&
    shody[1].id !== nejlepsi.id
  ) {
    return { ok: false };
  }

  return { ok: true, redakcniPolozkaId: nejlepsi.id };
}
