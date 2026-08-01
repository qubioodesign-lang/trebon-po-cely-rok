/** Proporce motivu BRÁNA – pouze pro ikonu BRÁNY (Třeboň beze změny) */
export const BRANA_IKONA_TEXT_VELIKOST = 140;

/** Mezera mezi nápisem a linkou – +50 % oproti 24 px @ 512 (linka posunuta dolů) */
export const BRANA_IKONA_MEZERA_TEXT_LINKA = 36;

/** Tloušťka linky – opticky odpovídá tahům Inter SemiBold @ 512 */
export const BRANA_IKONA_LINKA_TLOUSTKA = 5;

/**
 * Modrá plocha – nejsvětlejší odstín ze středu denního pozadí BRÁNY
 * (pozadi-den-master-final.png, střed obrazu).
 */
export const BRANA_IKONA_POZADI = "#5186B0";

/**
 * Posun celého motivu dolů od horního okraje @ 512 px.
 * Linka sedí v oblasti přechodu do spodního oblouku launcheru.
 */
export const BRANA_IKONA_POSUN_DOLU = 220;

/** Poměr optické šířky nápisu k fontSize – délka linky @ 512 */
export const BRANA_IKONA_LINKA_SIRKA_KOEF = 3.11;

export function meritkaBranaIkony(velikost: number) {
  const pomer = velikost / 512;
  const text = Math.round(BRANA_IKONA_TEXT_VELIKOST * pomer);

  return {
    text,
    linkaSirka: Math.round(text * BRANA_IKONA_LINKA_SIRKA_KOEF),
    mezeraTextLinka: Math.round(BRANA_IKONA_MEZERA_TEXT_LINKA * pomer),
    linkaTloustka: Math.max(1, Math.round(BRANA_IKONA_LINKA_TLOUSTKA * pomer)),
    posunDolu: Math.round(BRANA_IKONA_POSUN_DOLU * pomer),
  };
}
