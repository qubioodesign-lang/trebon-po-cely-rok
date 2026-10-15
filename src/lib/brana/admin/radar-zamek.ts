/**
 * RADAR extractor: zamek-trebon.cz/cs/akce
 * Veřejný listing + detail. Neimportuje produkční Rožmberskou noc.
 */

import {
  atributHref,
  isoZCeskehoData,
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

function textBunky(tr: string, trida: string): string {
  const m = tr.match(
    new RegExp(
      `<td\\b[^>]*\\bclass=["'][^"']*\\b${trida}\\b[^"']*["'][^>]*>([\\s\\S]*?)</td>`,
      "i",
    ),
  );
  return m ? textBezHtml(m[1]) : "";
}

function rokZBunky(text: string): number | null {
  const m = text.match(/^(20\d{2})$/);
  return m ? Number(m[1]) : null;
}

/**
 * Den a měsíc v řádku, rok z visiting-hours-year.
 * Řádek, který už rok nese, si ho nechá. Chybějící rok se nedoplňuje.
 * Rozmezí, které by po připojení roku teklo pozpátku, se neposouvá do dalšího roku.
 */
function terminZTextuObdobi(
  text: string,
  rok: number | null,
): { od: string; doDne: string } | null {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) {
    return null;
  }
  const sRokem = parsovatCeskeDatumVTextu(t);
  if (sRokem) {
    return { od: sRokem.od, doDne: sRokem.doDne };
  }
  if (rok === null) {
    return null;
  }
  const rozmezi = t.match(
    /^(\d{1,2})\.\s*(\d{1,2})\.?\s*[–\-]\s*(\d{1,2})\.\s*(\d{1,2})\.?$/,
  );
  if (rozmezi) {
    const od = isoZCeskehoData(Number(rozmezi[1]), Number(rozmezi[2]), rok);
    const doDne = isoZCeskehoData(Number(rozmezi[3]), Number(rozmezi[4]), rok);
    if (!od || !doDne || doDne < od) {
      return null;
    }
    return { od, doDne };
  }
  const jeden = t.match(/^(\d{1,2})\.\s*(\d{1,2})\.?$/);
  if (!jeden) {
    return null;
  }
  const den = isoZCeskehoData(Number(jeden[1]), Number(jeden[2]), rok);
  return den ? { od: den, doDne: den } : null;
}

type ZamekTermin = {
  datumOd: string;
  datumDo: string;
  cas: string;
};

function terminyZTabulky(html: string): ZamekTermin[] {
  const out: ZamekTermin[] = [];
  let rok: number | null = null;
  for (const m of html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)) {
    const tr = m[0];
    const rokText = textBunky(tr, "visiting-hours-year");
    if (rokText) {
      rok = rokZBunky(rokText);
      continue;
    }
    const obdobi = textBunky(tr, "obdobi");
    if (!obdobi) {
      continue;
    }
    const datum = terminZTextuObdobi(obdobi, rok);
    if (!datum) {
      continue;
    }
    out.push({
      datumOd: datum.od,
      datumDo: datum.doDne,
      cas: vytahnoutCasZTextu(textBunky(tr, "hodiny")),
    });
  }
  return out;
}

type ZamekPrednaska = {
  den: number;
  mesic: number;
  rok: number | null;
  nazev: string;
};

/** Jen seznam ul.indented: jeden den v položce a název v em. Jinak se název nehádá. */
function prednaskyZeSeznamu(html: string): ZamekPrednaska[] {
  const out: ZamekPrednaska[] = [];
  for (const ul of html.matchAll(
    /<ul\b[^>]*\bindented\b[^>]*>([\s\S]*?)<\/ul>/gi,
  )) {
    for (const li of ul[1].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
      const telo = li[1] ?? "";
      const em = telo.match(/<em\b[^>]*>([\s\S]*?)<\/em>/i);
      const nazev = em ? textBezHtml(em[1]) : "";
      if (!nazev) {
        continue;
      }
      const data = [
        ...textBezHtml(telo).matchAll(
          /(\d{1,2})\.\s*(\d{1,2})\.(?:\s*(20\d{2}))?/g,
        ),
      ];
      if (data.length !== 1) {
        continue;
      }
      out.push({
        den: Number(data[0][1]),
        mesic: Number(data[0][2]),
        rok: data[0][3] ? Number(data[0][3]) : null,
        nazev,
      });
    }
  }
  return out;
}

function nazevKartyZDetailu(html: string, nazevZListingu: string): string {
  const nazevZHlavicky = cistyNazevZamku(nazevZListingu);
  const nazevZH1 = cistyNazevZamku(
    textBezHtml(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? ""),
  );
  return (
    nazevZHlavicky ||
    (nazevZH1 && nazevZH1.toLowerCase() !== "třeboň" ? nazevZH1 : "")
  );
}

function nazevProTermin(
  termin: ZamekTermin,
  nazevKarty: string,
  prednasky: readonly ZamekPrednaska[],
): string {
  if (termin.datumOd !== termin.datumDo) {
    return nazevKarty;
  }
  const den = Number(termin.datumOd.slice(8, 10));
  const mesic = Number(termin.datumOd.slice(5, 7));
  const rok = Number(termin.datumOd.slice(0, 4));
  const shoda = prednasky.filter(
    (p) =>
      p.den === den &&
      p.mesic === mesic &&
      (p.rok === null || p.rok === rok),
  );
  if (shoda.length !== 1) {
    return nazevKarty;
  }
  return cistyNazevZamku(shoda[0].nazev) || nazevKarty;
}

/**
 * Tabulka termínů: jeden nález na konkrétní den, rozmezí zůstává jedno.
 * Bez tabulky zůstává původní datum v textu události.
 */
export function vytahnoutRadarZamekNalezyZDetailu(
  html: string,
  detailUrl: string,
  nazevZListingu: string,
): RadarHrubyNalez[] {
  const nazevKarty = nazevKartyZDetailu(html, nazevZListingu);
  if (!nazevKarty) {
    return [];
  }
  const eventBlok =
    html.match(/<div class="event">([\s\S]*?)<div class="post-text">/i)?.[1] ??
    html;
  const kde = kdeZeZamekTextu(textBezHtml(eventBlok));
  const terminy = terminyZTabulky(html);
  if (terminy.length > 0) {
    const prednasky = prednaskyZeSeznamu(html);
    return terminy.map((termin) => ({
      nazev: nazevProTermin(termin, nazevKarty, prednasky),
      datumOd: termin.datumOd,
      datumDo: termin.datumDo,
      cas: termin.cas,
      kde,
      url: detailUrl,
    }));
  }
  const datum = parsovatCeskeDatumVTextu(textBezHtml(eventBlok));
  if (!datum) {
    return [];
  }
  return [
    {
      nazev: nazevKarty,
      datumOd: datum.od,
      datumDo: datum.doDne,
      cas: vytahnoutCasZTextu(textBezHtml(eventBlok)),
      kde,
      url: detailUrl,
    },
  ];
}

export function vytahnoutRadarZamekNalezZDetailu(
  html: string,
  detailUrl: string,
  nazevZListingu: string,
): RadarHrubyNalez | null {
  return (
    vytahnoutRadarZamekNalezyZDetailu(html, detailUrl, nazevZListingu)[0] ??
    null
  );
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
    nalezy.push(
      ...vytahnoutRadarZamekNalezyZDetailu(html, karta.url, karta.nazev),
    );
  }
  return nalezy;
}
