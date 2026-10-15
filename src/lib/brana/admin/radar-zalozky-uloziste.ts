import "server-only";

import {
  BlobNotFoundError,
  BlobPreconditionFailedError,
  get,
  head,
  put,
} from "@vercel/blob";
import { unstable_noStore as noStore } from "next/cache";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import {
  maBranaAdminBlobKonfiguraci,
  ziskatVolbyBranaAdminBlob,
} from "./env-blob-brana-admin";
import {
  BRANA_RADAR_ZALOZKY_BLOB_CESTA,
  parsovatRadarZalozkyDokument,
  pridatPolozkuDoZalozekDokumentu,
  smazatPolozkuZeZalozekDokumentu,
  validovatRadarZalozkuVstup,
  vychoziRadarZalozkyDokument,
  type BranaRadarZalozka,
  type BranaRadarZalozkyDokument,
} from "./radar-zalozky";

/**
 * Samostatný PRIVATE Blob administrace.
 * Pracovní nálezy RADARU se sem nezapisují a tento soubor scan nečte.
 * Objekt leží ve stejném store jako ostatní data administrace, mimo nasazení.
 */
export const BRANA_RADAR_ZALOZKY_CHYBA_CTENI =
  "Sledované weby se nepodařilo načíst. Žádná data nebyla změněna.";

const CAS_MAX_POKUSU = 8;

const CHYBA_KONFLIKT =
  "Seznam mezitím změnil jiný zápis. Zkuste to znovu.";

export type NacistRadarZalozkyVysledek =
  | { ok: true; polozky: BranaRadarZalozka[] }
  | { ok: false };

type BlobCteniTextu =
  | { stav: "neexistuje" }
  | { stav: "ok"; text: string };

type BlobCteniProZapis =
  | { stav: "neexistuje" }
  | { stav: "ok"; dokument: BranaRadarZalozkyDokument; etag: string };

function zalogovatChybuCteni(duvod: string, error?: unknown): void {
  if (error === undefined) {
    console.error(`[brana-radar-zalozky] ${duvod}`);
    return;
  }
  console.error(`[brana-radar-zalozky] ${duvod}`, error);
}

async function nacistTextZPrivateBlob(): Promise<BlobCteniTextu> {
  const volby = ziskatVolbyBranaAdminBlob();

  if (!volby.token) {
    throw new Error("Chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.");
  }

  try {
    const vysledek = await get(BRANA_RADAR_ZALOZKY_BLOB_CESTA, {
      access: "private",
      useCache: false,
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

async function nacistDokumentSEtagProZapis(): Promise<BlobCteniProZapis> {
  const volby = ziskatVolbyBranaAdminBlob();

  if (!volby.token) {
    throw new Error("Chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.");
  }

  let etag: string;
  try {
    const meta = await head(BRANA_RADAR_ZALOZKY_BLOB_CESTA, volby);
    if (typeof meta.etag !== "string" || meta.etag.length === 0) {
      throw new Error(
        "Nelze bezpečně uložit: Blob HEAD nevrátil etag. Nic nebylo změněno.",
      );
    }
    etag = meta.etag;
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return { stav: "neexistuje" };
    }
    throw error;
  }

  try {
    const vysledek = await get(BRANA_RADAR_ZALOZKY_BLOB_CESTA, {
      access: "private",
      useCache: false,
      ...volby,
    });

    if (vysledek === null || !vysledek.stream) {
      throw new Error("Blob zmizel mezi HEAD a GET. Nic nebylo uloženo.");
    }

    const text = await new Response(vysledek.stream).text();

    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      throw new Error(BRANA_RADAR_ZALOZKY_CHYBA_CTENI);
    }

    const dokument = parsovatRadarZalozkyDokument(parsed);
    if (!dokument) {
      throw new Error(BRANA_RADAR_ZALOZKY_CHYBA_CTENI);
    }

    return { stav: "ok", dokument, etag };
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      throw new Error("Blob zmizel mezi HEAD a GET. Nic nebylo uloženo.");
    }
    throw error;
  }
}

async function ulozitDokumentSIfMatch(
  dokument: BranaRadarZalozkyDokument,
  etag: string | null,
): Promise<void> {
  const volby = ziskatVolbyBranaAdminBlob();

  if (!volby.token) {
    throw new Error(
      "Nelze uložit sledované weby: chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const overeny = parsovatRadarZalozkyDokument(dokument);
  if (!overeny) {
    throw new Error(
      "Výsledný dokument neprošel validací. Nic nebylo uloženo.",
    );
  }

  await put(
    BRANA_RADAR_ZALOZKY_BLOB_CESTA,
    JSON.stringify(overeny, null, 2),
    {
      ...volby,
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 0,
      ...(etag !== null ? { ifMatch: etag } : {}),
    },
  );
}

async function zmenitDokumentAtomicky(
  mutator: (
    dokument: BranaRadarZalozkyDokument,
  ) => BranaRadarZalozkyDokument,
): Promise<void> {
  for (let pokus = 1; pokus <= CAS_MAX_POKUSU; pokus += 1) {
    const cteni = await nacistDokumentSEtagProZapis();
    const zaklad =
      cteni.stav === "neexistuje"
        ? vychoziRadarZalozkyDokument()
        : parsovatRadarZalozkyDokument(
            JSON.parse(JSON.stringify(cteni.dokument)) as unknown,
          );
    if (!zaklad) {
      throw new Error(BRANA_RADAR_ZALOZKY_CHYBA_CTENI);
    }
    const etag = cteni.stav === "neexistuje" ? null : cteni.etag;
    const dalsi = mutator(zaklad);
    const overeny = parsovatRadarZalozkyDokument(dalsi);
    if (!overeny) {
      throw new Error(
        "Výsledný dokument neprošel validací. Nic nebylo uloženo.",
      );
    }

    try {
      await ulozitDokumentSIfMatch(overeny, etag);
      return;
    } catch (error) {
      if (!(error instanceof BlobPreconditionFailedError)) {
        throw error;
      }
    }
  }

  throw new Error(CHYBA_KONFLIKT);
}

/** Seznam pro admin UI. Chybějící objekt je prázdný seznam, Blob se nevytváří. */
export async function nacistRadarZalozky(): Promise<NacistRadarZalozkyVysledek> {
  noStore();

  if (!(await jeAdminPrihlasen())) {
    return { ok: false };
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
      return { ok: true, polozky: [] };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(cteni.text) as unknown;
    } catch (error) {
      zalogovatChybuCteni("neplatný JSON", error);
      return { ok: false };
    }

    const dokument = parsovatRadarZalozkyDokument(parsed);
    if (!dokument) {
      zalogovatChybuCteni("neplatný tvar dokumentu");
      return { ok: false };
    }

    return { ok: true, polozky: dokument.polozky };
  } catch (error) {
    zalogovatChybuCteni("selhání čtení PRIVATE Blobu", error);
    return { ok: false };
  }
}

function novaPolozka(nazev: string, url: string): BranaRadarZalozka {
  return {
    id: `zalozka-${crypto.randomUUID()}`,
    nazev,
    url,
    pridanoAt: new Date().toISOString(),
  };
}

/** Přidá odkaz na začátek seznamu. Scan, Kalendář ani Učení se nevolají. */
export async function pridatRadarZalozku(
  vstup: unknown,
): Promise<BranaRadarZalozka> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  const validace = validovatRadarZalozkuVstup(vstup);
  if (!validace.ok) {
    throw new Error(validace.chyba);
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit sledované weby: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const polozka = novaPolozka(validace.hodnota.nazev, validace.hodnota.url);
  await zmenitDokumentAtomicky((dokument) => {
    const vysledek = pridatPolozkuDoZalozekDokumentu(dokument, polozka);
    if (!vysledek.ok) {
      throw new Error(vysledek.chyba);
    }
    return vysledek.dokument;
  });
  return polozka;
}

/** Odebere jeden odkaz. Ostatní záznamy administrace nemění. */
export async function smazatRadarZalozku(id: string): Promise<void> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (typeof id !== "string" || !id.trim()) {
    throw new Error("Odkaz už v seznamu není.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit sledované weby: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  await zmenitDokumentAtomicky((dokument) => {
    const vysledek = smazatPolozkuZeZalozekDokumentu(dokument, id);
    if (!vysledek.ok) {
      throw new Error(vysledek.chyba);
    }
    return vysledek.dokument;
  });
}
