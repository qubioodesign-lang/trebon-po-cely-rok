/**
 * Filtr Výhledu: blízké okno = dnes (Europe/Prague) + veřejných 7 dní.
 * Veřejných 7 dní bere z obdobi7DniVPraze() – její implementaci nemění.
 */

import { dnesVPraze, pridatDny, zitraVPraze } from "@/lib/brana/cas";
import { obdobi7DniVPraze } from "@/lib/brana/casova-kotva";

function branaDatumNaIso(rok: number, mesic: number, den: number): string {
  return `${rok}-${String(mesic).padStart(2, "0")}-${String(den).padStart(2, "0")}`;
}

/** Volitelná hranice pro testy a veřejnou projekci se stejným významem. */
export type BranaVyhledDatumovaHranice = {
  dnesIso: string;
  sedmDniIso: readonly string[];
};

/**
 * ISO dny (YYYY-MM-DD) stejného období, které vrací obdobi7DniVPraze().
 * Počet dnů a výchozí bod (zítřek) odpovídají existujícímu helperu.
 * Autoritativní ISO podoba veřejných „7 dní“ (Europe/Prague).
 */
export function isoDnyObdobi7DniVPraze(okamzik: Date = new Date()): string[] {
  const obdobi = obdobi7DniVPraze();
  const zitra = zitraVPraze(okamzik);

  return Array.from({ length: obdobi.length }, (_, index) => {
    const den = pridatDny(zitra, index);
    return branaDatumNaIso(den.rok, den.mesic, den.den);
  });
}

function dnesIsoVPrazeProVyhled(okamzik: Date = new Date()): string {
  const dnes = dnesVPraze(okamzik);
  return branaDatumNaIso(dnes.rok, dnes.mesic, dnes.den);
}

/**
 * True, pokud se konkrétní událost smí zobrazit ve Výhledu podle data.
 * Vyloučeno:
 * – minulost (datumOd < dnes v Prague),
 * – blízké okno = dnes + veřejných 7 dní (zítřek … +6).
 * Redakční Výhled = ANO se zde neřeší.
 */
export function maDatumOdPatritDoVyhledu(
  isoDatumOd: string,
  hranice?: BranaVyhledDatumovaHranice,
): boolean {
  const dnesIso = hranice?.dnesIso ?? dnesIsoVPrazeProVyhled();
  const sedmDniIso = hranice?.sedmDniIso ?? isoDnyObdobi7DniVPraze();

  if (isoDatumOd <= dnesIso) {
    return false;
  }

  if (sedmDniIso.includes(isoDatumOd)) {
    return false;
  }

  return true;
}
