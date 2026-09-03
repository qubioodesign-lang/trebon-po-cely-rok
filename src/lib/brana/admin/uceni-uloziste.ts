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
  obdobiUceniPolozek,
  parsovatUceniDokument,
  pridatUceniPolozkuDoDokumentu,
  vychoziUceniDokument,
  type BranaUceniDokument,
  type BranaUceniPolozka,
  type BranaUceniPolozkaVstup,
} from "./uceni";
import {
  zmenitUceniDokumentAtomickySIo,
  type BranaUceniDokumentMutace,
} from "./uceni-cas";

/**
 * Samostatný PRIVATE Blob archivu Učení.
 * Nesmí se míchat s Kalendářem, RADARem ani ruční zálohou BRÁNY.
 */
export const BRANA_UCENI_BLOB_CESTA = "data/brana-uceni.json";

export const BRANA_UCENI_CHYBA_CTENI =
  "Archiv Učení se nepodařilo načíst. Žádná data nebyla změněna.";

export type NacistUceniVysledek =
  | {
      ok: true;
      polozky: BranaUceniPolozka[];
      pocet: number;
      obdobi: { od: string; do: string } | null;
      velikostBajtu: number;
    }
  | { ok: false };

type BlobCteniProZapis =
  | { stav: "neexistuje" }
  | { stav: "ok"; dokument: BranaUceniDokument; etag: string };

function zalogovatChybuUceni(duvod: string, error?: unknown): void {
  if (error === undefined) {
    console.error(`[brana-uceni] ${duvod}`);
    return;
  }
  console.error(`[brana-uceni] ${duvod}`, error);
}

async function nacistDokumentSEtagProZapis(): Promise<BlobCteniProZapis> {
  const volby = ziskatVolbyBranaAdminBlob();

  if (!volby.token) {
    throw new Error("Chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.");
  }

  let etag: string;
  try {
    const meta = await head(BRANA_UCENI_BLOB_CESTA, volby);
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
    const vysledek = await get(BRANA_UCENI_BLOB_CESTA, {
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
      throw new Error(BRANA_UCENI_CHYBA_CTENI);
    }

    const dokument = parsovatUceniDokument(parsed);
    if (!dokument) {
      throw new Error(BRANA_UCENI_CHYBA_CTENI);
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
  dokument: BranaUceniDokument,
  etag: string | null,
): Promise<void> {
  const volby = ziskatVolbyBranaAdminBlob();

  if (!volby.token) {
    throw new Error(
      "Nelze uložit Učení: chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  await put(BRANA_UCENI_BLOB_CESTA, JSON.stringify(dokument, null, 2), {
    ...volby,
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
    ...(etag !== null ? { ifMatch: etag } : {}),
  });
}

async function zmenitUceniDokumentAtomicky<T>(
  mutator: (
    dokument: BranaUceniDokument,
  ) => BranaUceniDokumentMutace<BranaUceniDokument, T>,
): Promise<T> {
  return zmenitUceniDokumentAtomickySIo(
    {
      nacist: nacistDokumentSEtagProZapis,
      vychoziDokument: vychoziUceniDokument,
      validovat: (dokument) => parsovatUceniDokument(dokument),
      ulozit: ulozitDokumentSIfMatch,
      jePreconditionChyba: (error) =>
        error instanceof BlobPreconditionFailedError,
    },
    mutator,
  );
}

function seraditPolozkyProUi(
  polozky: readonly BranaUceniPolozka[],
): BranaUceniPolozka[] {
  return [...polozky].sort((a, b) => {
    const podleUlozeni = b.ulozenoAt.localeCompare(a.ulozenoAt);
    if (podleUlozeni !== 0) {
      return podleUlozeni;
    }
    return b.datumOd.localeCompare(a.datumOd);
  });
}

/** Načte archiv pro admin UI. Chybějící Blob = prázdný archiv. */
export async function nacistUceni(): Promise<NacistUceniVysledek> {
  noStore();

  if (!(await jeAdminPrihlasen())) {
    return { ok: false };
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    return { ok: false };
  }

  try {
    const cteni = await nacistDokumentSEtagProZapis();
    if (cteni.stav === "neexistuje") {
      return {
        ok: true,
        polozky: [],
        pocet: 0,
        obdobi: null,
        velikostBajtu: 0,
      };
    }
    const polozky = seraditPolozkyProUi(cteni.dokument.polozky);
    const text = JSON.stringify(cteni.dokument, null, 2);
    return {
      ok: true,
      polozky,
      pocet: polozky.length,
      obdobi: obdobiUceniPolozek(polozky),
      velikostBajtu: Buffer.byteLength(text, "utf8"),
    };
  } catch (error) {
    zalogovatChybuUceni("načtení selhalo", error);
    return { ok: false };
  }
}

/**
 * Best-effort append do Učení.
 * Nikdy neházej ven — volající primární operace musí zůstat úspěšná.
 */
export async function pridatPolozkuDoUceniBestEffort(
  vstup: BranaUceniPolozkaVstup,
): Promise<void> {
  try {
    if (!maBranaAdminBlobKonfiguraci()) {
      zalogovatChybuUceni("přeskočeno – chybí BLOB_BRANA_ADMIN konfigurace");
      return;
    }

    await zmenitUceniDokumentAtomicky((dokument) => {
      const po = pridatUceniPolozkuDoDokumentu(dokument, vstup, {
        noveId: () => `uceni-${crypto.randomUUID()}`,
        tedIso: new Date().toISOString(),
      });
      if ("chyba" in po) {
        throw new Error(po.chyba);
      }
      return { typ: "zapsat", dokument: po, vysledek: undefined };
    });
  } catch (error) {
    zalogovatChybuUceni("best-effort zápis selhal", error);
  }
}

/** CAS nahrazení prázdným dokumentem. Jen data/brana-uceni.json. */
export async function vyprazdnitUceniArchiv(): Promise<void> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze vyprázdnit Učení: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  await zmenitUceniDokumentAtomicky((dokument) => {
    if (dokument.polozky.length === 0) {
      return { typ: "bezZmeny", vysledek: undefined };
    }
    return {
      typ: "zapsat",
      dokument: vychoziUceniDokument(),
      vysledek: undefined,
    };
  });
}

/** Celý JSON archivu pro stažení (admin). Chybějící Blob = prázdný dokument. */
export async function nacistUceniJsonProStazeni(): Promise<string> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error("Archiv Učení není dostupný.");
  }

  const cteni = await nacistDokumentSEtagProZapis();
  const dokument =
    cteni.stav === "neexistuje" ? vychoziUceniDokument() : cteni.dokument;
  return JSON.stringify(dokument, null, 2);
}
