/**
 * Typy obsahu galerie.
 * Fotografie – jeden snímek; prolnutí – 2–3 snímky (postupné prolínání); video – rezervováno.
 */
import type { ZdrojNavstevnika } from "@/lib/zdroj-navstev";
import type { TypZarizeni } from "@/lib/zarizeni-navstevnika";
import type { ProlnutiCasovaniNastaveni } from "@/lib/prolnuti-casovani";

export type { ProlnutiCasovaniNastaveni } from "@/lib/prolnuti-casovani";
export type { ZdrojNavstevnika, TypZarizeni };
export type TypObsahu = "fotografie" | "prolnuti" | "video";

/** Položka galerie */
export interface Polozka {
  id: string;
  typ: TypObsahu;
  /** Jeden soubor – fotografie nebo video */
  soubor?: string;
  /** Dva až tři soubory – prolnutí (postupné prolínání) */
  soubory?: string[];
  popis: string;
  datumPorizeni: string | null;
  datumPublikace: string;
  poradi: number;
  aktivni: boolean;
}

/** Veřejná reprezentace položky pro frontend */
export interface PolozkaVerejna {
  id: string;
  typ: TypObsahu;
  /** URL jednoho souboru – fotografie / video */
  url?: string;
  /** URL více souborů – prolnutí */
  urls?: string[];
  popis: string;
}

/** Souhrn metriky komunity – noví vs. vracející se návštěvníci */
export interface KomunitaObdobiSouhrn {
  noviNavstevnici: number;
  vracejiciSeNavstevnici: number;
  podilVracejicichSe: number;
}

export interface KomunitaSouhrn {
  celkem: KomunitaObdobiSouhrn;
  poslednich7Dni: KomunitaObdobiSouhrn;
}

/** Agregované metriky pro administraci */
export interface MetrikySouhrn {
  pocetNavstev: number;
  pocetVracejicichSeNavstevniku: number;
  pocetZobrazeniFotografii: number;
  pocetPosunuVpred: number;
  pocetNavratuZpet: number;
  procentoNavratu: number;
  pocetKliknutiChciSeVracet: number;
  pocetPovolenychUpozorneni: number;
  pocetKliknutiPridatNaPlochu: number;
  pocetNavstevZePlochy: number;
  pocetReplayProlnuti: number;
}

/** Souhrn analytics pro administraci */
export interface AnalyticsSouhrn {
  zdroje: Record<ZdrojNavstevnika, number>;
  navstevyPodleZarizeni: Record<TypZarizeni, number>;
  pushOdberyPodleZarizeni: Record<TypZarizeni, number>;
  fotografie: AnalyticsFotografieRadek[];
}

/** Řádek tabulky fotografií v analytics */
export interface AnalyticsFotografieRadek {
  polozkaId: string;
  popis: string;
  zobrazeni: number;
  sdileni: number;
  replay: number;
}

/** Typy událostí pro měření návratů */
export type TypUdalostiMetriky =
  | "navsteva"
  | "zobrazeni_fotografie"
  | "sdileni_fotografie"
  | "posun_vpred"
  | "navrat_zpet"
  | "klik_chci_se_vracet"
  | "povoleno_upozorneni"
  | "klik_pridat_na_plochu"
  | "navsteva_standalone"
  | "replay_prolnuti"
  | "odchod_navstevy";

/** Kategorie místa odchodu návštěvníka ze stránky */
export type KategorieOdchoduNavstevy = "pribeh" | "chci_se_vracet" | "ostatni";

export interface ChovaniNavstevObdobiSouhrn {
  pocetNavstev: number;
  prumerDelkaMs: number;
  odchodPribeh: number;
  odchodChciSeVracet: number;
  odchodOstatni: number;
}

export interface ChovaniNavstevnikuSouhrn {
  celkem: ChovaniNavstevObdobiSouhrn;
  poslednich7Dni: ChovaniNavstevObdobiSouhrn;
}

/** Payload pro záznam metriky */
export interface PayloadMetriky {
  typ: TypUdalostiMetriky;
  polozkaId?: string;
  navstevnikId?: string;
  zdroj?: ZdrojNavstevnika;
  zarizeni?: TypZarizeni;
  /** Délka návštěvy v ms – u odchod_navstevy */
  delkaMs?: number;
  /** Odkud návštěvník odešel – u odchod_navstevy */
  odchod?: KategorieOdchoduNavstevy;
}

/** Dávka metrik z klienta */
export interface PayloadMetrikyBatch {
  udalosti: PayloadMetriky[];
}

/** Vzkaz návštěvníka pro Třeboň – bez jména a e-mailu */
export interface VzkazTreboni {
  id: string;
  text: string;
  vytvoreno: string;
}

/** Diagnostika Blob úložiště (serializovatelná pro klienta) */
export interface DiagnozaBlob {
  trvaleUloziste: boolean;
  maAutentizaci: boolean;
  lzeZalohovat: boolean;
  zalohaDoBlobu: boolean;
  jeBuild: boolean;
  prostredi: { vercel: boolean; nodeEnv: string };
  promenne: {
    BLOB_STORE_ID: boolean;
    BLOB_READ_WRITE_TOKEN: boolean;
    VERCEL_OIDC_TOKEN: boolean;
    OIDC_Z_HEADERU: boolean;
  };
  nahledStoreId: string | null;
  doporuceni: string | null;
}

/** Data administrace načtená na serveru */
export interface AdminData {
  polozky: Polozka[];
  metriky: MetrikySouhrn;
  komunita: KomunitaSouhrn;
  analytics: AnalyticsSouhrn;
  pocetPushOdberu: number;
  trvaleUloziste: boolean;
  lzeVytvoritZalohu: boolean;
  diagnoza: DiagnozaBlob;
  prolnutiCasovani: ProlnutiCasovaniNastaveni;
  desktopPozvankaFotografie: string | null;
  desktopPozvankaFotografieUrl: string;
  vzkazyTreboni: VzkazTreboni[];
  chovaniNavstevniku: ChovaniNavstevnikuSouhrn;
}

/** Chyby při načítání jednotlivých částí administrace */
export interface AdminChyby {
  uloziste?: string;
  polozky?: string;
  metriky?: string;
  vzkazyTreboni?: string;
}

/** Výsledek načtení administrace – data jsou vždy k dispozici, chyby odděleně */
export interface AdminVysledek {
  data: AdminData;
  chyby: AdminChyby;
}
