/**
 * RADAR extractor: Třeboňská letní setkávání (trebon-kurzy.cz).
 * Sezonní zdroj. 0 v mimo sezonu je správně.
 */

import {
  parsovatCeskeDatumVTextu,
  textBezHtml,
  vytahnoutCasZTextu,
  type RadarHrubyNalez,
} from "./radar-html";

const HOST = "trebon-kurzy.cz";

export function jeRadarTlsUrl(url: string): boolean {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase() === HOST;
  } catch {
    return false;
  }
}

function cistyNazevTls(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (/třeboňsk/i.test(t) && /setkáv/i.test(t)) {
    return "Třeboňská letní setkávání";
  }
  if (/^\d{1,2}\.\s*[–\-]\s*\d{1,2}\./.test(t) || parsovatCeskeDatumVTextu(t)) {
    return "Třeboňská letní setkávání";
  }
  return t.slice(0, 200);
}

export function vytahnoutRadarTlsNalezy(
  html: string,
  zdrojUrl: string,
): RadarHrubyNalez[] {
  if (!jeRadarTlsUrl(zdrojUrl) && !/trebon-kurzy/i.test(html)) {
    return [];
  }

  const text = textBezHtml(html);
  const vysledek: RadarHrubyNalez[] = [];
  const videne = new Set<string>();

  for (const radek of text.split("\n")) {
    const datum = parsovatCeskeDatumVTextu(radek);
    if (!datum) {
      continue;
    }
    const klic = `${datum.od}|${datum.doDne}`;
    if (videne.has(klic)) {
      continue;
    }
    videne.add(klic);
    vysledek.push({
      nazev: cistyNazevTls(radek),
      datumOd: datum.od,
      datumDo: datum.doDne,
      cas: vytahnoutCasZTextu(radek),
      kde: "Třeboň",
      url: zdrojUrl,
    });
  }

  if (vysledek.length === 0) {
    const datum = parsovatCeskeDatumVTextu(text);
    if (datum) {
      vysledek.push({
        nazev: "Třeboňská letní setkávání",
        datumOd: datum.od,
        datumDo: datum.doDne,
        cas: "",
        kde: "Třeboň",
        url: zdrojUrl,
      });
    }
  }

  return vysledek;
}
