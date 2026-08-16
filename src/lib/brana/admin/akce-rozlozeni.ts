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

/** Veřejný CO rodiny Trhů — jediný typ s oddělovačem ` · `. */
const VEREJNE_CO_TRH = "Trh";
const ODDELOVAC_TRH = " · ";
const ODDELOVAC_BEZNY = " ";

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

export type BranaAkceRozlozeni = {
  typ: string;
  misto: string;
  nazev: string;
  cas: string;
  /**
   * Text mezi typ a misto ve veřejném/admin renderu.
   * Jen rodina Trhů používá ` · `; ostatní mezera (beze změny).
   */
  oddelovacPredMistem: string;
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

function oddelovacPredMistemPro(typ: string, misto: string): string {
  if (typ === VEREJNE_CO_TRH && misto.trim()) {
    return ODDELOVAC_TRH;
  }
  return ODDELOVAC_BEZNY;
}

function slozenyVerejnyZapis(
  co: string,
  rozliseni: string,
  oddelovac: string,
): string {
  return [co, rozliseni].filter((cast) => cast.length > 0).join(oddelovac);
}

/**
 * True = nazev jen opakuje veřejný zápis (CO+rozlišení / jen rozlišení).
 * Uložený nazev se nemění — pouze render.
 */
function jeNazevRedundantniVuciVerejnemu(
  nazev: string,
  typ: string,
  misto: string,
  oddelovac: string,
): boolean {
  const n = normalizovatProSrovnani(nazev);
  if (!n) {
    return false;
  }
  if (misto && n === normalizovatProSrovnani(misto)) {
    return true;
  }
  const verejny = normalizovatProSrovnani(
    slozenyVerejnyZapis(typ, misto, oddelovac),
  );
  if (verejny && n === verejny) {
    return true;
  }
  // I když render používá ` · `, nazev bez tečky se stejným CO+mezera.
  if (oddelovac !== ODDELOVAC_BEZNY) {
    const sMezerou = normalizovatProSrovnani(
      slozenyVerejnyZapis(typ, misto, ODDELOVAC_BEZNY),
    );
    if (sMezerou && n === sMezerou) {
      return true;
    }
  }
  return false;
}

function sOddelovacem(casti: {
  typ: string;
  misto: string;
  nazev: string;
  cas: string;
}): BranaAkceRozlozeni {
  return {
    ...casti,
    oddelovacPredMistem: oddelovacPredMistemPro(casti.typ, casti.misto),
  };
}

function rozlozLegacyAkci(akce: BranaAkceVstup): BranaAkceRozlozeni {
  const { typ, zbytek } = rozdelTypAkce(akce.mistoNeboTyp);

  if (zbytek) {
    return sOddelovacem({
      typ,
      misto: zbytek,
      nazev: akce.nazev,
      cas: akce.cas,
    });
  }

  if (JEDNOSLOVNE_TYPY_AKCE.has(typ) || typ === "Pro děti") {
    return sOddelovacem({
      typ,
      misto: "",
      nazev: akce.nazev,
      cas: akce.cas,
    });
  }

  return sOddelovacem({
    typ,
    misto: akce.nazev,
    nazev: "",
    cas: akce.cas,
  });
}

/**
 * Strukturovaná cesta: verejneCo !== undefined.
 * Prázdné CO i KDE → legacy fallback (bez rozbitého řádku).
 * Legacy: pole chybí → dnešní rozklad mistoNeboTyp.
 * Redundantní nazev vůči CO+rozlišení / samotnému rozlišení se skryje.
 */
export function rozlozAkci(akce: BranaAkceVstup): BranaAkceRozlozeni {
  if (akce.verejneCo !== undefined) {
    const typ = (akce.verejneCo ?? "").trim();
    const misto = (akce.verejneRozliseni ?? "").trim();
    if (!typ && !misto) {
      return rozlozLegacyAkci(akce);
    }
    const oddelovac = oddelovacPredMistemPro(typ, misto);
    const nazev = jeNazevRedundantniVuciVerejnemu(
      akce.nazev,
      typ,
      misto,
      oddelovac,
    )
      ? ""
      : akce.nazev;
    return {
      typ,
      misto,
      nazev,
      cas: akce.cas,
      oddelovacPredMistem: oddelovac,
    };
  }
  return rozlozLegacyAkci(akce);
}
