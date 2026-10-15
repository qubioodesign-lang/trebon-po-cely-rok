/**
 * RADAR: Kalendář akcí Charity Třeboň.
 * Jen výchozí výpis bez filterShowHistory. Žádný zápis, žádný Kalendář.
 */

import {
  dekodovatHtmlText,
  isoZCeskehoData,
  kanonizovatHttpUrl,
  type RadarHrubyNalez,
} from "./radar-html";

const HOST = "trebon.charita.cz";
const INDEX_PATH = "/aktualne/kalendar-akci";
const PRAZDNY_KALENDAR = "Nebyly nalezeny žádné položky.";

/** Celý text štítku musí být jeden den. Rozsah, čas ani měsíc se nedoplňují. */
const JEDNO_DATUM = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/;

export const RADAR_CHARITA_CHYBA_STRUKTURY = "neočekávaná struktura kalendáře";

export function jeRadarCharitaKalendarVychoziUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== HOST) {
      return false;
    }
    const path = decodeURIComponent(u.pathname).replace(/\/+$/, "") || "/";
    if (path !== INDEX_PATH) {
      return false;
    }
    return !u.searchParams.has("filterShowHistory");
  } catch {
    return false;
  }
}

export function jednoznacneDatumKonaniCharity(text: string): string | null {
  const t = text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  const m = JEDNO_DATUM.exec(t);
  if (!m) {
    return null;
  }
  return isoZCeskehoData(Number(m[1]), Number(m[2]), Number(m[3]));
}

function jeDetailKalendareAkci(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== HOST) {
      return false;
    }
    if (u.searchParams.has("filterShowHistory")) {
      return false;
    }
    const path = decodeURIComponent(u.pathname).replace(/\/+$/, "") || "/";
    const prefix = `${INDEX_PATH}/`;
    if (!path.startsWith(prefix)) {
      return false;
    }
    const slug = path.slice(prefix.length);
    return slug.length > 0 && !slug.split("/").some((cast) => cast.length === 0);
  } catch {
    return false;
  }
}

/**
 * Karty výchozího výpisu. Prázdná věta bez karet je úspěch s nula nálezy.
 * Tělo, které není prázdný kalendář ani karta, je chyba struktury.
 */
export function vytahnoutRadarCharitaKalendarNalezy(
  html: string,
  listingUrl: string,
): RadarHrubyNalez[] {
  if (!jeRadarCharitaKalendarVychoziUrl(listingUrl)) {
    throw new Error(RADAR_CHARITA_CHYBA_STRUKTURY);
  }

  const shody = [
    ...html.matchAll(/<div class="item event">([\s\S]*?)<\/a>\s*<\/div>/gi),
  ];
  if (shody.length === 0) {
    if (html.includes(PRAZDNY_KALENDAR)) {
      return [];
    }
    throw new Error(RADAR_CHARITA_CHYBA_STRUKTURY);
  }

  const nalezy: RadarHrubyNalez[] = [];
  let rozpoznanaKarta = false;
  for (const shoda of shody) {
    const blok = shoda[1] ?? "";
    const odkaz = blok.match(/<a class="inside" href="([^"]+)"/i);
    const nazevRaw = blok.match(/<h2 class="title">([^<]*)<\/h2>/i);
    const datumRaw = blok.match(/<span class="icon date">([^<]*)<\/span>/i);
    const mistoRaw = blok.match(/<span class="icon place">([^<]*)<\/span>/i);
    if (!odkaz || !nazevRaw || !datumRaw || !mistoRaw) {
      continue;
    }
    rozpoznanaKarta = true;
    const nazev = dekodovatHtmlText(nazevRaw[1] ?? "");
    const iso = jednoznacneDatumKonaniCharity(dekodovatHtmlText(datumRaw[1] ?? ""));
    if (!nazev || !iso) {
      continue;
    }
    const url = kanonizovatHttpUrl(odkaz[1] ?? "", listingUrl, [HOST]);
    if (!jeDetailKalendareAkci(url)) {
      continue;
    }
    nalezy.push({
      nazev,
      datumOd: iso,
      datumDo: iso,
      cas: "",
      kde: dekodovatHtmlText(mistoRaw[1] ?? ""),
      url,
    });
  }

  if (!rozpoznanaKarta) {
    throw new Error(RADAR_CHARITA_CHYBA_STRUKTURY);
  }
  return nalezy;
}
