import "server-only";

import { head, put, del } from "@vercel/blob";
import fs from "fs";
import path from "path";
import type { UlozisteDat } from "./uloziste-dat";

/** Cesta k metadata JSON v Blob úložišti */
export const BLOB_CESTA_METADATA = "data/uloziste.json";

const CESTA_DEPLOY = path.join(process.cwd(), "data", "uloziste-deploy.json");

/** Načte data z Vercel Blob */
export async function nacistDataBlob(): Promise<UlozisteDat> {
  try {
    const meta = await head(BLOB_CESTA_METADATA);
    const odpoved = await fetch(meta.url);

    if (!odpoved.ok) {
      throw new Error("Metadata nejsou dostupná");
    }

    const data = (await odpoved.json()) as UlozisteDat;
    return normalizovatData(data);
  } catch {
    const seed = nacistDeploySeed();
    await ulozitDataBlob(seed);
    return seed;
  }
}

/** Uloží data do Vercel Blob (přepíše existující soubor) */
export async function ulozitDataBlob(data: UlozisteDat): Promise<void> {
  try {
    const existujici = await head(BLOB_CESTA_METADATA);
    await del(existujici.url);
  } catch {
    // Soubor zatím neexistuje
  }

  await put(BLOB_CESTA_METADATA, JSON.stringify(data, null, 2), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
  });
}

/** Načte výchozí seed z repozitáře pro první inicializaci Blob */
function nacistDeploySeed(): UlozisteDat {
  if (fs.existsSync(CESTA_DEPLOY)) {
    const obsah = fs.readFileSync(CESTA_DEPLOY, "utf-8");
    return normalizovatData(JSON.parse(obsah) as UlozisteDat);
  }

  return { polozky: [], metriky: [], pushOdbery: [] };
}

function normalizovatData(data: UlozisteDat): UlozisteDat {
  return {
    polozky: data.polozky ?? [],
    metriky: data.metriky ?? [],
    pushOdbery: data.pushOdbery ?? [],
  };
}
