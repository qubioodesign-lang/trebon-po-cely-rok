/**
 * Ukázková data známých zdrojů pro administraci.
 * Bez trvalého úložiště – pouze ověření modelu a sekce Zdroje.
 */

import type { BranaZdroj } from "./zdroj";

export const UKAZKOVE_ZDROJE: readonly BranaZdroj[] = [
  {
    id: "ukazka-zdroj-mesto-trebon",
    nazev: "Město Třeboň",
    typ: "DLOUHODOBY",
  },
  {
    id: "ukazka-zdroj-kino-svetozor",
    nazev: "Kino Světozor",
    typ: "DLOUHODOBY",
  },
  {
    id: "ukazka-zdroj-galerie-105",
    nazev: "Galerie 105",
    typ: "DLOUHODOBY",
  },
  {
    id: "ukazka-zdroj-restaurace",
    nazev: "ukázková restaurace",
    typ: "RYCHLY",
  },
  {
    id: "ukazka-zdroj-kavarna",
    nazev: "ukázková kavárna",
    typ: "RYCHLY",
  },
];

export function ukazkoveZdrojePodleTypu(
  typ: BranaZdroj["typ"],
): readonly BranaZdroj[] {
  return UKAZKOVE_ZDROJE.filter((zdroj) => zdroj.typ === typ);
}
