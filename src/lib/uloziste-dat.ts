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

/** Agregované countery metrik – místo append-only logu */
export interface MetrikyAgregovane {
  pocetNavstev: number;
  pocetZobrazeniFotografii: number;
  pocetPosunuVpred: number;
  pocetNavratuZpet: number;
  pocetKliknutiChciSeVracet: number;
  pocetPovolenychUpozorneni: number;
  navstevyPodleNavstevnika: Record<string, number>;
}

/** Struktura celého úložiště */
export interface UlozisteDat {
  polozky: Polozka[];
  /** @deprecated Migrováno do metrikyAgregovane */
  metriky: ZaznamMetriky[];
  metrikyAgregovane?: MetrikyAgregovane;
  pushOdbery: PushOdber[];
  /** Interní čítač – detekce ztráty souběžného zápisu */
  verzeUloziste?: number;
}

/** Volby pro bezpečný zápis s ověřením po uložení */
export interface VolbyUpravyDat {
  overitPoUlozeni?: (data: UlozisteDat) => boolean;
}

const MAX_POKUSY_ZAPISU = 5;

/** Fronta zápisů – serializuje upravitData v rámci instance */
let radZapisu: Promise<unknown> = Promise.resolve();

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
    metrikyAgregovane: data.metrikyAgregovane,
    pushOdbery: data.pushOdbery ?? [],
    verzeUloziste: data.verzeUloziste,
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

/** Načte aktuální data pro zápis – vždy čerstvě z úložiště, bez React cache */
async function nacistDataProZapis(
  oidcZHeaderu?: string | null
): Promise<UlozisteDat> {
  if (pouzivaBlobUloziste()) {
    return nacistDataBlob(oidcZHeaderu);
  }
  return nacistDataLokalne();
}

/**
 * Provede změnu dat a uloží je.
 * Zápisy jsou serializované; při kolizi se znovu načte aktuální stav a operace se opakuje.
 */
export async function upravitData(
  upravitel: (data: UlozisteDat) => void,
  oidcZHeaderu?: string | null,
  volby?: VolbyUpravyDat
): Promise<UlozisteDat> {
  const spustit = async (): Promise<UlozisteDat> => {
    let posledniChyba: unknown;

    for (let pokus = 0; pokus < MAX_POKUSY_ZAPISU; pokus++) {
      try {
        const data = await nacistDataProZapis(oidcZHeaderu);
        upravitel(data);
        data.verzeUloziste = (data.verzeUloziste ?? 0) + 1;
        await ulozitData(data, oidcZHeaderu);

        if (volby?.overitPoUlozeni) {
          const kontrola = await nacistDataProZapis(oidcZHeaderu);
          if (!volby.overitPoUlozeni(kontrola)) {
            continue;
          }
          return kontrola;
        }

        return data;
      } catch (error) {
        posledniChyba = error;
      }
    }

    if (volby?.overitPoUlozeni) {
      throw new Error(
        "Nepodařilo se uložit data – souběžný zápis přepsal změnu. Zkuste akci znovu."
      );
    }

    throw posledniChyba instanceof Error
      ? posledniChyba
      : new Error("Nepodařilo se uložit data");
  };

  const vysledek = radZapisu.then(spustit, spustit);
  radZapisu = vysledek.catch(() => undefined);
  return vysledek;
}

/** Seřadí položky podle pořadí a data publikace */
export function seraditPolozky(polozky: Polozka[]): Polozka[] {
  return [...polozky].sort(
    (a, b) => a.poradi - b.poradi || a.datumPublikace.localeCompare(b.datumPublikace)
  );
}
