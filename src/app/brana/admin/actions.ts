"use server";

import { revalidatePath } from "next/cache";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import { ulozitRedakcniPoradi } from "@/lib/brana/admin/redakcni-poradi-uloziste";
import { validovatRedakcniPoradiVstup } from "@/lib/brana/admin/redakcni-poradi-validace";
import type { BranaRedakcniPolozkaStav } from "@/lib/brana/admin/redakcni-kostra";

export type BranaRedakcniUlozitVysledek =
  | { uspech: true; polozky: BranaRedakcniPolozkaStav[] }
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
