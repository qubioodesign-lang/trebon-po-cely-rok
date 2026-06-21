export const ZALOHA_SCHEMA = "trebon-backup" as const;
export const ZALOHA_VERZE = 1;
export const ZALOHA_PREFIX = "backups/manual/";

/** Manifest uvnitř ZIP zálohy */
export interface ManifestZalohy {
  schema: typeof ZALOHA_SCHEMA;
  version: number;
  vytvoreno: string;
  typ: "manual";
  souhrn: {
    polozky: number;
    soubory: number;
    pushOdbery: number;
    maMetriky: boolean;
  };
}

/** Netajná nastavení projektu ve záloze */
export interface NastaveniProjektuZalohy {
  vapidVerejnyKlic: string;
  vapidEmail: string;
  pushTitulek: string;
  pushText: string;
  schemaVerze: number;
}

/** Položka seznamu záloh v administraci */
export interface ZalohaInfo {
  pathname: string;
  url: string;
  velikost: number;
  vytvoreno: string;
  nazev: string;
}
