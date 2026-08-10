/**
 * Rozklad dat publikační položky na CO / KDE / název.
 * Pouze struktura polí – bez úprav textu.
 * Výhradně pro administraci BRÁNY.
 *
 * Seznam jednoslovných typů musí zůstat shodný s veřejným
 * `JEDNOSLOVNE_TYPY_AKCE` v BranaObrazovka.tsx (bez zásahu do rendereru).
 */

const JEDNOSLOVNE_TYPY_AKCE = new Set([
  "Kino",
  "Divadlo",
  "Koncert",
  "Festival",
  "Výstava",
  "Prohlídka",
  "Přednáška",
]);

export type BranaAkceVstup = {
  mistoNeboTyp: string;
  nazev: string;
  cas: string;
};

export function rozdelTypAkce(mistoNeboTyp: string): { typ: string; zbytek: string } {
  if (mistoNeboTyp === "Pro děti") {
    return { typ: "Pro děti", zbytek: "" };
  }

  const mezera = mistoNeboTyp.indexOf(" ");
  if (mezera === -1) {
    return { typ: mistoNeboTyp, zbytek: "" };
  }

  const prvniSlovo = mistoNeboTyp.slice(0, mezera);
  if (JEDNOSLOVNE_TYPY_AKCE.has(prvniSlovo)) {
    return { typ: prvniSlovo, zbytek: mistoNeboTyp.slice(mezera + 1) };
  }

  return { typ: mistoNeboTyp, zbytek: "" };
}

/**
 * True = celý řetězec je právě jeden známý typ (Kino, Koncert, … / Pro děti),
 * bez doplňku místa/instituce. Stejná množina typů jako rozdelTypAkce.
 */
export function jeCistyJednoslovnyTypAkce(mistoNeboTyp: string): boolean {
  const trim = mistoNeboTyp.trim();
  if (!trim) {
    return false;
  }
  const { typ, zbytek } = rozdelTypAkce(trim);
  if (zbytek) {
    return false;
  }
  return JEDNOSLOVNE_TYPY_AKCE.has(typ) || typ === "Pro děti";
}

export function rozlozAkci(akce: BranaAkceVstup): {
  typ: string;
  misto: string;
  nazev: string;
  cas: string;
} {
  const { typ, zbytek } = rozdelTypAkce(akce.mistoNeboTyp);

  if (zbytek) {
    return { typ, misto: zbytek, nazev: akce.nazev, cas: akce.cas };
  }

  if (JEDNOSLOVNE_TYPY_AKCE.has(typ) || typ === "Pro děti") {
    return { typ, misto: "", nazev: akce.nazev, cas: akce.cas };
  }

  return { typ, misto: akce.nazev, nazev: "", cas: akce.cas };
}
