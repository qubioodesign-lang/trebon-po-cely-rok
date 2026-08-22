/**
 * Schéma ruční zálohy BRÁNY (ZIP v PRIVATE admin Blob store).
 * Oddělené od trebon-backup i od veřejného Blob Třeboně.
 */

export const BRANA_ZALOHA_SCHEMA = "brana-backup" as const;
export const BRANA_ZALOHA_VERZE = 1;
export const BRANA_ZALOHA_PREFIX = "backups/brana/manual/";

/** Verze kalendářního dokumentu v záloze – musí odpovídat živému Blobu. */
export const BRANA_ZALOHA_KALENDAR_VERZE = 1;
/** Verze redakčního pořadí v záloze – prioritní seznam (živá verze 2). */
export const BRANA_ZALOHA_REDAKCNI_VERZE = 2;

export const BRANA_ZALOHA_SOUBORY = [
  "data/brana-konkretni-udalosti.json",
  "data/brana-redakcni-poradi.json",
  "data/brana-zdroje.json",
  "data/brana-upozorneni-nastaveni.json",
  "data/brana-nezarazene.json",
] as const;

export type BranaZalohaSoubor = (typeof BRANA_ZALOHA_SOUBORY)[number];

export type BranaZalohaTyp = "manual" | "zachrana";

export type BranaZalohaManifest = {
  schema: typeof BRANA_ZALOHA_SCHEMA;
  version: typeof BRANA_ZALOHA_VERZE;
  vytvoreno: string;
  typ: BranaZalohaTyp;
};

export type BranaZalohaInfo = {
  pathname: string;
  velikost: number;
  vytvoreno: string;
  nazev: string;
  typ: BranaZalohaTyp;
};

/** Texty JSON dokumentů v ZIP (klíč = cesta uvnitř archivu = Blob pathname). */
export type BranaZalohaDokumentyTexty = Record<BranaZalohaSoubor, string>;
