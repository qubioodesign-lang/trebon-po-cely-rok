/**
 * Ukázková data nezařazených akcí pro administraci.
 * Bez trvalého úložiště – pouze ověření sekce Nezařazené.
 */

export type BranaNezarazenaAkce = {
  id: string;
  mistoNeboTyp: string;
  nazev: string;
  /** Datum nebo čas – pouze zobrazení vpravo */
  udajVpravo: string;
};

export const UKAZKOVE_NEZARAZENE_AKCE: readonly BranaNezarazenaAkce[] = [
  {
    id: "ukazka-nezarazene-koncert-regent",
    mistoNeboTyp: "Koncert",
    nazev: "Hudba u Regenta",
    udajVpravo: "12.10.",
  },
  {
    id: "ukazka-nezarazene-knihovna",
    mistoNeboTyp: "Městská knihovna",
    nazev: "Čtení z nových knih",
    udajVpravo: "17:00",
  },
  {
    id: "ukazka-nezarazene-vystava-blata",
    mistoNeboTyp: "Výstava",
    nazev: "Fotografie z Blat",
    udajVpravo: "3.11.–18.11.",
  },
  {
    id: "ukazka-nezarazene-prochazka",
    mistoNeboTyp: "Procházka okolím",
    nazev: "Podzimní okruh kolem rybníků",
    udajVpravo: "10:30",
  },
];
