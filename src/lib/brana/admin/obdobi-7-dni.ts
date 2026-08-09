/**
 * Filtr Výhledu podle existujícího klouzavého 7denního okna.
 * Hranici bere z obdobi7DniVPraze() – její implementaci nemění.
 */

import { dnesVPraze, pridatDny, zitraVPraze } from "@/lib/brana/cas";
import { obdobi7DniVPraze } from "@/lib/brana/casova-kotva";

function branaDatumNaIso(rok: number, mesic: number, den: number): string {
  return `${rok}-${String(mesic).padStart(2, "0")}-${String(den).padStart(2, "0")}`;
}

/**
 * ISO dny (YYYY-MM-DD) stejného období, které vrací obdobi7DniVPraze().
 * Počet dnů a výchozí bod (zítřek) odpovídají existujícímu helperu.
 * Autoritativní ISO podoba veřejných „7 dní“ (Europe/Prague).
 */
export function isoDnyObdobi7DniVPraze(): string[] {
  const obdobi = obdobi7DniVPraze();
  const zitra = zitraVPraze();

  return Array.from({ length: obdobi.length }, (_, index) => {
    const den = pridatDny(zitra, index);
    return branaDatumNaIso(den.rok, den.mesic, den.den);
  });
}

/**
 * True, pokud se konkrétní událost smí zobrazit ve Výhledu podle data.
 * – datumOd není minulé (dnes v Prague ještě není minulost),
 * – datumOd není uvnitř období obdobi7DniVPraze().
 * Redakční Výhled = ANO se zde neřeší.
 */
export function maDatumOdPatritDoVyhledu(isoDatumOd: string): boolean {
  const dnes = dnesVPraze();
  const dnesIso = branaDatumNaIso(dnes.rok, dnes.mesic, dnes.den);

  if (isoDatumOd < dnesIso) {
    return false;
  }

  if (isoDnyObdobi7DniVPraze().includes(isoDatumOd)) {
    return false;
  }

  return true;
}
