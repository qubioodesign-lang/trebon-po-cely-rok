/**
 * Úzké fail-closed rozdělení titulku Galerie buddhistického umění až po matchingu.
 * Parser a matching tento modul nepoužívají.
 * Neměnit dsn-titulek.ts.
 */

export const BRANA_GBU_REDAKCNI_POLOZKA_ID = "galerie-buddhistickeho-umeni";

export const BRANA_GBU_KDE = "Galerie buddhistického um.";

/** Delší prefixy dřív. Oddělovač za prefixem je volitelný (`:` / pomlčka / mezera). */
const GBU_PREFIXY: readonly { prefix: string; co: string }[] = [
  { prefix: "Komentovaná prohlídka", co: "Komentovaná prohlídka" },
  { prefix: "Přednáška", co: "Přednáška" },
  { prefix: "Vernisáž", co: "Vernisáž" },
  { prefix: "Workshop", co: "Workshop" },
];

export type GbuTitulekRozdeleni = {
  co: string;
  nazev: string;
};

export type GbuZapisPoSparovani = {
  mistoNeboTyp: string;
  nazev: string;
  nazevProScanKlic?: string;
  verejneCo?: string | null;
  verejneRozliseni?: string | null;
};

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function oriznoutUvodniOddelovac(zbytek: string): string {
  return zbytek.replace(/^[\s]*[–\-:][\s]*/u, "").trim();
}

function velkePrvniPismenoCs(text: string): string {
  const t = text.trim();
  if (!t) {
    return t;
  }
  return t.charAt(0).toLocaleUpperCase("cs-CZ") + t.slice(1);
}

/**
 * Pozorovaná EHD konstrukce: první věta končí `?`, hned `V rámci Dnů evropského dědictví`.
 * Null = není tato konstrukce.
 */
function rozdelGbuEhdTitulek(titulek: string): GbuTitulekRozdeleni | null {
  const shoda = titulek.match(
    /^(.+?\?)\s+V rámci Dnů evropského dědictví(?=\s|$|[.,;:!?])/iu,
  );
  if (!shoda) {
    return null;
  }
  const otazka = (shoda[1] ?? "").trim();
  if (!otazka.endsWith("?")) {
    return null;
  }
  return {
    co: "Dny evropského dědictví",
    nazev: otazka,
  };
}

/**
 * Přesný prefix `DED:` → CO Dny evropského dědictví.
 * Bez dvojtečky se neshoduje. Prázdný zbytek = není tato konstrukce.
 */
function rozdelGbuDedPrefix(titulek: string): GbuTitulekRozdeleni | null {
  const shoda = titulek.match(/^DED\s*:\s*/iu);
  if (!shoda) {
    return null;
  }
  const zbytek = titulek.slice(shoda[0].length).trim();
  if (!zbytek) {
    return null;
  }
  return {
    co: "Dny evropského dědictví",
    nazev: velkePrvniPismenoCs(zbytek),
  };
}

/**
 * Přesný začátek `Zvuková lázeň` + oddělovač + neprázdný zbytek.
 * Holé slovo „lázeň“ / „koncert“ v jiném titulku se neshoduje.
 */
function rozdelGbuZvukovaLazen(titulek: string): GbuTitulekRozdeleni | null {
  const shoda = titulek.match(/^Zvuková lázeň(?=\s|[–\-:]|$)/iu);
  if (!shoda) {
    return null;
  }
  const zbytek = oriznoutUvodniOddelovac(titulek.slice(shoda[0].length));
  if (!zbytek) {
    return null;
  }
  return {
    co: "Zvuková lázeň",
    nazev: velkePrvniPismenoCs(zbytek),
  };
}

/**
 * Přesně `Kakaová ceremonie a ` + neprázdný zbytek.
 * Holé „ceremonie“ / „kakao“ v jiném titulku se neshoduje.
 */
function rozdelGbuKakaoCeremonie(titulek: string): GbuTitulekRozdeleni | null {
  const shoda = titulek.match(/^Kakaová ceremonie a\s+/iu);
  if (!shoda) {
    return null;
  }
  const zbytek = titulek.slice(shoda[0].length).trim();
  if (!zbytek) {
    return null;
  }
  return {
    co: "Kakaová ceremonie",
    nazev: velkePrvniPismenoCs(zbytek),
  };
}

/**
 * Fail-closed: jen známé GBU konstrukce a schválené prefixy.
 * Null = titulek se nemění (neznámý tvar).
 */
export function rozdelGbuTitulek(surovy: string): GbuTitulekRozdeleni | null {
  const titulek = surovy.replace(/\s+/g, " ").trim();
  if (!titulek) {
    return null;
  }

  const ehd = rozdelGbuEhdTitulek(titulek);
  if (ehd) {
    return ehd;
  }

  const ded = rozdelGbuDedPrefix(titulek);
  if (ded) {
    return ded;
  }

  const zvukova = rozdelGbuZvukovaLazen(titulek);
  if (zvukova) {
    return zvukova;
  }

  const kakao = rozdelGbuKakaoCeremonie(titulek);
  if (kakao) {
    return kakao;
  }

  for (const radek of GBU_PREFIXY) {
    const re = new RegExp(
      `^${escapeRegExp(radek.prefix)}(?=\\s|[–\\-:]|$)`,
      "i",
    );
    const shoda = titulek.match(re);
    if (!shoda) {
      continue;
    }
    const zbytek = oriznoutUvodniOddelovac(titulek.slice(shoda[0].length));
    return { co: radek.co, nazev: zbytek };
  }
  return null;
}

type JazykVstup = {
  mistoNeboTyp: string;
  verejneCo?: string | null;
  verejneRozliseni?: string | null;
};

/**
 * Po úspěšném sparovani GBU: případně čistý CO + Název; jinak surový název.
 * Neznámá konstrukce → dnešní KDE + celý název, bez ztráty události.
 * scanKlic při rozdělení počítat ze surového titulku.
 */
export function sestavGbuZapisPoSparovani(args: {
  surovyNazev: string;
  jazyk: JazykVstup;
}): GbuZapisPoSparovani {
  const surovy = args.surovyNazev.trim();
  const kde =
    (args.jazyk.verejneRozliseni ?? "").trim() || BRANA_GBU_KDE;
  const rozdel = rozdelGbuTitulek(surovy);
  if (!rozdel) {
    return {
      mistoNeboTyp: args.jazyk.mistoNeboTyp,
      nazev: surovy,
      ...(args.jazyk.verejneCo !== undefined
        ? {
            verejneCo: args.jazyk.verejneCo,
            verejneRozliseni: args.jazyk.verejneRozliseni ?? null,
          }
        : {}),
    };
  }

  const mistoNeboTyp = `${rozdel.co} ${kde}`.trim();
  return {
    mistoNeboTyp,
    nazev: rozdel.nazev,
    nazevProScanKlic: surovy,
    verejneCo: rozdel.co,
    verejneRozliseni: kde,
  };
}
