import "server-only";

import { put } from "@vercel/blob";
import { unstable_noStore as noStore } from "next/cache";
import type { UlozisteDat } from "./uloziste-dat";
import { ziskatEnv, ziskatVolbyBlobAsync } from "./env-blob";

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
  const storeId = ziskatEnv("BLOB_STORE_ID");
  if (!storeId) {
    throw new Error(
      "Chybí BLOB_STORE_ID – nelze načíst metadata z Blob. Nastavte ji ve Vercel → Storage → Blob."
    );
  }

  return `https://${storeId}.public.blob.vercel-storage.com/${BLOB_CESTA_METADATA}`;
}

/** Stáhne metadata přes veřejnou URL (bez Bearer tokenu) */
async function stahnoutMetadataVerejne(
  url: string,
  bypassCache: boolean
): Promise<string | null> {
  const fetchUrl = bypassCache
    ? `${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`
    : url;

  const odpoved = await fetch(fetchUrl, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
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

/** Načte data z Vercel Blob – pouze veřejný fetch, bez autentizovaného get() */
export async function nacistDataBlob(
  _oidcZHeaderu?: string | null,
  volbyCteni?: VolbyCteniBlob
): Promise<UlozisteDat> {
  noStore();

  try {
    const url = sestavitVerejneUrlMetadata();
    const text = await stahnoutMetadataVerejne(
      url,
      volbyCteni?.bypassCache ?? false
    );

    if (!text?.trim()) {
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
