/**
 * Rozklad dat publikační položky na CO / KDE / název.
 * Podporuje strukturovaná verejne* pole i legacy mistoNeboTyp.
 * Bez úprav textu.
 *
 * Seznam jednoslovných typů musí zůstat shodný s dřívějším
 * veřejným whitelistem (Kino, Divadlo, …).
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
  /**
   * undefined = legacy rozklad mistoNeboTyp
   * null / string = strukturovaná cesta
   */
  verejneCo?: string | null;
  verejneRozliseni?: string | null;
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

function rozlozLegacyAkci(akce: BranaAkceVstup): {
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

/**
 * Strukturovaná cesta: verejneCo !== undefined.
 * Legacy: pole chybí → dnešní rozklad mistoNeboTyp.
 */
export function rozlozAkci(akce: BranaAkceVstup): {
  typ: string;
  misto: string;
  nazev: string;
  cas: string;
} {
  if (akce.verejneCo !== undefined) {
    return {
      typ: akce.verejneCo ?? "",
      misto: (akce.verejneRozliseni ?? "").trim(),
      nazev: akce.nazev,
      cas: akce.cas,
    };
  }
  return rozlozLegacyAkci(akce);
}
