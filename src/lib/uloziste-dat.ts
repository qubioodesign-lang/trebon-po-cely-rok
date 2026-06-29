import "server-only";

import fs from "fs";
import path from "path";
import { cache } from "react";
import type { Polozka } from "@/types";
import type { TypUdalostiMetriky } from "@/types";
import { nacistDataBlob, ulozitDataBlob, nacistMetadataVerejne } from "./uloziste-blob";
import { normalizovatUloziste } from "./uloziste-normalizace";
import { pouzivaBlobUloziste } from "./env-blob";
import type { AnalyticsAgregovane } from "./analytics";
import type { ProlnutiCasovaniUlozene } from "./prolnuti-casovani";
import type { TypZarizeni } from "./zarizeni-navstevnika";

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
  /** Kategorie zařízení při registraci – volitelné u starších odběrů */
  zarizeni?: TypZarizeni;
}

/** Agregované countery metrik – místo append-only logu */
export interface MetrikyAgregovane {
  pocetNavstev: number;
  pocetZobrazeniFotografii: number;
  pocetPosunuVpred: number;
  pocetNavratuZpet: number;
  pocetKliknutiChciSeVracet: number;
  pocetPovolenychUpozorneni: number;
  pocetReplayProlnuti: number;
  navstevyPodleNavstevnika: Record<string, number>;
}

/** Struktura celého úložiště */
export interface UlozisteDat {
  polozky: Polozka[];
  /** @deprecated Migrováno do metrikyAgregovane */
  metriky: ZaznamMetriky[];
  metrikyAgregovane?: MetrikyAgregovane;
  analyticsAgregovane?: AnalyticsAgregovane;
  pushOdbery: PushOdber[];
  /** Upravitelné časy prolnutí z administrace */
  prolnutiCasovani?: ProlnutiCasovaniUlozene;
  /** Fotografie desktopové pozvánky (mimo galerii) */
  desktopPozvankaFotografie?: string | null;
  /** Interní čítač – detekce ztráty souběžného zápisu */
  verzeUloziste?: number;
}

/** Volby pro bezpečný zápis s ověřením po uložení */
export interface VolbyUpravyDat {
  overitPoUlozeni?: (data: UlozisteDat) => boolean;
  /** Vlastní chyba po vyčerpání pokusů (jen s overitPoUlozeni) */
  chybovaZprava?: string;
  /** Počet pokusů při kolizi – výchozí 8 */
  maxPokusu?: number;
}

/** Volby pro čtení metadat mimo React cache */
export interface VolbyCteniDat {
  bypassCache?: boolean;
}

const MAX_POKUSY_ZAPISU = 12;

function cekatPredOpakovanim(pokus: number): Promise<void> {
  const ms = Math.min(50 * 2 ** pokus, 2000);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  return normalizovatUloziste(data);
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
  oidcZHeaderu?: string | null,
  volbyCteni?: VolbyCteniDat
): Promise<UlozisteDat> {
  if (pouzivaBlobUloziste()) {
    return nacistDataBlob(oidcZHeaderu, {
      bypassCache: volbyCteni?.bypassCache ?? true,
    });
  }
  return nacistDataLokalne();
}

/** Veřejné API pro čtení metadat mimo React cache (např. po zápisu) */
export async function nacistDataCerstve(
  oidcZHeaderu?: string | null,
  volbyCteni?: VolbyCteniDat
): Promise<UlozisteDat> {
  return nacistDataProZapis(oidcZHeaderu, volbyCteni);
}

const MAX_POKUSY_VEREJNEHO_CETENI = 20;

function cekatNaVerejneCteni(pokus: number): Promise<void> {
  const ms = Math.min(100 * 2 ** pokus, 3000);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Počká, až jsou metadata viditelná přes veřejnou URL (stejná cesta jako veřejný web).
 * Server actions vracejí úspěch až po tomto ověření.
 */
export async function overitMetadataVerejne(
  overeni: (data: UlozisteDat) => boolean
): Promise<UlozisteDat> {
  if (!pouzivaBlobUloziste()) {
    const data = nacistDataLokalne();
    if (!overeni(data)) {
      throw new Error("Změna nebyla uložena do lokálního úložiště");
    }
    return data;
  }

  let posledni: UlozisteDat | null = null;

  for (let pokus = 0; pokus < MAX_POKUSY_VEREJNEHO_CETENI; pokus++) {
    try {
      const data = await nacistMetadataVerejne();
      posledni = data;
      if (overeni(data)) {
        return data;
      }
    } catch {
      // CDN může krátce vracet starou verzi nebo chybu – zkusíme znovu
    }

    await cekatNaVerejneCteni(pokus);
  }

  throw new Error(
    "Změna byla uložena, ale veřejný web ji zatím nevidí. Zkuste akci znovu za chvíli."
  );
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
    const maxPokusu = volby?.maxPokusu ?? MAX_POKUSY_ZAPISU;

    for (let pokus = 0; pokus < maxPokusu; pokus++) {
      try {
        const data = await nacistDataProZapis(oidcZHeaderu);
        const predVerze = data.verzeUloziste ?? 0;
        upravitel(data);
        data.verzeUloziste = predVerze + 1;
        await ulozitData(data, oidcZHeaderu);

        const kontrola = await nacistDataProZapis(oidcZHeaderu, {
          bypassCache: true,
        });
        const ocekavanaVerze = predVerze + 1;
        const verzeSouhlasi = (kontrola.verzeUloziste ?? 0) === ocekavanaVerze;
        const maOvereniObsahu = Boolean(volby?.overitPoUlozeni);
        const obsahSouhlasi = maOvereniObsahu
          ? volby!.overitPoUlozeni!(kontrola)
          : true;

        // U kritických zápisů stačí ověřit obsah – verze může během CDN prodlevy běžet dál
        if (maOvereniObsahu && obsahSouhlasi) {
          return kontrola;
        }

        if (verzeSouhlasi && obsahSouhlasi) {
          return kontrola;
        }

        await cekatPredOpakovanim(pokus);
      } catch (error) {
        posledniChyba = error;
        await cekatPredOpakovanim(pokus);
      }
    }

    if (volby?.overitPoUlozeni) {
      throw new Error(
        volby.chybovaZprava ??
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
