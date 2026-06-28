/** Minimální a maximální počet snímků v jednom prolnutí */
export const PROLNUTI_MIN_SNIMKU = 2;
export const PROLNUTI_MAX_SNIMKU = 3;

export function jePlatnyPocetSnimkuProlnuti(pocet: number): boolean {
  return pocet >= PROLNUTI_MIN_SNIMKU && pocet <= PROLNUTI_MAX_SNIMKU;
}
