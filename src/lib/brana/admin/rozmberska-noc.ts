/**
 * Úzký fail-closed parser Rožmberské noci na zamek-trebon.cz.
 * Dlouhodobý Zdroj: stabilní listing /cs/akce → discovery odkazu
 * s přesným názvem „Rožmberská noc“ → stávající parser detailu.
 * Ostatní akce zámku, Hradozámecká noc a obecný program → 0 kandidátů.
 *
 * Jeden kalendářní den = jedna karta. Tři denní vstupy jdou do verejneCo,
 * pole cas zůstává prázdné.
 *
 * Interní ID se nehádá. Scan najde kotvu v živém Redakčním pořadí:
 * id rozmberska-noc + Položka „Rožmberská noc“ + Používat=ANO.
 * Neshoda → 0 zápis, bez Nezařazených.
 */

import type { BranaRedakcniPolozkaStav } from "./redakcni-kostra";
import type { BranaScanKandidat } from "./zdroj-scan-parser";

export const BRANA_ROZMBERSKA_NOC_REDAKCNI_POLOZKA_ID = "rozmberska-noc";
export const BRANA_ROZMBERSKA_NOC_POLOZKA = "Rožmberská noc";
export const BRANA_ROZMBERSKA_NOC_NAZEV = "Opera";
export const BRANA_ROZMBERSKA_NOC_CO_ZAMEK = "Rožmberská noc · Zámek";

const ZAMEK_HOST = "zamek-trebon.cz";
const LISTING_CESTA = "/cs/akce";
const MAX_DNI = 14;
const MAX_MESICU_DISCOVERY = 8;
const IDENTITA_RE = /^rozmberska-noc\|(\d{4}-\d{2}-\d{2})$/;

export type RozmberskaNocScanKandidat = BranaScanKandidat;

export type RozmberskaNocZapisPoSparovani = {
  mistoNeboTyp: string;
  nazev: string;
  verejneCo: string;
  verejneRozliseni: null;
  nazevProScanKlic?: string;
};

function normalizovatRn(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function dekodovatRnText(raw: string): string {
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

function textBezHtmlRn(html: string): string {
  return dekodovatRnText(html.replace(/<[^>]+>/g, " "));
}

function hostZamek(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function cestaZamek(url: string): string | null {
  try {
    return decodeURIComponent(new URL(url).pathname).toLowerCase();
  } catch {
    return null;
  }
}

function castiCesty(path: string): string[] {
  return path.replace(/\/+$/, "").split("/").filter(Boolean);
}

/** Stabilní kalendář akcí zámku — to se ukládá do Zdrojů. */
export function jeRozmberskaNocListingUrl(url: string): boolean {
  if (hostZamek(url) !== ZAMEK_HOST) {
    return false;
  }
  const path = cestaZamek(url);
  if (!path) {
    return false;
  }
  const casti = castiCesty(path);
  return casti.length === 2 && casti[0] === "cs" && casti[1] === "akce";
}

/** Jen stránka konkrétní akce Rožmberská noc — ne listing, ne jiná akce. */
export function jeRozmberskaNocDetailUrl(url: string): boolean {
  if (hostZamek(url) !== ZAMEK_HOST) {
    return false;
  }
  const path = cestaZamek(url);
  if (!path || !path.includes("/akce/")) {
    return false;
  }
  const slug = path.split("/").filter(Boolean).pop() ?? "";
  return normalizovatRn(slug).includes("rozmberska-noc");
}

export function jeRozmberskaNocZdrojUrl(url: string): boolean {
  return jeRozmberskaNocListingUrl(url) || jeRozmberskaNocDetailUrl(url);
}

export function sestavRozmberskaNocListingUrl(zdrojUrl: string): string {
  if (!jeRozmberskaNocZdrojUrl(zdrojUrl)) {
    return "";
  }
  try {
    const u = new URL(zdrojUrl);
    u.pathname = LISTING_CESTA;
    u.search = "";
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return `https://www.${ZAMEK_HOST}${LISTING_CESTA}`;
  }
}

function nadpisyH1(html: string): string[] {
  return [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) =>
    normalizovatRn(textBezHtmlRn(m[1] ?? "")),
  );
}

export function jeRozmberskaNocHtml(html: string): boolean {
  const nadpisy = nadpisyH1(html);
  const maRn = nadpisy.some((n) => n.includes("rozmberska noc"));
  const maHradozameckou = nadpisy.some((n) => n.includes("hradozamecka"));
  if (!maRn || maHradozameckou) {
    return false;
  }
  return /class=["']event["']/i.test(html);
}

function atributHref(atributy: string): string {
  const m = atributy.match(/\bhref=["']([^"']+)["']/i);
  return (m?.[1] ?? "").trim();
}

function maTridu(atributy: string, trida: string): boolean {
  const m = atributy.match(/\bclass=["']([^"']*)["']/i);
  const classy = (m?.[1] ?? "").split(/\s+/);
  return classy.includes(trida);
}

/**
 * Jádro názvu karty v listingu: bez prefixu „Třeboň:“ a bez stavu VYPRODÁNO.
 * Přesná shoda = „Rožmberská noc“. Hradozámecká noc / jiná akce / prohlídka → ne.
 */
export function jePresnyNazevRozmberskaNocAkce(nazev: string): boolean {
  let jadro = normalizovatRn(nazev).replace(/^trebon\s*:\s*/, "");
  jadro = jadro.replace(/\s*[–-]\s*vyprodano\s*$/u, "").trim();
  jadro = jadro.replace(/\s+vyprodano\s*$/u, "").trim();
  if (!jadro || jadro.includes("hradozamecka")) {
    return false;
  }
  return jadro === "rozmberska noc";
}

function kanonizovatZamekUrl(href: string, listingUrl: string): string {
  try {
    const abs = new URL(href, listingUrl);
    if (hostZamek(abs.toString()) !== ZAMEK_HOST) {
      return "";
    }
    abs.hash = "";
    abs.search = "";
    return abs.toString();
  } catch {
    return "";
  }
}

export type RozmberskaNocMesicListingu = {
  rok: number;
  mesic: number;
};

/** Měsíce, které listing sám nabízí v li.panel — bez šipek prev/next. */
export function vytahnoutRozmberskaNocMesiceZListingu(
  html: string,
): RozmberskaNocMesicListingu[] {
  const out: RozmberskaNocMesicListingu[] = [];
  const videne = new Set<string>();
  for (const m of html.matchAll(
    /<li\b[^>]*class=["'][^"']*\bpanel\b[^"']*["'][^>]*>[\s\S]*?<a\b[^>]*class=["'][^"']*events-filter-month-selector[^"']*["'][^>]*>/gi,
  )) {
    const tag = m[0];
    const rokM = tag.match(/\bdata-year=["'](\d{4})["']/i);
    const mesicM = tag.match(/\bdata-month=["'](\d{1,2})["']/i);
    const rok = Number(rokM?.[1] ?? "");
    const mesic = Number(mesicM?.[1] ?? "");
    if (rok < 2000 || mesic < 1 || mesic > 12) {
      continue;
    }
    const klic = `${rok}-${mesic}`;
    if (videne.has(klic)) {
      continue;
    }
    videne.add(klic);
    out.push({ rok, mesic });
    if (out.length >= MAX_MESICU_DISCOVERY) {
      break;
    }
  }
  return out;
}

export function sestavRozmberskaNocMesicPostTelo(args: {
  rok: number;
  mesic: number;
}): string {
  const telo = new URLSearchParams();
  telo.set("formId", "eventsFilter");
  telo.set("month", String(args.mesic));
  telo.set("year", String(args.rok));
  telo.set("page", "1");
  telo.set("offset", "0");
  telo.set("sort", "1");
  telo.set("day", "");
  telo.set("fullMonth", "");
  return telo.toString();
}

/** Odkazy z listing karet — jen přesný název Rožmberská noc. */
export function vytahnoutRozmberskaNocDetailUrlZListingu(
  html: string,
  listingUrl: string,
): string[] {
  const out: string[] = [];
  const videne = new Set<string>();
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const atributy = m[1] ?? "";
    if (!maTridu(atributy, "events__item-title")) {
      continue;
    }
    const nazev = textBezHtmlRn(m[2] ?? "");
    if (!jePresnyNazevRozmberskaNocAkce(nazev)) {
      continue;
    }
    const abs = kanonizovatZamekUrl(atributHref(atributy), listingUrl);
    if (!abs || !jeRozmberskaNocDetailUrl(abs)) {
      continue;
    }
    if (videne.has(abs)) {
      continue;
    }
    videne.add(abs);
    out.push(abs);
  }
  return out;
}

export function vybratJednoznacnyRozmberskaNocDetailUrl(
  urlky: readonly string[],
): string | null {
  const unikatni = [...new Set(urlky.filter((u) => jeRozmberskaNocDetailUrl(u)))];
  return unikatni.length === 1 ? (unikatni[0] ?? null) : null;
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

export function sestavRozmberskaNocZdrojIdentitu(datumOd: string): string {
  const d = datumOd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return "";
  }
  return `rozmberska-noc|${d}`;
}

export function jeRozmberskaNocZdrojIdentita(
  identita: string | undefined | null,
): boolean {
  return IDENTITA_RE.test((identita ?? "").trim());
}

function parsujIsoDen(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    return null;
  }
  const rok = Number(m[1]);
  const mesic = Number(m[2]);
  const den = Number(m[3]);
  if (!jePlatnyDen(rok, mesic, den)) {
    return null;
  }
  return new Date(Date.UTC(rok, mesic - 1, den));
}

function dnyRozmezi(odIso: string, doIso: string): string[] {
  const od = parsujIsoDen(odIso);
  const doDne = parsujIsoDen(doIso);
  if (!od || !doDne || doDne.getTime() < od.getTime()) {
    return [];
  }
  const dny: string[] = [];
  const kurzor = new Date(od.getTime());
  while (kurzor.getTime() <= doDne.getTime()) {
    if (dny.length >= MAX_DNI) {
      return [];
    }
    dny.push(
      formatujIsoDen(
        kurzor.getUTCFullYear(),
        kurzor.getUTCMonth() + 1,
        kurzor.getUTCDate(),
      ),
    );
    kurzor.setUTCDate(kurzor.getUTCDate() + 1);
  }
  return dny;
}

function vytahnoutEventMetadata(html: string): string {
  const m = html.match(/<div class="event">([\s\S]*?)<div class="post-text">/i);
  return m?.[1] ?? "";
}

function vytahnoutPostText(html: string): string {
  const m = html.match(/<div class="post-text">([\s\S]*?)<\/div>/i);
  return m?.[1] ?? "";
}

function vytahnoutDatumoveRozmezi(text: string): { od: string; doDne: string } | null {
  const rozmezi = text.match(
    /(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})\s*[–\-]\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/,
  );
  if (rozmezi) {
    const odDen = Number(rozmezi[1]);
    const odMesic = Number(rozmezi[2]);
    const odRok = Number(rozmezi[3]);
    const doDen = Number(rozmezi[4]);
    const doMesic = Number(rozmezi[5]);
    const doRok = Number(rozmezi[6]);
    if (
      jePlatnyDen(odRok, odMesic, odDen) &&
      jePlatnyDen(doRok, doMesic, doDen)
    ) {
      return {
        od: formatujIsoDen(odRok, odMesic, odDen),
        doDne: formatujIsoDen(doRok, doMesic, doDen),
      };
    }
    return null;
  }
  const jeden = text.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/);
  if (!jeden) {
    return null;
  }
  const den = Number(jeden[1]);
  const mesic = Number(jeden[2]);
  const rok = Number(jeden[3]);
  if (!jePlatnyDen(rok, mesic, den)) {
    return null;
  }
  const iso = formatujIsoDen(rok, mesic, den);
  return { od: iso, doDne: iso };
}

function casZCisel(hodina: number, minuta: number): string | null {
  if (hodina > 23 || minuta > 59) {
    return null;
  }
  return formatujCas(hodina, minuta);
}

/** Začátky vstupů ze zdroje — rozsah 18.00–19.00 bere jen 18:00. */
export function vytahnoutRozmberskaNocCasyZacatku(text: string): string[] {
  const t = text.replace(/\u00a0/g, " ");
  const nalezene: string[] = [];
  const videne = new Set<string>();
  const rozsahRe =
    /(\d{1,2})[.:](\d{2})\s*[–\-]\s*(\d{1,2})[.:](\d{2})/g;
  let m: RegExpExecArray | null;
  while ((m = rozsahRe.exec(t))) {
    const cas = casZCisel(Number(m[1]), Number(m[2]));
    if (cas && !videne.has(cas)) {
      videne.add(cas);
      nalezene.push(cas);
    }
  }
  if (nalezene.length > 0 && nalezene.length <= 8) {
    return [...nalezene].sort();
  }
  const volneRe = /(\d{1,2})[.:](\d{2})/g;
  const volne: string[] = [];
  const volneVidene = new Set<string>();
  while ((m = volneRe.exec(t))) {
    const cas = casZCisel(Number(m[1]), Number(m[2]));
    if (cas && !volneVidene.has(cas)) {
      volneVidene.add(cas);
      volne.push(cas);
    }
  }
  if (volne.length === 0 || volne.length > 8) {
    return [];
  }
  return [...volne].sort();
}

export function sestavRozmberskaNocVerejneCo(casy: readonly string[]): string {
  const unikatni = [...new Set(casy.map((c) => c.trim()).filter(Boolean))].sort();
  if (unikatni.length === 0) {
    return "";
  }
  return `${BRANA_ROZMBERSKA_NOC_CO_ZAMEK} · ${unikatni.join(" / ")}`;
}

export function najitRozmberskaNocKotvuId(
  polozky: readonly BranaRedakcniPolozkaStav[],
): string | null {
  const podleId = polozky.filter(
    (p) =>
      p.pouzivat === "ANO" &&
      p.id === BRANA_ROZMBERSKA_NOC_REDAKCNI_POLOZKA_ID &&
      (p.polozka ?? "").trim() === BRANA_ROZMBERSKA_NOC_POLOZKA,
  );
  const podleNazvu = polozky.filter(
    (p) =>
      p.pouzivat === "ANO" &&
      (p.polozka ?? "").trim() === BRANA_ROZMBERSKA_NOC_POLOZKA,
  );
  if (podleId.length !== 1 || podleNazvu.length !== 1) {
    return null;
  }
  return BRANA_ROZMBERSKA_NOC_REDAKCNI_POLOZKA_ID;
}

export function sestavRozmberskaNocZapisPoSparovani(args: {
  verejneCo: string;
}): RozmberskaNocZapisPoSparovani {
  const co = args.verejneCo.replace(/\s+/g, " ").trim();
  return {
    mistoNeboTyp: co,
    nazev: BRANA_ROZMBERSKA_NOC_NAZEV,
    verejneCo: co,
    verejneRozliseni: null,
  };
}

export function parsovatRozmberskaNocProgram(
  html: string,
): RozmberskaNocScanKandidat[] {
  if (!jeRozmberskaNocHtml(html)) {
    return [];
  }
  const metaHtml = vytahnoutEventMetadata(html);
  const postHtml = vytahnoutPostText(html);
  const textMeta = textBezHtmlRn(metaHtml || html);
  const textPost = textBezHtmlRn(postHtml);
  const rozmezi =
    vytahnoutDatumoveRozmezi(textMeta) ?? vytahnoutDatumoveRozmezi(textPost);
  if (!rozmezi) {
    return [];
  }
  const dny = dnyRozmezi(rozmezi.od, rozmezi.doDne);
  if (dny.length === 0) {
    return [];
  }
  const casyMeta = vytahnoutRozmberskaNocCasyZacatku(textMeta);
  const casy =
    casyMeta.length > 0
      ? casyMeta
      : vytahnoutRozmberskaNocCasyZacatku(textPost);
  const verejneCo = sestavRozmberskaNocVerejneCo(casy);
  if (!verejneCo) {
    return [];
  }
  const out: RozmberskaNocScanKandidat[] = [];
  const videne = new Set<string>();
  for (const den of dny) {
    const identita = sestavRozmberskaNocZdrojIdentitu(den);
    if (!identita || videne.has(identita)) {
      continue;
    }
    videne.add(identita);
    out.push({
      nazev: BRANA_ROZMBERSKA_NOC_NAZEV,
      datumOd: den,
      datumDo: den,
      cas: "",
      mistoNeboTyp: verejneCo,
      zdrojIdentita: identita,
    });
  }
  return out;
}

export function parsovatRozmberskaNoc(
  html: string,
  vysledek: BranaScanKandidat[],
): void {
  for (const k of parsovatRozmberskaNocProgram(html)) {
    vysledek.push(k);
  }
}
