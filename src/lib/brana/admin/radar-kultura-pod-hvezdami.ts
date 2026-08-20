/**
 * RADAR extractor: Kultura pod hvězdami (kulturapodhvezdami.cz).
 * Sezonní zdroj. 0 v mimo sezonu je správně.
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

const HOST = "kulturapodhvezdami.cz";

export function jeRadarKphUrl(url: string): boolean {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase() === HOST;
  } catch {
    return false;
  }
}

function jeTrebonVKontextu(text: string): boolean {
  const n = normalizovatRadarText(text);
  if (!n.includes("trebon")) {
    return false;
  }
  if (n.includes("chlum u trebone")) {
    return false;
  }
  return true;
}

function cistyNazevKph(text: string): string {
  return text
    .replace(/\s*\/\s*\d{1,2}\.\s*\d{1,2}\.\s*20\d{2}.*$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function vytahnoutRadarKphNalezy(
  html: string,
  zdrojUrl: string,
): RadarHrubyNalez[] {
  if (!jeRadarKphUrl(zdrojUrl) && !/kulturapodhvezdami/i.test(html)) {
    return [];
  }

  const vysledek: RadarHrubyNalez[] = [];
  const videne = new Set<string>();

  const pridat = (nalez: RadarHrubyNalez): void => {
    const nazev = cistyNazevKph(nalez.nazev);
    if (!nazev) {
      return;
    }
    const klic = `${nalez.datumOd}|${nazev.toLowerCase()}`;
    if (videne.has(klic)) {
      return;
    }
    videne.add(klic);
    vysledek.push({ ...nalez, nazev });
  };

  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const text = textBezHtml(m[2] ?? "");
    if (!jeTrebonVKontextu(text)) {
      continue;
    }
    const datum = parsovatCeskeDatumVTextu(text);
    if (!datum) {
      continue;
    }
    const href = atributHref(m[1] ?? "");
    const url = kanonizovatHttpUrl(href, zdrojUrl, [HOST]) || zdrojUrl;
    pridat({
      nazev: text,
      datumOd: datum.od,
      datumDo: datum.doDne,
      cas: vytahnoutCasZTextu(text),
      kde: /třeboň/i.test(text) ? "Třeboň" : "",
      url,
    });
  }

  const cisty = textBezHtml(html);
  for (const radek of cisty.split("\n")) {
    if (!jeTrebonVKontextu(radek) && !jeTrebonVKontextu(cisty)) {
      continue;
    }
    const datum = parsovatCeskeDatumVTextu(radek);
    if (!datum) {
      continue;
    }
    if (!jeTrebonVKontextu(radek) && !/třeboň/i.test(radek)) {
      continue;
    }
    pridat({
      nazev: radek,
      datumOd: datum.od,
      datumDo: datum.doDne,
      cas: vytahnoutCasZTextu(radek),
      kde: /třeboň/i.test(radek) ? "Třeboň" : "",
      url: zdrojUrl,
    });
  }

  return vysledek;
}
