import "server-only";

import fs from "fs";
import path from "path";
import type { Polozka } from "@/types";
import type { TypUdalostiMetriky } from "@/types";
import { nacistDataBlob, ulozitDataBlob } from "./uloziste-blob";

/** Lokální datový soubor (vývoj bez Blob tokenu) */
const CESTA_LOKALNI = path.join(process.cwd(), "data", "uloziste.json");

/** Seed data v repozitáři */
const CESTA_DEPLOY = path.join(process.cwd(), "data", "uloziste-deploy.json");

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

/** True, pokud je nastaven token pro Vercel Blob */
export function pouzivaBlobUloziste(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** Najde cestu k lokálnímu souboru */
function ziskatCestuKeCteni(): string {
  if (fs.existsSync(CESTA_LOKALNI)) return CESTA_LOKALNI;
  if (fs.existsSync(CESTA_DEPLOY)) return CESTA_DEPLOY;
  return CESTA_LOKALNI;
}

/** Načte data z Blob nebo lokálního souboru */
export async function nacistData(): Promise<UlozisteDat> {
  if (pouzivaBlobUloziste()) {
    return nacistDataBlob();
  }
  return nacistDataLokalne();
}

function nacistDataLokalne(): UlozisteDat {
  const cesta = ziskatCestuKeCteni();

  if (!fs.existsSync(cesta)) {
    ulozitDataLokalne(PRAZDNA_DATA);
    return structuredClone(PRAZDNA_DATA);
  }

  const obsah = fs.readFileSync(cesta, "utf-8");
  const data = JSON.parse(obsah) as UlozisteDat;

  return {
    polozky: data.polozky ?? [],
    metriky: data.metriky ?? [],
    pushOdbery: data.pushOdbery ?? [],
  };
}

/** Uloží data */
export async function ulozitData(data: UlozisteDat): Promise<void> {
  if (pouzivaBlobUloziste()) {
    await ulozitDataBlob(data);
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
  upravitel: (data: UlozisteDat) => void
): Promise<UlozisteDat> {
  const data = await nacistData();
  upravitel(data);
  await ulozitData(data);
  return data;
}

/** Seřadí položky podle pořadí a data publikace */
export function seraditPolozky(polozky: Polozka[]): Polozka[] {
  return [...polozky].sort(
    (a, b) => a.poradi - b.poradi || a.datumPublikace.localeCompare(b.datumPublikace)
  );
}
