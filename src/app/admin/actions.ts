"use server";

import { revalidatePath } from "next/cache";
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
import {
  ziskatOidcZRequestu,
  zpravaChybejiciBlobAutentizace,
} from "@/lib/admin-data";
import {
  maBlobAutentizaci,
  pouzivaBlobUloziste,
  ziskatDiagnozuBlob,
} from "@/lib/env-blob";
import type { DiagnozaBlob } from "@/types";

type AkceVysledek =
  | { uspech: true }
  | { chyba: string; diagnoza?: DiagnozaBlob };

async function overitAdmina(): Promise<
  | { chyba: string; diagnoza: DiagnozaBlob }
  | { oidcHeader: string | null; diagnoza: DiagnozaBlob }
> {
  const oidcHeader = await ziskatOidcZRequestu();
  const diagnoza = ziskatDiagnozuBlob(oidcHeader);

  if (!(await jeAdminPrihlasen())) {
    return { chyba: "Neautorizováno – přihlaste se znovu", diagnoza };
  }

  if (pouzivaBlobUloziste() && !maBlobAutentizaci(oidcHeader)) {
    return { chyba: zpravaChybejiciBlobAutentizace(), diagnoza };
  }

  return { oidcHeader, diagnoza };
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

export async function nahratPolozku(formData: FormData): Promise<AkceVysledek> {
  const admin = await overitAdmina();
  if ("chyba" in admin) {
    return { chyba: admin.chyba, diagnoza: admin.diagnoza };
  }

  const { oidcHeader, diagnoza } = admin;
  let cestaSouboru: string | null = null;

  try {
    const soubor = formData.get("soubor") as File | null;
    const popis = (formData.get("popis") as string) ?? "";
    const datumPorizeni = (formData.get("datumPorizeni") as string) || null;

    if (!soubor || soubor.size === 0) {
      return {
        chyba: "Soubor je prázdný nebo se nepodařilo přenést z formuláře",
        diagnoza,
      };
    }

    const vysledek = await ulozitSoubor(soubor, oidcHeader);
    cestaSouboru = vysledek.cestaSouboru;

    await vytvoritPolozku(
      {
        typ: vysledek.typ,
        soubor: vysledek.cestaSouboru,
        popis,
        datumPorizeni,
      },
      oidcHeader
    );

    revalidatePath("/admin");
    revalidatePath("/");
    return { uspech: true };
  } catch (error) {
    if (cestaSouboru) {
      try {
        await smazatSoubor(cestaSouboru, oidcHeader);
      } catch {
        // metadata zůstala beze změny – orphan soubor je lepší než ztráta dat
      }
    }

    const zprava =
      error instanceof Error ? error.message : "Chyba při nahrávání";
    return { chyba: zprava, diagnoza: ziskatDiagnozuBlob(oidcHeader) };
  }
}

export async function prepnoutAktivniPolozky(
  id: string,
  aktivni: boolean
): Promise<AkceVysledek> {
  const admin = await overitAdmina();
  if ("chyba" in admin) return { chyba: admin.chyba, diagnoza: admin.diagnoza };

  try {
    await prepnoutAktivni(id, aktivni, admin.oidcHeader);
    revalidatePath("/admin");
    revalidatePath("/");
    return { uspech: true };
  } catch (error) {
    return {
      chyba: error instanceof Error ? error.message : "Chyba při změně viditelnosti",
      diagnoza: admin.diagnoza,
    };
  }
}

export async function smazatPolozkuAdmin(id: string): Promise<AkceVysledek> {
  const admin = await overitAdmina();
  if ("chyba" in admin) return { chyba: admin.chyba, diagnoza: admin.diagnoza };

  try {
    const smazana = await smazatPolozku(id, admin.oidcHeader);
    if (smazana) {
      await smazatSoubor(smazana.soubor, admin.oidcHeader);
    }
    revalidatePath("/admin");
    revalidatePath("/");
    return { uspech: true };
  } catch (error) {
    return {
      chyba: error instanceof Error ? error.message : "Chyba při mazání",
      diagnoza: admin.diagnoza,
    };
  }
}

export async function zmenitPopisPolozky(
  id: string,
  popis: string
): Promise<AkceVysledek> {
  const admin = await overitAdmina();
  if ("chyba" in admin) return { chyba: admin.chyba, diagnoza: admin.diagnoza };

  try {
    await aktualizovatPopis(id, popis, admin.oidcHeader);
    revalidatePath("/admin");
    return { uspech: true };
  } catch (error) {
    return {
      chyba: error instanceof Error ? error.message : "Chyba při ukládání popisu",
      diagnoza: admin.diagnoza,
    };
  }
}

export async function zmenitPoradiPolozek(
  poradiIds: string[]
): Promise<AkceVysledek> {
  const admin = await overitAdmina();
  if ("chyba" in admin) return { chyba: admin.chyba, diagnoza: admin.diagnoza };

  try {
    await zmenitPoradi(poradiIds, admin.oidcHeader);
    revalidatePath("/admin");
    revalidatePath("/");
    return { uspech: true };
  } catch (error) {
    return {
      chyba: error instanceof Error ? error.message : "Chyba při změně pořadí",
      diagnoza: admin.diagnoza,
    };
  }
}
