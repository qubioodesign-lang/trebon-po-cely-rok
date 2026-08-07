/**
 * Přiřazení nalezené události k existující položce Redakčního pořadí.
 * Nevytváří nová pravidla – jen hledá shodu.
 */

import type { BranaRedakcniPolozkaStav } from "./redakcni-kostra";
import type { BranaScanKandidat } from "./zdroj-scan-parser";

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

/**
 * Hledá existující redakcniPolozkaId podle místa / názvu / poznámky.
 * Při nejednoznačnosti bere nejdelší přesnou shodu na poli „položka“.
 */
export function sparovatSRedakcniPolozkou(
  kandidat: BranaScanKandidat,
  polozky: readonly BranaRedakcniPolozkaStav[],
): SparovaniVysledek {
  const misto = normalizovatProShodu(kandidat.mistoNeboTyp);
  const nazev = normalizovatProShodu(kandidat.nazev);
  if (!misto && !nazev) {
    return { ok: false };
  }

  type Skore = { id: string; skore: number; delka: number };
  const shody: Skore[] = [];

  for (const p of polozky) {
    const polozka = normalizovatProShodu(p.polozka);
    const poznamka = normalizovatProShodu(p.poznamka);
    if (!polozka && !poznamka) {
      continue;
    }

    let skore = 0;
    if (polozka && (polozka === misto || polozka === nazev)) {
      skore = 100;
    } else if (poznamka && (poznamka === misto || poznamka === nazev)) {
      skore = 90;
    } else if (
      polozka.length >= 5 &&
      ((misto && (misto.includes(polozka) || polozka.includes(misto))) ||
        (nazev && (nazev.includes(polozka) || polozka.includes(nazev))))
    ) {
      skore = 70;
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
