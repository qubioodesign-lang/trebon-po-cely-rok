import {
  BRANA_IKONA_POZADI,
  BRANA_IKONA_POSUN_DOLU,
  BRANA_IKONA_TEXT_VELIKOST,
} from "./brana-konstanty";

/** Stejné modré pozadí jako ikona BRÁNY */
export const TREBON_IKONA_POZADI = BRANA_IKONA_POZADI;

/**
 * Velikost písmene T @ 512 px.
 * Spodní hrana T = spodní hrana nápisu BRÁNA (228 + 140 = 368).
 */
export const TREBON_IKONA_TEXT_VELIKOST = 318;

/**
 * Posun motivu od horního okraje @ 512 px.
 * Horní hrana T ≈ oblast začátku zaoblení bočních rohů launcheru (~100 px).
 */
export const TREBON_IKONA_POSUN_DOLU = 50;

export function meritkaTrebonIkony(velikost: number) {
  const pomer = velikost / 512;

  return {
    text: Math.round(TREBON_IKONA_TEXT_VELIKOST * pomer),
    posunDolu: Math.round(TREBON_IKONA_POSUN_DOLU * pomer),
  };
}

/** Spodní hrana nápisu BRÁNA @ referenční velikost – pro kontrolu zarovnání T */
export const TREBON_IKONA_SPOLECNY_SPOODNI_OKRAJ =
  BRANA_IKONA_POSUN_DOLU + BRANA_IKONA_TEXT_VELIKOST;
