"use server";

import { jeAdminPrihlasen } from "@/lib/autentizace";
import { odeslatTrebonTestovaciUpozorneni } from "@/lib/trebon-spravce-upozorneni-odeslani";
import {
  nacistTrebonSpravceUpozorneni,
  ulozitTrebonSpravceSubscription,
  vypnoutTrebonSpravceUpozorneni,
} from "@/lib/trebon-spravce-upozorneni-uloziste";
import type { TrebonTestovaciPushVysledek } from "@/lib/trebon-spravce-upozorneni";

export type TrebonSpravceUpozorneniUi = {
  upozorneniAktivni: boolean;
};

export type TrebonSpravceUpozorneniVysledek =
  | { uspech: true; ui: TrebonSpravceUpozorneniUi }
  | { uspech: false; chyba: string };

function uiZDokumentu(dokument: {
  upozorneniAktivni: boolean;
}): TrebonSpravceUpozorneniUi {
  return { upozorneniAktivni: dokument.upozorneniAktivni };
}

export async function nacistTrebonSpravceUpozorneniAkce(): Promise<TrebonSpravceUpozorneniVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }
  const nacteno = await nacistTrebonSpravceUpozorneni();
  if (!nacteno.ok) {
    return { uspech: false, chyba: "Nastavení upozornění se nepodařilo načíst." };
  }
  return { uspech: true, ui: uiZDokumentu(nacteno.dokument) };
}

export async function ulozitTrebonSpravceSubscriptionAkce(
  subscription: unknown,
): Promise<TrebonSpravceUpozorneniVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }
  try {
    const dokument = await ulozitTrebonSpravceSubscription(subscription);
    return { uspech: true, ui: uiZDokumentu(dokument) };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Upozornění se nepodařilo zapnout.",
    };
  }
}

export async function vypnoutTrebonSpravceUpozorneniAkce(): Promise<TrebonSpravceUpozorneniVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }
  try {
    const dokument = await vypnoutTrebonSpravceUpozorneni();
    return { uspech: true, ui: uiZDokumentu(dokument) };
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : null;
    return {
      uspech: false,
      chyba: detail ?? "Upozornění se nepodařilo vypnout.",
    };
  }
}

/** Jeden testovací push na správcovský odběr Třeboně. Vzkaz nevytváří. */
export async function odeslatTrebonTestovaciUpozorneniAkce(): Promise<TrebonTestovaciPushVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { uspech: false, chyba: "Nejste přihlášeni." };
  }
  return odeslatTrebonTestovaciUpozorneni();
}
