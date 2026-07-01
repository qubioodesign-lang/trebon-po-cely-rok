import "server-only";

import { randomUUID } from "crypto";
import type { VzkazTreboni } from "@/types";
import type { UlozisteDat } from "./uloziste-dat";
import { upravitData } from "./uloziste-dat";
import {
  nacistVsechnyVzkazyZeSouboru,
  smazatVzkazSoubor,
  ulozitVzkazSoubor,
} from "./vzkaz-treboni-uloziste";

export const MAX_DELKA_VZKAZU = 200;

export type { VzkazTreboni };

export function normalizovatVzkazy(uloziste: UlozisteDat): VzkazTreboni[] {
  return uloziste.vzkazyTreboni ?? [];
}

export function seraditVzkazyOdNejnovejsich(vzkazy: VzkazTreboni[]): VzkazTreboni[] {
  return [...vzkazy].sort((a, b) => b.vytvoreno.localeCompare(a.vytvoreno));
}

function sloucitVzkazy(
  zeSouboru: VzkazTreboni[],
  legacy: VzkazTreboni[]
): VzkazTreboni[] {
  const mapa = new Map<string, VzkazTreboni>();

  for (const vzkaz of legacy) {
    mapa.set(vzkaz.id, vzkaz);
  }

  for (const vzkaz of zeSouboru) {
    mapa.set(vzkaz.id, vzkaz);
  }

  return Array.from(mapa.values());
}

function overitTextVzkazu(text: string): string {
  const vycisteny = text.trim();

  if (!vycisteny) {
    throw new Error("Vzkaz je prázdný");
  }

  if (vycisteny.length > MAX_DELKA_VZKAZU) {
    throw new Error(`Vzkaz může mít nejvýše ${MAX_DELKA_VZKAZU} znaků`);
  }

  return vycisteny;
}

/** Načte vzkazy z odděleného úložiště a sloučí se staršími záznamy z metadata JSON */
export async function nacistVsechnyVzkazy(
  oidcZHeaderu?: string | null,
  legacy: VzkazTreboni[] = []
): Promise<VzkazTreboni[]> {
  const zeSouboru = await nacistVsechnyVzkazyZeSouboru(oidcZHeaderu);
  return sloucitVzkazy(zeSouboru, legacy);
}

/** Uloží vzkaz jako samostatný soubor – bez sdíleného JSON s metrikami */
export async function pridatVzkaz(
  text: string,
  oidcZHeaderu?: string | null
): Promise<void> {
  const vycisteny = overitTextVzkazu(text);
  const vzkaz: VzkazTreboni = {
    id: randomUUID(),
    text: vycisteny,
    vytvoreno: new Date().toISOString(),
  };

  await ulozitVzkazSoubor(vzkaz, oidcZHeaderu);
}

async function odstranitLegacyVzkaz(
  id: string,
  oidcZHeaderu?: string | null
): Promise<void> {
  await upravitData((uloziste) => {
    if (!uloziste.vzkazyTreboni?.length) {
      return;
    }

    uloziste.vzkazyTreboni = uloziste.vzkazyTreboni.filter(
      (vzkaz) => vzkaz.id !== id
    );
  }, oidcZHeaderu);
}

/** Smaže soubor vzkazu a případný starší záznam v metadata JSON */
export async function smazatVzkaz(
  id: string,
  oidcZHeaderu?: string | null
): Promise<void> {
  await smazatVzkazSoubor(id, oidcZHeaderu);

  try {
    await odstranitLegacyVzkaz(id, oidcZHeaderu);
  } catch {
    // Legacy metadata není kritické pro smazání samostatného souboru
  }
}
