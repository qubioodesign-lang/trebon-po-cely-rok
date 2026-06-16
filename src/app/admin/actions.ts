"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  jeAdminPrihlasen,
  overitHeslo,
  vytvoritSessionToken,
  nastavitSessionCookie,
  smazatSessionCookie,
} from "@/lib/autentizace";
import {
  vytvoritPolozku,
  aktualizovatPopis,
  prepnoutAktivni,
  smazatPolozku,
  zmenitPoradi,
} from "@/lib/polozky";
import { ulozitSoubor, smazatSoubor } from "@/lib/soubory";

async function ziskatOidcZHeaderu(): Promise<string | null> {
  const hlavicky = await headers();
  return hlavicky.get("x-vercel-oidc-token");
}

async function vyzadovatAdmina(): Promise<string | null> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Neautorizováno");
  }
  return ziskatOidcZHeaderu();
}

export async function prihlasitAdmin(heslo: string) {
  if (!overitHeslo(heslo)) {
    return { chyba: "Neplatné heslo" as const };
  }

  const token = await vytvoritSessionToken();
  await nastavitSessionCookie(token);
  revalidatePath("/admin");
  return { uspech: true as const };
}

export async function odhlasitAdmin() {
  await smazatSessionCookie();
  revalidatePath("/admin");
}

export async function nahrátPolozku(formData: FormData) {
  const oidcHeader = await vyzadovatAdmina();

  try {
    const soubor = formData.get("soubor") as File | null;
    const popis = (formData.get("popis") as string) ?? "";
    const datumPorizeni = (formData.get("datumPorizeni") as string) || null;

    if (!soubor || soubor.size === 0) {
      return { chyba: "Soubor je povinný" };
    }

    const { cestaSouboru, typ } = await ulozitSoubor(soubor, oidcHeader);
    await vytvoritPolozku(
      { typ, soubor: cestaSouboru, popis, datumPorizeni },
      oidcHeader
    );

    revalidatePath("/admin");
    return { uspech: true as const };
  } catch (error) {
    const zprava =
      error instanceof Error ? error.message : "Chyba při nahrávání";
    return { chyba: zprava };
  }
}

export async function prepnoutAktivniPolozky(id: string, aktivni: boolean) {
  const oidcHeader = await vyzadovatAdmina();
  await prepnoutAktivni(id, aktivni, oidcHeader);
  revalidatePath("/admin");
}

export async function smazatPolozkuAdmin(id: string) {
  const oidcHeader = await vyzadovatAdmina();
  const smazana = await smazatPolozku(id, oidcHeader);
  if (smazana) {
    await smazatSoubor(smazana.soubor, oidcHeader);
  }
  revalidatePath("/admin");
}

export async function zmenitPopisPolozky(id: string, popis: string) {
  const oidcHeader = await vyzadovatAdmina();
  await aktualizovatPopis(id, popis, oidcHeader);
  revalidatePath("/admin");
}

export async function zmenitPoradiPolozek(poradiIds: string[]) {
  const oidcHeader = await vyzadovatAdmina();
  await zmenitPoradi(poradiIds, oidcHeader);
  revalidatePath("/admin");
}
