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
  vytvoritProlnuti,
  aktualizovatPopis,
  aktualizovatPolozku,
  prepnoutAktivni,
  smazatPolozku,
  ziskatPolozku,
  ziskatPolozkuCerstve,
  ziskatVsechnyPolozky,
  zmenitPoradi,
  nahraditSouborPolozky,
  nahraditSnimekProlnuti,
} from "@/lib/polozky";
import { ulozitSoubor, smazatSoubor } from "@/lib/soubory";
import { ziskatSouboryPolozky } from "@/lib/polozka-soubory";
import { jePlatnyPocetSnimkuProlnuti } from "@/lib/prolnuti-snimky";
import { odeslatPushNotifikaceVsem } from "@/lib/push-notifikace";
import {
  ziskatOidcZRequestu,
  zpravaChybejiciBlobAutentizace,
  lzeVytvoritZalohu,
} from "@/lib/admin-data";
import { overitMetadataVerejne, type UlozisteDat } from "@/lib/uloziste-dat";
import {
  maBlobAutentizaci,
  pouzivaBlobUloziste,
  ziskatDiagnozuBlob,
} from "@/lib/env-blob";
import type { DiagnozaBlob } from "@/types";
import type { ProlnutiCasovaniNastaveni } from "@/lib/prolnuti-casovani";
import { validovatProlnutiCasovani } from "@/lib/prolnuti-casovani";
import { ulozitProlnutiCasovani } from "@/lib/prolnuti-nastaveni";
import {
  ulozitDesktopPozvankaFotografii,
  ziskatCestuDesktopPozvankaFotografie,
} from "@/lib/desktop-pozvanka-nastaveni";
import {
  vytvoritZalohu as vytvoritZalohuSoubor,
  seznamZaloh,
  obnovitZeZalohy,
  type ZalohaInfo,
} from "@/lib/zaloha";

type AkceVysledek =
  | { uspech: true; novaUrlSouboru?: string; diagProlnuti?: DiagProlnutiNahrani }
  | { chyba: string; diagnoza?: DiagnozaBlob; diagProlnuti?: DiagProlnutiNahrani };

/** Diagnostika nahrání prolnutí – zobrazení v adminu po uploadu */
export type DiagProlnutiNahrani = {
  maA: boolean;
  maB: boolean;
  maC: boolean;
  pocetUlozenychSouboru: number;
  pocetSouboruVMeta: number;
};

function sestavitDiagProlnuti(
  souborA: FormDataEntryValue | null,
  souborB: FormDataEntryValue | null,
  souborC: FormDataEntryValue | null,
  pocetUlozenychSouboru = 0,
  pocetSouboruVMeta = 0
): DiagProlnutiNahrani {
  return {
    maA: souborA instanceof File && souborA.size > 0,
    maB: souborB instanceof File && souborB.size > 0,
    maC: souborC instanceof File && souborC.size > 0,
    pocetUlozenychSouboru,
    pocetSouboruVMeta,
  };
}

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
  const diagnoza = ziskatDiagnozuBlob(oidcHeader, {
    lzeZalohovat: lzeVytvoritZalohu(),
  });

  if (!(await jeAdminPrihlasen())) {
    return { chyba: "Neautorizováno – přihlaste se znovu", diagnoza };
  }

  if (pouzivaBlobUloziste() && !maBlobAutentizaci(oidcHeader)) {
    return { chyba: zpravaChybejiciBlobAutentizace(), diagnoza };
  }

  return { oidcHeader, diagnoza };
}

/** Počká na veřejnou viditelnost změny, pak invaliduje cache stránek */
async function potvrditAUvolnitWeb(
  overeni: (data: UlozisteDat) => boolean
): Promise<void> {
  await overitMetadataVerejne(overeni);
  revalidatePath("/admin");
  revalidatePath("/");
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
  try {
    await potvrditAUvolnitWeb(
      (uloziste) =>
        uloziste.polozky.find((p) => p.id === id)?.soubor === novaUrl
    );
  } catch {
    return null;
  }

  if (starySoubor !== novaUrl) {
    await smazatSouborBezpecne(starySoubor, oidcHeader);
  }

  return { uspech: true, novaUrlSouboru: novaUrl };
}

/** Dokončí náhradu snímku prolnutí, pokud metadata už ukazují na novou URL */
async function dokoncitNahrazeniSnimkuProlnutiJeLiUlozeno(
  id: string,
  indexSnimku: number,
  novaUrl: string,
  starySoubor: string | null,
  oidcHeader: string | null
): Promise<Extract<AkceVysledek, { uspech: true }> | null> {
  try {
    await potvrditAUvolnitWeb(
      (uloziste) =>
        uloziste.polozky.find((p) => p.id === id)?.soubory?.[indexSnimku] ===
        novaUrl
    );
  } catch {
    return null;
  }

  if (starySoubor && starySoubor !== novaUrl) {
    await smazatSouborBezpecne(starySoubor, oidcHeader);
  }

  return { uspech: true, novaUrlSouboru: novaUrl };
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

    const novaPolozka = await vytvoritPolozku(
      {
        typ: vysledek.typ,
        soubor: vysledek.cestaSouboru,
        popis,
        datumPorizeni,
      },
      oidcHeader
    );

    await potvrditAUvolnitWeb((uloziste) =>
      uloziste.polozky.some((p) => p.id === novaPolozka.id)
    );

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
    return { chyba: zprava, diagnoza: ziskatDiagnozuBlob(oidcHeader, { lzeZalohovat: lzeVytvoritZalohu() }) };
  }
}

export async function nahratProlnuti(formData: FormData): Promise<AkceVysledek> {
  const admin = await overitAdmina();
  if ("chyba" in admin) {
    return { chyba: admin.chyba, diagnoza: admin.diagnoza };
  }

  const { oidcHeader, diagnoza } = admin;
  const nahrateCesty: string[] = [];

  try {
    const souborA = formData.get("souborA");
    const souborB = formData.get("souborB");
    const souborC = formData.get("souborC");
    const popis = (formData.get("popis") as string) ?? "";
    const datumPorizeni = (formData.get("datumPorizeni") as string) || null;

    if (!(souborA instanceof File) || souborA.size === 0) {
      return {
        chyba: "Pro prolnutí chybí první fotografie (A)",
        diagnoza,
        diagProlnuti: sestavitDiagProlnuti(souborA, souborB, souborC),
      };
    }

    if (!(souborB instanceof File) || souborB.size === 0) {
      return {
        chyba: "Pro prolnutí chybí druhá fotografie (B)",
        diagnoza,
        diagProlnuti: sestavitDiagProlnuti(souborA, souborB, souborC),
      };
    }

    const souboryKNahrani: File[] = [souborA, souborB];
    if (souborC instanceof File && souborC.size > 0) {
      souboryKNahrani.push(souborC);
    }

    if (!jePlatnyPocetSnimkuProlnuti(souboryKNahrani.length)) {
      return {
        chyba: "Pro prolnutí jsou potřeba 2 nebo 3 fotografie (A a B povinné)",
        diagnoza,
        diagProlnuti: sestavitDiagProlnuti(souborA, souborB, souborC),
      };
    }

    // Paralelně načíst všechny buffery hned po validaci – před jakýmkoli uploadem.
    const souboryProUpload = await Promise.all(
      souboryKNahrani.map(async (soubor, index) => {
        const buffer = Buffer.from(await soubor.arrayBuffer());
        return new File([buffer], soubor.name || `snimek-${index + 1}`, {
          type: soubor.type,
        });
      })
    );

    for (const soubor of souboryProUpload) {
      const vysledek = await ulozitSoubor(soubor, oidcHeader);
      if (vysledek.typ !== "fotografie") {
        for (const cesta of nahrateCesty) {
          await smazatSouborBezpecne(cesta, oidcHeader);
        }
        return {
          chyba: "Prolnutí podporuje pouze fotografie (JPEG, PNG, WebP, AVIF)",
          diagnoza,
          diagProlnuti: sestavitDiagProlnuti(
            souborA,
            souborB,
            souborC,
            nahrateCesty.length
          ),
        };
      }
      nahrateCesty.push(vysledek.cestaSouboru);
    }

    const novaPolozka = await vytvoritProlnuti(
      {
        soubory: nahrateCesty,
        popis,
        datumPorizeni,
      },
      oidcHeader
    );

    await potvrditAUvolnitWeb((uloziste) =>
      uloziste.polozky.some((p) => p.id === novaPolozka.id)
    );

    const diagProlnuti = sestavitDiagProlnuti(
      souborA,
      souborB,
      souborC,
      nahrateCesty.length,
      novaPolozka.soubory?.length ?? 0
    );

    return { uspech: true, diagProlnuti };
  } catch (error) {
    for (const cesta of nahrateCesty) {
      try {
        await smazatSouborBezpecne(cesta, oidcHeader);
      } catch {
        // metadata zůstala beze změny
      }
    }

    const zprava =
      error instanceof Error ? error.message : "Chyba při nahrávání prolnutí";
    return {
      chyba: zprava,
      diagnoza: ziskatDiagnozuBlob(oidcHeader, { lzeZalohovat: lzeVytvoritZalohu() }),
      diagProlnuti: sestavitDiagProlnuti(
        formData.get("souborA"),
        formData.get("souborB"),
        formData.get("souborC"),
        nahrateCesty.length
      ),
    };
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
    await potvrditAUvolnitWeb(
      (uloziste) =>
        uloziste.polozky.find((p) => p.id === id)?.aktivni === aktivni
    );
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

    await smazatPolozku(id, admin.oidcHeader);

    for (const cesta of ziskatSouboryPolozky(polozka)) {
      await smazatSouborBezpecne(cesta, admin.oidcHeader);
    }

    await potvrditAUvolnitWeb(
      (uloziste) => !uloziste.polozky.some((p) => p.id === id)
    );

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

    if (!polozka.soubor) {
      return {
        chyba: "Položka nemá soubor k nahrazení",
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
    return { chyba: zprava, diagnoza: ziskatDiagnozuBlob(oidcHeader, { lzeZalohovat: lzeVytvoritZalohu() }) };
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
    await potvrditAUvolnitWeb(
      (uloziste) =>
        uloziste.polozky.find((p) => p.id === id)?.popis === popis
    );
    return { uspech: true };
  } catch (error) {
    return {
      chyba: error instanceof Error ? error.message : "Chyba při ukládání popisu",
      diagnoza: admin.diagnoza,
    };
  }
}

export async function ulozitUpravyPolozky(
  id: string,
  data: {
    popis: string;
    datumPorizeni: string | null;
    aktivni: boolean;
  }
): Promise<AkceVysledek> {
  const admin = await overitAdmina();
  if ("chyba" in admin) return { chyba: admin.chyba, diagnoza: admin.diagnoza };

  try {
    const polozka = await ziskatPolozku(id, admin.oidcHeader);
    if (!polozka) {
      return { chyba: "Položka nebyla nalezena", diagnoza: admin.diagnoza };
    }

    await aktualizovatPolozku(
      id,
      {
        popis: data.popis,
        datumPorizeni: data.datumPorizeni,
        aktivni: data.aktivni,
      },
      admin.oidcHeader
    );

    await potvrditAUvolnitWeb((uloziste) => {
      const polozka = uloziste.polozky.find((p) => p.id === id);
      if (!polozka) return false;
      return (
        polozka.popis === data.popis &&
        polozka.datumPorizeni === data.datumPorizeni &&
        polozka.aktivni === data.aktivni
      );
    });

    return { uspech: true };
  } catch (error) {
    return {
      chyba: error instanceof Error ? error.message : "Chyba při ukládání úprav",
      diagnoza: admin.diagnoza,
    };
  }
}

type SnimekProlnuti = "A" | "B" | "C";

function indexSnimkuProlnuti(snimek: SnimekProlnuti): number {
  switch (snimek) {
    case "A":
      return 0;
    case "B":
      return 1;
    case "C":
      return 2;
  }
}

export async function nahraditSnimekProlnutiPolozky(
  id: string,
  snimek: SnimekProlnuti,
  formData: FormData
): Promise<AkceVysledek> {
  const admin = await overitAdmina();
  if ("chyba" in admin) {
    return { chyba: admin.chyba, diagnoza: admin.diagnoza };
  }

  const { oidcHeader, diagnoza } = admin;
  const indexSnimku = indexSnimkuProlnuti(snimek);
  let novaCestaSouboru: string | null = null;
  let starySoubor: string | null = null;

  try {
    const polozka = await ziskatPolozku(id, oidcHeader);
    if (!polozka) {
      return { chyba: "Položka nebyla nalezena", diagnoza };
    }

    if (polozka.typ !== "prolnuti" || !polozka.soubory) {
      return { chyba: "Nahradit lze pouze snímek prolnutí", diagnoza };
    }

    if (indexSnimku >= polozka.soubory.length) {
      if (
        snimek !== "C" ||
        polozka.soubory.length !== 2 ||
        indexSnimku !== 2
      ) {
        return {
          chyba: `Snímek ${snimek} v této položce neexistuje`,
          diagnoza,
        };
      }
    } else {
      starySoubor = polozka.soubory[indexSnimku];
    }

    const soubor = formData.get("soubor") as File | null;
    if (!soubor || soubor.size === 0) {
      return {
        chyba: "Soubor je prázdný nebo se nepodařilo přenést z formuláře",
        diagnoza,
      };
    }

    const vysledek = await ulozitSoubor(soubor, oidcHeader);
    novaCestaSouboru = vysledek.cestaSouboru;

    if (vysledek.typ !== "fotografie") {
      await smazatSouborBezpecne(novaCestaSouboru, oidcHeader);
      return {
        chyba: "Prolnutí podporuje pouze fotografie (JPEG, PNG, WebP, AVIF)",
        diagnoza,
      };
    }

    await nahraditSnimekProlnuti(
      id,
      indexSnimku,
      vysledek.cestaSouboru,
      oidcHeader
    );

    const uspech = await dokoncitNahrazeniSnimkuProlnutiJeLiUlozeno(
      id,
      indexSnimku,
      vysledek.cestaSouboru,
      starySoubor,
      oidcHeader
    );
    if (uspech) {
      return uspech;
    }

    const overena = await ziskatPolozkuCerstve(id, oidcHeader, {
      bypassCache: true,
    });
    const skutecnaUrl = overena?.soubory?.[indexSnimku] ?? null;

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
      const uspechPoChybe = await dokoncitNahrazeniSnimkuProlnutiJeLiUlozeno(
        id,
        indexSnimku,
        novaCestaSouboru,
        starySoubor,
        oidcHeader
      );
      if (uspechPoChybe) {
        return uspechPoChybe;
      }
    }

    const zprava =
      error instanceof Error
        ? error.message
        : "Chyba při nahrazování snímku prolnutí";
    return { chyba: zprava, diagnoza: ziskatDiagnozuBlob(oidcHeader, { lzeZalohovat: lzeVytvoritZalohu() }) };
  }
}

export async function zmenitPoradiPolozek(
  poradiIds: string[]
): Promise<AkceVysledek> {
  const admin = await overitAdmina();
  if ("chyba" in admin) return { chyba: admin.chyba, diagnoza: admin.diagnoza };

  try {
    await zmenitPoradi(poradiIds, admin.oidcHeader);
    await potvrditAUvolnitWeb((uloziste) =>
      poradiIds.every(
        (id, index) =>
          uloziste.polozky.find((p) => p.id === id)?.poradi === index
      )
    );
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
      chyba: "Zálohování vyžaduje aktivní Blob úložiště nebo lokální soubory.",
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

export async function ulozitNastaveniProlnutiAdmin(
  nastaveni: ProlnutiCasovaniNastaveni
): Promise<AkceVysledek> {
  const admin = await overitAdmina();
  if ("chyba" in admin) return { chyba: admin.chyba, diagnoza: admin.diagnoza };

  const validace = validovatProlnutiCasovani(nastaveni);
  if ("chyba" in validace) {
    return { chyba: validace.chyba, diagnoza: admin.diagnoza };
  }

  try {
    await ulozitProlnutiCasovani(validace.data, admin.oidcHeader);
    revalidatePath("/admin");
    revalidatePath("/");
    return { uspech: true };
  } catch (error) {
    return {
      chyba:
        error instanceof Error
          ? error.message
          : "Chyba při ukládání nastavení prolnutí",
      diagnoza: admin.diagnoza,
    };
  }
}

export async function nahratDesktopPozvankaFotografii(
  formData: FormData
): Promise<AkceVysledek> {
  const admin = await overitAdmina();
  if ("chyba" in admin) {
    return { chyba: admin.chyba, diagnoza: admin.diagnoza };
  }

  const { oidcHeader, diagnoza } = admin;
  let cestaSouboru: string | null = null;

  try {
    const soubor = formData.get("soubor");
    if (!(soubor instanceof File) || soubor.size === 0) {
      return {
        chyba: "Soubor je prázdný nebo se nepodařilo přenést z formuláře",
        diagnoza,
      };
    }

    const vysledek = await ulozitSoubor(soubor, oidcHeader);
    if (vysledek.typ !== "fotografie") {
      await smazatSoubor(vysledek.cestaSouboru, oidcHeader);
      return {
        chyba: "Desktopová pozvánka podporuje pouze fotografie (JPEG, PNG, WebP, AVIF)",
        diagnoza,
      };
    }

    cestaSouboru = vysledek.cestaSouboru;
    const staraCesta = await ziskatCestuDesktopPozvankaFotografie(oidcHeader);

    await ulozitDesktopPozvankaFotografii(cestaSouboru, oidcHeader);

    if (staraCesta && staraCesta !== cestaSouboru) {
      try {
        await smazatSoubor(staraCesta, oidcHeader);
      } catch {
        // metadata jsou uložena – starý soubor může zůstat jako orphan
      }
    }

    revalidatePath("/admin");
    revalidatePath("/");
    return { uspech: true };
  } catch (error) {
    if (cestaSouboru) {
      try {
        await smazatSoubor(cestaSouboru, oidcHeader);
      } catch {
        // metadata zůstala beze změny
      }
    }

    const zprava =
      error instanceof Error
        ? error.message
        : "Chyba při nahrávání desktopové fotografie";
    return { chyba: zprava, diagnoza: ziskatDiagnozuBlob(oidcHeader, { lzeZalohovat: lzeVytvoritZalohu() }) };
  }
}
