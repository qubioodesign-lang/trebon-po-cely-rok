/**
 * Rozklad dat publikační položky na CO / KDE / název.
 * Podporuje strukturovaná verejne* pole i legacy mistoNeboTyp.
 * Uložený text nemění; strukturovaná větev může skrýt redundantní nazev
 * vůči složenému verejneCo + verejneRozliseni (pouze render).
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

function normalizovatProSrovnani(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function slozenyVerejnyZapis(co: string, rozliseni: string): string {
  return [co, rozliseni].filter((cast) => cast.length > 0).join(" ");
}

/**
 * True = nazev jen opakuje CO + rozlišení (veřejný zápis už je kompletní).
 */
function jeNazevRedundantniVuciVerejnemu(
  nazev: string,
  typ: string,
  misto: string,
): boolean {
  const n = normalizovatProSrovnani(nazev);
  if (!n) {
    return false;
  }
  const verejny = normalizovatProSrovnani(slozenyVerejnyZapis(typ, misto));
  return Boolean(verejny) && n === verejny;
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
 * Prázdné CO i KDE → legacy fallback (bez rozbitého řádku).
 * Legacy: pole chybí → dnešní rozklad mistoNeboTyp.
 * Redundantní nazev vůči CO+rozlišení se ve strukturované větvi skryje.
 */
export function rozlozAkci(akce: BranaAkceVstup): {
  typ: string;
  misto: string;
  nazev: string;
  cas: string;
} {
  if (akce.verejneCo !== undefined) {
    const typ = (akce.verejneCo ?? "").trim();
    const misto = (akce.verejneRozliseni ?? "").trim();
    if (!typ && !misto) {
      return rozlozLegacyAkci(akce);
    }
    const nazev = jeNazevRedundantniVuciVerejnemu(akce.nazev, typ, misto)
      ? ""
      : akce.nazev;
    return {
      typ,
      misto,
      nazev,
      cas: akce.cas,
    };
  }
  return rozlozLegacyAkci(akce);
}
