/** Proporce motivu BRÁNA – pouze pro ikonu BRÁNY (Třeboň beze změny) */
export const BRANA_IKONA_TEXT_VELIKOST = 140;

/** Mezera mezi nápisem a linkou – +50 % oproti 24 px @ 512 (linka posunuta dolů) */
export const BRANA_IKONA_MEZERA_TEXT_LINKA = 36;

/** Tloušťka linky @ 512 – opticky jako 1px linka u horního nápisu Třeboně (15px text) */
export const BRANA_IKONA_LINKA_TLOUSTKA = 9;

/**
 * Oranžová linky – teplejší odstín odlesku na vodě (denní pozadí BRÁNY).
 * Stejná světlost a sytost jako předchozí #F0AA66, méně žluté složky.
 */
export const BRANA_IKONA_AKCENT = "#F0A066";

/**
 * Modrá plocha – více modré složky, živější bez zesvětlení do světlé modré.
 */
export const BRANA_IKONA_POZADI = "#4585C5";

/**
 * Posun celého motivu dolů od horního okraje @ 512 px.
 * Linka sedí v oblasti přechodu do spodního oblouku launcheru.
 */
export const BRANA_IKONA_POSUN_DOLU = 228;

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
