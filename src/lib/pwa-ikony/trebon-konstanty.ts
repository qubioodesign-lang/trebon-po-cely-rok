import {
  BRANA_IKONA_POZADI,
  BRANA_IKONA_POSUN_DOLU,
  BRANA_IKONA_TEXT_VELIKOST,
} from "./brana-konstanty";

/** Stejné modré pozadí jako ikona BRÁNY */
export const TREBON_IKONA_POZADI = BRANA_IKONA_POZADI;

/**
 * Referenční vizuální metriky T @ 512 px – stav v=10.
 * Výška, tloušťka horního ramene a mezera k linkě slouží jako výchozí bod doladění.
 */
export const TREBON_IKONA_T_REF_VYSKA = 227;
export const TREBON_IKONA_T_REF_RAMENO = 25;
export const TREBON_IKONA_T_REF_MEZERA = 54;
export const TREBON_IKONA_T_REF_FONT = 318;
export const TREBON_IKONA_T_REF_EM_TOP = 49;
export const TREBON_IKONA_T_REF_VISUAL_TOP = 104;

const TREBON_IKONA_T_VIZUALNI_VYSKA_KOEF =
  TREBON_IKONA_T_REF_VYSKA / TREBON_IKONA_T_REF_FONT;
const TREBON_IKONA_T_HORNI_ODSAZENI =
  (TREBON_IKONA_T_REF_VISUAL_TOP - TREBON_IKONA_T_REF_EM_TOP) /
  TREBON_IKONA_T_REF_FONT;

/** Metriky bílého písmene T nad hotovou diagnostickou linkou */
export function meritkaTrebonPismenoT(velikost: number, linkaY: number) {
  const pomer = velikost / 512;
  const refVyska = Math.round(TREBON_IKONA_T_REF_VYSKA * pomer);
  const refRameno = Math.round(TREBON_IKONA_T_REF_RAMENO * pomer);
  const refMezera = Math.round(TREBON_IKONA_T_REF_MEZERA * pomer);

  const cilovaVyska = refVyska - refRameno;
  const cilovaMezera = Math.round(refMezera * 0.8);
  const cilovaSpodni = linkaY - cilovaMezera;
  const cilovaHorni = cilovaSpodni - cilovaVyska;

  const text = Math.round(cilovaVyska / TREBON_IKONA_T_VIZUALNI_VYSKA_KOEF);
  const top = Math.round(cilovaHorni - TREBON_IKONA_T_HORNI_ODSAZENI * text);

  return {
    text,
    top,
    cilovaVyska,
    cilovaMezera,
    cilovaHorni,
    cilovaSpodni,
  };
}

/**
 * Tloušťka oranžové linky na splash ikoně @ 512 px.
 * ≈ 2/3 launcher linky (20 px) – stejná poloha a délka, jen tenčí pruh.
 */
export const TREBON_SPLASH_LINKA_TLOUSTKA = 13;

/** Spodní hrana nápisu BRÁNA @ referenční velikost – pro kontrolu zarovnání T */
export const TREBON_IKONA_SPOLECNY_SPOODNI_OKRAJ =
  BRANA_IKONA_POSUN_DOLU + BRANA_IKONA_TEXT_VELIKOST;
