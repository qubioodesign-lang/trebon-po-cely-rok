"use server";

import { revalidatePath } from "next/cache";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import { ulozitSkrytiAkciNaVikend } from "@/lib/brana/admin/akci-na-vikend-uloziste";
import {
  isoDenPrahy,
  konecAktualnihoOknaAkciNaVikend,
} from "@/lib/brana/sdileni-akci-na-vikend";

export type BranaAkciNaVikendSkrytiAkceVysledek =
  | { uspech: true; skrytoDo: string }
  | { uspech: false; chyba: string };

/**
 * Skryje sdělení jen do konce právě běžícího pondělního nebo čtvrtečního okna.
 * Mimo okno nezapíše nic. Park, kalendář ani Atmosféru nemění.
 */
export async function skrytAkciNaVikendDoKonceOknaAkce(): Promise<BranaAkciNaVikendSkrytiAkceVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }

  const okamzik = new Date();
  const konec = konecAktualnihoOknaAkciNaVikend(okamzik);
  if (!konec) {
    return {
      uspech: false,
      chyba: "Mimo pondělní a čtvrteční okno se sdělení skrýt nedá.",
    };
  }

  try {
    const skrytoDo = konec.toISOString();
    await ulozitSkrytiAkciNaVikend(skrytoDo, isoDenPrahy(okamzik));
    revalidatePath("/brana/admin/sprava/atmosfera");
    revalidatePath("/brana");
    return { uspech: true, skrytoDo };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Skrytí akcí na víkend se nepodařilo uložit.",
    };
  }
}
