import "server-only";

import { BlobNotFoundError, get, put } from "@vercel/blob";
import { unstable_noStore as noStore } from "next/cache";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import {
  maBranaAdminBlobKonfiguraci,
  ziskatVolbyBranaAdminBlob,
} from "./env-blob-brana-admin";
import {
  BRANA_DLOUHODOBY_INTERVAL_VYCHOZI,
  jeDlouhodobyIntervalDni,
  type BranaDlouhodobyIntervalDni,
} from "./zdroj";

/**
 * Objekt v PRIVATE Blob store administrace BRÁNY.
 * Odděleně od redakčního pořadí i konkrétních událostí.
 */
export const BRANA_ZDROJE_NASTAVENI_BLOB_CESTA =
  "data/brana-zdroje-nastaveni.json";

/** Bezpečná zpráva pro klienta – bez tokenů a interních podrobností */
export const BRANA_ZDROJE_NASTAVENI_CHYBA_CTENI =
  "Nastavení zdrojů se nepodařilo načíst. Žádná data nebyla změněna.";

export type BranaZdrojeNastaveniDokument = {
  dlouhodobyIntervalDni: BranaDlouhodobyIntervalDni;
};

export type NacistZdrojeNastaveniVysledek =
  | { ok: true; dlouhodobyIntervalDni: BranaDlouhodobyIntervalDni }
  | { ok: false };

type BlobCteniTextu =
  | { stav: "neexistuje" }
  | { stav: "ok"; text: string };

function zalogovatChybuCteni(duvod: string, error?: unknown): void {
  if (error === undefined) {
    console.error(`[brana-zdroje-nastaveni] ${duvod}`);
    return;
  }
  console.error(`[brana-zdroje-nastaveni] ${duvod}`, error);
}

export function validovatDlouhodobyIntervalVstup(
  hodnota: unknown,
):
  | { ok: true; dlouhodobyIntervalDni: BranaDlouhodobyIntervalDni }
  | { ok: false; chyba: string } {
  if (typeof hodnota !== "number" || !Number.isInteger(hodnota)) {
    return { ok: false, chyba: "Interval musí být celé číslo 14, 21 nebo 30." };
  }
  if (!jeDlouhodobyIntervalDni(hodnota)) {
    return { ok: false, chyba: "Interval musí být 14, 21 nebo 30 dní." };
  }
  return { ok: true, dlouhodobyIntervalDni: hodnota };
}

function parsovatDokument(
  parsed: unknown,
): BranaZdrojeNastaveniDokument | null {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const validace = validovatDlouhodobyIntervalVstup(
    (parsed as { dlouhodobyIntervalDni?: unknown }).dlouhodobyIntervalDni,
  );
  if (!validace.ok) {
    return null;
  }
  return { dlouhodobyIntervalDni: validace.dlouhodobyIntervalDni };
}

async function nacistTextZPrivateBlob(): Promise<BlobCteniTextu> {
  const volby = ziskatVolbyBranaAdminBlob();

  if (!volby.token) {
    throw new Error("Chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.");
  }

  try {
    const vysledek = await get(BRANA_ZDROJE_NASTAVENI_BLOB_CESTA, {
      access: "private",
      ...volby,
    });

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

async function ulozitDokument(
  dokument: BranaZdrojeNastaveniDokument,
): Promise<void> {
  const volby = ziskatVolbyBranaAdminBlob();

  if (!volby.token) {
    throw new Error(
      "Nelze uložit nastavení zdrojů: chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  await put(
    BRANA_ZDROJE_NASTAVENI_BLOB_CESTA,
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

/**
 * Načte interval dlouhodobých zdrojů.
 * - Objekt neexistuje → výchozí 21 (Blob se nevytváří).
 * - Jiná chyba / neplatný dokument → ok: false (bez tichého fallbacku).
 */
export async function nacistZdrojeNastaveni(): Promise<NacistZdrojeNastaveniVysledek> {
  noStore();

  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    zalogovatChybuCteni(
      "chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN",
    );
    return { ok: false };
  }

  try {
    const cteni = await nacistTextZPrivateBlob();

    if (cteni.stav === "neexistuje") {
      return {
        ok: true,
        dlouhodobyIntervalDni: BRANA_DLOUHODOBY_INTERVAL_VYCHOZI,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(cteni.text) as unknown;
    } catch (error) {
      zalogovatChybuCteni("neplatný JSON v Blob dokumentu", error);
      return { ok: false };
    }

    const dokument = parsovatDokument(parsed);
    if (!dokument) {
      zalogovatChybuCteni("Blob dokument neprošel validací");
      return { ok: false };
    }

    return {
      ok: true,
      dlouhodobyIntervalDni: dokument.dlouhodobyIntervalDni,
    };
  } catch (error) {
    zalogovatChybuCteni("selhání čtení PRIVATE Blobu", error);
    return { ok: false };
  }
}

/**
 * Uloží dlouhodobý interval do PRIVATE Blobu.
 * Při chybě čtení existujícího dokumentu nic nezapisuje.
 */
export async function ulozitDlouhodobyIntervalDni(
  dlouhodobyIntervalDni: BranaDlouhodobyIntervalDni,
): Promise<BranaZdrojeNastaveniDokument> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit nastavení zdrojů: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const cteni = await nacistTextZPrivateBlob();

  let dokument: BranaZdrojeNastaveniDokument;

  if (cteni.stav === "neexistuje") {
    dokument = { dlouhodobyIntervalDni };
  } else {
    let parsed: unknown;
    try {
      parsed = JSON.parse(cteni.text) as unknown;
    } catch {
      throw new Error(BRANA_ZDROJE_NASTAVENI_CHYBA_CTENI);
    }

    const stary = parsovatDokument(parsed);
    if (!stary) {
      throw new Error(BRANA_ZDROJE_NASTAVENI_CHYBA_CTENI);
    }

    dokument = {
      ...stary,
      dlouhodobyIntervalDni,
    };
  }

  const validace = validovatDlouhodobyIntervalVstup(
    dokument.dlouhodobyIntervalDni,
  );
  if (!validace.ok) {
    throw new Error(validace.chyba);
  }

  const vysledny: BranaZdrojeNastaveniDokument = {
    dlouhodobyIntervalDni: validace.dlouhodobyIntervalDni,
  };

  await ulozitDokument(vysledny);
  return vysledny;
}
