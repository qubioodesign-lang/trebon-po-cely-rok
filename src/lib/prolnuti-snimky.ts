/** Minimální a maximální počet snímků v jednom prolnutí */
export const PROLNUTI_MIN_SNIMKU = 2;
export const PROLNUTI_MAX_SNIMKU = 3;

export function jePlatnyPocetSnimkuProlnuti(pocet: number): boolean {
  return pocet >= PROLNUTI_MIN_SNIMKU && pocet <= PROLNUTI_MAX_SNIMKU;
}

/** Odstraní prázdné cesty a omezí na 2–3 snímky */
export function normalizovatCestySnimkuProlnuti(soubory: string[]): string[] {
  return soubory
    .filter(
      (cesta): cesta is string =>
        typeof cesta === "string" && cesta.trim().length > 0
    )
    .slice(0, PROLNUTI_MAX_SNIMKU);
}

/** Počet prolínacích kroků – u 2 snímků 1 (A→B), u 3 snímků 2 (A→B→C) */
export function pocetKrokuProlnuti(pocetSnimku: number): number {
  return Math.max(0, pocetSnimku - 1);
}
