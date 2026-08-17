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
 * Fail-closed: jen EHD konstrukce a schválené prefixy.
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
