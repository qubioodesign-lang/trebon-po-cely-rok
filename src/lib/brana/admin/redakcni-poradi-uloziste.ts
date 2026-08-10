import "server-only";

import { BlobNotFoundError, get, put } from "@vercel/blob";
import { unstable_noStore as noStore } from "next/cache";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import {
  maBranaAdminBlobKonfiguraci,
  ziskatVolbyBranaAdminBlob,
} from "./env-blob-brana-admin";
import type { BranaRedakcniPolozkaStav } from "./redakcni-kostra";
import { vytvoritVychoziRedakcniPoradi } from "./redakcni-kostra";
import { validovatRedakcniPoradiVstup } from "./redakcni-poradi-validace";

/**
 * Objekt v PRIVATE Blob store administrace BRÁNY.
 * Odděleně od PUBLIC store Třeboně i od vzkazů BRÁNY.
 */
export const BRANA_REDAKCNI_PORADI_BLOB_CESTA =
  "data/brana-redakcni-poradi.json";

const VERZE_ULOZISTE = 1;

/** Bezpečná zpráva pro klienta – bez tokenů a interních podrobností */
export const BRANA_REDAKCNI_CHYBA_CTENI =
  "Redakční pořadí se nepodařilo načíst. Žádná data nebyla změněna.";

export type BranaRedakcniPoradiDokument = {
  verzeUloziste: number;
  polozky: BranaRedakcniPolozkaStav[];
};

export type NacistRedakcniPoradiVysledek =
  | { ok: true; polozky: BranaRedakcniPolozkaStav[] }
  | { ok: false };

type BlobCteniTextu =
  | { stav: "neexistuje" }
  | { stav: "ok"; text: string };

function zalogovatChybuCteni(duvod: string, error?: unknown): void {
  if (error === undefined) {
    console.error(`[brana-redakcni-poradi] ${duvod}`);
    return;
  }
  console.error(`[brana-redakcni-poradi] ${duvod}`, error);
}

async function nacistTextZPrivateBlob(): Promise<BlobCteniTextu> {
  const volby = ziskatVolbyBranaAdminBlob();

  if (!volby.token) {
    throw new Error("Chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.");
  }

  try {
    const vysledek = await get(BRANA_REDAKCNI_PORADI_BLOB_CESTA, {
      access: "private",
      ...volby,
    });

    // Vercel Blob get() vrací null, pokud objekt ještě neexistuje
    if (vysledek === null) {
      return { stav: "neexistuje" };
    }

    if (!vysledek.stream) {
      throw new Error("Blob get vrátil odpověď bez použitelného streamu.");
    }

    const text = await new Response(vysledek.stream).text();
    return { stav: "ok", text };
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return { stav: "neexistuje" };
    }
    throw error;
  }
}

/**
 * Načte redakční pořadí z PRIVATE Blobu (bez admin kontroly).
 * - Objekt neexistuje → výchozí kostra (editovatelná, Blob se nevytváří).
 * - Jiná chyba / neplatný dokument → ok: false (bez tichého fallbacku).
 */
async function nacistRedakcniPoradiDokument(): Promise<NacistRedakcniPoradiVysledek> {
  noStore();

  if (!maBranaAdminBlobKonfiguraci()) {
    zalogovatChybuCteni(
      "chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN",
    );
    return { ok: false };
  }

  try {
    const cteni = await nacistTextZPrivateBlob();

    if (cteni.stav === "neexistuje") {
      return { ok: true, polozky: vytvoritVychoziRedakcniPoradi() };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(cteni.text) as unknown;
    } catch (error) {
      zalogovatChybuCteni("neplatný JSON v Blob dokumentu", error);
      return { ok: false };
    }

    if (!parsed || typeof parsed !== "object") {
      zalogovatChybuCteni("Blob dokument nemá platný objekt");
      return { ok: false };
    }

    const polozky = (parsed as { polozky?: unknown }).polozky;
    const validace = validovatRedakcniPoradiVstup(polozky, {
      legacyVyhled: true,
    });
    if (!validace.ok) {
      zalogovatChybuCteni(`Blob dokument neprošel validací: ${validace.chyba}`);
      return { ok: false };
    }

    return { ok: true, polozky: validace.polozky };
  } catch (error) {
    zalogovatChybuCteni("selhání čtení PRIVATE Blobu", error);
    return { ok: false };
  }
}

/**
 * Načte redakční pořadí z PRIVATE Blob store.
 * - Objekt neexistuje → výchozí kostra (editovatelná, Blob se nevytváří).
 * - Jiná chyba / neplatný dokument → ok: false (bez tichého fallbacku).
 */
export async function nacistRedakcniPoradi(): Promise<NacistRedakcniPoradiVysledek> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  return nacistRedakcniPoradiDokument();
}

/**
 * Read-only načtení pro důvěryhodný scheduler (po ověření CRON_SECRET).
 * Bez admin session. Žádný put.
 */
export async function nacistRedakcniPoradiProScheduler(): Promise<NacistRedakcniPoradiVysledek> {
  return nacistRedakcniPoradiDokument();
}

/**
 * Uloží validovanou sadu do PRIVATE Blob store (přepis celého dokumentu).
 * Bez tokenu zápis odmítne – žádný veřejný store ani lokální filesystem.
 */
export async function ulozitRedakcniPoradi(
  polozky: BranaRedakcniPolozkaStav[],
): Promise<void> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit redakční pořadí: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const volby = ziskatVolbyBranaAdminBlob();

  if (!volby.token) {
    throw new Error(
      "Nelze uložit redakční pořadí: chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const dokument: BranaRedakcniPoradiDokument = {
    verzeUloziste: VERZE_ULOZISTE,
    polozky,
  };

  await put(
    BRANA_REDAKCNI_PORADI_BLOB_CESTA,
    JSON.stringify(dokument, null, 2),
    {
      ...volby,
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 0,
    },
  );
}
