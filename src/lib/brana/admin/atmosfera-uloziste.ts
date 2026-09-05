import "server-only";

import {
  BlobNotFoundError,
  BlobPreconditionFailedError,
  get,
  head,
  put,
} from "@vercel/blob";
import { unstable_noStore as noStore } from "next/cache";
import {
  maBranaAdminBlobKonfiguraci,
  ziskatVolbyBranaAdminBlob,
} from "./env-blob-brana-admin";
import {
  BRANA_ATMOSFERA_BLOB_CESTA,
  BRANA_ATMOSFERA_PREDCHOZI_JPEG_CESTA,
  otiskJpegSha256,
  parsovatAtmosferaDokument,
  vychoziAtmosferaDokument,
  type BranaAtmosferaDokument,
} from "./atmosfera";
import {
  zmenitAtmosferaDokumentAtomickySIo,
  type BranaAtmosferaDokumentMutace,
} from "./atmosfera-cas";

export { BRANA_ATMOSFERA_BLOB_CESTA, BRANA_ATMOSFERA_PREDCHOZI_JPEG_CESTA };

type BlobCteniProZapis =
  | { stav: "neexistuje" }
  | { stav: "ok"; dokument: BranaAtmosferaDokument; etag: string };

function zalogovatChybuAtmosfery(duvod: string, error?: unknown): void {
  if (error === undefined) {
    console.error(`[brana-atmosfera] ${duvod}`);
    return;
  }
  console.error(`[brana-atmosfera] ${duvod}`, error);
}

async function nacistDokumentSEtagProZapis(): Promise<BlobCteniProZapis> {
  const volby = ziskatVolbyBranaAdminBlob();
  if (!volby.token) {
    throw new Error("Chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.");
  }

  let etag: string;
  try {
    const meta = await head(BRANA_ATMOSFERA_BLOB_CESTA, volby);
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
    const vysledek = await get(BRANA_ATMOSFERA_BLOB_CESTA, {
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
      throw new Error("Atmosféra dokument je poškozený.");
    }

    const dokument = parsovatAtmosferaDokument(parsed);
    if (!dokument) {
      throw new Error("Atmosféra dokument je neplatný.");
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
  dokument: BranaAtmosferaDokument,
  etag: string | null,
): Promise<void> {
  const volby = ziskatVolbyBranaAdminBlob();
  if (!volby.token) {
    throw new Error(
      "Nelze uložit Atmosféru: chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  await put(BRANA_ATMOSFERA_BLOB_CESTA, JSON.stringify(dokument, null, 2), {
    ...volby,
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
    ...(etag !== null ? { ifMatch: etag } : {}),
  });
}

async function zmenitAtmosferaDokumentAtomicky<T>(
  mutator: (
    dokument: BranaAtmosferaDokument,
  ) => BranaAtmosferaDokumentMutace<BranaAtmosferaDokument, T>,
): Promise<T> {
  return zmenitAtmosferaDokumentAtomickySIo(
    {
      nacist: nacistDokumentSEtagProZapis,
      vychoziDokument: () => vychoziAtmosferaDokument(),
      validovat: (dokument) => parsovatAtmosferaDokument(dokument),
      ulozit: ulozitDokumentSIfMatch,
      jePreconditionChyba: (error) =>
        error instanceof BlobPreconditionFailedError,
    },
    mutator,
  );
}

/** Read-only načtení stavu. Při chybě null (fail-soft). */
export async function nacistAtmosferaDokument(): Promise<BranaAtmosferaDokument | null> {
  noStore();
  if (!maBranaAdminBlobKonfiguraci()) {
    return null;
  }
  try {
    const cteni = await nacistDokumentSEtagProZapis();
    if (cteni.stav === "neexistuje") {
      return vychoziAtmosferaDokument();
    }
    return cteni.dokument;
  } catch (error) {
    zalogovatChybuAtmosfery("načtení stavu selhalo", error);
    return null;
  }
}

/**
 * Read-only pro cron dedup: neexistující Blob / chyba → null
 * (nesmí se tvářit jako právě dokončená kontrola).
 */
export async function nacistAtmosferaDokumentPokudExistuje(): Promise<BranaAtmosferaDokument | null> {
  noStore();
  if (!maBranaAdminBlobKonfiguraci()) {
    return null;
  }
  try {
    const cteni = await nacistDokumentSEtagProZapis();
    if (cteni.stav === "neexistuje") {
      return null;
    }
    return cteni.dokument;
  } catch (error) {
    zalogovatChybuAtmosfery("načtení stavu pro dedup selhalo", error);
    return null;
  }
}

/**
 * Pracovní JPEG jen když metadata existují a SHA-256 bajtů sedí.
 * Při neshodě hashe vrátí null (previous se nepoužije) — Atmosféru nepoškodí.
 */
export async function nacistPredchoziPracovniJpeg(): Promise<{
  bajty: Buffer;
  snimekAtIso: string;
  sha256: string;
} | null> {
  noStore();
  if (!maBranaAdminBlobKonfiguraci()) {
    return null;
  }

  const dokument = await nacistAtmosferaDokument();
  if (!dokument?.pracovniJpegAt || !dokument.pracovniJpegSha256) {
    return null;
  }

  const volby = ziskatVolbyBranaAdminBlob();
  try {
    const vysledek = await get(BRANA_ATMOSFERA_PREDCHOZI_JPEG_CESTA, {
      access: "private",
      useCache: false,
      ...volby,
    });
    if (vysledek === null || !vysledek.stream) {
      return null;
    }
    const bajty = Buffer.from(
      await new Response(vysledek.stream).arrayBuffer(),
    );
    if (bajty.length < 100 || bajty[0] !== 0xff || bajty[1] !== 0xd8) {
      return null;
    }

    const sha256 = otiskJpegSha256(bajty);
    if (sha256 !== dokument.pracovniJpegSha256.toLowerCase()) {
      zalogovatChybuAtmosfery(
        "pracovní JPEG neodpovídá pracovniJpegSha256 — previous odmítnut",
      );
      return null;
    }

    return {
      bajty,
      snimekAtIso: dokument.pracovniJpegAt,
      sha256,
    };
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return null;
    }
    zalogovatChybuAtmosfery("načtení předchozího JPEG selhalo", error);
    return null;
  }
}

export async function ulozitAtmosferaDokument(
  dokument: BranaAtmosferaDokument,
): Promise<void> {
  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit Atmosféru: chybí BLOB_BRANA_ADMIN konfigurace.",
    );
  }

  await zmenitAtmosferaDokumentAtomicky(() => ({
    typ: "zapsat",
    dokument,
    vysledek: undefined,
  }));
}

/**
 * Nastaví ruční override. Nemění automatická pole ani zkontrolovanoAt.
 */
export async function nastavitAtmosferaRucniText(
  text: string,
): Promise<BranaAtmosferaDokument> {
  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit Atmosféru: chybí BLOB_BRANA_ADMIN konfigurace.",
    );
  }

  const tedIso = new Date().toISOString();
  return zmenitAtmosferaDokumentAtomicky((dokument) => ({
    typ: "zapsat",
    dokument: {
      ...dokument,
      rucniText: text,
      rucniTextAt: tedIso,
    },
    vysledek: {
      ...dokument,
      rucniText: text,
      rucniTextAt: tedIso,
    },
  }));
}

/**
 * Zruší ruční override. Nemění automatický stav; bez AI.
 */
export async function zrusitAtmosferaRucniText(): Promise<BranaAtmosferaDokument> {
  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit Atmosféru: chybí BLOB_BRANA_ADMIN konfigurace.",
    );
  }

  return zmenitAtmosferaDokumentAtomicky((dokument) => {
    if (dokument.rucniText === null && dokument.rucniTextAt === null) {
      return { typ: "bezZmeny", vysledek: dokument };
    }
    const dalsi = {
      ...dokument,
      rucniText: null,
      rucniTextAt: null,
    };
    return { typ: "zapsat", dokument: dalsi, vysledek: dalsi };
  });
}

/** Přepíše jediný pracovní JPEG. Žádný archiv. */
export async function ulozitPredchoziPracovniJpeg(
  bajty: Buffer,
): Promise<void> {
  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit JPEG Atmosféry: chybí BLOB_BRANA_ADMIN konfigurace.",
    );
  }
  const volby = ziskatVolbyBranaAdminBlob();
  if (!volby.token) {
    throw new Error(
      "Nelze uložit JPEG Atmosféry: chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  await put(BRANA_ATMOSFERA_PREDCHOZI_JPEG_CESTA, bajty, {
    ...volby,
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "image/jpeg",
    cacheControlMaxAge: 0,
  });
}
