import "server-only";

import { get, put, BlobNotFoundError, type GetBlobResult } from "@vercel/blob";
import { unstable_noStore as noStore } from "next/cache";
import type { UlozisteDat } from "./uloziste-dat";
import { ziskatVolbyBlobAsync } from "./env-blob";

/** Cesta k metadata JSON v Blob úložišti */
export const BLOB_CESTA_METADATA = "data/uloziste.json";

const PRAZDNA_DATA: UlozisteDat = {
  polozky: [],
  metriky: [],
  pushOdbery: [],
};

/** Stáhne text metadata – HTTP 304 nemá stream, použije veřejnou URL */
async function stahnoutTextMetadata(vysledek: GetBlobResult): Promise<string> {
  if (vysledek.statusCode === 200 && vysledek.stream) {
    return new Response(vysledek.stream).text();
  }

  if (vysledek.statusCode === 304) {
    const odpoved = await fetch(vysledek.blob.url, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });

    if (!odpoved.ok) {
      throw new Error(
        `Metadata Blob vrátily 304, ale stažení z URL selhalo (HTTP ${odpoved.status})`
      );
    }

    return odpoved.text();
  }

  throw new Error("Nepodařilo se načíst tělo metadata z Blob");
}

/** Stáhne metadata přes veřejnou URL s vynuceným obejitím cache */
async function stahnoutTextMetadataBezCache(url: string): Promise<string> {
  const odpoved = await fetch(`${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  });

  if (!odpoved.ok) {
    throw new Error(
      `Metadata Blob se nepodařilo načíst bez cache (HTTP ${odpoved.status})`
    );
  }

  return odpoved.text();
}

export interface VolbyCteniBlob {
  /** Po zápisu – obejde CDN/SDK cache pro spolehlivé ověření */
  bypassCache?: boolean;
}

/** Načte data z Vercel Blob – správně zpracuje HTTP 304 (Not Modified) */
export async function nacistDataBlob(
  oidcZHeaderu?: string | null,
  volbyCteni?: VolbyCteniBlob
): Promise<UlozisteDat> {
  noStore();
  const volby = await ziskatVolbyBlobAsync(oidcZHeaderu);

  try {
    const vysledek = await get(BLOB_CESTA_METADATA, {
      ...volby,
      access: "public",
    });

    if (!vysledek) {
      return structuredClone(PRAZDNA_DATA);
    }

    const text = volbyCteni?.bypassCache
      ? await stahnoutTextMetadataBezCache(vysledek.blob.url)
      : await stahnoutTextMetadata(vysledek);
    if (!text.trim()) {
      return structuredClone(PRAZDNA_DATA);
    }

    try {
      return normalizovatData(JSON.parse(text) as UlozisteDat);
    } catch {
      throw new Error(
        "Metadata v Blob jsou poškozená (neplatný JSON). Obnovte zálohu nebo opravte soubor data/uloziste.json."
      );
    }
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return structuredClone(PRAZDNA_DATA);
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Nepodařilo se načíst data z Blob úložiště");
  }
}

/** Uloží data do Vercel Blob */
export async function ulozitDataBlob(
  data: UlozisteDat,
  oidcZHeaderu?: string | null
): Promise<void> {
  const volby = await ziskatVolbyBlobAsync(oidcZHeaderu);

  if (!volby.token && !volby.oidcToken) {
    throw new Error(
      "Nelze uložit do Blob: chybí autentizace. Nastavte BLOB_READ_WRITE_TOKEN ve Vercel → Storage → Blob → Tokens."
    );
  }

  await put(BLOB_CESTA_METADATA, JSON.stringify(data, null, 2), {
    ...volby,
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

function normalizovatData(data: UlozisteDat): UlozisteDat {
  return {
    polozky: data.polozky ?? [],
    metriky: data.metriky ?? [],
    metrikyAgregovane: data.metrikyAgregovane,
    pushOdbery: data.pushOdbery ?? [],
    verzeUloziste: data.verzeUloziste,
  };
}
