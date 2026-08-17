/**
 * Úzký fail-closed parser Domu přírody Třeboňska (dumprirody.cz).
 * Jen větev /dum-prirody-trebonska/akce/.
 * Parser a matching: explicitní povolené formáty; zbytek 0 kandidátů.
 * Přednáška se strukturovaným Místo: Dům Štěpánka Netolického patří DSN
 * (0 kandidátů). DPT scan DSN web nenačítá.
 */

export const BRANA_DPT_REDAKCNI_POLOZKA_ID = "dum-prirody-trebonska";

export const BRANA_DPT_CO = "Dům přírody";

const DPT_HOST = "dumprirody.cz";
const DPT_AKCE_PREFIX = "/dum-prirody-trebonska/akce";
const MAX_KANDIDATU_DPT = 40;

export type DptScanKandidat = {
  nazev: string;
  datumOd: string;
  datumDo: string;
  cas: string;
  mistoNeboTyp: string;
  zdrojIdentita?: string;
};

const MESICE_GENITIV: Record<string, number> = {
  ledna: 1,
  unor: 2,
  unora: 2,
  brezna: 3,
  dubna: 4,
  kvetna: 5,
  cervna: 6,
  cervence: 7,
  srpna: 8,
  zari: 9,
  rijna: 10,
  listopadu: 11,
  prosince: 12,
};

export type DptPovolenyFormat = "vylet" | "exkurze" | "prednaska";

function normalizovatProDpt(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function dekodovatDptText(raw: string): string {
  return raw
    .replace(/&#(\d+);/g, (_, n: string) => {
      const kod = Number(n);
      return Number.isFinite(kod) ? String.fromCharCode(kod) : "";
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function textBezHtmlDpt(html: string): string {
  return dekodovatDptText(html.replace(/<[^>]+>/g, " "));
}

function formatujIsoDen(rok: number, mesic: number, den: number): string {
  return `${rok}-${String(mesic).padStart(2, "0")}-${String(den).padStart(2, "0")}`;
}

function formatujCas(hodina: number, minuta: number): string {
  return `${String(hodina).padStart(2, "0")}:${String(minuta).padStart(2, "0")}`;
}

function jePlatnyDen(rok: number, mesic: number, den: number): boolean {
  if (den < 1 || den > 31 || mesic < 1 || mesic > 12) {
    return false;
  }
  const dt = new Date(Date.UTC(rok, mesic - 1, den));
  return (
    dt.getUTCFullYear() === rok &&
    dt.getUTCMonth() === mesic - 1 &&
    dt.getUTCDate() === den
  );
}

/** True, pokud URL míří na oficiální akce Domu přírody Třeboňska. */
export function jeDumPrirodyTrebonskaZdrojUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== DPT_HOST) {
      return false;
    }
    const path = parsed.pathname.replace(/\/+$/, "").toLowerCase();
    return path === DPT_AKCE_PREFIX || path.startsWith(`${DPT_AKCE_PREFIX}/`);
  } catch {
    return false;
  }
}

/**
 * Listing `/akce/` → kanonický hub.
 * Detail / roční přehled → původní cesta (jeden fetch).
 */
export function sestavDumPrirodyHubUrl(zdrojUrl: string): string {
  if (!jeDumPrirodyTrebonskaZdrojUrl(zdrojUrl)) {
    return "";
  }
  const base = new URL(zdrojUrl);
  const path = base.pathname.replace(/\/+$/, "").toLowerCase();
  if (path === DPT_AKCE_PREFIX) {
    return `${base.protocol}//${base.host}${DPT_AKCE_PREFIX}/`;
  }
  return `${base.protocol}//${base.host}${base.pathname}`;
}

function slugZAkceCesty(href: string): string | null {
  try {
    const u = new URL(href, `https://www.${DPT_HOST}`);
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    if (!path.startsWith(`${DPT_AKCE_PREFIX}/`)) {
      return null;
    }
    const slug = path.slice(`${DPT_AKCE_PREFIX}/`.length);
    if (!slug || slug.includes("/")) {
      return null;
    }
    if (slug.startsWith("prehled-akci-v-roce-")) {
      return null;
    }
    return slug;
  } catch {
    return null;
  }
}

/** Odkazy `a.article` z listingu — bez roční mega-karty. */
export function vytahnoutDumPrirodyDetailUrlky(
  html: string,
  hubUrl: string,
): string[] {
  if (!jeDumPrirodyTrebonskaZdrojUrl(hubUrl) || !html.trim()) {
    return [];
  }
  let origin: string;
  try {
    origin = new URL(hubUrl).origin;
  } catch {
    return [];
  }
  const videne = new Set<string>();
  const out: string[] = [];
  const re =
    /<a\b([^>]*\bclass=["'][^"']*\barticle\b[^"']*["'][^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tag = m[1] ?? "";
    const hrefM = tag.match(/\bhref=["']([^"']+)["']/i);
    const href = (hrefM?.[1] ?? "").trim();
    const slug = slugZAkceCesty(href);
    if (!slug) {
      continue;
    }
    let abs: string;
    try {
      abs = new URL(href, origin).href;
    } catch {
      continue;
    }
    if (videne.has(slug)) {
      continue;
    }
    videne.add(slug);
    out.push(abs);
    if (out.length >= MAX_KANDIDATU_DPT) {
      break;
    }
  }
  return out;
}

export function jeDumPrirodyTrebonskaHtml(html: string): boolean {
  return (
    /dumprirody\.cz/i.test(html) &&
    /dum-prirody-trebonska/i.test(html) &&
    /Termín:/i.test(html) &&
    /Místo:/i.test(html)
  );
}

/**
 * Zakázané skupiny dřív než povolené.
 * Null = není bezpečně zařaditelné → 0 kandidátů.
 */
export function zaraditDptFormat(
  nazev: string,
  perex: string,
): DptPovolenyFormat | null {
  const t = normalizovatProDpt(`${nazev} ${perex}`);
  if (!t) {
    return null;
  }

  if (
    /\bdiln/.test(t) ||
    /tvoriv/.test(t) ||
    /kreativn/.test(t)
  ) {
    return null;
  }
  if (/komentovan/.test(t) && /prohlidk/.test(t)) {
    return null;
  }
  if (
    /stala expozice/.test(t) ||
    /oteviraci doba/.test(t)
  ) {
    return null;
  }
  if (
    /prehled akci/.test(t) ||
    /akce na trebonsku v roce/.test(t)
  ) {
    return null;
  }

  if (/\bprednask/.test(t)) {
    return "prednaska";
  }
  if (/\bexkurz/.test(t) || /botanicka vychazka/.test(t)) {
    return "exkurze";
  }
  if (
    /cyklovylet/.test(t) ||
    /pesi vylet/.test(t) ||
    /ornitologicka vychazka/.test(t)
  ) {
    return "vylet";
  }
  return null;
}

/** Přesná shoda strukturovaného pole Místo: — ne anotace, ne substring. */
const DPT_MISTO_DSN = new Set([
  "Dům Štěpánka Netolického",
  "Dům Štěpánka Netolického v Třeboni",
]);

function jePresneStrukturovaneMistoDsn(misto: string): boolean {
  return DPT_MISTO_DSN.has(misto.replace(/\s+/g, " ").trim());
}

function mesicZGenitivu(surovy: string): number | null {
  const klic = normalizovatProDpt(surovy).replace(/í/g, "i");
  return MESICE_GENITIV[klic] ?? null;
}

function rozlozTerminDpt(infoText: string): {
  datumOd: string;
  datumDo: string;
  cas: string;
} | null {
  const t = infoText.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  if (/[—–]/.test(t) && (t.match(/\d{1,2}\.\s*[a-záčďéěíňóřšťúůýž]+/gi) ?? []).length >= 2) {
    return null;
  }
  const shoda = t.match(
    /Termín:\s*(\d{1,2})\.\s*([A-Za-zÁáČčĎďÉéĚěÍíŇňÓóŘřŠšŤťÚúŮůÝýŽž]+)\s+(20\d{2})(?:\s+od\s+(\d{1,2}):(\d{2}))?/i,
  );
  if (!shoda) {
    return null;
  }
  const den = Number(shoda[1]);
  const mesic = mesicZGenitivu(shoda[2] ?? "");
  const rok = Number(shoda[3]);
  if (mesic == null || !jePlatnyDen(rok, mesic, den)) {
    return null;
  }
  const datum = formatujIsoDen(rok, mesic, den);
  let cas = "";
  if (shoda[4] != null && shoda[5] != null) {
    const hodina = Number(shoda[4]);
    const minuta = Number(shoda[5]);
    if (hodina > 23 || minuta > 59) {
      return null;
    }
    cas = formatujCas(hodina, minuta);
  }
  return { datumOd: datum, datumDo: datum, cas };
}

function mistoZInfo(infoText: string): string {
  const t = infoText.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  const shoda = t.match(/Místo:\s*(.+)$/i);
  return (shoda?.[1] ?? "").replace(/\s+/g, " ").trim();
}

function atributZTagu(tag: string, jmeno: string): string {
  const re = new RegExp(`\\b${jmeno}=["']([^"']+)["']`, "i");
  return (tag.match(re)?.[1] ?? "").trim();
}

function kartaZBloku(args: {
  nazev: string;
  infoHtml: string;
  perex: string;
  slug: string | null;
}): DptScanKandidat | null {
  const nazev = textBezHtmlDpt(args.nazev);
  const info = textBezHtmlDpt(args.infoHtml);
  const perex = textBezHtmlDpt(args.perex);
  if (!nazev || nazev.length < 2) {
    return null;
  }
  const format = zaraditDptFormat(nazev, perex);
  if (!format) {
    return null;
  }
  const termin = rozlozTerminDpt(info);
  if (!termin) {
    return null;
  }
  const misto = mistoZInfo(info);
  if (!misto) {
    return null;
  }
  if (format === "prednaska" && jePresneStrukturovaneMistoDsn(misto)) {
    return null;
  }
  if (!args.slug) {
    return null;
  }
  return {
    nazev,
    datumOd: termin.datumOd,
    datumDo: termin.datumDo,
    cas: termin.cas,
    mistoNeboTyp: misto,
    zdrojIdentita: `dumprirody|${format}|${args.slug}|${termin.datumOd}`,
  };
}

function parsovatListingKarty(
  html: string,
  vysledek: DptScanKandidat[],
): void {
  const re =
    /<a\b([^>]*\bclass=["'][^"']*\barticle\b[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (vysledek.length >= MAX_KANDIDATU_DPT) {
      return;
    }
    const tag = m[1] ?? "";
    const vnitr = m[2] ?? "";
    const href = atributZTagu(tag, "href");
    const slug = slugZAkceCesty(href);
    const h2 = vnitr.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i);
    const info = vnitr.match(
      /<p\b[^>]*\bclass=["'][^"']*\binfo\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i,
    );
    const perex = vnitr.match(
      /<p\b(?![^>]*\binfo\b)[^>]*>([\s\S]*?)<\/p>/i,
    );
    const karta = kartaZBloku({
      nazev: h2?.[1] ?? "",
      infoHtml: info?.[1] ?? "",
      perex: perex?.[1] ?? "",
      slug,
    });
    if (karta) {
      vysledek.push(karta);
    }
  }
}

function slugZDetailHtml(html: string): string | null {
  const canon = html.match(
    /<link[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["']/i,
  );
  if (canon?.[1]) {
    const slug = slugZAkceCesty(canon[1]);
    if (slug) {
      return slug;
    }
  }
  const odkaz = html.match(
    /\/dum-prirody-trebonska\/akce\/([a-z0-9-]+)\//i,
  );
  return odkaz?.[1] && !odkaz[1].startsWith("prehled-akci-v-roce-")
    ? odkaz[1].toLowerCase()
    : null;
}

function parsovatDetailClanek(
  html: string,
  vysledek: DptScanKandidat[],
): void {
  if (vysledek.length >= MAX_KANDIDATU_DPT) {
    return;
  }
  if (!/<div[^>]*\bclass=["'][^"']*\bdetail-perex\b/i.test(html)) {
    return;
  }
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const perexBlok = html.match(
    /<div[^>]*\bclass=["'][^"']*\bdetail-perex\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  );
  const blok = perexBlok?.[1] ?? "";
  const info = blok.match(
    /<p\b[^>]*\bclass=["'][^"']*\binfo\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i,
  );
  const perex = blok.match(
    /<p\b(?![^>]*\binfo\b)[^>]*>([\s\S]*?)<\/p>/i,
  );
  const karta = kartaZBloku({
    nazev: h1?.[1] ?? "",
    infoHtml: info?.[1] ?? "",
    perex: perex?.[1] ?? "",
    slug: slugZDetailHtml(html),
  });
  if (karta) {
    vysledek.push(karta);
  }
}

/** HTML listing `a.article` / detail `article` + `p.info` → kandidáti. */
export function parsovatDumPrirodyTrebonska(
  html: string,
  vysledek: DptScanKandidat[],
): void {
  if (!jeDumPrirodyTrebonskaHtml(html)) {
    return;
  }
  parsovatListingKarty(html, vysledek);
  parsovatDetailClanek(html, vysledek);
}
