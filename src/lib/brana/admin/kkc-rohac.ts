/**
 * Úzké fail-closed parsery KKC Roháč: Ticketportal venue 1203336
 * a SMSticket místo 5734. Společná identita `rohac|YYYY-MM-DD|HH:MM`.
 *
 * Interní ID kotvy se nehádá. Scan najde právě jednu živou Položku
 * „KKC Roháč“ s Používat=ANO (libovolné existující katalogové ID).
 * 0 nebo 2+ → 0 zápis, bez Nezařazených.
 */

import { okamzikVPraze } from "@/lib/brana/cas";
import type { BranaRedakcniPolozkaStav } from "./redakcni-kostra";
import type { BranaScanKandidat } from "./zdroj-scan-parser";

export const BRANA_KKC_ROHAC_POLOZKA = "KKC Roháč";
export const BRANA_KKC_ROHAC_MISTO = "KKC Roháč";
export const BRANA_KKC_ROHAC_CO = "Roháč";
export const BRANA_KKC_ROHAC_KDE = "KKC";

export const TICKETPORTAL_ROHAC_VENUE_ID = "1203336";
export const SMSTICKET_ROHAC_MISTO_ID = "5734";

const TICKETPORTAL_HOST = "ticketportal.cz";
const SMSTICKET_HOST = "smsticket.cz";
const MAX_KANDIDATU = 20;
const CAS_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DEN_RE = /^\d{4}-\d{2}-\d{2}$/;
const IDENTITA_RE = /^rohac\|\d{4}-\d{2}-\d{2}\|([01]\d|2[0-3]):[0-5]\d$/;

export type KkcRohacScanKandidat = BranaScanKandidat;

function hostBezWww(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function formatujCas(hodina: number, minuta: number): string {
  return `${String(hodina).padStart(2, "0")}:${String(minuta).padStart(2, "0")}`;
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
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Jen SMSticket Roháč: koncové „ I Třeboň“ je městský suffix, ne název show. */
function normalizovatSmsticketRohacNazev(nazev: string): string {
  return nazev.replace(/\s+I\s+Třeboň\s*$/u, "").trim();
}

export function sestavKkcRohacZdrojIdentitu(
  datumOd: string,
  cas: string,
): string {
  return `rohac|${datumOd}|${cas}`;
}

export function jeKkcRohacZdrojIdentita(hodnota: string): boolean {
  return IDENTITA_RE.test(hodnota.trim());
}

export function jeTicketportalRohacZdrojUrl(url: string): boolean {
  if (hostBezWww(url) !== TICKETPORTAL_HOST) {
    return false;
  }
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "").toLowerCase();
    return path === `/venue/${TICKETPORTAL_ROHAC_VENUE_ID}`;
  } catch {
    return false;
  }
}

export function jeSmsticketRohacZdrojUrl(url: string): boolean {
  if (hostBezWww(url) !== SMSTICKET_HOST) {
    return false;
  }
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "").toLowerCase();
    return (
      path === `/mista/${SMSTICKET_ROHAC_MISTO_ID}` ||
      path.startsWith(`/mista/${SMSTICKET_ROHAC_MISTO_ID}-`)
    );
  } catch {
    return false;
  }
}

export function jeKkcRohacZdrojUrl(url: string): boolean {
  return jeTicketportalRohacZdrojUrl(url) || jeSmsticketRohacZdrojUrl(url);
}

export function jeTicketportalRohacVenueHtml(html: string): boolean {
  if (!html.trim()) {
    return false;
  }
  const n = html.replace(/\\/g, "/");
  return (
    /ticketportal\.cz/i.test(n) &&
    new RegExp(`/venue/${TICKETPORTAL_ROHAC_VENUE_ID}\\b`, "i").test(n)
  );
}

export function jeSmsticketRohacVenueHtml(html: string): boolean {
  if (!html.trim()) {
    return false;
  }
  const n = html.replace(/\\/g, "/");
  return (
    /smsticket\.cz/i.test(n) &&
    new RegExp(`/mista/${SMSTICKET_ROHAC_MISTO_ID}(?:-|\\b)`, "i").test(n)
  );
}

export function jeKkcRohacVenueHtml(html: string): boolean {
  const tp = jeTicketportalRohacVenueHtml(html);
  const sms = jeSmsticketRohacVenueHtml(html);
  return tp !== sms;
}

/** Oba venue markery najednou = nejednoznačné, bez JSON-LD pádu. */
export function jeKkcRohacKonfliktHtml(html: string): boolean {
  return (
    jeTicketportalRohacVenueHtml(html) && jeSmsticketRohacVenueHtml(html)
  );
}

/**
 * Právě jedna ANO Položka „KKC Roháč“. Interní id se nehádá.
 * Jinak null (0 karet).
 */
export function najitKkcRohacKotvuId(
  polozky: readonly BranaRedakcniPolozkaStav[],
): string | null {
  const shody = polozky.filter(
    (p) =>
      p.pouzivat === "ANO" &&
      (p.polozka ?? "").trim() === BRANA_KKC_ROHAC_POLOZKA,
  );
  return shody.length === 1 ? shody[0].id : null;
}

function normalizovatIsoDatetime(hodnota: string): string {
  return hodnota.trim().replace(/(\.\d{3})\d+(?=Z|[+-])/i, "$1");
}

function casZDatetime(hodnota: string): { datum: string; cas: string } | null {
  const trim = normalizovatIsoDatetime(hodnota);
  if (!trim.includes("T")) {
    return null;
  }
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(trim)) {
    const okamzik = new Date(trim);
    if (Number.isNaN(okamzik.getTime())) {
      return null;
    }
    const praha = okamzikVPraze(okamzik);
    return {
      datum: `${praha.rok}-${String(praha.mesic).padStart(2, "0")}-${String(praha.den).padStart(2, "0")}`,
      cas: formatujCas(praha.hodina, praha.minuta),
    };
  }
  const lokalni = trim.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{1,2}):(\d{2})/,
  );
  if (!lokalni) {
    return null;
  }
  const rok = Number(lokalni[1]);
  const mesic = Number(lokalni[2]);
  const den = Number(lokalni[3]);
  const hodina = Number(lokalni[4]);
  const minuta = Number(lokalni[5]);
  if (
    mesic < 1 ||
    mesic > 12 ||
    den < 1 ||
    den > 31 ||
    hodina > 23 ||
    minuta > 59
  ) {
    return null;
  }
  return {
    datum: `${rok}-${String(mesic).padStart(2, "0")}-${String(den).padStart(2, "0")}`,
    cas: formatujCas(hodina, minuta),
  };
}

function casZTextuOd(text: string): string {
  const shoda = dekodovatHtmlText(text).match(/\bod\s+(\d{1,2}):(\d{2})\b/i);
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

function zahoditDuplicitniTermin(
  kandidati: KkcRohacScanKandidat[],
): KkcRohacScanKandidat[] {
  const pocty = new Map<string, number>();
  for (const k of kandidati) {
    const klic = `${k.datumOd}|${k.cas}`;
    pocty.set(klic, (pocty.get(klic) ?? 0) + 1);
  }
  return kandidati.filter((k) => (pocty.get(`${k.datumOd}|${k.cas}`) ?? 0) === 1);
}

export function parsovatTicketportalRohacVenue(
  html: string,
): KkcRohacScanKandidat[] {
  if (!jeTicketportalRohacVenueHtml(html)) {
    return [];
  }
  const out: KkcRohacScanKandidat[] = [];
  const videne = new Set<string>();
  const venueRe = new RegExp(`/venue/${TICKETPORTAL_ROHAC_VENUE_ID}\\b`, "i");

  for (const shoda of html.matchAll(
    /href=["'](\/Event\/(\d+))["'][^>]*\bitemprop=["']name["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    if (out.length >= MAX_KANDIDATU) {
      break;
    }
    const eventId = (shoda[2] ?? "").trim();
    const nazev = dekodovatHtmlText(shoda[3] ?? "");
    if (!eventId || nazev.length < 2) {
      continue;
    }
    const index = shoda.index ?? 0;
    const okno = html.slice(Math.max(0, index - 2500), index + (shoda[0].length + 900));
    if (!venueRe.test(okno)) {
      continue;
    }
    const start = okno.match(
      /itemprop=["']startDate["'][^>]*content=["']([^"']+)["']/i,
    );
    const rozklad = casZDatetime(start?.[1] ?? "");
    if (!rozklad || !ISO_DEN_RE.test(rozklad.datum) || !CAS_RE.test(rozklad.cas)) {
      continue;
    }
    const casVypis = okno.match(/\bclass=["']time["'][^>]*>(\d{1,2}:\d{2})</i);
    if (casVypis) {
      const casti = casVypis[1].split(":");
      const vypis = formatujCas(Number(casti[0]), Number(casti[1]));
      if (vypis !== rozklad.cas) {
        continue;
      }
    }
    const identita = sestavKkcRohacZdrojIdentitu(rozklad.datum, rozklad.cas);
    if (!jeKkcRohacZdrojIdentita(identita) || videne.has(eventId)) {
      continue;
    }
    videne.add(eventId);
    out.push({
      nazev,
      datumOd: rozklad.datum,
      datumDo: rozklad.datum,
      cas: rozklad.cas,
      mistoNeboTyp: BRANA_KKC_ROHAC_MISTO,
      zdrojIdentita: identita,
    });
  }
  return zahoditDuplicitniTermin(out);
}

export function parsovatSmsticketRohacVenue(
  html: string,
): KkcRohacScanKandidat[] {
  if (!jeSmsticketRohacVenueHtml(html)) {
    return [];
  }
  const out: KkcRohacScanKandidat[] = [];
  const videne = new Set<string>();

  for (const shoda of html.matchAll(
    /<strong\s+property=["']name["'][^>]*>([\s\S]*?)<\/strong>[\s\S]{0,1500}?property=["']url["'][^>]*href=["']([^"']*\/vstupenky\/(\d+)[^"']*)["'][\s\S]{0,1500}?property=["']startDate["'][^>]*content=["']([^"']+)["']([\s\S]{0,250}?<small[\s\S]*?<\/small>)/gi,
  )) {
    if (out.length >= MAX_KANDIDATU) {
      break;
    }
    const nazev = normalizovatSmsticketRohacNazev(
      dekodovatHtmlText(shoda[1] ?? ""),
    );
    const eventId = (shoda[3] ?? "").trim();
    const startDate = (shoda[4] ?? "").trim();
    const paticka = shoda[5] ?? "";
    if (!nazev || nazev.length < 2 || !eventId) {
      continue;
    }
    const rozklad = casZDatetime(startDate);
    if (!rozklad || !ISO_DEN_RE.test(rozklad.datum) || !CAS_RE.test(rozklad.cas)) {
      continue;
    }
    const casOd = casZTextuOd(paticka);
    if (!casOd || casOd !== rozklad.cas) {
      continue;
    }
    const identita = sestavKkcRohacZdrojIdentitu(rozklad.datum, rozklad.cas);
    if (!jeKkcRohacZdrojIdentita(identita) || videne.has(eventId)) {
      continue;
    }
    videne.add(eventId);
    out.push({
      nazev,
      datumOd: rozklad.datum,
      datumDo: rozklad.datum,
      cas: rozklad.cas,
      mistoNeboTyp: BRANA_KKC_ROHAC_MISTO,
      zdrojIdentita: identita,
    });
  }
  return zahoditDuplicitniTermin(out);
}

export function parsovatKkcRohac(
  html: string,
  vysledek: BranaScanKandidat[],
): void {
  const tp = jeTicketportalRohacVenueHtml(html);
  const sms = jeSmsticketRohacVenueHtml(html);
  if (tp === sms) {
    return;
  }
  const kandidati = tp
    ? parsovatTicketportalRohacVenue(html)
    : parsovatSmsticketRohacVenue(html);
  for (const k of kandidati) {
    vysledek.push(k);
  }
}
