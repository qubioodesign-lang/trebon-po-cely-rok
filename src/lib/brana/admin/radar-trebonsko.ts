/**
 * RADAR extractor: trebonsko.cz/prehled-akci-trebonsko
 * Vlastní čtení přehledu. Nemění produkční trebonsko větve.
 */

import {
  atributHref,
  kanonizovatHttpUrl,
  normalizovatRadarText,
  parsovatCeskeDatumVTextu,
  textBezHtml,
  vytahnoutCasZTextu,
  type RadarHrubyNalez,
} from "./radar-html";

const HOST = "trebonsko.cz";
const LISTING_PATH = "/prehled-akci-trebonsko";

export function jeRadarTrebonskoListingUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const path = decodeURIComponent(u.pathname).replace(/\/+$/, "") || "/";
    return host === HOST && path === LISTING_PATH;
  } catch {
    return false;
  }
}

function cistyNazev(surovy: string): string {
  return surovy
    .replace(/^\d{1,2}\.\d{2}\.\d{4}(?:\s*[–\-]\s*\d{1,2}\.\d{2}\.\d{4})?\s*[–\-:]?\s*/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Datované řádky přehledu. Bez data se neemituje.
 * URL je odkaz z řádku, jinak listing.
 */
export function vytahnoutRadarTrebonskoNalezy(
  html: string,
  listingUrl: string,
): RadarHrubyNalez[] {
  if (!/trebonsko\.cz/i.test(html) && !jeRadarTrebonskoListingUrl(listingUrl)) {
    return [];
  }

  const vysledek: RadarHrubyNalez[] = [];
  const videne = new Set<string>();

  const pridat = (nalez: RadarHrubyNalez): void => {
    const nazev = cistyNazev(nalez.nazev);
    if (!nazev || nazev.length < 3 || nazev.length > 200) {
      return;
    }
    const klic = `${nalez.datumOd}|${nalez.datumDo}|${nazev.toLowerCase()}`;
    if (videne.has(klic)) {
      return;
    }
    videne.add(klic);
    vysledek.push({
      ...nalez,
      nazev,
    });
  };

  for (const m of html.matchAll(
    /<span>\s*(\d{1,2}\.\d{2}\.\d{4}(?:\s*[–\-]\s*\d{1,2}\.\d{2}\.\d{4})?)\s*[-–]?\s*<\/span>\s*<a\b([^>]*)>([\s\S]*?)<\/a>/gi,
  )) {
    const datum = parsovatCeskeDatumVTextu(m[1] ?? "");
    if (!datum) {
      continue;
    }
    const nazev = textBezHtml(m[3] ?? "");
    const href = atributHref(m[2] ?? "");
    const url =
      kanonizovatHttpUrl(href, listingUrl, [HOST]) || listingUrl;
    pridat({
      nazev,
      datumOd: datum.od,
      datumDo: datum.doDne,
      cas: "",
      kde: "",
      url,
    });
  }

  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const text = textBezHtml(m[2] ?? "");
    const datum = parsovatCeskeDatumVTextu(text);
    if (!datum) {
      continue;
    }
    const nazev = cistyNazev(text);
    if (!nazev) {
      continue;
    }
    const href = atributHref(m[1] ?? "");
    const url =
      kanonizovatHttpUrl(href, listingUrl, [HOST]) || listingUrl;
    pridat({
      nazev,
      datumOd: datum.od,
      datumDo: datum.doDne,
      cas: vytahnoutCasZTextu(text),
      kde: "",
      url,
    });
  }

  return vysledek;
}

/**
 * Veřejná rybářská akce na přehledu Třeboňska.
 * Samotné „rybník“ nestačí. Svět jen ve spojení s výlovem nebo rybníkem.
 */
export function jeRadarTrebonskoRybarskyNazev(nazev: string): boolean {
  const n = normalizovatRadarText(nazev);
  if (!n) {
    return false;
  }
  if (/\bvylov\w*\b/.test(n) || /\bsad(?:k\w*|ek)\b/.test(n)) {
    return true;
  }
  if (/\brybar(?:i|e|u|um|ich|sk\w*)\b/.test(n)) {
    return true;
  }
  if (/\bzablatsk\w*\b/.test(n) || /\brozmberk\w*\b/.test(n)) {
    return true;
  }
  if (
    /\bvelk(?:y|eho|em|emu)\s+tis(?:y|eho|em|emu)\b/.test(n) ||
    /\btisy\b/.test(n) ||
    /\btiseho\b/.test(n)
  ) {
    return true;
  }
  return /\b(?:rybnik\w*|vylov\w*)\s+svet\w*\b/.test(n);
}

/** ZRUŠEN / ZRUŠENO / ZRUŠENA / neuskuteční se. Jen pro už rozpoznaný rybářský název. */
export function jeRadarTrebonskoZrusenyNazev(nazev: string): boolean {
  const n = normalizovatRadarText(nazev);
  return (
    /\bzrusen\b/.test(n) ||
    /\bzruseno\b/.test(n) ||
    /\bzrusena\b/.test(n) ||
    /\bneuskutecni\b/.test(n)
  );
}
