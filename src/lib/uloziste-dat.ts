import fs from "fs";
import path from "path";
import type { Polozka, TypUdalostiMetriky } from "@/types";

/** Lokální datový soubor (gitignored) */
const CESTA_LOKALNI = path.join(process.cwd(), "data", "uloziste.json");

/** Seed data pro deploy na Vercel (commitováno v gitu) */
const CESTA_DEPLOY = path.join(process.cwd(), "data", "uloziste-deploy.json");

/** Na Vercelu je souborový systém pouze ke čtení – zápisy nejsou trvalé */
const JE_VERCEL = process.env.VERCEL === "1";

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

/** Vrátí true, pokud lze data zapisovat na disk */
function lzeZapisovat(): boolean {
  return !JE_VERCEL;
}

/** Najde cestu k datovému souboru – lokální má přednost před deploy seedem */
function ziskatCestuKeCteni(): string {
  if (fs.existsSync(CESTA_LOKALNI)) return CESTA_LOKALNI;
  if (fs.existsSync(CESTA_DEPLOY)) return CESTA_DEPLOY;
  return CESTA_LOKALNI;
}

/** Načte data z JSON souboru */
export function nacistData(): UlozisteDat {
  const cesta = ziskatCestuKeCteni();

  if (!fs.existsSync(cesta)) {
    if (lzeZapisovat()) {
      ulozitData(PRAZDNA_DATA);
    }
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

/** Uloží data atomicky přes dočasný soubor (pouze lokálně) */
export function ulozitData(data: UlozisteDat): void {
  if (!lzeZapisovat()) return;

  try {
    const adresar = path.dirname(CESTA_LOKALNI);
    if (!fs.existsSync(adresar)) {
      fs.mkdirSync(adresar, { recursive: true });
    }

    const docasny = CESTA_LOKALNI + ".tmp";
    fs.writeFileSync(docasny, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(docasny, CESTA_LOKALNI);
  } catch {
    // Na read-only prostředí (Vercel) zápis tiše přeskočíme
  }
}

/** Provede změnu dat a uloží je (zápis na Vercelu se neprovádí) */
export function upravitData(upravitel: (data: UlozisteDat) => void): UlozisteDat {
  const data = nacistData();
  upravitel(data);
  ulozitData(data);
  return data;
}

/** Seřadí položky podle pořadí a data publikace */
export function seraditPolozky(polozky: Polozka[]): Polozka[] {
  return [...polozky].sort(
    (a, b) => a.poradi - b.poradi || a.datumPublikace.localeCompare(b.datumPublikace)
  );
}

/** Vrátí true, pokud běžíme na Vercelu (pro UI upozornění v administraci) */
export function jeVercelProstredi(): boolean {
  return JE_VERCEL;
}
