/**
 * Ukázková data konkrétních událostí pro administraci.
 * Bez trvalého úložiště – pouze ověření Kalendáře a Výhledu.
 */

import type { BranaKonkretniUdalost } from "./konkretni-udalost";
import type { BranaRedakcniVyhled } from "./redakcni-kostra";

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
];

/** True, pokud redakční Výhled je explicitní ANO. */
export function maUkazkovyVyhledAno(
  _redakcniPolozkaId: string,
  ulozenyVyhled: BranaRedakcniVyhled | undefined,
): boolean {
  return ulozenyVyhled === "ANO";
}
