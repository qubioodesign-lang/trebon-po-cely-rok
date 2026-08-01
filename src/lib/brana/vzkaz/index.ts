import "server-only";

import { randomUUID } from "crypto";
import { BRANA_MAX_DELKA_VZKAZU } from "./konstanty";
import {
  nacistVsechnyBranaVzkazyZeSouboru,
  ulozitBranaVzkazSoubor,
} from "./uloziste";
import type { BranaVzkaz } from "./types";

export { BRANA_MAX_DELKA_VZKAZU, BRANA_VZKAZ_BLOB_PREFIX } from "./konstanty";
export type { BranaVzkaz } from "./types";

function overitTextVzkazu(text: string): string {
  const vycisteny = text.trim();

  if (!vycisteny) {
    throw new Error("Vzkaz je prázdný");
  }

  if (vycisteny.length > BRANA_MAX_DELKA_VZKAZU) {
    throw new Error(
      `Vzkaz může mít nejvýše ${BRANA_MAX_DELKA_VZKAZU} znaků`,
    );
  }

  return vycisteny;
}

export function seraditBranaVzkazyOdNejnovejsich(
  vzkazy: BranaVzkaz[],
): BranaVzkaz[] {
  return [...vzkazy].sort((a, b) => b.vytvoreno.localeCompare(a.vytvoreno));
}

/** Načte všechny vzkazy BRÁNY – připraveno pro budoucí administraci */
export async function nacistVsechnyBranaVzkazy(
  oidcZHeaderu?: string | null,
): Promise<BranaVzkaz[]> {
  return nacistVsechnyBranaVzkazyZeSouboru(oidcZHeaderu);
}

/** Uloží vzkaz BRÁNY jako samostatný soubor */
export async function pridatBranaVzkaz(
  text: string,
  oidcZHeaderu?: string | null,
): Promise<void> {
  const vycisteny = overitTextVzkazu(text);
  const vzkaz: BranaVzkaz = {
    id: randomUUID(),
    text: vycisteny,
    vytvoreno: new Date().toISOString(),
  };

  await ulozitBranaVzkazSoubor(vzkaz, oidcZHeaderu);
}
