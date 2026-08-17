/**
 * Úzké fail-closed rozdělení titulku DSN až po matchingu.
 * Parser a matching tento modul nepoužívají.
 */

export const BRANA_DSN_REDAKCNI_POLOZKA_ID = "dum-stepanka-netolickeho";

export const BRANA_DSN_KDE = "Dům Š. Netolického";

/** Delší prefixy dřív, aby „Vernisáž výstavy“ vyhrála nad „Vernisáž“. */
const DSN_PREFIXY: readonly { prefix: string; co: string }[] = [
  { prefix: "Komentovaná prohlídka výstavy", co: "Komentovaná prohlídka" },
  { prefix: "Dny otevřených ateliérů", co: "Dny otevřených ateliérů" },
  { prefix: "Vernisáž výstavy", co: "Vernisáž" },
  { prefix: "Komentovaná prohlídka", co: "Komentovaná prohlídka" },
  { prefix: "Přednáška", co: "Přednáška" },
  { prefix: "Vernisáž", co: "Vernisáž" },
];

export type DsnTitulekRozdeleni = {
  co: string;
  nazev: string;
};

export type DsnZapisPoSparovani = {
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
 * Fail-closed: jen schválené prefixy.
 * Null = titulek se nemění (neznámý typ).
 */
export function rozdelDsnTitulek(surovy: string): DsnTitulekRozdeleni | null {
  const titulek = surovy.replace(/\s+/g, " ").trim();
  if (!titulek) {
    return null;
  }

  for (const radek of DSN_PREFIXY) {
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
 * Po úspěšném sparovani DSN: čistý redakční název + surový titulek pro scanKlic.
 * Neznámý prefix → dnešní KDE + celý název, bez nazevProScanKlic.
 */
export function sestavDsnZapisPoSparovani(args: {
  surovyNazev: string;
  jazyk: JazykVstup;
}): DsnZapisPoSparovani {
  const surovy = args.surovyNazev.trim();
  const kde =
    (args.jazyk.verejneRozliseni ?? "").trim() || BRANA_DSN_KDE;
  const rozdel = rozdelDsnTitulek(surovy);
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
