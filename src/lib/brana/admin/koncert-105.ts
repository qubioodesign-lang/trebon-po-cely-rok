/**
 * Úzký sběr Koncertu 105: jen URL trebon105.cz `/program/prostor:koncert`.
 * Izolaci dělá filtrovaná URL.
 *
 * Redukce excerptu s jádrem „VIDINY“ platí na listingách
 * prostor:galerie / biograf / divadlo / koncert. Hub a jiné detaily ne.
 * Běžný program bez „vidiny“ v excerptu zůstane.
 *
 * Ownership podle živého názvu Položky „Koncert 105“ s Používat=ANO.
 * Interní id se nehádá. 0 nebo 2+ → 0 zápis, bez hrobky, bez JKT,
 * bez Nezařazených.
 */

import type { BranaRedakcniPolozkaStav } from "./redakcni-kostra";

export const BRANA_KONCERT_105_POLOZKA = "Koncert 105";

const TREBON105_HOST = "trebon105.cz";
const KONCERT_PROGRAM_CESTA = "/program/prostor:koncert";
const VIDINY_EXCERPT_LISTING_CESTY = [
  "/program/prostor:galerie",
  "/program/prostor:biograf",
  "/program/prostor:divadlo",
  "/program/prostor:koncert",
] as const;

function hostBezWww(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function cestaProgramu(url: string): string | null {
  try {
    const path = decodeURIComponent(new URL(url).pathname)
      .replace(/\/+$/, "")
      .toLowerCase();
    return path;
  } catch {
    return null;
  }
}

/** Jen filtrovaný program Koncert. Galerie / Biograf / Divadlo / hub ne. */
export function jeTrebon105KoncertZdrojUrl(url: string): boolean {
  return (
    hostBezWww(url) === TREBON105_HOST &&
    cestaProgramu(url) === KONCERT_PROGRAM_CESTA
  );
}

function canonicalHrefZHtml(html: string): string | null {
  const sRelHref = html.match(
    /<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["'][^>]*>/i,
  );
  if (sRelHref?.[1]) {
    return sRelHref[1];
  }
  const sHrefRel = html.match(
    /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']canonical["'][^>]*>/i,
  );
  return sHrefRel?.[1] ?? null;
}

function jeTrebon105ProstorUrl(url: string, cesta: string): boolean {
  return hostBezWww(url) === TREBON105_HOST && cestaProgramu(url) === cesta;
}

function jeTrebon105ListingHtmlPro(
  html: string,
  jeUrl: (url: string) => boolean,
): boolean {
  const canon = canonicalHrefZHtml(html);
  if (canon && jeUrl(canon)) {
    return true;
  }
  for (const m of html.matchAll(/<a\b([^>]*)>/gi)) {
    const attrs = m[1] ?? "";
    if (!/\bclass=["'][^"']*\bis-active\b/i.test(attrs)) {
      continue;
    }
    const href = attrs.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (href && jeUrl(href)) {
      return true;
    }
  }
  return false;
}

/** Listing HTML větve Koncert 105. Canonical na živém webu míří na hub; aktivní filtr je prostor:koncert. */
export function jeTrebon105KoncertListingHtml(html: string): boolean {
  return jeTrebon105ListingHtmlPro(html, jeTrebon105KoncertZdrojUrl);
}

/**
 * Listing, na kterém platí redukce excerptu VIDINY:
 * prostor:galerie / biograf / divadlo / koncert. Hub ne.
 */
export function jeTrebon105VidinyExcerptListingHtml(html: string): boolean {
  return jeTrebon105ListingHtmlPro(html, (url) =>
    VIDINY_EXCERPT_LISTING_CESTY.some((cesta) =>
      jeTrebon105ProstorUrl(url, cesta),
    ),
  );
}

/**
 * Redakční filtr listingů 105: jádro VIDINY v excerptu, bez roku.
 * Vstup už bez HTML tagů.
 */
export function excerptTrebon105ObsahujeVidiny(excerpt: string): boolean {
  return excerpt.toLocaleLowerCase("en-US").includes("vidiny");
}

/**
 * Právě jedna ANO Položka „Koncert 105“. Interní id se nehádá.
 * Jinak null (0 karet).
 */
export function najitKoncert105KotvuId(
  polozky: readonly BranaRedakcniPolozkaStav[],
): string | null {
  const shody = polozky.filter(
    (p) =>
      p.pouzivat === "ANO" &&
      (p.polozka ?? "").trim() === BRANA_KONCERT_105_POLOZKA,
  );
  return shody.length === 1 ? shody[0].id : null;
}
