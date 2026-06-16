import "server-only";

import { get, put, BlobNotFoundError } from "@vercel/blob";
import type { UlozisteDat } from "./uloziste-dat";
import { ziskatVolbyBlobAsync } from "./env-blob";

/** Cesta k metadata JSON v Blob úložišti */
export const BLOB_CESTA_METADATA = "data/uloziste.json";

const PRAZDNA_DATA: UlozisteDat = {
  polozky: [],
  metriky: [],
  pushOdbery: [],
};

/** Načte data z Vercel Blob – nikdy nepřepisuje seedem při chybě */
export async function nacistDataBlob(oidcZHeaderu?: string | null): Promise<UlozisteDat> {
  const volby = await ziskatVolbyBlobAsync(oidcZHeaderu);

  try {
    const vysledek = await get(BLOB_CESTA_METADATA, {
      ...volby,
      access: "public",
    });

    // Soubor metadata ještě neexistuje
    if (!vysledek || vysledek.statusCode !== 200 || !vysledek.stream) {
      return structuredClone(PRAZDNA_DATA);
    }

    const text = await new Response(vysledek.stream).text();
    return normalizovatData(JSON.parse(text) as UlozisteDat);
  } catch (error) {
    // Pouze skutečně chybějící soubor → prázdná galerie
    if (error instanceof BlobNotFoundError) {
      return structuredClone(PRAZDNA_DATA);
    }
    // Auth/síťová chyba – nevracet seed, nechat projít dál
    throw error;
  }
}

/** Uloží data do Vercel Blob */
export async function ulozitDataBlob(
  data: UlozisteDat,
  oidcZHeaderu?: string | null
): Promise<void> {
  const volby = await ziskatVolbyBlobAsync(oidcZHeaderu);

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
    pushOdbery: data.pushOdbery ?? [],
  };
}
