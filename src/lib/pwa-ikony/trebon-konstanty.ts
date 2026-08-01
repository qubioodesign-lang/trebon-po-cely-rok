import {
  BRANA_IKONA_AKCENT,
  BRANA_IKONA_LINKA_SIRKA_KOEF,
  BRANA_IKONA_LINKA_TLOUSTKA,
  BRANA_IKONA_MEZERA_TEXT_LINKA,
  BRANA_IKONA_POZADI,
  BRANA_IKONA_POSUN_DOLU,
  BRANA_IKONA_TEXT_VELIKOST,
} from "./brana-konstanty";

/** Sesterská ikona BRÁNY – stejné barvy a linka */
export const TREBON_IKONA_POZADI = BRANA_IKONA_POZADI;
export const TREBON_IKONA_AKCENT = BRANA_IKONA_AKCENT;

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

/** Spodní hrana textu BRÁNY – společný referenční bod pro zarovnání linky */
const SPOLECNY_SPOODNI_OKRAJ_TEXTU =
  BRANA_IKONA_POSUN_DOLU + BRANA_IKONA_TEXT_VELIKOST;

export function meritkaTrebonIkony(velikost: number) {
  const pomer = velikost / 512;
  const branaText = Math.round(BRANA_IKONA_TEXT_VELIKOST * pomer);

  return {
    text: Math.round(TREBON_IKONA_TEXT_VELIKOST * pomer),
    linkaSirka: Math.round(branaText * BRANA_IKONA_LINKA_SIRKA_KOEF),
    mezeraTextLinka: Math.round(BRANA_IKONA_MEZERA_TEXT_LINKA * pomer),
    linkaTloustka: Math.max(1, Math.round(BRANA_IKONA_LINKA_TLOUSTKA * pomer)),
    posunDolu: Math.round(TREBON_IKONA_POSUN_DOLU * pomer),
    spodniOkrajTextu: Math.round(SPOLECNY_SPOODNI_OKRAJ_TEXTU * pomer),
  };
}
