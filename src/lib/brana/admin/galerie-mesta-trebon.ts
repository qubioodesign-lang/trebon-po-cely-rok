/**
 * Úzký fail-closed sběr jednorázových akcí Galerie města Třeboň
 * z živého výpisu itrebon.cz/kalendar.html.
 * Jen přesné místo `Galerie města Třeboň` a název začínající
 * `Vernisáž` / `Komentovaná prohlídka`. Denní karty výstav → 0.
 * GBU / JKT / 105 / VIDINY tuto větev nevolají.
 * Ownership podle živého názvu Položky, ne podle interního id.
 */

import { BRANA_GBU_REDAKCNI_POLOZKA_ID } from "./gbu-titulek";
import { BRANA_JKT_REDAKCNI_POLOZKA_ID } from "./divadlo-jk-tyla";
import type { BranaRedakcniPolozkaStav } from "./redakcni-kostra";
import type { BranaScanKandidat } from "./zdroj-scan-parser";

/** Katalogové id — jen zámek zdroje (kterou kotvu hlídá). Ownership ho nepoužívá. */
export const BRANA_GALERIE_MESTA_TREBON_KATALOG_ID = "galerie-mesta-trebon";

export const BRANA_GALERIE_MESTA_TREBON_POLOZKA = "Galerie města Třeboň";

export const BRANA_GALERIE_MESTA_TREBON_KDE = "Galerie města";

export const BRANA_GALERIE_MESTA_TREBON_CO_VERNISAZ = "Vernisáž";

export const BRANA_GALERIE_MESTA_TREBON_CO_KOMENTOVANA =
  "Komentovaná prohlídka";

/** Horní strop: pár jednorázových karet, ne program galerie. */
export const MAX_KANDIDATU_GALERIE_MESTA_TREBON = 20;

const MISTO_PRESNE = BRANA_GALERIE_MESTA_TREBON_POLOZKA;

/** Delší prefix dřív. */
const JEDNORAZOVE_PREFIXY: readonly { prefix: string; co: string }[] = [
  {
    prefix: BRANA_GALERIE_MESTA_TREBON_CO_KOMENTOVANA,
    co: BRANA_GALERIE_MESTA_TREBON_CO_KOMENTOVANA,
  },
  {
    prefix: BRANA_GALERIE_MESTA_TREBON_CO_VERNISAZ,
    co: BRANA_GALERIE_MESTA_TREBON_CO_VERNISAZ,
  },
];

export type GalerieMestaTrebonZapisPoSparovani = {
  mistoNeboTyp: string;
  nazev: string;
  nazevProScanKlic?: string;
  verejneCo?: string | null;
  verejneRozliseni?: string | null;
};

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizovatItrebonMezery(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function dekodovatHtmlText(raw: string): string {
  return raw
    .replace(/&#(\d+);/g, (_, n: string) => {
      const kod = Number(n);
      return Number.isFinite(kod) ? String.fromCharCode(kod) : "";
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n: string) => {
      const kod = Number.parseInt(n, 16);
      return Number.isFinite(kod) ? String.fromCharCode(kod) : "";
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function textBezHtmlTagu(html: string): string {
  return dekodovatHtmlText(html.replace(/<[^>]+>/g, " "));
}

function obsahPrvkuPodleTridy(html: string, className: string): string {
  const re = new RegExp(
    `<[^>]*\\bclass=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)</`,
    "i",
  );
  const shoda = html.match(re);
  return textBezHtmlTagu(shoda?.[1] ?? "");
}

function formatujIsoDen(rok: number, mesic: number, den: number): string {
  return `${rok}-${String(mesic).padStart(2, "0")}-${String(den).padStart(2, "0")}`;
}

function formatujCas(hodina: number, minuta: number): string {
  return `${String(hodina).padStart(2, "0")}:${String(minuta).padStart(2, "0")}`;
}

function jeItrebonKalendarZdrojUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== "itrebon.cz") {
      return false;
    }
    const path = parsed.pathname.replace(/\/+$/, "").toLowerCase();
    return path === "/kalendar.html" || path === "/kalendar";
  } catch {
    return false;
  }
}

function oriznoutUvodniOddelovac(zbytek: string): string {
  return zbytek.replace(/^[\s]*[–\-:][\s]*/u, "").trim();
}

/**
 * True = zdroj má stejnou iTřeboň URL jako GBU, ale hlídá katalogovou
 * kotvu Galerie města Třeboň (a ne GBU / JKT).
 * Scan větev musí běžet před GBU URL větví, za JKT.
 */
export function jeItrebonGalerieMestaTrebonZdroj(zdroj: {
  url: string;
  rezimScanu?: string;
  hlidaneRedakcniPolozkaIds?: readonly string[];
}): boolean {
  if (!jeItrebonKalendarZdrojUrl(zdroj.url)) {
    return false;
  }
  if (zdroj.rezimScanu !== "HLIDANE_KOTVY") {
    return false;
  }
  const ids = (zdroj.hlidaneRedakcniPolozkaIds ?? []).map((id) => id.trim());
  if (!ids.includes(BRANA_GALERIE_MESTA_TREBON_KATALOG_ID)) {
    return false;
  }
  if (ids.includes(BRANA_GBU_REDAKCNI_POLOZKA_ID)) {
    return false;
  }
  if (ids.includes(BRANA_JKT_REDAKCNI_POLOZKA_ID)) {
    return false;
  }
  return true;
}

export function jePresneItrebonGalerieMestaTrebonMisto(misto: string): boolean {
  return normalizovatItrebonMezery(misto) === MISTO_PRESNE;
}

/**
 * Case-insensitive začátek `kal-nazev`: Vernisáž / Komentovaná prohlídka.
 * `Výstava` / `Zahájení výstavy` / jednodenní datum sem nepatří.
 */
export function jeItrebonGalerieMestaTrebonJednorazovyNazev(
  nazev: string,
): boolean {
  return vytahnoutGalerieMestaTrebonCo(nazev) !== null;
}

function vytahnoutGalerieMestaTrebonCo(
  nazev: string,
): { co: string; zbytek: string } | null {
  const n = normalizovatItrebonMezery(nazev);
  if (!n) {
    return null;
  }
  for (const radek of JEDNORAZOVE_PREFIXY) {
    const re = new RegExp(
      `^${escapeRegExp(radek.prefix)}(?=\\s|[–\\-:]|$)`,
      "i",
    );
    const shoda = n.match(re);
    if (!shoda) {
      continue;
    }
    return {
      co: radek.co,
      zbytek: oriznoutUvodniOddelovac(n.slice(shoda[0].length)),
    };
  }
  return null;
}

function itrebonHrefAId(karta: string): { href: string; id: string } | null {
  const shoda = karta.match(
    /href=["']([^"']*\/kalendar\/[^"'?#]*_(\d+)\.html[^"']*)["']/i,
  );
  const href = (shoda?.[1] ?? "").trim();
  const id = (shoda?.[2] ?? "").trim();
  if (!href || !id) {
    return null;
  }
  return { href, id };
}

function itrebonDatumyZTextu(
  datumText: string,
): { datumOd: string; datumDo: string } | null {
  const shody = [
    ...normalizovatItrebonMezery(datumText).matchAll(
      /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/g,
    ),
  ];
  if (shody.length === 0) {
    return null;
  }
  const prvni = shody[0];
  const den = Number(prvni[1]);
  const mesic = Number(prvni[2]);
  const rok = Number(prvni[3]);
  if (mesic < 1 || mesic > 12 || den < 1 || den > 31) {
    return null;
  }
  const datumOd = formatujIsoDen(rok, mesic, den);
  if (shody.length < 2) {
    return { datumOd, datumDo: datumOd };
  }
  const druhy = shody[1];
  const denDo = Number(druhy[1]);
  const mesicDo = Number(druhy[2]);
  const rokDo = Number(druhy[3]);
  if (mesicDo < 1 || mesicDo > 12 || denDo < 1 || denDo > 31) {
    return { datumOd, datumDo: datumOd };
  }
  return { datumOd, datumDo: formatujIsoDen(rokDo, mesicDo, denDo) };
}

function itrebonZacatekCasu(casText: string): string {
  const shoda = normalizovatItrebonMezery(casText).match(
    /(\d{1,2}):(\d{2})/,
  );
  if (!shoda) {
    return "";
  }
  const hodina = Number(shoda[1]);
  const minuta = Number(shoda[2]);
  if (hodina > 23 || minuta > 59) {
    return "";
  }
  return formatujCas(hodina, minuta);
}

/**
 * HTML výpis itrebon.cz/kalendar.html → jen jednorázové akce GMT.
 * Cizí místa a denní karty výstav se tiše zahodí (ne Nezařazené).
 * Název jen z `kal-nazev` — bez fallbacku na anotaci.
 */
export function parsovatItrebonGalerieMestaTrebon(
  html: string,
): BranaScanKandidat[] {
  const vysledek: BranaScanKandidat[] = [];
  const karty = [
    ...html.matchAll(
      /<div[^>]*\bclass=["'][^"']*\bkalendarAkceBox\b[^"']*["'][^>]*>[\s\S]*?(?=<div[^>]*\bclass=["'][^"']*\bkalendarAkceBox\b|<\/body>|$)/gi,
    ),
  ];
  for (const kartaMatch of karty) {
    if (vysledek.length >= MAX_KANDIDATU_GALERIE_MESTA_TREBON) {
      return vysledek;
    }
    const karta = kartaMatch[0];
    const misto = obsahPrvkuPodleTridy(karta, "kalTerminMisto");
    if (!jePresneItrebonGalerieMestaTrebonMisto(misto)) {
      continue;
    }
    const nazev = obsahPrvkuPodleTridy(karta, "kal-nazev");
    if (!nazev || nazev.length < 2) {
      continue;
    }
    if (!jeItrebonGalerieMestaTrebonJednorazovyNazev(nazev)) {
      continue;
    }

    const identita = itrebonHrefAId(karta);
    if (!identita) {
      continue;
    }

    const datumy = itrebonDatumyZTextu(
      obsahPrvkuPodleTridy(karta, "kalTerminDatum"),
    );
    if (!datumy) {
      continue;
    }

    vysledek.push({
      nazev,
      datumOd: datumy.datumOd,
      datumDo: datumy.datumDo,
      cas: itrebonZacatekCasu(obsahPrvkuPodleTridy(karta, "kalTerminCas")),
      mistoNeboTyp: MISTO_PRESNE,
      zdrojIdentita: `itrebon|${identita.id}`,
    });
  }
  return vysledek;
}

/**
 * Právě jedna ANO Položka „Galerie města Třeboň“. Interní id se nehádá.
 * Jinak null (0 zápisů).
 */
export function najitGalerieMestaTrebonKotvuId(
  polozky: readonly BranaRedakcniPolozkaStav[],
): string | null {
  const shody = polozky.filter(
    (p) =>
      p.pouzivat === "ANO" &&
      (p.polozka ?? "").trim() === BRANA_GALERIE_MESTA_TREBON_POLOZKA,
  );
  return shody.length === 1 ? shody[0].id : null;
}

type JazykVstup = {
  mistoNeboTyp: string;
  verejneCo?: string | null;
  verejneRozliseni?: string | null;
};

/**
 * Po úspěšném sparovani: CO z prefixu názvu, KDE pevné Galerie města
 * (nebo už nastavené rozlišení z RP).
 */
export function sestavGalerieMestaTrebonZapisPoSparovani(args: {
  surovyNazev: string;
  jazyk: JazykVstup;
}): GalerieMestaTrebonZapisPoSparovani {
  const surovy = args.surovyNazev.trim();
  const kde =
    (args.jazyk.verejneRozliseni ?? "").trim() ||
    BRANA_GALERIE_MESTA_TREBON_KDE;
  const rozdel = vytahnoutGalerieMestaTrebonCo(surovy);
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
    nazev: rozdel.zbytek,
    nazevProScanKlic: surovy,
    verejneCo: rozdel.co,
    verejneRozliseni: kde,
  };
}
