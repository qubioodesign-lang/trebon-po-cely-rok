/**
 * Statická Redakční kostra v1 – pouze pracovní data pro administraci.
 * Bez ukládání, editace a databáze.
 */

export type BranaRedakcniPolozka = {
  polozka: string;
  /** ANO = v první kostře, NE = mimo první kostru (zásobník) */
  pouzivat: "ANO" | "NE";
};

/** Schválená Redakční kostra v1 – Používat ANO */
export const BRANA_REDAKCNI_KOSTRA: readonly BranaRedakcniPolozka[] = [
  { polozka: "Divadlo J. K. Tyla", pouzivat: "ANO" },
  { polozka: "Dům přírody Třeboňska", pouzivat: "ANO" },
  { polozka: "Dům Štěpánka Netolického", pouzivat: "ANO" },
  { polozka: "Ekocentrum Vydra", pouzivat: "ANO" },
  { polozka: "Galerie 105", pouzivat: "ANO" },
  { polozka: "Galerie buddhistického umění", pouzivat: "ANO" },
  { polozka: "Kino Aurora", pouzivat: "ANO" },
  { polozka: "Kino Světozor", pouzivat: "ANO" },
  { polozka: "Muzeum a Galerie Třeboň", pouzivat: "ANO" },
  { polozka: "Schwarzenberská hrobka", pouzivat: "ANO" },
  { polozka: "Státní zámek Třeboň", pouzivat: "ANO" },
  { polozka: "Základní umělecká škola Třeboň", pouzivat: "ANO" },
  { polozka: "Zámecká lékárna Třeboň", pouzivat: "ANO" },
  { polozka: "Městské kulturní akce Třeboň", pouzivat: "ANO" },
  { polozka: "Trhy", pouzivat: "ANO" },
  { polozka: "Kultura pod hvězdami", pouzivat: "ANO" },
  { polozka: "Okolo Třeboně", pouzivat: "ANO" },
  { polozka: "Třeboňská lázeňská matiné", pouzivat: "ANO" },
  { polozka: "Třeboňská letní setkávání", pouzivat: "ANO" },
  { polozka: "Třeboňská nocturna", pouzivat: "ANO" },
  { polozka: "Třeboňský divadelní festival", pouzivat: "ANO" },
  { polozka: "Výlov Rožmberka", pouzivat: "ANO" },
];

/** Zásobník mimo první kostru – Používat NE, nesmí být smazán */
export const BRANA_REDAKCNI_MIMO_KOSTRA: readonly BranaRedakcniPolozka[] = [
  { polozka: "Lázeňský dům Aurora", pouzivat: "NE" },
  { polozka: "Lázeňský dům Berta / altán", pouzivat: "NE" },
  { polozka: "Třeboň 105", pouzivat: "NE" },
  { polozka: "Biograf 105", pouzivat: "NE" },
  { polozka: "Divadlo 105", pouzivat: "NE" },
  { polozka: "Open air scéna MN 105", pouzivat: "NE" },
  { polozka: "Galerie města Třeboň", pouzivat: "NE" },
  { polozka: "Muzeum města Třeboň", pouzivat: "NE" },
  { polozka: "Galerie buddhistického umění / jurta", pouzivat: "NE" },
  { polozka: "Zámecký park", pouzivat: "NE" },
  { polozka: "Zámek – malé / velké nádvoří / Schwarzenberský sál", pouzivat: "NE" },
  { polozka: "Masarykovo náměstí", pouzivat: "NE" },
  { polozka: "Louka u Zlaté stoky", pouzivat: "NE" },
  { polozka: "Street Food Festival", pouzivat: "NE" },
  { polozka: "Mint Market", pouzivat: "NE" },
  { polozka: "Adventní / vánoční trhy", pouzivat: "NE" },
  { polozka: "Čochtanova Třeboň", pouzivat: "NE" },
  { polozka: "Historické slavnosti Jakuba Krčína", pouzivat: "NE" },
  { polozka: "VIDINY", pouzivat: "NE" },
  { polozka: "Rožmberská noc", pouzivat: "NE" },
  { polozka: "Výlovy", pouzivat: "NE" },
  { polozka: "Gymnázium Třeboň", pouzivat: "NE" },
  { polozka: "Kostel Panny Marie Královny a sv. Jiljí", pouzivat: "NE" },
  { polozka: "Turistické informační centrum Třeboň", pouzivat: "NE" },
  { polozka: "Hospicová péče sv. Kleofáše", pouzivat: "NE" },
  { polozka: "Botanická zahrada Třeboň", pouzivat: "NE" },
  { polozka: "Pivovar Bohemia Regent", pouzivat: "NE" },
  { polozka: "Rybářské muzeum Rožmberk", pouzivat: "NE" },
  { polozka: "Farská louka (Lomnice nad Lužnicí)", pouzivat: "NE" },
  { polozka: "Pláž u rybníka Svět", pouzivat: "NE" },
];
