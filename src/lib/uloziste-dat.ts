import "server-only";

import fs from "fs";
import path from "path";
import { cache } from "react";
import type { Polozka } from "@/types";
import type { TypUdalostiMetriky } from "@/types";
import { nacistDataBlob, ulozitDataBlob } from "./uloziste-blob";
import { pouzivaBlobUloziste } from "./env-blob";

export { pouzivaBlobUloziste } from "./env-blob";

/** Lokální datový soubor (vývoj bez Blob tokenu) */
const CESTA_LOKALNI = path.join(process.cwd(), "data", "uloziste.json");

/** Záznam metriky v úložišti */
export interface ZaznamMetriky {
  id: string;
  typ: TypUdalostiMetriky;
  polozkaId?: string;
  navstevnikId?: string;
  vytvoreno: string;
}

/** Push subscription v úložišti */
export interface PushOdber {
  endpoint: string;
  klicP256dh: string;
  klicAuth: string;
  vytvoreno: string;
}

/** Struktura celého úložiště */
export interface UlozisteDat {
  polozky: Polozka[];
  metriky: ZaznamMetriky[];
  pushOdbery: PushOdber[];
}

const PRAZDNA_DATA: UlozisteDat = {
  polozky: [],
  metriky: [],
  pushOdbery: [],
};

/** Načte data z Blob nebo lokálního souboru – v rámci jednoho requestu jen jednou */
export const nacistData = cache(async function nacistData(
  oidcZHeaderu?: string | null
): Promise<UlozisteDat> {
  if (pouzivaBlobUloziste()) {
    return nacistDataBlob(oidcZHeaderu);
  }
  return nacistDataLokalne();
});

function nacistDataLokalne(): UlozisteDat {
  if (!fs.existsSync(CESTA_LOKALNI)) {
    ulozitDataLokalne(PRAZDNA_DATA);
    return structuredClone(PRAZDNA_DATA);
  }

  const obsah = fs.readFileSync(CESTA_LOKALNI, "utf-8");
  const data = JSON.parse(obsah) as UlozisteDat;

  return {
    polozky: data.polozky ?? [],
    metriky: data.metriky ?? [],
    pushOdbery: data.pushOdbery ?? [],
  };
}

/** Uloží data */
export async function ulozitData(
  data: UlozisteDat,
  oidcZHeaderu?: string | null
): Promise<void> {
  if (pouzivaBlobUloziste()) {
    await ulozitDataBlob(data, oidcZHeaderu);
    return;
  }
  ulozitDataLokalne(data);
}

function ulozitDataLokalne(data: UlozisteDat): void {
  const adresar = path.dirname(CESTA_LOKALNI);
  if (!fs.existsSync(adresar)) {
    fs.mkdirSync(adresar, { recursive: true });
  }

  const docasny = CESTA_LOKALNI + ".tmp";
  fs.writeFileSync(docasny, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(docasny, CESTA_LOKALNI);
}

/** Provede změnu dat a uloží je */
export async function upravitData(
  upravitel: (data: UlozisteDat) => void,
  oidcZHeaderu?: string | null
): Promise<UlozisteDat> {
  const data = await nacistData(oidcZHeaderu);
  upravitel(data);
  await ulozitData(data, oidcZHeaderu);
  return data;
}

/** Seřadí položky podle pořadí a data publikace */
export function seraditPolozky(polozky: Polozka[]): Polozka[] {
  return [...polozky].sort(
    (a, b) => a.poradi - b.poradi || a.datumPublikace.localeCompare(b.datumPublikace)
  );
}
