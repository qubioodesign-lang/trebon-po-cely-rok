/** Dočasný referenční seznam akcí pro ladění vzhledu – nahraditelný skutečnými daty. */
export type BranaReferencniAkce = {
  mistoNeboTyp: string;
  nazev: string;
  cas: string;
};

export const BRANA_REFERENCNI_AKCE: BranaReferencniAkce[] = [
  { mistoNeboTyp: "Kino Světozor", nazev: "Ďábel nosí Pradu", cas: "20:00" },
  { mistoNeboTyp: "Kino Aurora", nazev: "Bobr a přátelé", cas: "19:30" },
  {
    mistoNeboTyp: "Divadlo J. K. Tyla",
    nazev: "Svědomitě nepřipravení",
    cas: "19:30",
  },
  { mistoNeboTyp: "Koncert", nazev: "Pavel Šporcl ACADEMY", cas: "20:00" },
  { mistoNeboTyp: "Koncert", nazev: "Štěpán Kojan", cas: "20:00" },
  {
    mistoNeboTyp: "Divadlo",
    nazev: "Jak se Petr Vok na Třeboň stěhovati ráčil",
    cas: "18:20",
  },
  { mistoNeboTyp: "Festival", nazev: "Třeboňská nocturna", cas: "19:30" },
  { mistoNeboTyp: "Výstava", nazev: "Když obrazy znějí", cas: "17:00" },
  { mistoNeboTyp: "Prohlídka", nazev: "Město s průvodcem", cas: "17:00" },
  {
    mistoNeboTyp: "Prohlídka",
    nazev: "Sádek Rybářství Třeboň",
    cas: "13:00",
  },
  {
    mistoNeboTyp: "Přednáška",
    nazev: "Jak kapr proměnil naši krajinu",
    cas: "18:00",
  },
  { mistoNeboTyp: "Pro děti", nazev: "Hra o poklad Matyáše", cas: "11:00" },
  {
    mistoNeboTyp: "Restaurace U Vodníka",
    nazev: "Živá hudba",
    cas: "19:00",
  },
  {
    mistoNeboTyp: "Kavárna Vratislavský dům",
    nazev: "Jazzový večer",
    cas: "18:30",
  },
  {
    mistoNeboTyp: "Restaurace Šupina",
    nazev: "Grilování na terase",
    cas: "17:00",
  },
  { mistoNeboTyp: "Lázně Aurora", nazev: "Taneční večer", cas: "19:30" },
  { mistoNeboTyp: "Přístaviště Svět", nazev: "Večerní plavby", cas: "20:00" },
  {
    mistoNeboTyp: "Náměstí T. G. Masaryka",
    nazev: "Pouliční hudebníci",
    cas: "14:00",
  },
];
