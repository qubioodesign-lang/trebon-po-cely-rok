"use server";

import { revalidatePath } from "next/cache";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import type { BranaKonkretniUdalost } from "@/lib/brana/admin/konkretni-udalost";
import {
  nastavitPosledniScanDokoncen,
  pridatRucniKonkretniUdalost,
} from "@/lib/brana/admin/konkretni-udalosti-uloziste";
import { ulozitRedakcniPoradi } from "@/lib/brana/admin/redakcni-poradi-uloziste";
import { validovatRedakcniPoradiVstup } from "@/lib/brana/admin/redakcni-poradi-validace";
import type { BranaRedakcniPolozkaStav } from "@/lib/brana/admin/redakcni-kostra";
import { validovatRucniUdalostVstup } from "@/lib/brana/admin/rucni-udalost-validace";

export type BranaRedakcniUlozitVysledek =
  | { uspech: true; polozky: BranaRedakcniPolozkaStav[] }
  | { uspech: false; chyba: string };

export type BranaRucniUdalostVysledek =
  | { uspech: true; udalost: BranaKonkretniUdalost }
  | { uspech: false; chyba: string };

export type BranaScanStavVysledek =
  | { uspech: true }
  | { uspech: false; chyba: string };

/** Uloží celé redakční pořadí – pouze pro přihlášeného admina */
export async function ulozitBranaRedakcniPoradiAkce(
  polozky: unknown,
): Promise<BranaRedakcniUlozitVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  const validace = validovatRedakcniPoradiVstup(polozky);
  if (!validace.ok) {
    return { uspech: false, chyba: validace.chyba };
  }

  try {
    await ulozitRedakcniPoradi(validace.polozky);
    revalidatePath("/brana/admin/sprava/redakcni-poradi");
    return { uspech: true, polozky: validace.polozky };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Změny se neuložily.",
    };
  }
}

/** Označí poslední scan jako dokončený – odemkne ruční zápis v Kalendáři */
export async function oznacitPosledniScanDokoncenAkce(): Promise<BranaScanStavVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  try {
    await nastavitPosledniScanDokoncen(true);
    revalidatePath("/brana/admin/sprava/kalendar");
    return { uspech: true };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Stav scanu se nepodařilo uložit.",
    };
  }
}

/** Přidá ruční konkrétní událost do Kalendáře */
export async function pridatRucniKonkretniUdalostAkce(
  vstup: unknown,
): Promise<BranaRucniUdalostVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  const validace = validovatRucniUdalostVstup(vstup);
  if (!validace.ok) {
    return { uspech: false, chyba: validace.chyba };
  }

  try {
    const udalost = await pridatRucniKonkretniUdalost(validace.udalost);
    revalidatePath("/brana/admin/sprava/kalendar");
    return { uspech: true, udalost };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Událost se neuložila.",
    };
  }
}
