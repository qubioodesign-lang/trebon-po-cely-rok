/** Centrální časová konfigurace projektu BRÁNA – jediný zdroj pravidel pro práci s časem. */
export const BRANA_CASOVA_KONFIGURACE = {
  /** Časové pásmo Třeboně – všechny výpočty musí vycházet z tohoto pásma. */
  casovePasmo: "Europe/Prague",

  /** Poloha Třeboně pro výpočet východu a západu slunce. */
  trebon: {
    lat: 49.0038,
    lng: 14.7706,
  },

  /** Přepínání denní/noční verze pozadí podle slunce v Třeboni. */
  denniDoba: {
    /** Posun ranního přepnutí vůči východu slunce (záporné = dříve). */
    posunRanoMinuty: -40,
    /** Posun večerního přepnutí vůči západu slunce (kladné = později). */
    posunVecerMinuty: 40,
    /** Záložní logika při selhání astronomického výpočtu. */
    fallback: {
      zacatekDne: { hodina: 6, minuta: 0 },
      zacatekNoci: { hodina: 20, minuta: 0 },
    },
  },
} as const;

export type BranaCasovePasmo =
  (typeof BRANA_CASOVA_KONFIGURACE)["casovePasmo"];
