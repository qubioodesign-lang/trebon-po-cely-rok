/** Centrální časová konfigurace projektu BRÁNA – jediný zdroj pravidel pro práci s časem. */
export const BRANA_CASOVA_KONFIGURACE = {
  /** Časové pásmo Třeboně – všechny výpočty musí vycházet z tohoto pásma. */
  casovePasmo: "Europe/Prague",

  /** Pravidla pro určení aktuálního víkendu. */
  vikend: {
    /** Den přepnutí na následující víkend (0 = neděle). */
    denPrepnuti: 0,
    /** Čas přepnutí v pásmu Europe/Prague (od tohoto okamžiku platí následující víkend). */
    casPrepnuti: { hodina: 22, minuta: 0 },
  },

  /**
   * Připraveno pro další kroky – zatím neimplementováno:
   * pohled Dnes, Zítra, klouzavých 7 dní, Výhled,
   * přepínání kotvy při scrollování, denní/noční téma podle času v Třeboni.
   */
} as const;

export type BranaCasovePasmo =
  (typeof BRANA_CASOVA_KONFIGURACE)["casovePasmo"];
