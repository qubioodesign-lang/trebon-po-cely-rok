import "server-only";

import { get, put } from "@vercel/blob";
import { unstable_noStore as noStore } from "next/cache";
import type { UlozisteDat } from "./uloziste-dat";
import { normalizovatUloziste } from "./uloziste-normalizace";
import { ziskatBlobStoreId, ziskatVolbyBlobAsync } from "./env-blob";

/** Cesta k metadata JSON v Blob úložišti */
export const BLOB_CESTA_METADATA = "data/uloziste.json";

const PRAZDNA_DATA: UlozisteDat = {
  polozky: [],
  metriky: [],
  pushOdbery: [],
};

export interface VolbyCteniBlob {
  /** Po zápisu – obejde CDN cache pro spolehlivé ověření */
  bypassCache?: boolean;
}

/** Veřejná URL metadat – čtení bez autentizovaného Blob get() */
function sestavitVerejneUrlMetadata(): string {
  const storeId = ziskatBlobStoreId();
  if (!storeId) {
    throw new Error(
      "Chybí BLOB_STORE_ID – nelze načíst metadata z Blob. Nastavte ji ve Vercel → Storage → Blob."
    );
  }

  return `https://${storeId}.public.blob.vercel-storage.com/${BLOB_CESTA_METADATA}`;
}

async function nacistTextZBlobGet(
  pathname: string,
  volby: { storeId?: string; token?: string; oidcToken?: string }
): Promise<string | null> {
  const vysledek = await get(pathname, { access: "public", ...volby });

  if (!vysledek?.stream) {
    return null;
  }

  return new Response(vysledek.stream).text();
}

/** Stáhne metadata přes veřejnou URL (bez Bearer tokenu) */
async function stahnoutMetadataVerejne(
  url: string,
  bypassCache: boolean
): Promise<string | null> {
  const fetchUrl = bypassCache
    ? `${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    : url;

  const odpoved = await fetch(fetchUrl, {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
    },
  });

  if (odpoved.status === 404) {
    return null;
  }

  if (!odpoved.ok) {
    throw new Error(
      `Metadata Blob se nepodařilo načíst (HTTP ${odpoved.status})`
    );
  }

  return odpoved.text();
}

function parsovatMetadata(text: string | null): UlozisteDat {
  if (!text?.trim()) {
    return structuredClone(PRAZDNA_DATA);
  }

  try {
    return normalizovatUloziste(JSON.parse(text) as UlozisteDat);
  } catch {
    throw new Error(
      "Metadata v Blob jsou poškozená (neplatný JSON). Obnovte zálohu nebo opravte soubor data/uloziste.json."
    );
  }
}

/** Načte data z Vercel Blob – autentizované get() nebo veřejný fetch bez CDN cache */
export async function nacistDataBlob(
  oidcZHeaderu?: string | null,
  volbyCteni?: VolbyCteniBlob
): Promise<UlozisteDat> {
  noStore();

  const bypassCache = volbyCteni?.bypassCache ?? true;
  const volby = await ziskatVolbyBlobAsync(oidcZHeaderu);

  if (volby.token || volby.oidcToken) {
    try {
      const text = await nacistTextZBlobGet(BLOB_CESTA_METADATA, volby);
      if (text !== null) {
        return parsovatMetadata(text);
      }
    } catch {
      // Fallback na veřejný fetch níže
    }
  }

  try {
    const url = sestavitVerejneUrlMetadata();
    const text = await stahnoutMetadataVerejne(url, bypassCache);
    return parsovatMetadata(text);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Nepodařilo se načíst data z Blob úložiště");
  }
}

/** Uloží data do Vercel Blob (autentizovaný put) */
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
    cacheControlMaxAge: 0,
  });
}

/** Stáhne metadata tak, jak je vidí veřejný web (veřejná URL, bez CDN cache) */
export async function nacistMetadataVerejne(): Promise<UlozisteDat> {
  noStore();
  const url = sestavitVerejneUrlMetadata();
  const text = await stahnoutMetadataVerejne(url, true);
  return parsovatMetadata(text);
}
