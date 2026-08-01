/** Společná PWA identita Třeboně po celý rok a BRÁNY */
export const PWA_IKONA_POZADI = "#144C8C";
export const PWA_IKONA_AKCENT = "#cf9168";
export const PWA_IKONA_TEXT = "#FFFFFF";

/** Referenční velikost pro proporce z návrhu */
export const PWA_IKONA_REFERENCNI_VELIKOST = 512;

/** Délka akcentní linky – stejná u obou ikon */
export const PWA_IKONA_LINKA_SIRKA = 108;

/** Tloušťka akcentní linky */
export const PWA_IKONA_LINKA_TLOUSTKA = 3;

/** Mezera mezi textem a linkou */
export const PWA_IKONA_MEZERA_TEXT_LINKA = 12;

/** Velikost písmene T */
export const PWA_IKONA_T_VELIKOST = 210;

/** Velikost nápisu BRÁNA – stejná optická váha jako .brana-znacka-hlavni */
export const PWA_IKONA_BRANA_VELIKOST = 56;

/** Inter SemiBold – shodné s font-semibold v hlavičce BRÁNY */
export const PWA_IKONA_FONT_VAHA = 600;

/** tracking-tight z Tailwindu */
export const PWA_IKONA_BRANA_MEZERY = -0.025;

export function meritkaPwaIkony(velikost: number) {
  const pomer = velikost / PWA_IKONA_REFERENCNI_VELIKOST;

  return {
    pismenoT: Math.round(PWA_IKONA_T_VELIKOST * pomer),
    brana: Math.round(PWA_IKONA_BRANA_VELIKOST * pomer),
    linkaSirka: Math.round(PWA_IKONA_LINKA_SIRKA * pomer),
    linkaTloustka: Math.max(1, Math.round(PWA_IKONA_LINKA_TLOUSTKA * pomer)),
    mezeraTextLinka: Math.round(PWA_IKONA_MEZERA_TEXT_LINKA * pomer),
    branaMezery: PWA_IKONA_BRANA_MEZERY,
  };
}
