import "server-only";

import fs from "fs";
import path from "path";
import { del, get, list, put } from "@vercel/blob";
import { BlobNotFoundError } from "@vercel/blob";
import { pouzivaBlobUloziste, ziskatVolbyBlobAsync } from "@/lib/env-blob";
import { BRANA_VZKAZ_BLOB_PREFIX } from "./konstanty";
import type { BranaVzkaz } from "./types";

const CESTA_LOKALNI_VZKAZY = path.join(process.cwd(), "data", "brana-vzkazy");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function overitId(id: string): void {
  if (!UUID_RE.test(id)) {
    throw new Error("Neplatné ID vzkazu");
  }
}

function cestaBlobProId(id: string): string {
  overitId(id);
  return `${BRANA_VZKAZ_BLOB_PREFIX}${id}.json`;
}

function cestaLokalniProId(id: string): string {
  overitId(id);
  return path.join(CESTA_LOKALNI_VZKAZY, `${id}.json`);
}

function parsovatVzkaz(text: string): BranaVzkaz | null {
  try {
    const data = JSON.parse(text) as Partial<BranaVzkaz>;
    if (
      typeof data.id !== "string" ||
      typeof data.text !== "string" ||
      typeof data.vytvoreno !== "string"
    ) {
      return null;
    }

    return {
      id: data.id,
      text: data.text.trim(),
      vytvoreno: data.vytvoreno,
    };
  } catch {
    return null;
  }
}

async function nacistTextBlob(
  pathname: string,
  oidcZHeaderu?: string | null,
): Promise<string | null> {
  const volby = await ziskatVolbyBlobAsync(oidcZHeaderu);
  const vysledek = await get(pathname, { access: "public", ...volby });

  if (!vysledek?.stream) {
    return null;
  }

  return new Response(vysledek.stream).text();
}

/** Uloží jeden vzkaz BRÁNY jako samostatný soubor */
export async function ulozitBranaVzkazSoubor(
  vzkaz: BranaVzkaz,
  oidcZHeaderu?: string | null,
): Promise<void> {
  overitId(vzkaz.id);
  const telo = JSON.stringify(vzkaz);

  if (pouzivaBlobUloziste()) {
    const volby = await ziskatVolbyBlobAsync(oidcZHeaderu);

    if (!volby.token && !volby.oidcToken) {
      throw new Error(
        "Nelze uložit vzkaz: chybí autentizace k Blob. Nastavte BLOB_READ_WRITE_TOKEN ve Vercel → Storage → Blob → Tokens.",
      );
    }

    await put(cestaBlobProId(vzkaz.id), telo, {
      ...volby,
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: "application/json",
      cacheControlMaxAge: 0,
    });

    return;
  }

  if (!fs.existsSync(CESTA_LOKALNI_VZKAZY)) {
    fs.mkdirSync(CESTA_LOKALNI_VZKAZY, { recursive: true });
  }

  const cesta = cestaLokalniProId(vzkaz.id);
  if (fs.existsSync(cesta)) {
    return;
  }

  fs.writeFileSync(cesta, telo, "utf-8");
}

/** Smaže soubor vzkazu BRÁNY z Blobu nebo lokálního úložiště */
export async function smazatBranaVzkazSoubor(
  id: string,
  oidcZHeaderu?: string | null,
): Promise<void> {
  if (pouzivaBlobUloziste()) {
    const volby = await ziskatVolbyBlobAsync(oidcZHeaderu);

    try {
      await del(cestaBlobProId(id), volby);
    } catch (error) {
      if (error instanceof BlobNotFoundError) {
        return;
      }
      throw error;
    }

    return;
  }

  const cesta = cestaLokalniProId(id);
  if (fs.existsSync(cesta)) {
    fs.unlinkSync(cesta);
  }
}

/** Načte všechny vzkazy BRÁNY – pro budoucí redakční administraci */
export async function nacistVsechnyBranaVzkazyZeSouboru(
  oidcZHeaderu?: string | null,
): Promise<BranaVzkaz[]> {
  if (pouzivaBlobUloziste()) {
    const volby = await ziskatVolbyBlobAsync(oidcZHeaderu);

    if (!volby.token && !volby.oidcToken) {
      return [];
    }

    const vysledek = await list({ prefix: BRANA_VZKAZ_BLOB_PREFIX, ...volby });
    const vzkazy = await Promise.all(
      vysledek.blobs.map(async (blob) => {
        try {
          const text = await nacistTextBlob(blob.pathname, oidcZHeaderu);
          if (!text) {
            return null;
          }
          return parsovatVzkaz(text);
        } catch {
          return null;
        }
      }),
    );

    return vzkazy.filter((vzkaz): vzkaz is BranaVzkaz => vzkaz !== null);
  }

  if (!fs.existsSync(CESTA_LOKALNI_VZKAZY)) {
    return [];
  }

  const vzkazy: BranaVzkaz[] = [];

  for (const nazev of fs.readdirSync(CESTA_LOKALNI_VZKAZY)) {
    if (!nazev.endsWith(".json")) {
      continue;
    }

    try {
      const text = fs.readFileSync(
        path.join(CESTA_LOKALNI_VZKAZY, nazev),
        "utf-8",
      );
      const vzkaz = parsovatVzkaz(text);
      if (vzkaz) {
        vzkazy.push(vzkaz);
      }
    } catch {
      // poškozený soubor přeskočíme
    }
  }

  return vzkazy;
}
