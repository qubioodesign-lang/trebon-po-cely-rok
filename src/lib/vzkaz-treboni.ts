import "server-only";

import { randomUUID } from "crypto";
import type { VzkazTreboni } from "@/types";
import type { UlozisteDat } from "./uloziste-dat";
import { upravitData } from "./uloziste-dat";

export const MAX_DELKA_VZKAZU = 200;

export type { VzkazTreboni };

export function normalizovatVzkazy(uloziste: UlozisteDat): VzkazTreboni[] {
  return uloziste.vzkazyTreboni ?? [];
}

export function seraditVzkazyOdNejnovejsich(vzkazy: VzkazTreboni[]): VzkazTreboni[] {
  return [...vzkazy].sort((a, b) => b.vytvoreno.localeCompare(a.vytvoreno));
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

export async function pridatVzkaz(
  text: string,
  oidcZHeaderu?: string | null
): Promise<void> {
  const vycisteny = overitTextVzkazu(text);
  const id = randomUUID();
  const vytvoreno = new Date().toISOString();

  await upravitData((uloziste) => {
    if (!uloziste.vzkazyTreboni) {
      uloziste.vzkazyTreboni = [];
    }

    uloziste.vzkazyTreboni.unshift({ id, text: vycisteny, vytvoreno });
  }, oidcZHeaderu);
}

export async function smazatVzkaz(
  id: string,
  oidcZHeaderu?: string | null
): Promise<void> {
  await upravitData(
    (uloziste) => {
      uloziste.vzkazyTreboni = (uloziste.vzkazyTreboni ?? []).filter(
        (vzkaz) => vzkaz.id !== id
      );
    },
    oidcZHeaderu,
    {
      overitPoUlozeni: (uloziste) =>
        !(uloziste.vzkazyTreboni ?? []).some((vzkaz) => vzkaz.id === id),
      chybovaZprava: "Vzkaz se nepodařilo smazat – zkuste to znovu.",
    }
  );
}
