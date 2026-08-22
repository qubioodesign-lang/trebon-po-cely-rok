/**
 * Sestavení a parsování ZIP schématu brana-backup v1.
 * Bez Blob I/O a bez server-only – ověřitelné v paměti.
 */

import { strToU8, unzipSync, zipSync } from "fflate";
import { parsovatAValidovatDokumentyZalohy, type BranaZalohaDokumenty } from "./validace";
import {
  parsovatBranaZalohaManifest,
  prectiTextZZip,
} from "./pomocne";
import {
  BRANA_ZALOHA_SCHEMA,
  BRANA_ZALOHA_SOUBORY,
  BRANA_ZALOHA_VERZE,
  type BranaZalohaDokumentyTexty,
  type BranaZalohaManifest,
  type BranaZalohaTyp,
} from "./typy";

const ZAKAZANE_CASTI_CESTY = [
  "brana-radar",
  "brana-zdroje-nastaveni",
  "uloziste.json",
  "sw.js",
  "manifest.webmanifest",
  "vercel.json",
  "divadlo-jk-tyla-itrebon",
] as const;

const POVOLENE_CESTY = new Set<string>([
  "manifest.json",
  ...BRANA_ZALOHA_SOUBORY,
]);

function normalizovatZipCestu(cesta: string): string {
  return cesta.replace(/\\/g, "/").replace(/^\.?\//, "");
}

function assertCestaPovolena(cesta: string): void {
  const normalizovana = normalizovatZipCestu(cesta);
  if (
    normalizovana.includes("..") ||
    normalizovana.startsWith("/") ||
    normalizovana.includes("\0")
  ) {
    throw new Error("Neplatná záloha – zakázaná cesta v ZIP.");
  }

  const male = normalizovana.toLowerCase();
  for (const zakazana of ZAKAZANE_CASTI_CESTY) {
    if (male.includes(zakazana)) {
      throw new Error(
        `Neplatná záloha – ZIP nesmí obsahovat ${zakazana}.`,
      );
    }
  }

  if (normalizovana.endsWith("/")) {
    return;
  }

  if (!POVOLENE_CESTY.has(normalizovana)) {
    throw new Error(
      `Neplatná záloha – neočekávaný soubor ${normalizovana}.`,
    );
  }
}

export function sestavitBranaZalohuZip(args: {
  typ: BranaZalohaTyp;
  vytvoreno?: string;
  dokumenty: BranaZalohaDokumentyTexty;
}): Uint8Array {
  const vytvoreno = args.vytvoreno ?? new Date().toISOString();
  const manifest: BranaZalohaManifest = {
    schema: BRANA_ZALOHA_SCHEMA,
    version: BRANA_ZALOHA_VERZE,
    vytvoreno,
    typ: args.typ,
  };

  const souboryZip: Record<string, Uint8Array> = {
    "manifest.json": strToU8(JSON.stringify(manifest, null, 2)),
  };

  for (const cesta of BRANA_ZALOHA_SOUBORY) {
    const text = args.dokumenty[cesta];
    if (typeof text !== "string" || text.trim().length === 0) {
      throw new Error(`Záloha nemůže vzniknout – chybí ${cesta}.`);
    }
    JSON.parse(text);
    souboryZip[cesta] = strToU8(text);
  }

  return zipSync(souboryZip, { level: 6 });
}

export type ParsovanaBranaZaloha = {
  manifest: BranaZalohaManifest;
  texty: BranaZalohaDokumentyTexty;
  dokumenty: BranaZalohaDokumenty;
};

export function parsovatBranaZalohuZip(zip: Uint8Array): ParsovanaBranaZaloha {
  let polozky: Record<string, Uint8Array>;
  try {
    polozky = unzipSync(zip);
  } catch {
    throw new Error("Neplatná záloha – soubor není čitelný ZIP.");
  }

  const normalizovane: Record<string, Uint8Array> = {};
  for (const [cesta, data] of Object.entries(polozky)) {
    const normalizovana = normalizovatZipCestu(cesta);
    assertCestaPovolena(normalizovana);
    if (normalizovana.endsWith("/")) {
      continue;
    }
    normalizovane[normalizovana] = data;
  }

  const manifest = parsovatBranaZalohaManifest(
    prectiTextZZip(normalizovane, "manifest.json"),
  );

  const texty = {} as BranaZalohaDokumentyTexty;
  for (const cesta of BRANA_ZALOHA_SOUBORY) {
    texty[cesta] = prectiTextZZip(normalizovane, cesta);
  }

  const dokumenty = parsovatAValidovatDokumentyZalohy(texty);

  return { manifest, texty, dokumenty };
}

/** In-memory obnova: vrátí dokumenty, které by šly zapsat. Bez Blob WRITE. */
export function simulovatObnovuBranaZalohy(
  zip: Uint8Array,
): BranaZalohaDokumenty {
  return parsovatBranaZalohuZip(zip).dokumenty;
}
