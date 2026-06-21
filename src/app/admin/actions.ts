"use server";

import { revalidatePath } from "next/cache";
import {
  jeAdminPrihlasen,
  overitHeslo,
  vytvoritSessionToken,
  nastavitSessionCookie,
  smazatSessionCookie,
} from "@/lib/autentizace";
import { BlobNotFoundError } from "@vercel/blob";
import {
  vytvoritPolozku,
  aktualizovatPopis,
  prepnoutAktivni,
  smazatPolozku,
  ziskatPolozku,
  ziskatPolozkuCerstve,
  ziskatVsechnyPolozky,
  zmenitPoradi,
  nahraditSouborPolozky,
} from "@/lib/polozky";
import { ulozitSoubor, smazatSoubor } from "@/lib/soubory";
import { odeslatPushNotifikaceVsem } from "@/lib/push-notifikace";
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
import {
  vytvoritZalohu as vytvoritZalohuSoubor,
  seznamZaloh,
  obnovitZeZalohy,
  type ZalohaInfo,
} from "@/lib/zaloha";

type AkceVysledek =
  | { uspech: true; novaUrlSouboru?: string }
  | { chyba: string; diagnoza?: DiagnozaBlob };

export type PushAkceVysledek =
  | { uspech: true; pocetOdeslano: number; pocetSelhalo: number }
  | { zadniOdberatele: true }
  | { chyba: string; diagnoza?: DiagnozaBlob };

export type ZalohaAkceVysledek =
  | { uspech: true; zaloha: ZalohaInfo }
  | { chyba: string; diagnoza?: DiagnozaBlob };

export type SeznamZalohVysledek =
  | { uspech: true; zalohy: ZalohaInfo[] }
  | { chyba: string; diagnoza?: DiagnozaBlob };

export type ObnovaZalohyVysledek =
  | {
      uspech: true;
      polozky: number;
      pushOdbery: number;
      soubory: number;
      vytvoreno: string;
    }
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

/** Smaže soubor; chybějící soubor neblokuje dokončení mazání položky */
async function smazatSouborBezpecne(
  cestaSouboru: string,
  oidcHeader: string | null
): Promise<void> {
  try {
    await smazatSoubor(cestaSouboru, oidcHeader);
  } catch (error) {
    if (error instanceof BlobNotFoundError) return;
    throw error;
  }
}

/** Dokončí náhradu, pokud metadata už ukazují na novou URL – bez mazání nového blobu */
async function dokoncitNahrazeniJeLiUlozeno(
  id: string,
  novaUrl: string,
  starySoubor: string,
  oidcHeader: string | null
): Promise<Extract<AkceVysledek, { uspech: true }> | null> {
  const overena = await ziskatPolozkuCerstve(id, oidcHeader, {
    bypassCache: true,
  });
  if (overena?.soubor !== novaUrl) {
    return null;
  }

  if (starySoubor !== novaUrl) {
    await smazatSouborBezpecne(starySoubor, oidcHeader);
  }

  revalidatePath("/admin");
  revalidatePath("/");
  return { uspech: true, novaUrlSouboru: overena.soubor };
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
    const polozka = await ziskatPolozku(id, admin.oidcHeader);
    if (!polozka) {
      return { chyba: "Položka nebyla nalezena", diagnoza: admin.diagnoza };
    }

    await smazatSouborBezpecne(polozka.soubor, admin.oidcHeader);
    await smazatPolozku(id, admin.oidcHeader);

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

export async function nahraditFotografiiPolozky(
  id: string,
  formData: FormData
): Promise<AkceVysledek> {
  const admin = await overitAdmina();
  if ("chyba" in admin) {
    return { chyba: admin.chyba, diagnoza: admin.diagnoza };
  }

  const { oidcHeader, diagnoza } = admin;
  let novaCestaSouboru: string | null = null;
  let starySoubor: string | null = null;

  try {
    const polozka = await ziskatPolozku(id, oidcHeader);
    if (!polozka) {
      return { chyba: "Položka nebyla nalezena", diagnoza };
    }

    if (polozka.typ !== "fotografie") {
      return {
        chyba: "Nahradit lze pouze fotografii",
        diagnoza,
      };
    }

    const soubor = formData.get("soubor") as File | null;
    if (!soubor || soubor.size === 0) {
      return {
        chyba: "Soubor je prázdný nebo se nepodařilo přenést z formuláře",
        diagnoza,
      };
    }

    starySoubor = polozka.soubor;
    const vysledek = await ulozitSoubor(soubor, oidcHeader);
    novaCestaSouboru = vysledek.cestaSouboru;

    if (vysledek.typ !== "fotografie") {
      await smazatSouborBezpecne(novaCestaSouboru, oidcHeader);
      return {
        chyba: "Nahradit lze pouze fotografii (JPEG, PNG, WebP, AVIF)",
        diagnoza,
      };
    }

    await nahraditSouborPolozky(
      id,
      vysledek.cestaSouboru,
      vysledek.typ,
      oidcHeader
    );

    const novaUrl = vysledek.cestaSouboru;
    const uspech = await dokoncitNahrazeniJeLiUlozeno(
      id,
      novaUrl,
      starySoubor,
      oidcHeader
    );
    if (uspech) {
      return uspech;
    }

    const overena = await ziskatPolozkuCerstve(id, oidcHeader, {
      bypassCache: true,
    });
    const skutecnaUrl = overena?.soubor ?? null;

    if (skutecnaUrl === starySoubor) {
      return {
        chyba:
          "Metadata se nepodařilo uložit. Nový soubor nebyl smazán – zkuste znovu.",
        diagnoza,
      };
    }

    return {
      chyba: skutecnaUrl
        ? `Metadata obsahují jinou URL (${skutecnaUrl}). Nový soubor nebyl smazán – ověřte stav v administraci.`
        : "Položka v metadatech chybí. Nový soubor nebyl smazán – ověřte stav v administraci.",
      diagnoza,
    };
  } catch (error) {
    if (novaCestaSouboru && starySoubor) {
      const uspechPoChybe = await dokoncitNahrazeniJeLiUlozeno(
        id,
        novaCestaSouboru,
        starySoubor,
        oidcHeader
      );
      if (uspechPoChybe) {
        return uspechPoChybe;
      }
    }

    const zprava =
      error instanceof Error ? error.message : "Chyba při nahrazování fotografie";
    return { chyba: zprava, diagnoza: ziskatDiagnozuBlob(oidcHeader) };
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
    revalidatePath("/");
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

export async function odeslatPushUpozorneni(
  polozkaId: string
): Promise<PushAkceVysledek> {
  const admin = await overitAdmina();
  if ("chyba" in admin) return { chyba: admin.chyba, diagnoza: admin.diagnoza };

  try {
    const polozky = await ziskatVsechnyPolozky(admin.oidcHeader);
    const nejnovejsiAktivni = polozky.find((p) => p.aktivni);

    if (!nejnovejsiAktivni) {
      return {
        chyba: "V galerii není žádná aktivní fotografie",
        diagnoza: admin.diagnoza,
      };
    }

    if (nejnovejsiAktivni.id !== polozkaId) {
      return {
        chyba: "Upozornění lze odeslat pouze u nejnovější aktivní fotografie",
        diagnoza: admin.diagnoza,
      };
    }

    const vysledek = await odeslatPushNotifikaceVsem(admin.oidcHeader);

    if ("chyba" in vysledek) {
      return { chyba: vysledek.chyba, diagnoza: admin.diagnoza };
    }

    return vysledek;
  } catch (error) {
    return {
      chyba:
        error instanceof Error ? error.message : "Chyba při odesílání upozornění",
      diagnoza: admin.diagnoza,
    };
  }
}

export async function vytvoritZalohu(): Promise<ZalohaAkceVysledek> {
  const admin = await overitAdmina();
  if ("chyba" in admin) return { chyba: admin.chyba, diagnoza: admin.diagnoza };

  if (!pouzivaBlobUloziste()) {
    return {
      chyba: "Zálohování vyžaduje aktivní Blob úložiště.",
      diagnoza: admin.diagnoza,
    };
  }

  if (!maBlobAutentizaci(admin.oidcHeader)) {
    return {
      chyba: zpravaChybejiciBlobAutentizace(),
      diagnoza: admin.diagnoza,
    };
  }

  try {
    const zaloha = await vytvoritZalohuSoubor(admin.oidcHeader);
    return { uspech: true, zaloha };
  } catch (error) {
    return {
      chyba: error instanceof Error ? error.message : "Chyba při vytváření zálohy",
      diagnoza: admin.diagnoza,
    };
  }
}

export async function nacistSeznamZaloh(): Promise<SeznamZalohVysledek> {
  const admin = await overitAdmina();
  if ("chyba" in admin) return { chyba: admin.chyba, diagnoza: admin.diagnoza };

  if (!pouzivaBlobUloziste()) {
    return { uspech: true, zalohy: [] };
  }

  try {
    const zalohy = await seznamZaloh(admin.oidcHeader);
    return { uspech: true, zalohy };
  } catch (error) {
    return {
      chyba: error instanceof Error ? error.message : "Chyba při načtení seznamu záloh",
      diagnoza: admin.diagnoza,
    };
  }
}

export async function obnovitZalohuAdmin(
  pathname: string
): Promise<ObnovaZalohyVysledek> {
  const admin = await overitAdmina();
  if ("chyba" in admin) return { chyba: admin.chyba, diagnoza: admin.diagnoza };

  if (!maBlobAutentizaci(admin.oidcHeader)) {
    return {
      chyba: zpravaChybejiciBlobAutentizace(),
      diagnoza: admin.diagnoza,
    };
  }

  try {
    const vysledek = await obnovitZeZalohy(pathname, admin.oidcHeader);
    revalidatePath("/admin");
    revalidatePath("/");
    return { uspech: true, ...vysledek };
  } catch (error) {
    return {
      chyba: error instanceof Error ? error.message : "Chyba při obnově ze zálohy",
      diagnoza: admin.diagnoza,
    };
  }
}
