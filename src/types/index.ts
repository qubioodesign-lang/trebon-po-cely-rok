/**
 * Typy obsahu – architektura připravena pro budoucí video.
 * První verze používá pouze fotografie.
 */
export type TypObsahu = "fotografie" | "video";

/** Položka galerie – fotografie nebo video */
export interface Polozka {
  id: string;
  typ: TypObsahu;
  /** Relativní cesta k souboru v /public/uploads */
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

/** Typy událostí pro měření návratů */
export type TypUdalostiMetriky =
  | "navsteva"
  | "zobrazeni_fotografie"
  | "posun_vpred"
  | "navrat_zpet"
  | "klik_chci_se_vracet"
  | "povoleno_upozorneni";

/** Payload pro záznam metriky */
export interface PayloadMetriky {
  typ: TypUdalostiMetriky;
  polozkaId?: string;
  navstevnikId?: string;
}
