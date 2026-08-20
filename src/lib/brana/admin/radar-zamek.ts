/**
 * RADAR extractor: zamek-trebon.cz/cs/akce
 * Veřejný listing + detail. Neimportuje produkční Rožmberskou noc.
 */

import {
  atributHref,
  kanonizovatHttpUrl,
  parsovatCeskeDatumVTextu,
  textBezHtml,
  vytahnoutCasZTextu,
  type RadarHrubyNalez,
} from "./radar-html";

const HOST = "zamek-trebon.cz";
const LISTING_CESTA = "/cs/akce";
const MAX_DETAILU = 40;

function hostZamek(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

export function jeRadarZamekListingUrl(url: string): boolean {
  if (hostZamek(url) !== HOST) {
    return false;
  }
  try {
    const path = decodeURIComponent(new URL(url).pathname)
      .replace(/\/+$/, "")
      .toLowerCase();
    return path === LISTING_CESTA;
  } catch {
    return false;
  }
}

export function jeRadarZamekDetailUrl(url: string): boolean {
  if (hostZamek(url) !== HOST) {
    return false;
  }
  try {
    const path = decodeURIComponent(new URL(url).pathname).toLowerCase();
    return /\/akce\/\d+/.test(path) && !path.endsWith("/akce");
  } catch {
    return false;
  }
}

function cistyNazevZamku(nazev: string): string {
  return nazev
    .replace(/^třeboň\s*:\s*/i, "")
    .replace(/\s*[–-]\s*vyprodáno\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function maTridu(atributy: string, trida: string): boolean {
  const m = atributy.match(/\bclass=["']([^"']*)["']/i);
  const classy = (m?.[1] ?? "").split(/\s+/);
  return classy.includes(trida);
}

export type RadarZamekMesic = { rok: number; mesic: number };

export function vytahnoutRadarZamekMesice(html: string): RadarZamekMesic[] {
  const out: RadarZamekMesic[] = [];
  const videne = new Set<string>();
  for (const m of html.matchAll(
    /<a\b[^>]*class=["'][^"']*events-filter-month-selector[^"']*["'][^>]*>/gi,
  )) {
    const tag = m[0];
    const rok = Number(tag.match(/\bdata-year=["'](\d{4})["']/i)?.[1] ?? "");
    const mesic = Number(tag.match(/\bdata-month=["'](\d{1,2})["']/i)?.[1] ?? "");
    if (rok < 2000 || mesic < 1 || mesic > 12) {
      continue;
    }
    const klic = `${rok}-${mesic}`;
    if (videne.has(klic)) {
      continue;
    }
    videne.add(klic);
    out.push({ rok, mesic });
  }
  return out;
}

export function sestavRadarZamekMesicTelo(args: {
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

export function vytahnoutRadarZamekDetailUrlZListingu(
  html: string,
  listingUrl: string,
): { url: string; nazev: string }[] {
  const out: { url: string; nazev: string }[] = [];
  const videne = new Set<string>();
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const atributy = m[1] ?? "";
    if (!maTridu(atributy, "events__item-title")) {
      continue;
    }
    const nazev = cistyNazevZamku(textBezHtml(m[2] ?? ""));
    const abs = kanonizovatHttpUrl(
      atributHref(atributy),
      listingUrl,
      [HOST],
    );
    if (!nazev || !abs || !jeRadarZamekDetailUrl(abs)) {
      continue;
    }
    if (videne.has(abs)) {
      continue;
    }
    videne.add(abs);
    out.push({ url: abs, nazev });
  }
  return out;
}

function kdeZeZamekTextu(text: string): string {
  const park = text.match(/zámecký park/i);
  if (park) {
    return "Zámecký park";
  }
  const nadvori = text.match(/malé nádvoří/i);
  if (nadvori) {
    return "malé nádvoří zámku";
  }
  const trasa = text.match(/trasa\s+[ab]/i);
  if (trasa) {
    return `Zámek Třeboň, ${trasa[0]}`;
  }
  if (/státní zámek třeboň/i.test(text) || /\bzámek\b/i.test(text)) {
    return "Zámek Třeboň";
  }
  return "";
}

export function vytahnoutRadarZamekNalezZDetailu(
  html: string,
  detailUrl: string,
  nazevZListingu: string,
): RadarHrubyNalez | null {
  const nazevZHlavicky = cistyNazevZamku(nazevZListingu);
  const nazevZH1 = cistyNazevZamku(
    textBezHtml(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? ""),
  );
  const nazev =
    nazevZHlavicky ||
    (nazevZH1 && nazevZH1.toLowerCase() !== "třeboň" ? nazevZH1 : "");
  if (!nazev) {
    return null;
  }
  const eventBlok =
    html.match(/<div class="event">([\s\S]*?)<div class="post-text">/i)?.[1] ??
    html;
  const datum = parsovatCeskeDatumVTextu(textBezHtml(eventBlok));
  if (!datum) {
    return null;
  }
  return {
    nazev,
    datumOd: datum.od,
    datumDo: datum.doDne,
    cas: vytahnoutCasZTextu(textBezHtml(eventBlok)),
    kde: kdeZeZamekTextu(textBezHtml(eventBlok)),
    url: detailUrl,
  };
}

export async function vytahnoutRadarZamekNalezy(args: {
  listingHtml: string;
  listingUrl: string;
  stahnoutHtml: (url: string, init?: RequestInit) => Promise<string>;
  mesice: RadarZamekMesic[];
}): Promise<RadarHrubyNalez[]> {
  const kartyZHtml: { url: string; nazev: string }[] = [
    ...vytahnoutRadarZamekDetailUrlZListingu(args.listingHtml, args.listingUrl),
  ];

  for (const mesic of args.mesice) {
    const telo = sestavRadarZamekMesicTelo(mesic);
    const html = await args.stahnoutHtml(args.listingUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: telo,
    });
    kartyZHtml.push(
      ...vytahnoutRadarZamekDetailUrlZListingu(html, args.listingUrl),
    );
  }

  const unikatni = new Map<string, { url: string; nazev: string }>();
  for (const karta of kartyZHtml) {
    if (!unikatni.has(karta.url)) {
      unikatni.set(karta.url, karta);
    }
  }

  const nalezy: RadarHrubyNalez[] = [];
  let detaily = 0;
  for (const karta of unikatni.values()) {
    if (detaily >= MAX_DETAILU) {
      break;
    }
    detaily += 1;
    const html = await args.stahnoutHtml(karta.url);
    const nalez = vytahnoutRadarZamekNalezZDetailu(
      html,
      karta.url,
      karta.nazev,
    );
    if (nalez) {
      nalezy.push(nalez);
    }
  }
  return nalezy;
}
