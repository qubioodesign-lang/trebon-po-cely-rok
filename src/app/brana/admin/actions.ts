"use server";

import { revalidatePath } from "next/cache";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import type { BranaKonkretniUdalost } from "@/lib/brana/admin/konkretni-udalost";
import {
  nastavitPosledniScanDokoncen,
  pridatRucniKonkretniUdalost,
  smazatRucniKonkretniUdalost,
  upravitRucniKonkretniUdalost,
} from "@/lib/brana/admin/konkretni-udalosti-uloziste";
import { ulozitRedakcniPoradi } from "@/lib/brana/admin/redakcni-poradi-uloziste";
import { validovatRedakcniPoradiVstup } from "@/lib/brana/admin/redakcni-poradi-validace";
import type { BranaRedakcniPolozkaStav } from "@/lib/brana/admin/redakcni-kostra";
import { validovatRucniUdalostVstup } from "@/lib/brana/admin/rucni-udalost-validace";
import type { BranaDlouhodobyIntervalDni, BranaZdroj } from "@/lib/brana/admin/zdroj";
import {
  ulozitDlouhodobyIntervalDni,
  validovatDlouhodobyIntervalVstup,
} from "@/lib/brana/admin/zdroje-nastaveni-uloziste";
import {
  pridatZdroj,
  smazatZdroj,
  upravitZdroj,
} from "@/lib/brana/admin/zdroje-uloziste";

export type BranaRedakcniUlozitVysledek =
  | { uspech: true; polozky: BranaRedakcniPolozkaStav[] }
  | { uspech: false; chyba: string };

export type BranaRucniUdalostVysledek =
  | { uspech: true; udalost: BranaKonkretniUdalost }
  | { uspech: false; chyba: string };

export type BranaScanStavVysledek =
  | { uspech: true }
  | { uspech: false; chyba: string };

export type BranaZdrojeIntervalVysledek =
  | { uspech: true; dlouhodobyIntervalDni: BranaDlouhodobyIntervalDni }
  | { uspech: false; chyba: string };

export type BranaZdrojAkceVysledek =
  | { uspech: true; zdroj: BranaZdroj }
  | { uspech: false; chyba: string };

export type BranaZdrojSmazatVysledek =
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

/** Aktualizuje existující ruční událost – stejné id, bez kopie */
export async function upravitRucniKonkretniUdalostAkce(
  id: string,
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
    const udalost = await upravitRucniKonkretniUdalost(id, validace.udalost);
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

/** Smaže jednu ruční událost podle id */
export async function smazatRucniKonkretniUdalostAkce(
  id: string,
): Promise<BranaScanStavVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  try {
    await smazatRucniKonkretniUdalost(id);
    revalidatePath("/brana/admin/sprava/kalendar");
    return { uspech: true };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Událost se nepodařilo smazat.",
    };
  }
}

/** Uloží společný interval kontroly dlouhodobých zdrojů (14 / 21 / 30) */
export async function ulozitBranaZdrojeDlouhodobyIntervalAkce(
  interval: unknown,
): Promise<BranaZdrojeIntervalVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  const validace = validovatDlouhodobyIntervalVstup(interval);
  if (!validace.ok) {
    return { uspech: false, chyba: validace.chyba };
  }

  try {
    const dokument = await ulozitDlouhodobyIntervalDni(
      validace.dlouhodobyIntervalDni,
    );
    revalidatePath("/brana/admin/sprava/zdroje");
    return {
      uspech: true,
      dlouhodobyIntervalDni: dokument.dlouhodobyIntervalDni,
    };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Interval se nepodařilo uložit.",
    };
  }
}

/** Přidá známý zdroj do produkčního seznamu */
export async function pridatBranaZdrojAkce(
  vstup: unknown,
): Promise<BranaZdrojAkceVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  try {
    const zdroj = await pridatZdroj(vstup);
    revalidatePath("/brana/admin/sprava/zdroje");
    return { uspech: true, zdroj };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Zdroj se neuložil.",
    };
  }
}

/** Upraví existující známý zdroj – stejné id */
export async function upravitBranaZdrojAkce(
  id: string,
  vstup: unknown,
): Promise<BranaZdrojAkceVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  try {
    const zdroj = await upravitZdroj(id, vstup);
    revalidatePath("/brana/admin/sprava/zdroje");
    return { uspech: true, zdroj };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Zdroj se neuložil.",
    };
  }
}

/** Smaže jeden známý zdroj podle id */
export async function smazatBranaZdrojAkce(
  id: string,
): Promise<BranaZdrojSmazatVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  try {
    await smazatZdroj(id);
    revalidatePath("/brana/admin/sprava/zdroje");
    return { uspech: true };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Zdroj se nepodařilo smazat.",
    };
  }
}
