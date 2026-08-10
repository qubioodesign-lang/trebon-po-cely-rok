/**
 * Statická Redakční kostra v1 – katalog pevných položek a výchozí Používat.
 * Editovatelné hodnoty se ukládají do samostatného Vercel Blob dokumentu.
 */

/** Max. délka poznámky */
export const BRANA_REDAKCNI_POZNAMKA_MAX = 200;

/** Max. délka redakčního textu Položka (editovatelný název, ne id) */
export const BRANA_REDAKCNI_POLOZKA_MAX = 100;

/** Priorita / Subpriorita: prázdné nebo celé nezáporné číslo */
export const BRANA_REDAKCNI_CISLO_MIN = 0;
export const BRANA_REDAKCNI_CISLO_MAX = 999;

export type BranaRedakcniPouzivat = "ANO" | "NE";

/** Výhled: vždy explicitní ANO nebo NE */
export type BranaRedakcniVyhled = "ANO" | "NE";

/**
 * Legacy null/prázdné/neplatné → stejné efektivní ANO jako dřívější UKAZKOVY_VYHLED_FALLBACK.
 * Všechna ostatní id → NE.
 */
const VYHLED_ANO_PRI_NEURCENEM = new Set([
  "kino-aurora",
  "trebonsky-divadelni-festival",
  "statni-zamek-trebon",
]);

/** Explicitní výchozí Výhled pro id (včetně zpětné kompatibility starého null). */
export function vychoziVyhledProId(id: string): BranaRedakcniVyhled {
  return VYHLED_ANO_PRI_NEURCENEM.has(id) ? "ANO" : "NE";
}

export type BranaRedakcniPolozkaVychozi = {
  /** Stabilní identifikátor – nemění se, nesloučí se s názvem */
  id: string;
  /** Výchozí redakční text – po uložení se bere z Blobu, katalog ho nepřepisuje */
  polozka: string;
  pouzivat: BranaRedakcniPouzivat;
  /** true = historicky mimo první kostru (katalog); sekce UI řídí Používat */
  mimoKostru: boolean;
};

/** Plný řádek pracovní tabulky včetně editovatelných polí */
export type BranaRedakcniPolozkaStav = {
  id: string;
  polozka: string;
  pouzivat: BranaRedakcniPouzivat;
  priorita: number | null;
  subpriorita: number | null;
  vyhled: BranaRedakcniVyhled;
  poznamka: string;
  mimoKostru: boolean;
};

/** Schválená Redakční kostra v1 – Používat ANO */
export const BRANA_REDAKCNI_KOSTRA: readonly BranaRedakcniPolozkaVychozi[] = [
  { id: "divadlo-jk-tyla", polozka: "Divadlo J. K. Tyla", pouzivat: "ANO", mimoKostru: false },
  { id: "dum-prirody-trebonska", polozka: "Dům přírody Třeboňska", pouzivat: "ANO", mimoKostru: false },
  { id: "dum-stepanka-netolickeho", polozka: "Dům Štěpánka Netolického", pouzivat: "ANO", mimoKostru: false },
  { id: "ekocentrum-vydra", polozka: "Ekocentrum Vydra", pouzivat: "ANO", mimoKostru: false },
  { id: "galerie-105", polozka: "Galerie 105", pouzivat: "ANO", mimoKostru: false },
  { id: "galerie-buddhistickeho-umeni", polozka: "Galerie buddhistického umění", pouzivat: "ANO", mimoKostru: false },
  { id: "kino-aurora", polozka: "Kino Aurora", pouzivat: "ANO", mimoKostru: false },
  { id: "kino-svetozor", polozka: "Kino Světozor", pouzivat: "ANO", mimoKostru: false },
  { id: "muzeum-a-galerie-trebon", polozka: "Muzeum a Galerie Třeboň", pouzivat: "ANO", mimoKostru: false },
  { id: "schwarzenberska-hrobka", polozka: "Schwarzenberská hrobka", pouzivat: "ANO", mimoKostru: false },
  { id: "statni-zamek-trebon", polozka: "Státní zámek Třeboň", pouzivat: "ANO", mimoKostru: false },
  { id: "zus-trebon", polozka: "Základní umělecká škola Třeboň", pouzivat: "ANO", mimoKostru: false },
  { id: "zamecka-lekarna-trebon", polozka: "Zámecká lékárna Třeboň", pouzivat: "ANO", mimoKostru: false },
  { id: "mestske-kulturni-akce-trebon", polozka: "Městské kulturní akce Třeboň", pouzivat: "ANO", mimoKostru: false },
  { id: "trhy", polozka: "Trhy", pouzivat: "ANO", mimoKostru: false },
  { id: "kultura-pod-hvezdami", polozka: "Kultura pod hvězdami", pouzivat: "ANO", mimoKostru: false },
  { id: "okolo-trebone", polozka: "Okolo Třeboně", pouzivat: "ANO", mimoKostru: false },
  { id: "trebonska-lazenska-matine", polozka: "Třeboňská lázeňská matiné", pouzivat: "ANO", mimoKostru: false },
  { id: "trebonska-letni-setkavani", polozka: "Třeboňská letní setkávání", pouzivat: "ANO", mimoKostru: false },
  { id: "trebonska-nocturna", polozka: "Třeboňská nocturna", pouzivat: "ANO", mimoKostru: false },
  { id: "trebonsky-divadelni-festival", polozka: "Třeboňský divadelní festival", pouzivat: "ANO", mimoKostru: false },
  { id: "vylov-rozmberka", polozka: "Výlov Rožmberka", pouzivat: "ANO", mimoKostru: false },
];

/** Zásobník mimo první kostru – Používat NE, nesmí být smazán */
export const BRANA_REDAKCNI_MIMO_KOSTRA: readonly BranaRedakcniPolozkaVychozi[] =
  [
    { id: "lazensky-dum-aurora", polozka: "Lázeňský dům Aurora", pouzivat: "NE", mimoKostru: true },
    { id: "lazensky-dum-berta", polozka: "Lázeňský dům Berta / altán", pouzivat: "NE", mimoKostru: true },
    { id: "trebon-105", polozka: "Třeboň 105", pouzivat: "NE", mimoKostru: true },
    { id: "biograf-105", polozka: "Biograf 105", pouzivat: "NE", mimoKostru: true },
    { id: "divadlo-105", polozka: "Divadlo 105", pouzivat: "NE", mimoKostru: true },
    { id: "open-air-scena-mn-105", polozka: "Open air scéna MN 105", pouzivat: "NE", mimoKostru: true },
    { id: "galerie-mesta-trebon", polozka: "Galerie města Třeboň", pouzivat: "NE", mimoKostru: true },
    { id: "muzeum-mesta-trebon", polozka: "Muzeum města Třeboň", pouzivat: "NE", mimoKostru: true },
    { id: "galerie-buddhistickeho-umeni-jurta", polozka: "Galerie buddhistického umění / jurta", pouzivat: "NE", mimoKostru: true },
    { id: "zamecky-park", polozka: "Zámecký park", pouzivat: "NE", mimoKostru: true },
    { id: "zamek-nadvori-schwarzenbersky-sal", polozka: "Zámek – malé / velké nádvoří / Schwarzenberský sál", pouzivat: "NE", mimoKostru: true },
    { id: "masarykovo-namesti", polozka: "Masarykovo náměstí", pouzivat: "NE", mimoKostru: true },
    { id: "louka-u-zlate-stoky", polozka: "Louka u Zlaté stoky", pouzivat: "NE", mimoKostru: true },
    { id: "street-food-festival", polozka: "Street Food Festival", pouzivat: "NE", mimoKostru: true },
    { id: "mint-market", polozka: "Mint Market", pouzivat: "NE", mimoKostru: true },
    { id: "adventni-vanocni-trhy", polozka: "Adventní / vánoční trhy", pouzivat: "NE", mimoKostru: true },
    { id: "cochtanova-trebon", polozka: "Čochtanova Třeboň", pouzivat: "NE", mimoKostru: true },
    { id: "historicke-slavnosti-jakuba-krcina", polozka: "Historické slavnosti Jakuba Krčína", pouzivat: "NE", mimoKostru: true },
    { id: "vidiny", polozka: "VIDINY", pouzivat: "NE", mimoKostru: true },
    { id: "rozmberska-noc", polozka: "Rožmberská noc", pouzivat: "NE", mimoKostru: true },
    { id: "vylovy", polozka: "Výlovy", pouzivat: "NE", mimoKostru: true },
    { id: "gymnazium-trebon", polozka: "Gymnázium Třeboň", pouzivat: "NE", mimoKostru: true },
    { id: "kostel-panny-marie-a-sv-jilji", polozka: "Kostel Panny Marie Královny a sv. Jiljí", pouzivat: "NE", mimoKostru: true },
    { id: "tic-trebon", polozka: "Turistické informační centrum Třeboň", pouzivat: "NE", mimoKostru: true },
    { id: "hospic-sv-kleofase", polozka: "Hospicová péče sv. Kleofáše", pouzivat: "NE", mimoKostru: true },
    { id: "botanicka-zahrada-trebon", polozka: "Botanická zahrada Třeboň", pouzivat: "NE", mimoKostru: true },
    { id: "pivovar-bohemia-regent", polozka: "Pivovar Bohemia Regent", pouzivat: "NE", mimoKostru: true },
    { id: "rybarske-muzeum-rozmberk", polozka: "Rybářské muzeum Rožmberk", pouzivat: "NE", mimoKostru: true },
    { id: "farska-louka-lomnice", polozka: "Farská louka (Lomnice nad Lužnicí)", pouzivat: "NE", mimoKostru: true },
    { id: "plaz-u-rybnika-svet", polozka: "Pláž u rybníka Svět", pouzivat: "NE", mimoKostru: true },
  ];

/** Pevné pořadí všech 52 položek (kostra + mimo) */
export const BRANA_REDAKCNI_VSECHNY_VYCHOZI: readonly BranaRedakcniPolozkaVychozi[] =
  [...BRANA_REDAKCNI_KOSTRA, ...BRANA_REDAKCNI_MIMO_KOSTRA];

export function vytvoritVychoziStavPolozky(
  vychozi: BranaRedakcniPolozkaVychozi,
): BranaRedakcniPolozkaStav {
  return {
    id: vychozi.id,
    polozka: vychozi.polozka,
    pouzivat: vychozi.pouzivat,
    priorita: null,
    subpriorita: null,
    vyhled: vychoziVyhledProId(vychozi.id),
    poznamka: "",
    mimoKostru: vychozi.mimoKostru,
  };
}

export function vytvoritVychoziRedakcniPoradi(): BranaRedakcniPolozkaStav[] {
  return BRANA_REDAKCNI_VSECHNY_VYCHOZI.map(vytvoritVychoziStavPolozky);
}

export function jePolozkaMimoKostruPodleId(id: string): boolean {
  return BRANA_REDAKCNI_MIMO_KOSTRA.some((p) => p.id === id);
}
