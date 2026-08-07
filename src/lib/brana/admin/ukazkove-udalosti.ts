/**
 * Ukázková data konkrétních událostí pro administraci.
 * Bez trvalého úložiště – pouze ověření Kalendáře a Výhledu.
 */

import type { BranaKonkretniUdalost } from "./konkretni-udalost";
import type { BranaRedakcniVyhled } from "./redakcni-kostra";

/**
 * Ukázkové Výhled ANO/NE pro ověření UI,
 * použije se jen když uložené Redakční pořadí má Výhled prázdné (null).
 * Uložená hodnota ANO/NE z Blobu má vždy přednost.
 */
export const UKAZKOVY_VYHLED_FALLBACK: Readonly<
  Record<string, Exclude<BranaRedakcniVyhled, null>>
> = {
  "kino-aurora": "ANO",
  "trebonsky-divadelni-festival": "ANO",
  "statni-zamek-trebon": "ANO",
  "divadlo-jk-tyla": "NE",
};

export const UKAZKOVE_KONKRETNI_UDALOSTI: readonly BranaKonkretniUdalost[] = [
  {
    id: "ukazka-kino-aurora-2026-10-05",
    redakcniPolozkaId: "kino-aurora",
    datumOd: "2026-10-05",
    datumDo: "2026-10-05",
    cas: "19:30",
    mistoNeboTyp: "Kino Aurora",
    nazev: "Bobr a přátelé",
    rucniPoziceVDni: null,
    stavSchvaleni: "SCHVALENO",
  },
  {
    id: "ukazka-divadlo-jk-tyla-2026-10-05",
    redakcniPolozkaId: "divadlo-jk-tyla",
    datumOd: "2026-10-05",
    datumDo: "2026-10-05",
    cas: "19:30",
    mistoNeboTyp: "Divadlo J. K. Tyla",
    nazev: "Svědomitě nepřipravení",
    rucniPoziceVDni: null,
    stavSchvaleni: "SCHVALENO",
  },
  {
    id: "ukazka-festival-2026-10-05-08",
    redakcniPolozkaId: "trebonsky-divadelni-festival",
    datumOd: "2026-10-05",
    datumDo: "2026-10-08",
    cas: "18:00",
    mistoNeboTyp: "Festival",
    nazev: "Třeboňský divadelní festival",
    rucniPoziceVDni: null,
    stavSchvaleni: "SCHVALENO",
  },
  {
    id: "ukazka-zamek-2027-03-12",
    redakcniPolozkaId: "statni-zamek-trebon",
    datumOd: "2027-03-12",
    datumDo: "2027-03-12",
    cas: "10:00",
    mistoNeboTyp: "Státní zámek Třeboň",
    nazev: "Jarní prohlídka",
    rucniPoziceVDni: null,
    stavSchvaleni: "SCHVALENO",
  },
  /**
   * Dočasná admin-only ukázka pro ověření CEKA_NA_SCHVALENI v Kalendáři.
   * Vazba divadlo-jk-tyla (Výhled NE) – neobjeví se ve Výhledu.
   * Nezapisuje se do PRIVATE Blobu.
   */
  {
    id: "ukazka-test-ceka-na-schvaleni-2026-10-05",
    redakcniPolozkaId: "divadlo-jk-tyla",
    datumOd: "2026-10-05",
    datumDo: "2026-10-05",
    cas: "12:00",
    mistoNeboTyp: "Testovací místo",
    nazev: "TEST – čeká na schválení",
    rucniPoziceVDni: null,
    stavSchvaleni: "CEKA_NA_SCHVALENI",
  },
];

export function maUkazkovyVyhledAno(
  redakcniPolozkaId: string,
  ulozenyVyhled: BranaRedakcniVyhled | undefined,
): boolean {
  if (ulozenyVyhled === "ANO") {
    return true;
  }
  if (ulozenyVyhled === "NE") {
    return false;
  }
  return UKAZKOVY_VYHLED_FALLBACK[redakcniPolozkaId] === "ANO";
}
