import "server-only";

import { randomUUID } from "crypto";
import type { VzkazTreboni } from "@/types";
import type { UlozisteDat } from "./uloziste-dat";
import { nacistDataCerstve, upravitData } from "./uloziste-dat";

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

const MAX_POKUSU_OVERENI_VZKAZU = 20;

function cekatNaOvereniVzkazu(pokus: number): Promise<void> {
  const ms = Math.min(100 * 2 ** pokus, 3000);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Ověří jen skutečnou přítomnost vzkazu v úložišti – bez ohledu na verzi metadata */
async function overitVzkazUlozen(
  id: string,
  jeUlozen: (uloziste: UlozisteDat) => boolean,
  oidcZHeaderu?: string | null
): Promise<boolean> {
  for (let pokus = 0; pokus < MAX_POKUSU_OVERENI_VZKAZU; pokus++) {
    try {
      const uloziste = await nacistDataCerstve(oidcZHeaderu, { bypassCache: true });
      if (jeUlozen(uloziste)) {
        return true;
      }
    } catch {
      // CDN nebo síť – zkusíme znovu
    }

    await cekatNaOvereniVzkazu(pokus);
  }

  return false;
}

export async function pridatVzkaz(
  text: string,
  oidcZHeaderu?: string | null
): Promise<void> {
  const vycisteny = overitTextVzkazu(text);
  const id = randomUUID();
  const vytvoreno = new Date().toISOString();

  const vlozitVzkaz = (uloziste: UlozisteDat) => {
    if (!uloziste.vzkazyTreboni) {
      uloziste.vzkazyTreboni = [];
    }

    const uzExistuje = uloziste.vzkazyTreboni.some((vzkaz) => vzkaz.id === id);
    if (!uzExistuje) {
      uloziste.vzkazyTreboni.unshift({ id, text: vycisteny, vytvoreno });
    }
  };

  const jeUlozen = (uloziste: UlozisteDat) =>
    (uloziste.vzkazyTreboni ?? []).some((vzkaz) => vzkaz.id === id);

  try {
    await upravitData(vlozitVzkaz, oidcZHeaderu, {
      overitPoUlozeni: jeUlozen,
      maxPokusu: 12,
    });
    return;
  } catch {
    // Chyba verze nebo metadata neznamená neúspěch – rozhoduje jen skutečné uložení
  }

  if (await overitVzkazUlozen(id, jeUlozen, oidcZHeaderu)) {
    return;
  }

  throw new Error("Vzkaz se nepodařilo uložit");
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
