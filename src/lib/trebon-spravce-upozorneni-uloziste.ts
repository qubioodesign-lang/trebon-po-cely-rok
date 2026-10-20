import "server-only";

import fs from "fs";
import path from "path";
import { get, put } from "@vercel/blob";
import { BlobNotFoundError } from "@vercel/blob";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import {
  pouzivaBlobUloziste,
  ziskatVolbyBlobAsync,
} from "@/lib/env-blob";
import {
  validovatTrebonSpravceSubscription,
  type TrebonSpravceUpozorneniDokument,
} from "@/lib/trebon-spravce-upozorneni";

/** Samostatný soubor v úložišti Třeboně. Není to seznam návštěvníků ani dokument BRÁNY. */
export const TREBON_SPRAVCE_UPOZORNENI_CESTA =
  "data/trebon-spravce-vzkaz-upozorneni.json";

const CESTA_LOKALNI = path.join(
  process.cwd(),
  "data",
  "trebon-spravce-vzkaz-upozorneni.json",
);

export function prazdneTrebonSpravceUpozorneni(): TrebonSpravceUpozorneniDokument {
  return { upozorneniAktivni: false, pushSubscription: null };
}

function parsovatDokument(text: string): TrebonSpravceUpozorneniDokument | null {
  try {
    const data = JSON.parse(text) as Partial<TrebonSpravceUpozorneniDokument>;
    if (typeof data.upozorneniAktivni !== "boolean") {
      return null;
    }
    if (data.pushSubscription == null) {
      return { upozorneniAktivni: false, pushSubscription: null };
    }
    const sub = validovatTrebonSpravceSubscription(data.pushSubscription);
    if (!sub.ok) {
      return null;
    }
    return {
      upozorneniAktivni: data.upozorneniAktivni,
      pushSubscription: sub.pushSubscription,
    };
  } catch {
    return null;
  }
}

async function nacistText(): Promise<string | null> {
  if (pouzivaBlobUloziste()) {
    const volby = await ziskatVolbyBlobAsync();
    try {
      const vysledek = await get(TREBON_SPRAVCE_UPOZORNENI_CESTA, {
        access: "private",
        ...volby,
      });
      if (!vysledek?.stream) {
        return null;
      }
      return new Response(vysledek.stream).text();
    } catch (error) {
      if (error instanceof BlobNotFoundError) {
        return null;
      }
      throw error;
    }
  }

  if (!fs.existsSync(CESTA_LOKALNI)) {
    return null;
  }
  return fs.readFileSync(CESTA_LOKALNI, "utf-8");
}

async function zapsat(dokument: TrebonSpravceUpozorneniDokument): Promise<void> {
  const telo = JSON.stringify(dokument);

  if (pouzivaBlobUloziste()) {
    const volby = await ziskatVolbyBlobAsync();
    if (!volby.token && !volby.oidcToken) {
      throw new Error("Nelze uložit upozornění: chybí přístup k úložišti.");
    }
    await put(TREBON_SPRAVCE_UPOZORNENI_CESTA, telo, {
      ...volby,
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 0,
    });
    return;
  }

  fs.mkdirSync(path.dirname(CESTA_LOKALNI), { recursive: true });
  fs.writeFileSync(CESTA_LOKALNI, telo, "utf-8");
}

/** Čtení pro odeslání po uložení vzkazu. Bez přihlášení, bez zápisu. */
export async function nacistTrebonSpravceUpozorneni(): Promise<
  | { ok: true; dokument: TrebonSpravceUpozorneniDokument }
  | { ok: false }
> {
  try {
    const text = await nacistText();
    if (text === null) {
      return { ok: true, dokument: prazdneTrebonSpravceUpozorneni() };
    }
    const dokument = parsovatDokument(text);
    if (!dokument) {
      return { ok: false };
    }
    return { ok: true, dokument };
  } catch (error) {
    console.error("[trebon-vzkaz-push] nastavení se nepodařilo načíst", error);
    return { ok: false };
  }
}

export async function ulozitTrebonSpravceSubscription(
  subscription: unknown,
): Promise<TrebonSpravceUpozorneniDokument> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }
  const validace = validovatTrebonSpravceSubscription(subscription);
  if (!validace.ok) {
    throw new Error(validace.chyba);
  }
  const dokument: TrebonSpravceUpozorneniDokument = {
    upozorneniAktivni: true,
    pushSubscription: validace.pushSubscription,
  };
  await zapsat(dokument);
  return dokument;
}

export async function vypnoutTrebonSpravceUpozorneni(): Promise<TrebonSpravceUpozorneniDokument> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }
  const dokument = prazdneTrebonSpravceUpozorneni();
  await zapsat(dokument);
  return dokument;
}
