/**
 * Úzký sběr Divadla 105: jen URL trebon105.cz `/program/prostor:divadlo`.
 * Parser trebon105.cz se nemění — izolaci dělá filtrovaná URL.
 *
 * Ownership podle živého názvu Položky „Divadlo 105“ s Používat=ANO.
 * Interní id se nehádá. 0 nebo 2+ → 0 zápis, bez JKT, bez Nezařazených.
 * Galerie 105 / Biograf 105 tuto větev nevidí.
 */

import type { BranaRedakcniPolozkaStav } from "./redakcni-kostra";

export const BRANA_DIVADLO_105_POLOZKA = "Divadlo 105";

const TREBON105_HOST = "trebon105.cz";
const DIVADLO_PROGRAM_CESTA = "/program/prostor:divadlo";

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

/** Jen filtrovaný program Divadlo. Galerie / Biograf / Koncert / hub ne. */
export function jeTrebon105DivadloZdrojUrl(url: string): boolean {
  return (
    hostBezWww(url) === TREBON105_HOST &&
    cestaProgramu(url) === DIVADLO_PROGRAM_CESTA
  );
}

/**
 * Právě jedna ANO Položka „Divadlo 105“. Interní id se nehádá.
 * Jinak null (0 karet).
 */
export function najitDivadlo105KotvuId(
  polozky: readonly BranaRedakcniPolozkaStav[],
): string | null {
  const shody = polozky.filter(
    (p) =>
      p.pouzivat === "ANO" &&
      (p.polozka ?? "").trim() === BRANA_DIVADLO_105_POLOZKA,
  );
  return shody.length === 1 ? shody[0].id : null;
}
