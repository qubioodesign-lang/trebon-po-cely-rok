import "server-only";

import fs from "fs";
import path from "path";
import { get, list, put } from "@vercel/blob";
import { ziskatVolbyBlobAsync, pouzivatBlobProZalohu } from "@/lib/env-blob";
import {
  ZALOHA_PREFIX,
  type ZalohaInfo,
} from "./typy";
import {
  formatovatCasZalohy,
  jePlatnaCestaZalohy,
  nazevZalohyZPathname,
} from "./pomocne";

const CESTA_LOKALNI_ZALOHY = path.join(process.cwd(), "data", "backups", "manual");

function mapBlobNaZalohu(blob: {
  pathname: string;
  url: string;
  size: number;
  uploadedAt: Date;
}): ZalohaInfo {
  return {
    pathname: blob.pathname,
    url: blob.url,
    velikost: blob.size,
    vytvoreno: blob.uploadedAt.toISOString(),
    nazev: nazevZalohyZPathname(blob.pathname),
  };
}

/** Uloží ZIP zálohu do Blob store */
export async function ulozitZalohuDoBlobu(
  zip: Uint8Array,
  oidcZHeaderu?: string | null
): Promise<ZalohaInfo> {
  const volby = await ziskatVolbyBlobAsync(oidcZHeaderu);

  if (!volby.token && !volby.oidcToken) {
    throw new Error("Nelze uložit zálohu – chybí autentizace k Blob úložišti.");
  }

  const pathname = `${ZALOHA_PREFIX}${formatovatCasZalohy()}-${crypto.randomUUID().slice(0, 8)}.zip`;

  const vysledek = await put(pathname, Buffer.from(zip), {
    ...volby,
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: "application/zip",
  });

  return {
    pathname: vysledek.pathname,
    url: vysledek.url,
    velikost: zip.byteLength,
    vytvoreno: new Date().toISOString(),
    nazev: nazevZalohyZPathname(pathname),
  };
}

function seznamZalohLokalne(): ZalohaInfo[] {
  if (!fs.existsSync(CESTA_LOKALNI_ZALOHY)) {
    return [];
  }

  return fs
    .readdirSync(CESTA_LOKALNI_ZALOHY)
    .filter((soubor) => soubor.endsWith(".zip"))
    .map((soubor) => {
      const cesta = path.join(CESTA_LOKALNI_ZALOHY, soubor);
      const stat = fs.statSync(cesta);
      const pathname = `${ZALOHA_PREFIX}${soubor}`;
      return {
        pathname,
        url: cesta,
        velikost: stat.size,
        vytvoreno: stat.mtime.toISOString(),
        nazev: nazevZalohyZPathname(pathname),
      };
    })
    .sort((a, b) => b.vytvoreno.localeCompare(a.vytvoreno));
}

export function ulozitZalohuLokalne(zip: Uint8Array): ZalohaInfo {
  if (!fs.existsSync(CESTA_LOKALNI_ZALOHY)) {
    fs.mkdirSync(CESTA_LOKALNI_ZALOHY, { recursive: true });
  }

  const nazev = `${formatovatCasZalohy()}-${crypto.randomUUID().slice(0, 8)}.zip`;
  const pathname = `${ZALOHA_PREFIX}${nazev}`;
  const cesta = path.join(CESTA_LOKALNI_ZALOHY, nazev);
  fs.writeFileSync(cesta, zip);

  return {
    pathname,
    url: cesta,
    velikost: zip.byteLength,
    vytvoreno: new Date().toISOString(),
    nazev: nazevZalohyZPathname(pathname),
  };
}

/** Seznam ručních záloh v Blobu nebo lokálně */
export async function seznamZaloh(
  oidcZHeaderu?: string | null
): Promise<ZalohaInfo[]> {
  const lokalni = seznamZalohLokalne();

  if (!pouzivatBlobProZalohu()) {
    return lokalni;
  }

  const volby = await ziskatVolbyBlobAsync(oidcZHeaderu);

  if (volby.token || volby.oidcToken) {
    const vysledek = await list({ prefix: ZALOHA_PREFIX, ...volby });
    const blobZalohy = vysledek.blobs.map(mapBlobNaZalohu);
    const cesty = new Set(blobZalohy.map((zaloha) => zaloha.pathname));

    return [...blobZalohy, ...lokalni.filter((zaloha) => !cesty.has(zaloha.pathname))].sort(
      (a, b) => b.vytvoreno.localeCompare(a.vytvoreno)
    );
  }

  return lokalni;
}

/** Načte obsah ZIP zálohy podle pathname */
export async function nacistZalohuZip(
  pathname: string,
  oidcZHeaderu?: string | null
): Promise<Uint8Array> {
  if (!jePlatnaCestaZalohy(pathname)) {
    throw new Error("Neplatná cesta zálohy.");
  }

  const nazev = pathname.slice(ZALOHA_PREFIX.length);
  const cesta = path.join(CESTA_LOKALNI_ZALOHY, nazev);
  if (fs.existsSync(cesta)) {
    return new Uint8Array(fs.readFileSync(cesta));
  }

  if (pouzivatBlobProZalohu()) {
    const volby = await ziskatVolbyBlobAsync(oidcZHeaderu);
    const vysledek = await get(pathname, { access: "public", ...volby });

    if (!vysledek?.stream) {
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
  }

  throw new Error("Záloha nebyla nalezena.");
}
