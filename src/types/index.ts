/**
 * Typy obsahu – architektura připravena pro budoucí video.
 * První verze používá pouze fotografie.
 */
import type { ZdrojNavstevnika } from "@/lib/zdroj-navstev";
import type { TypZarizeni } from "@/lib/zarizeni-navstevnika";

export type { ZdrojNavstevnika, TypZarizeni };
export type TypObsahu = "fotografie" | "video";

/** Položka galerie – fotografie nebo video */
export interface Polozka {
  id: string;
  typ: TypObsahu;
  /** URL souboru (Blob) nebo název souboru v /public/uploads */
  soubor: string;
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
  url: string;
  popis: string;
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
}

/** Typy událostí pro měření návratů */
export type TypUdalostiMetriky =
  | "navsteva"
  | "zobrazeni_fotografie"
  | "sdileni_fotografie"
  | "posun_vpred"
  | "navrat_zpet"
  | "klik_chci_se_vracet"
  | "povoleno_upozorneni";

/** Payload pro záznam metriky */
export interface PayloadMetriky {
  typ: TypUdalostiMetriky;
  polozkaId?: string;
  navstevnikId?: string;
  zdroj?: ZdrojNavstevnika;
  zarizeni?: TypZarizeni;
}

/** Dávka metrik z klienta */
export interface PayloadMetrikyBatch {
  udalosti: PayloadMetriky[];
}

/** Diagnostika Blob úložiště (serializovatelná pro klienta) */
export interface DiagnozaBlob {
  trvaleUloziste: boolean;
  maAutentizaci: boolean;
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
  analytics: AnalyticsSouhrn;
  pocetPushOdberu: number;
  trvaleUloziste: boolean;
  diagnoza: DiagnozaBlob;
}

/** Chyby při načítání jednotlivých částí administrace */
export interface AdminChyby {
  uloziste?: string;
  polozky?: string;
  metriky?: string;
}

/** Výsledek načtení administrace – data jsou vždy k dispozici, chyby odděleně */
export interface AdminVysledek {
  data: AdminData;
  chyby: AdminChyby;
}
