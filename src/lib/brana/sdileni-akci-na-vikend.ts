import { okamzikVPraze } from "@/lib/brana/cas";
import {
  dalsiZmenaStavuZameckehoParku,
  stavZameckehoParku,
  verejnaVetaZameckehoParku,
} from "@/lib/brana/zamecky-park";

/**
 * Jedno sdělení na místě parku.
 * Další věta může dostat vlastní popisek, dny a výpočet
 * ze stejných už načtených událostí. Místo zůstává jeden odstavec.
 */
export const POPISEK_AKCI_NA_VIKEND = "Akcí na víkend";

const DEN_PONDELI = 1;
const DEN_CTVRTEK = 4;

export function isoDenPrahy(okamzik: Date): string {
  const praha = okamzikVPraze(okamzik);
  const mesic = String(praha.mesic).padStart(2, "0");
  const den = String(praha.den).padStart(2, "0");
  return `${praha.rok}-${mesic}-${den}`;
}

/** Pondělí nebo čtvrtek a přirozený stav parku „nic“. Skrytí parku okno nerozšiřuje. */
export function jeOknoAkciNaVikend(okamzik: Date): boolean {
  const den = okamzikVPraze(okamzik).denVTydnu;
  if (den !== DEN_PONDELI && den !== DEN_CTVRTEK) {
    return false;
  }
  return stavZameckehoParku(okamzik) === "nic";
}

export function pocetRadkuVikendoveProjekce(
  bloky: readonly (readonly unknown[])[] | undefined,
): number | null {
  if (!bloky) {
    return null;
  }
  let soucet = 0;
  for (const blok of bloky) {
    soucet += blok.length;
  }
  if (!Number.isInteger(soucet) || soucet < 0) {
    return null;
  }
  return soucet;
}

/**
 * Věta patří na obrazovku jen s kladným počtem z téhož pražského dne
 * a jen dokud je park ve stavu „nic“.
 */
export function maSeZobrazitAkciNaVikend(
  okamzik: Date,
  pocet: number | null,
  oknoIso: string | null,
): boolean {
  if (pocet == null || !Number.isInteger(pocet) || pocet < 1) {
    return false;
  }
  if (!oknoIso || isoDenPrahy(okamzik) !== oknoIso) {
    return false;
  }
  return jeOknoAkciNaVikend(okamzik);
}

/** Další hranice, kdy se viditelnost může změnit. Bez posunu za čas parku. */
export function dalsiKontrolaAkciNaVikend(okamzik: Date): Date {
  return dalsiZmenaStavuZameckehoParku(okamzik);
}

/**
 * Selhání výpočtu čísla nechá původní data a nevrátí počet.
 * Nula zůstane nulou; větu z ní neskládá volající.
 */
export function pripojitVolitelnyPocet<T>(
  data: T,
  spocitat: () => { pocet: number | null; oknoIso: string | null },
): { data: T; pocet: number | null; oknoIso: string | null } {
  try {
    const vysledek = spocitat();
    return {
      data,
      pocet: vysledek.pocet,
      oknoIso: vysledek.oknoIso,
    };
  } catch {
    return { data, pocet: null, oknoIso: null };
  }
}

/** Sdělení a věta parku nemohou platit v jednom okamžiku. */
export function vetaParkuASdeleniSeNekryji(
  okamzik: Date,
  pocet: number | null,
  oknoIso: string | null,
  parkSkrytoDo: string | null,
): boolean {
  const sdeleni = maSeZobrazitAkciNaVikend(okamzik, pocet, oknoIso);
  const park = verejnaVetaZameckehoParku(okamzik, parkSkrytoDo) !== null;
  return !(sdeleni && park);
}
