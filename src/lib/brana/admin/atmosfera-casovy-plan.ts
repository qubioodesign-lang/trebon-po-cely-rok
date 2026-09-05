/**
 * Časový plán Atmosféry — jen rozhodnutí o slotu / dedupu.
 * Žádný Blob zápis, žádné volání motoru.
 */

import { okamzikVPraze } from "@/lib/brana/cas";

/** Cílové hodiny kontrol v Europe/Prague. */
export const BRANA_ATMOSFERA_SLOTY_HODIN = [8, 11, 15, 19, 23] as const;

export type BranaAtmosferaCasovySlotHodina =
  (typeof BRANA_ATMOSFERA_SLOTY_HODIN)[number];

export function jeAtmosferaCasovySlot(
  okamzik: Date = new Date(),
): boolean {
  const hodina = okamzikVPraze(okamzik).hodina;
  return (BRANA_ATMOSFERA_SLOTY_HODIN as readonly number[]).includes(hodina);
}

/**
 * True, pokud zkontrolovanoAt spadá do stejného Pražského dne a hodiny
 * jako `okamzik` (pojistka proti opakovanému cron requestu ve stejném slotu).
 */
export function uzProbehlaAtmosferaKontrolaVeStejnemSlotu(
  zkontrolovanoAt: string | null | undefined,
  okamzik: Date = new Date(),
): boolean {
  if (typeof zkontrolovanoAt !== "string" || !zkontrolovanoAt.trim()) {
    return false;
  }
  const ms = Date.parse(zkontrolovanoAt);
  if (!Number.isFinite(ms)) {
    return false;
  }

  const predchozi = okamzikVPraze(new Date(ms));
  const ted = okamzikVPraze(okamzik);

  return (
    predchozi.rok === ted.rok &&
    predchozi.mesic === ted.mesic &&
    predchozi.den === ted.den &&
    predchozi.hodina === ted.hodina
  );
}
