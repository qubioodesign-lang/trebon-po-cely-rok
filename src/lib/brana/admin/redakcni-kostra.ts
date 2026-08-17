/**
 * Statická Redakční kostra – katalog 54 pevných ID a výchozí prioritní seznam (22 ANO).
 * Editovatelné hodnoty se ukládají do samostatného Vercel Blob dokumentu (verzeUloziste ≥ 2).
 *
 * Veřejný jazyk BRÁNY (CO / KDE) je oddělený od identity položky (matching).
 */

/** Max. délka poznámky */
export const BRANA_REDAKCNI_POZNAMKA_MAX = 200;

/** Max. délka redakčního textu Položka (editovatelný název, ne id) */
export const BRANA_REDAKCNI_POLOZKA_MAX = 100;

/** Max. délka pevného veřejného CO / KDE */
export const BRANA_REDAKCNI_JAZYK_CO_MAX = 40;
export const BRANA_REDAKCNI_JAZYK_ROZLISENI_MAX = 60;

/** Priorita / Subpriorita: prázdné nebo celé nezáporné číslo */
export const BRANA_REDAKCNI_CISLO_MIN = 0;
export const BRANA_REDAKCNI_CISLO_MAX = 999;

export type BranaRedakcniPouzivat = "ANO" | "NE";

/** Výhled: vždy explicitní ANO nebo NE */
export type BranaRedakcniVyhled = "ANO" | "NE";

/**
 * Režim jednoho veřejného slotu (CO nebo KDE / rozlišení).
 * Bez magických textových tokenů.
 */
export type BranaJazykSlotRezim = "PEVNE" | "Z_UDALOSTI" | "NIC";

export type BranaJazykSlot =
  | { rezim: "PEVNE"; text: string }
  | { rezim: "Z_UDALOSTI" }
  | { rezim: "NIC" };

/**
 * Nastavený strukturovaný veřejný jazyk pravidla.
 * null celého objektu = jazyk není nastaven → legacy (heuristika mistoNeboTyp).
 */
export type BranaRedakcniJazykVerejny = {
  co: BranaJazykSlot;
  rozliseni: BranaJazykSlot;
};

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
  /**
   * Admin Výhled: true = série (agregace), false = jednotlivé události.
   * Chybí-li ve starém Blobu → při načtení true.
   */
  vyhledSerie: boolean;
  poznamka: string;
  mimoKostru: boolean;
  /**
   * null = strukturovaný jazyk NENÍ nastaven → legacy chování.
   * objekt = strukturovaný jazyk JE nastaven (sloty PEVNE / Z_UDALOSTI / NIC).
   */
  jazykVerejny: BranaRedakcniJazykVerejny | null;
};

function pevne(text: string): BranaJazykSlot {
  return { rezim: "PEVNE", text };
}

const Z_UDALOSTI: BranaJazykSlot = { rezim: "Z_UDALOSTI" };

/**
 * Definitivní seed veřejného jazyka + priority + Výhled pro 22 pravidel.
 * Ostatní id katalogu → jazyk null (legacy), priorita null.
 */
const DEFINITIVNI_SEED: Readonly<
  Record<
    string,
    {
      polozka: string;
      priorita: number;
      vyhled: BranaRedakcniVyhled;
      jazyk: BranaRedakcniJazykVerejny;
      /**
       * Jen výchozí seed (nový / prázdný Blob): false = jednotlivé.
       * Starý Blob bez pole → při načtení vždy true (série), viz validace.
       */
      vyhledSerie?: boolean;
    }
  >
> = {
  vylovy: {
    polozka: "Výlovy",
    priorita: 1,
    vyhled: "ANO",
    jazyk: { co: pevne("Výlov"), rozliseni: Z_UDALOSTI },
  },
  trhy: {
    polozka: "Trhy na náměstí",
    priorita: 2,
    vyhled: "ANO",
    // Veřejný zápis: Trh · [rozlišení]; oddělovač řeší rozlozAkci (jen CO=Trh).
    jazyk: { co: pevne("Trh"), rozliseni: Z_UDALOSTI },
    // Rodina samostatných událostí — ne sezónní souhrn.
    vyhledSerie: false,
  },
  "zahajeni-lazenske-sezony": {
    polozka: "Zahájení lázeňské sezóny",
    priorita: 9,
    vyhled: "ANO",
    // CO z události: „Trh“ → Trh · Zahájení…; jinak jen pevné rozlišení.
    jazyk: {
      co: Z_UDALOSTI,
      rozliseni: pevne("Zahájení lázeňské sezóny"),
    },
    vyhledSerie: false,
  },
  "kino-svetozor": {
    polozka: "Kino Světozor",
    priorita: 3,
    vyhled: "NE",
    jazyk: { co: pevne("Kino"), rozliseni: pevne("Světozor") },
  },
  "kino-aurora": {
    polozka: "Kino Aurora",
    priorita: 4,
    vyhled: "NE",
    jazyk: { co: pevne("Kino"), rozliseni: pevne("Aurora") },
  },
  "divadlo-jk-tyla": {
    polozka: "Divadlo J. K. Tyla",
    priorita: 5,
    vyhled: "NE",
    jazyk: { co: pevne("Divadlo"), rozliseni: pevne("J. K. Tyla") },
  },
  "dum-stepanka-netolickeho": {
    polozka: "Dům Štěpánka Netolického",
    priorita: 6,
    vyhled: "NE",
    jazyk: { co: Z_UDALOSTI, rozliseni: pevne("Dům Š. Netolického") },
  },
  "galerie-105": {
    polozka: "Galerie 105",
    priorita: 7,
    vyhled: "NE",
    jazyk: { co: pevne("Výstava"), rozliseni: pevne("Galerie 105") },
  },
  "biograf-105": {
    polozka: "Biograf 105",
    priorita: 8,
    vyhled: "NE",
    jazyk: { co: pevne("Kino"), rozliseni: pevne("Biograf 105") },
  },
  "lazensky-dum-aurora": {
    polozka: "Lázně Aurora",
    priorita: 9,
    vyhled: "NE",
    jazyk: { co: Z_UDALOSTI, rozliseni: pevne("Aurora") },
  },
  "okolo-trebone": {
    polozka: "Okolo Třeboně",
    priorita: 10,
    vyhled: "ANO",
    jazyk: { co: pevne("Okolo Třeboně"), rozliseni: Z_UDALOSTI },
  },
  "trebonsky-divadelni-festival": {
    polozka: "Třeboňský divadelní festival",
    priorita: 11,
    vyhled: "ANO",
    jazyk: { co: pevne("Divadelní festival"), rozliseni: Z_UDALOSTI },
  },
  "dum-prirody-trebonska": {
    polozka: "Dům přírody Třeboňska",
    priorita: 12,
    vyhled: "NE",
    jazyk: { co: pevne("Dům přírody Třeboňska"), rozliseni: Z_UDALOSTI },
  },
  "galerie-buddhistickeho-umeni": {
    polozka: "Galerie buddhistického umění",
    priorita: 13,
    vyhled: "NE",
    jazyk: {
      co: Z_UDALOSTI,
      rozliseni: pevne("Galerie buddhistického umění"),
    },
  },
  "zamecka-lekarna-trebon": {
    polozka: "Francouzské dny TRE(s)BON",
    priorita: 14,
    vyhled: "NE",
    jazyk: {
      co: pevne("Francouzské dny"),
      rozliseni: pevne("Zámecká lékárna"),
    },
  },
  "trebonska-nocturna": {
    polozka: "Třeboňská nocturna",
    priorita: 15,
    vyhled: "ANO",
    jazyk: { co: pevne("Třeboňská nocturna"), rozliseni: Z_UDALOSTI },
  },
  "trebonska-lazenska-matine": {
    polozka: "Třeboňská lázeňská matiné",
    priorita: 16,
    vyhled: "NE",
    jazyk: { co: pevne("Lázeňské matiné"), rozliseni: Z_UDALOSTI },
  },
  "schwarzenberska-hrobka": {
    polozka: "Koncerty na Schwarzenberské hrobce",
    priorita: 17,
    vyhled: "NE",
    jazyk: {
      co: pevne("Koncert"),
      rozliseni: pevne("Schwarzenberská hrobka"),
    },
  },
  "kultura-pod-hvezdami": {
    polozka: "Kultura pod hvězdami",
    priorita: 18,
    vyhled: "ANO",
    jazyk: {
      co: pevne("Kultura pod hvězdami"),
      rozliseni: pevne("Zámek"),
    },
  },
  "trebonska-letni-setkavani": {
    polozka: "Třeboňská letní setkávání",
    priorita: 19,
    vyhled: "NE",
    jazyk: { co: pevne("Letní setkávání"), rozliseni: Z_UDALOSTI },
  },
  "rozmberska-noc": {
    polozka: "Rožmberská noc",
    priorita: 20,
    vyhled: "NE",
    jazyk: { co: pevne("Opera"), rozliseni: pevne("Zámek") },
  },
  "zus-trebon": {
    polozka: "ZUŠ Open",
    priorita: 21,
    vyhled: "NE",
    jazyk: { co: pevne("ZUŠ Open"), rozliseni: Z_UDALOSTI },
  },
};

/** Explicitní výchozí Výhled pro id (včetně zpětné kompatibility starého null). */
export function vychoziVyhledProId(id: string): BranaRedakcniVyhled {
  return DEFINITIVNI_SEED[id]?.vyhled ?? "NE";
}

/**
 * Výchozí admin Výhled série z katalogu (jen pro nový seed bez Blobu).
 * true/undefined → série; false → jednotlivé (např. trhy).
 * Načtení starého Blobu bez pole řeší validace → vždy true.
 */
export function vychoziVyhledSerieProId(id: string): boolean {
  return DEFINITIVNI_SEED[id]?.vyhledSerie !== false;
}

/** @deprecated alias – preferuj hodnotu z Redakčního pořadí / vychoziVyhledSerieProId */
export function vyhledSerieProId(id: string): boolean {
  return vychoziVyhledSerieProId(id);
}

/** Výchozí strukturovaný jazyk podle id – 21 pravidel, ostatní null (legacy). */
export function vychoziJazykVerejnyProId(
  id: string,
): BranaRedakcniJazykVerejny | null {
  return DEFINITIVNI_SEED[id]?.jazyk ?? null;
}

export function vychoziPrioritaProId(id: string): number | null {
  return DEFINITIVNI_SEED[id]?.priorita ?? null;
}

/** True = pravidlo má nastavený strukturovaný jazyk. */
export function maStrukturovanyJazykPravidla(polozka: {
  jazykVerejny: BranaRedakcniJazykVerejny | null;
}): boolean {
  return polozka.jazykVerejny !== null;
}

/** IDs 22 definitivních pravidel (priority dle seedu). */
export const BRANA_REDAKCNI_DEFINITIVNI_ID: readonly string[] = Object.freeze(
  Object.keys(DEFINITIVNI_SEED).sort(
    (a, b) =>
      (DEFINITIVNI_SEED[a]?.priorita ?? 0) -
      (DEFINITIVNI_SEED[b]?.priorita ?? 0),
  ),
);

/** Historická „první kostra“ – mimoKostru=false; výchozí Používat řídí DEFINITIVNI_SEED */
export const BRANA_REDAKCNI_KOSTRA: readonly BranaRedakcniPolozkaVychozi[] = [
  { id: "divadlo-jk-tyla", polozka: "Divadlo J. K. Tyla", pouzivat: "ANO", mimoKostru: false },
  { id: "dum-prirody-trebonska", polozka: "Dům přírody Třeboňska", pouzivat: "ANO", mimoKostru: false },
  { id: "dum-stepanka-netolickeho", polozka: "Dům Štěpánka Netolického", pouzivat: "ANO", mimoKostru: false },
  { id: "ekocentrum-vydra", polozka: "Ekocentrum Vydra", pouzivat: "NE", mimoKostru: false },
  { id: "galerie-105", polozka: "Galerie 105", pouzivat: "ANO", mimoKostru: false },
  { id: "galerie-buddhistickeho-umeni", polozka: "Galerie buddhistického umění", pouzivat: "ANO", mimoKostru: false },
  { id: "kino-aurora", polozka: "Kino Aurora", pouzivat: "ANO", mimoKostru: false },
  { id: "kino-svetozor", polozka: "Kino Světozor", pouzivat: "ANO", mimoKostru: false },
  { id: "muzeum-a-galerie-trebon", polozka: "Muzeum a Galerie Třeboň", pouzivat: "NE", mimoKostru: false },
  { id: "schwarzenberska-hrobka", polozka: "Koncerty na Schwarzenberské hrobce", pouzivat: "ANO", mimoKostru: false },
  { id: "statni-zamek-trebon", polozka: "Státní zámek Třeboň", pouzivat: "NE", mimoKostru: false },
  { id: "zus-trebon", polozka: "ZUŠ Open", pouzivat: "ANO", mimoKostru: false },
  { id: "zamecka-lekarna-trebon", polozka: "Francouzské dny TRE(s)BON", pouzivat: "ANO", mimoKostru: false },
  { id: "mestske-kulturni-akce-trebon", polozka: "Městské kulturní akce Třeboň", pouzivat: "NE", mimoKostru: false },
  { id: "trhy", polozka: "Trhy na náměstí", pouzivat: "ANO", mimoKostru: false },
  {
    id: "zahajeni-lazenske-sezony",
    polozka: "Zahájení lázeňské sezóny",
    pouzivat: "ANO",
    mimoKostru: false,
  },
  { id: "kultura-pod-hvezdami", polozka: "Kultura pod hvězdami", pouzivat: "ANO", mimoKostru: false },
  { id: "okolo-trebone", polozka: "Okolo Třeboně", pouzivat: "ANO", mimoKostru: false },
  { id: "trebonska-lazenska-matine", polozka: "Třeboňská lázeňská matiné", pouzivat: "ANO", mimoKostru: false },
  { id: "trebonska-letni-setkavani", polozka: "Třeboňská letní setkávání", pouzivat: "ANO", mimoKostru: false },
  { id: "trebonska-nocturna", polozka: "Třeboňská nocturna", pouzivat: "ANO", mimoKostru: false },
  { id: "trebonsky-divadelni-festival", polozka: "Třeboňský divadelní festival", pouzivat: "ANO", mimoKostru: false },
  { id: "vylov-rozmberka", polozka: "Výlov Rožmberka", pouzivat: "NE", mimoKostru: false },
];

/** Zásobník mimo první kostru – nesmí být smazán; výchozí Používat řídí DEFINITIVNI_SEED */
export const BRANA_REDAKCNI_MIMO_KOSTRA: readonly BranaRedakcniPolozkaVychozi[] =
  [
    { id: "lazensky-dum-aurora", polozka: "Lázně Aurora", pouzivat: "ANO", mimoKostru: true },
    { id: "lazensky-dum-berta", polozka: "Lázeňský dům Berta / altán", pouzivat: "NE", mimoKostru: true },
    { id: "trebon-105", polozka: "Třeboň 105", pouzivat: "NE", mimoKostru: true },
    { id: "biograf-105", polozka: "Biograf 105", pouzivat: "ANO", mimoKostru: true },
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
    { id: "rozmberska-noc", polozka: "Rožmberská noc", pouzivat: "ANO", mimoKostru: true },
    { id: "vylovy", polozka: "Výlovy", pouzivat: "ANO", mimoKostru: true },
    { id: "vylov-sveta", polozka: "Výlov Světa", pouzivat: "NE", mimoKostru: true },
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

/** Pevné pořadí všech 54 položek (kostra + mimo) – kompatibilita Blob / matching */
export const BRANA_REDAKCNI_VSECHNY_VYCHOZI: readonly BranaRedakcniPolozkaVychozi[] =
  [...BRANA_REDAKCNI_KOSTRA, ...BRANA_REDAKCNI_MIMO_KOSTRA];

export function vytvoritVychoziStavPolozky(
  vychozi: BranaRedakcniPolozkaVychozi,
): BranaRedakcniPolozkaStav {
  const seed = DEFINITIVNI_SEED[vychozi.id];
  return {
    id: vychozi.id,
    polozka: seed?.polozka ?? vychozi.polozka,
    /** Přesně 22 definitivních = ANO; ostatní = NE */
    pouzivat: seed ? "ANO" : "NE",
    priorita: seed?.priorita ?? null,
    subpriorita: null,
    vyhled: seed?.vyhled ?? vychoziVyhledProId(vychozi.id),
    vyhledSerie: vychoziVyhledSerieProId(vychozi.id),
    poznamka: "",
    mimoKostru: vychozi.mimoKostru,
    jazykVerejny: seed?.jazyk ?? null,
  };
}

export function vytvoritVychoziRedakcniPoradi(): BranaRedakcniPolozkaStav[] {
  return BRANA_REDAKCNI_VSECHNY_VYCHOZI.map(vytvoritVychoziStavPolozky);
}

export function jePolozkaMimoKostruPodleId(id: string): boolean {
  return BRANA_REDAKCNI_MIMO_KOSTRA.some((p) => p.id === id);
}
