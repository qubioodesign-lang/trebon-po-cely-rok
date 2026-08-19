/**
 * Úzký fail-closed parser programu Music Club Beseda (besedaclub.cz).
 * Scan z homepage deterministicky přejde na /program.html (přednostně
 * odkaz „Program“). Jen pojmenované karty s datem. Čas jen když je
 * na vlastním řádku jednoznačný začátek akce — VIP / provoz / dveře ne.
 *
 * Interní ID kotvy se nehádá. Scan ji najde v živém Redakčním pořadí
 * podle přesného textu Položka „Music Club Beseda“ + Používat=ANO.
 * Neshoda → 0 zápis, bez Nezařazených.
 */

import type { BranaRedakcniPolozkaStav } from "./redakcni-kostra";
import type { BranaScanKandidat } from "./zdroj-scan-parser";

export const BRANA_BESEDA_POLOZKA = "Music Club Beseda";
export const BRANA_BESEDA_KDE = "Music Club Beseda";
export const BESEDA_PROGRAM_PATH = "/program.html";

const BESEDA_HOST = "besedaclub.cz";
const MAX_KANDIDATU = 40;

export type BesedaScanKandidat = BranaScanKandidat;

export type BesedaZapisPoSparovani = {
  mistoNeboTyp: string;
  nazev: string;
  nazevProScanKlic?: string;
  verejneCo?: string | null;
  verejneRozliseni?: string | null;
};

function normalizovatBeseda(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function dekodovatBesedaText(raw: string): string {
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
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textBezHtmlBeseda(html: string): string {
  return dekodovatBesedaText(html.replace(/<[^>]+>/g, " "));
}

function slugProBesedaIdentitu(text: string): string {
  return normalizovatBeseda(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hostBeseda(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

export function jeBesedaZdrojUrl(url: string): boolean {
  return hostBeseda(url) === BESEDA_HOST;
}

export function sestavBesedaHomeUrl(zdrojUrl: string): string {
  if (!jeBesedaZdrojUrl(zdrojUrl)) {
    return "";
  }
  try {
    const base = new URL(zdrojUrl);
    return `${base.protocol}//${base.host}/`;
  } catch {
    return "";
  }
}

export function sestavBesedaProgramUrl(zdrojUrl: string): string {
  if (!jeBesedaZdrojUrl(zdrojUrl)) {
    return "";
  }
  try {
    const base = new URL(zdrojUrl);
    return `${base.protocol}//${base.host}${BESEDA_PROGRAM_PATH}`;
  } catch {
    return "";
  }
}

function atributZTagu(tagAttrs: string, jmeno: string): string {
  const re = new RegExp(
    `\\b${jmeno}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
    "i",
  );
  const m = tagAttrs.match(re);
  return (m?.[1] ?? m?.[2] ?? "").trim();
}

/**
 * Z homepage HTML vytáhne odkaz Program na stejný host.
 * Nic → prázdný řetězec (volající může sáhnout na kanonické /program.html).
 */
export function vytahnoutBesedaProgramUrl(
  hubHtml: string,
  hubUrl: string,
): string {
  if (!jeBesedaZdrojUrl(hubUrl) || !hubHtml.trim()) {
    return "";
  }
  let origin: string;
  try {
    origin = new URL(hubUrl).origin;
  } catch {
    return "";
  }

  let zTextu = "";
  let zHref = "";
  for (const m of hubHtml.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = atributZTagu(m[1] ?? "", "href");
    if (!href || href.startsWith("#") || href.toLowerCase().startsWith("javascript:")) {
      continue;
    }
    let abs: URL;
    try {
      abs = new URL(href, origin);
    } catch {
      continue;
    }
    if (abs.hostname.replace(/^www\./i, "").toLowerCase() !== BESEDA_HOST) {
      continue;
    }
    const path = abs.pathname.replace(/\/+$/, "").toLowerCase();
    if (path !== "/program.html" && path !== "/program") {
      continue;
    }
    const popisek = textBezHtmlBeseda(m[2] ?? "");
    const normalizovana = `${abs.origin}${abs.pathname.endsWith(".html") ? abs.pathname : BESEDA_PROGRAM_PATH}`;
    if (normalizovatBeseda(popisek) === "program") {
      zTextu = normalizovana;
      break;
    }
    if (!zHref) {
      zHref = normalizovana;
    }
  }
  return zTextu || zHref;
}

/**
 * Živý program.html nemá canonical s hostem — detekce je h2/title Program.
 * Scan už bere jen besedaclub.cz (jeBesedaZdrojUrl).
 */
export function jeBesedaProgramHtml(html: string): boolean {
  const nadpis = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].some(
    (m) => normalizovatBeseda(textBezHtmlBeseda(m[1] ?? "")) === "program",
  );
  if (nadpis) {
    return true;
  }
  return /<title[^>]*>[\s\S]*Program[\s\S]*Beseda/i.test(html);
}

function jePlatnyDen(rok: number, mesic: number, den: number): boolean {
  if (den < 1 || den > 31 || mesic < 1 || mesic > 12 || rok < 2000) {
    return false;
  }
  const dt = new Date(Date.UTC(rok, mesic - 1, den));
  return (
    dt.getUTCFullYear() === rok &&
    dt.getUTCMonth() + 1 === mesic &&
    dt.getUTCDate() === den
  );
}

function formatujIsoDen(rok: number, mesic: number, den: number): string {
  return `${rok}-${String(mesic).padStart(2, "0")}-${String(den).padStart(2, "0")}`;
}

function formatujCas(hodina: number, minuta: number): string {
  return `${String(hodina).padStart(2, "0")}:${String(minuta).padStart(2, "0")}`;
}

function parsovatDatumZRadku(text: string): string | null {
  const m = text.match(/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/);
  if (!m) {
    return null;
  }
  const den = Number(m[1]);
  const mesic = Number(m[2]);
  const rok = Number(m[3]);
  if (!jePlatnyDen(rok, mesic, den)) {
    return null;
  }
  return formatujIsoDen(rok, mesic, den);
}

/**
 * Jen samostatný řádek času, případně s prefixem START.
 * Věty (VIP vstup, provoz, dveře) se neberou. 2+ časy → prázdné.
 */
export function vytahnoutJednoznacnyCasZacatkuBesedy(teloHtml: string): string {
  const sRadky = teloHtml
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n");
  const radky = textBezHtmlBeseda(sRadky.replace(/\n/g, "§"))
    .split("§")
    .map((r) => r.trim())
    .filter((r) => r.length > 0);

  const nalezene: string[] = [];
  for (const radek of radky) {
    const m = radek.match(/^(?:START\s+)?(\d{1,2})[.:](\d{2})$/i);
    if (!m) {
      continue;
    }
    const hodina = Number(m[1]);
    const minuta = Number(m[2]);
    if (hodina > 23 || minuta > 59) {
      continue;
    }
    nalezene.push(formatujCas(hodina, minuta));
  }
  if (nalezene.length !== 1) {
    return "";
  }
  return nalezene[0] ?? "";
}

export function sestavBesedaZdrojIdentitu(args: {
  datumOd: string;
  nazev: string;
}): string {
  const slug = slugProBesedaIdentitu(args.nazev);
  return `beseda|${args.datumOd}|${slug || "akce"}`;
}

export function najitBesedaKotvuId(
  polozky: readonly BranaRedakcniPolozkaStav[],
): string | null {
  const cil = BRANA_BESEDA_POLOZKA;
  const shody = polozky.filter(
    (p) => p.pouzivat === "ANO" && (p.polozka ?? "").trim() === cil,
  );
  return shody.length === 1 ? shody[0].id : null;
}

type JazykVstup = {
  mistoNeboTyp: string;
  verejneCo?: string | null;
  verejneRozliseni?: string | null;
};

/**
 * CO = přesný název karty; KDE z pravidla (pevné Music Club Beseda).
 * Nazev = KDE, aby se na veřejnosti neopakoval jako druhý řádek.
 */
export function sestavBesedaZapisPoSparovani(args: {
  surovyNazev: string;
  jazyk: JazykVstup;
}): BesedaZapisPoSparovani {
  const co = args.surovyNazev.replace(/\s+/g, " ").trim();
  const kde =
    (args.jazyk.verejneRozliseni ?? "").trim() || BRANA_BESEDA_KDE;
  if (!co) {
    return {
      mistoNeboTyp: args.jazyk.mistoNeboTyp,
      nazev: args.surovyNazev,
      ...(args.jazyk.verejneCo !== undefined
        ? {
            verejneCo: args.jazyk.verejneCo,
            verejneRozliseni: args.jazyk.verejneRozliseni ?? null,
          }
        : {}),
    };
  }
  return {
    mistoNeboTyp: `${co} ${kde}`.trim(),
    nazev: kde,
    nazevProScanKlic: co,
    verejneCo: co,
    verejneRozliseni: kde,
  };
}

function jeIgnorovanyNadpis(nazev: string): boolean {
  const n = normalizovatBeseda(nazev);
  return (
    n === "kde nas najdete" ||
    n === "program" ||
    n.length < 2
  );
}

export function parsovatBesedaProgram(html: string): BesedaScanKandidat[] {
  if (!jeBesedaProgramHtml(html)) {
    return [];
  }
  if (/aktualne neni naplanovana zadna akce/i.test(normalizovatBeseda(html))) {
    return [];
  }

  const videne = new Set<string>();
  const out: BesedaScanKandidat[] = [];

  for (const m of html.matchAll(
    /<h3\b[^>]*>([\s\S]*?)<\/h3>\s*<p>\s*<strong>([\s\S]*?)<\/strong>\s*<\/p>(?:\s*<p>([\s\S]*?)<\/p>)?/gi,
  )) {
    if (out.length >= MAX_KANDIDATU) {
      break;
    }
    const nazev = textBezHtmlBeseda(m[1] ?? "");
    if (jeIgnorovanyNadpis(nazev)) {
      continue;
    }
    const datumOd = parsovatDatumZRadku(textBezHtmlBeseda(m[2] ?? ""));
    if (!datumOd) {
      continue;
    }
    const telo = m[3] ?? "";
    const cas = vytahnoutJednoznacnyCasZacatkuBesedy(telo);
    const identita = sestavBesedaZdrojIdentitu({ datumOd, nazev });
    if (videne.has(identita)) {
      continue;
    }
    videne.add(identita);
    out.push({
      nazev,
      datumOd,
      datumDo: datumOd,
      cas,
      mistoNeboTyp: BRANA_BESEDA_KDE,
      zdrojIdentita: identita,
    });
  }
  return out;
}

export function parsovatBeseda(
  html: string,
  vysledek: BranaScanKandidat[],
): void {
  for (const k of parsovatBesedaProgram(html)) {
    vysledek.push(k);
  }
}
