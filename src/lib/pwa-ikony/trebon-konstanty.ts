import {
  BRANA_IKONA_POZADI,
  BRANA_IKONA_POSUN_DOLU,
  BRANA_IKONA_TEXT_VELIKOST,
} from "./brana-konstanty";

/** Stejné modré pozadí jako ikona BRÁNY */
export const TREBON_IKONA_POZADI = BRANA_IKONA_POZADI;

/**
 * Začátek horního oblouku launcher ikony @ 512 px.
 * Horní hrana T končí v místě, kde boční strany přecházejí do zaoblených rohů.
 */
export const TREBON_IKONA_HORNI_OBLOUK = 100;

/** Mezera mezi spodní hranou T a horní hranou linky @ 512 px */
export const TREBON_IKONA_MEZERA_TEXT_LINKA = 50;

/** Jemné optické zmenšení T – řádově několik procent @ 512 px */
export const TREBON_IKONA_T_ZMENSENI = 0.97;

/** Jemný posun celého T dolů @ 512 px (px) */
export const TREBON_IKONA_T_POSUN_DOLU = 6;

/**
 * Poměry vykreslení Inter SemiBold v ImageResponse @ 512 px –
 * vizuální hrany glyfu v em boxu (fontSize 234, linka y 384).
 */
const TREBON_IKONA_T_VIZUALNI_VYSKA_KOEF = 167 / 234;
const TREBON_IKONA_T_HORNI_ODSAZENI = 41 / 234;

/** Metriky bílého písmene T nad hotovou diagnostickou linkou */
export function meritkaTrebonPismenoT(velikost: number, linkaY: number) {
  const pomer = velikost / 512;
  const horniOblouk = Math.round(TREBON_IKONA_HORNI_OBLOUK * pomer);
  const mezeraTextLinka = Math.round(TREBON_IKONA_MEZERA_TEXT_LINKA * pomer);
  const spodniHrana = linkaY - mezeraTextLinka;
  const cilovaVyska = spodniHrana - horniOblouk;
  const textZaklad = Math.round(cilovaVyska / TREBON_IKONA_T_VIZUALNI_VYSKA_KOEF);
  const topZaklad = Math.round(horniOblouk - TREBON_IKONA_T_HORNI_ODSAZENI * textZaklad);
  const text = Math.round(textZaklad * TREBON_IKONA_T_ZMENSENI);
  const top = Math.round(topZaklad + TREBON_IKONA_T_POSUN_DOLU * pomer);

  return {
    text,
    top,
    horniHrana: horniOblouk,
    spodniHrana,
    mezeraTextLinka,
    horniOblouk,
    vizualniVyska: cilovaVyska,
  };
}

/** Spodní hrana nápisu BRÁNA @ referenční velikost – pro kontrolu zarovnání T */
export const TREBON_IKONA_SPOLECNY_SPOODNI_OKRAJ =
  BRANA_IKONA_POSUN_DOLU + BRANA_IKONA_TEXT_VELIKOST;
