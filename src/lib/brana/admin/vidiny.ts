/**
 * Úzký sběr festivalu VIDINY: jen oficiální detail ročníku na trebon105.cz.
 * Rodina URL: `/program/festival-vizualni-tvorby-vidiny`
 * a `/program/festival-vizualni-tvorby-vidiny-20xx`.
 * Hub, filtry 105 a jiné event detaily sem nepatří. Aktuální ročník
 * se nehledá — URL Zdroje mění redaktor ručně.
 *
 * Ownership podle živého názvu Položky „VIDINY“ s Používat=ANO.
 * Interní id se nehádá. 0 nebo 2+ → 0 zápis, bez Nezařazených,
 * bez Galerie / Biograf / Divadlo / Koncert 105.
 */

import type { BranaRedakcniPolozkaStav } from "./redakcni-kostra";

export const BRANA_VIDINY_POLOZKA = "VIDINY";

/** Název kandidáta: renderer schová druhý řádek vůči CO Festival + KDE VIDINY. */
export const BRANA_VIDINY_KANDIDAT_NAZEV = "Festival VIDINY";

const TREBON105_HOST = "trebon105.cz";
const VIDINY_DETAIL_CESTA_RE =
  /^\/program\/festival-vizualni-tvorby-vidiny(?:-20\d{2})?$/;

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

/** Jen oficiální detail festivalu VIDINY. Hub / filtry 105 / jiné detaily ne. */
export function jeTrebon105VidinyFestivalZdrojUrl(url: string): boolean {
  const cesta = cestaProgramu(url);
  return (
    hostBezWww(url) === TREBON105_HOST &&
    cesta !== null &&
    VIDINY_DETAIL_CESTA_RE.test(cesta)
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

/** Detail HTML festivalu VIDINY — canonical v rodině URL, ne listing. */
export function jeTrebon105VidinyFestivalDetailHtml(html: string): boolean {
  const canon = canonicalHrefZHtml(html);
  return Boolean(canon && jeTrebon105VidinyFestivalZdrojUrl(canon));
}

/** H1 jádro VIDINY, bez roku. Vstup už bez HTML tagů. */
export function h1Trebon105ObsahujeVidiny(nadpis: string): boolean {
  return nadpis.toLocaleLowerCase("en-US").includes("vidiny");
}

/**
 * Právě jedna ANO Položka „VIDINY“. Interní id se nehádá.
 * Jinak null (0 karet).
 */
export function najitVidinyKotvuId(
  polozky: readonly BranaRedakcniPolozkaStav[],
): string | null {
  const shody = polozky.filter(
    (p) =>
      p.pouzivat === "ANO" &&
      (p.polozka ?? "").trim() === BRANA_VIDINY_POLOZKA,
  );
  return shody.length === 1 ? shody[0].id : null;
}
