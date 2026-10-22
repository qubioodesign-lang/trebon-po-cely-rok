import type { Polozka } from "@/types";
import { ziskatSouboryPolozky, normalizovatSouboryProlnuti } from "./polozka-soubory";
import {
  jePlatnyPocetSnimkuProlnuti,
  viditelnostNovehoProlnuti,
} from "./prolnuti-snimky";
import {
  vysledekPridaniProlnuti,
  type StavRotacePolozek,
} from "./rotace-prolnuti";

/**
 * UUID, které prohlížeč posílá jako `operaceId`.
 * Stejná hodnota se použije jako `id` položky, aby opakované doručení
 * i opakovaný pokus zápisu nesly jedno prolnutí.
 */
const UUID_OPERACE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Operace už má v úložišti jiné prolnutí. Zápis se nesmí opakovat ani přepsat. */
export class ObsazenaOperaceProlnutiError extends Error {
  readonly bezOpakovani = true;

  constructor() {
    super("Identifikátor operace už patří jinému prolnutí.");
    this.name = "ObsazenaOperaceProlnutiError";
  }
}

export function stabilniIdOperaceProlnuti(
  operaceId: string | null | undefined,
  noveId: () => string
): string {
  const text = operaceId?.trim() ?? "";
  if (UUID_OPERACE.test(text)) return text;
  return noveId();
}

export interface ZadostVytvoreniProlnuti {
  id: string;
  soubory: string[];
  popis: string;
  datumPorizeni?: string | null;
  aktivni?: boolean;
  /** Stejné pro všechny pokusy jedné operace. */
  datumPublikace: string;
}

export type VysledekVytvoreniProlnuti =
  | { stav: "vlozeno"; polozka: Polozka; uloziste: StavRotacePolozek }
  | { stav: "uz-existuje"; polozka: Polozka };

function jeStejneUlozeneProlnuti(polozka: Polozka, soubory: string[]): boolean {
  if (polozka.typ !== "prolnuti") return false;
  const ulozene = normalizovatSouboryProlnuti(polozka.soubory ?? []);
  if (ulozene.length !== soubory.length) return false;
  return soubory.every((cesta, index) => ulozene[index] === cesta);
}

function chybaBezOpakovani(zprava: string): Error {
  const error = new Error(zprava);
  (error as Error & { bezOpakovani?: boolean }).bezOpakovani = true;
  return error;
}

/**
 * Vloží prolnutí, nebo vrátí už uložené se stejným ID.
 * Při kolizi ID s jiným obsahem nic nemění a odmítne další pokus.
 */
export function vysledekVytvoreniProlnuti(
  ulozene: Polozka[],
  rotaceOd: string | null | undefined,
  zadost: ZadostVytvoreniProlnuti,
  nowMs: number
): VysledekVytvoreniProlnuti {
  const soubory = normalizovatSouboryProlnuti(zadost.soubory);
  if (!jePlatnyPocetSnimkuProlnuti(soubory.length)) {
    throw chybaBezOpakovani("Prolnutí musí mít 2 nebo 3 fotografie");
  }

  const existujici = ulozene.find((polozka) => polozka.id === zadost.id);
  if (existujici) {
    if (!jeStejneUlozeneProlnuti(existujici, soubory)) {
      throw new ObsazenaOperaceProlnutiError();
    }
    return { stav: "uz-existuje", polozka: existujici };
  }

  const minPoradi = ulozene.reduce(
    (min, polozka) => Math.min(min, polozka.poradi),
    Infinity
  );
  const nova: Polozka = {
    id: zadost.id,
    typ: "prolnuti",
    soubory,
    popis: zadost.popis,
    datumPorizeni: zadost.datumPorizeni ?? null,
    datumPublikace: zadost.datumPublikace,
    poradi: minPoradi === Infinity ? 0 : minPoradi - 1,
    aktivni: viditelnostNovehoProlnuti(zadost.aktivni),
  };

  return {
    stav: "vlozeno",
    polozka: nova,
    uloziste: vysledekPridaniProlnuti(ulozene, rotaceOd, nova, nowMs),
  };
}

/**
 * Cesty, které smí mazání smazat.
 * Bez načteného úložiště nevrátí nic – soubor raději zůstane.
 */
export function souboryBezpecneKeSmazani(
  uloziste: { polozky: readonly Polozka[] } | null | undefined,
  cesty: readonly string[]
): string[] {
  if (!uloziste) return [];

  const pouzite = new Set<string>();
  for (const polozka of uloziste.polozky) {
    for (const cesta of ziskatSouboryPolozky(polozka)) {
      pouzite.add(cesta);
    }
  }

  const volne: string[] = [];
  const videne = new Set<string>();
  for (const cesta of cesty) {
    if (typeof cesta !== "string") continue;
    const text = cesta.trim();
    if (!text || pouzite.has(text) || videne.has(text)) continue;
    videne.add(text);
    volne.push(text);
  }
  return volne;
}
