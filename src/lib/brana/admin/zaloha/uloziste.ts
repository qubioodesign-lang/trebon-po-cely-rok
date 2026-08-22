import "server-only";

import { BlobNotFoundError, get, list, put } from "@vercel/blob";
import {
  maBranaAdminBlobKonfiguraci,
  ziskatVolbyBranaAdminBlob,
} from "@/lib/brana/admin/env-blob-brana-admin";
import {
  formatovatCasZalohy,
  jePlatnaCestaBranaZalohy,
  nazevZalohyZPathname,
  typZalohyZNazvu,
} from "./pomocne";
import {
  BRANA_ZALOHA_PREFIX,
  type BranaZalohaInfo,
  type BranaZalohaTyp,
} from "./typy";

function overitPrivateStore(): ReturnType<typeof ziskatVolbyBranaAdminBlob> {
  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error("Chybí konfigurace PRIVATE Blob store administrace BRÁNY.");
  }

  const volby = ziskatVolbyBranaAdminBlob();
  if (!volby.token) {
    throw new Error("Chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.");
  }

  return volby;
}

function mapBlobNaZalohu(blob: {
  pathname: string;
  size: number;
  uploadedAt: Date;
}): BranaZalohaInfo {
  const nazev = nazevZalohyZPathname(blob.pathname);
  return {
    pathname: blob.pathname,
    velikost: blob.size,
    vytvoreno: blob.uploadedAt.toISOString(),
    nazev,
    typ: typZalohyZNazvu(nazev),
  };
}

export async function ulozitBranaZalohuZip(
  zip: Uint8Array,
  typ: BranaZalohaTyp,
): Promise<BranaZalohaInfo> {
  const volby = overitPrivateStore();
  const znacka = typ === "zachrana" ? "zachrana-" : "";
  const nazev = `${formatovatCasZalohy()}-${znacka}${crypto.randomUUID().slice(0, 8)}.zip`;
  const pathname = `${BRANA_ZALOHA_PREFIX}${nazev}`;

  if (!jePlatnaCestaBranaZalohy(pathname)) {
    throw new Error("Nelze uložit zálohu – neplatná cesta.");
  }

  await put(pathname, Buffer.from(zip), {
    ...volby,
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: "application/zip",
  });

  return {
    pathname,
    velikost: zip.byteLength,
    vytvoreno: new Date().toISOString(),
    nazev: nazevZalohyZPathname(pathname),
    typ,
  };
}

export async function seznamBranaZaloh(): Promise<BranaZalohaInfo[]> {
  const volby = overitPrivateStore();
  const nalezene: BranaZalohaInfo[] = [];
  let cursor: string | undefined;

  do {
    const vysledek = await list({
      prefix: BRANA_ZALOHA_PREFIX,
      cursor,
      ...volby,
    });
    for (const blob of vysledek.blobs) {
      if (jePlatnaCestaBranaZalohy(blob.pathname)) {
        nalezene.push(mapBlobNaZalohu(blob));
      }
    }
    cursor = vysledek.hasMore ? vysledek.cursor : undefined;
  } while (cursor);

  return nalezene.sort((a, b) => b.vytvoreno.localeCompare(a.vytvoreno));
}

export async function nacistBranaZalohuZip(
  pathname: string,
): Promise<Uint8Array> {
  if (!jePlatnaCestaBranaZalohy(pathname)) {
    throw new Error("Neplatná cesta zálohy.");
  }

  const volby = overitPrivateStore();

  try {
    const vysledek = await get(pathname, {
      access: "private",
      ...volby,
    });

    if (vysledek === null || !vysledek.stream) {
      throw new Error("Záloha nebyla nalezena.");
    }

    const reader = vysledek.stream.getReader();
    const casti: Uint8Array[] = [];
    let celkem = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        casti.push(value);
        celkem += value.byteLength;
      }
    }

    const buffer = new Uint8Array(celkem);
    let offset = 0;
    for (const cast of casti) {
      buffer.set(cast, offset);
      offset += cast.byteLength;
    }

    return buffer;
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      throw new Error("Záloha nebyla nalezena.");
    }
    throw error;
  }
}
