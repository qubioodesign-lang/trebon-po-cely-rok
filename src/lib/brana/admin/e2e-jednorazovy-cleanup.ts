/**
 * DOČASNÝ jednorázový E2E cleanup – přesně 6 testovacích SCHVALENO.
 * Po dokončení testu celý soubor odstranit.
 * Žádný paralelní storage – stejný PRIVATE Blob dokument + konfigurace.
 */

import "server-only";

import { put } from "@vercel/blob";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import type { BranaKonkretniUdalost } from "@/lib/brana/admin/konkretni-udalost";
import {
  BRANA_KONKRETNI_UDALOSTI_BLOB_CESTA,
  nacistKonkretniUdalosti,
} from "@/lib/brana/admin/konkretni-udalosti-uloziste";
import {
  maBranaAdminBlobKonfiguraci,
  ziskatVolbyBranaAdminBlob,
} from "@/lib/brana/admin/env-blob-brana-admin";

const VERZE_ULOZISTE = 1;
const MISTO = "TEST BRÁNA E2E";

const FINGERPRINTY = [
  {
    nazev: "TEST BRÁNA E2E 01",
    datumOd: "2026-08-09",
    datumDo: "2026-08-09",
    cas: "10:01",
    mistoNeboTyp: MISTO,
    redakcniPolozkaId: "kino-svetozor",
    stavSchvaleni: "SCHVALENO" as const,
  },
  {
    nazev: "TEST BRÁNA E2E 02",
    datumOd: "2026-08-10",
    datumDo: "2026-08-10",
    cas: "10:02",
    mistoNeboTyp: MISTO,
    redakcniPolozkaId: "kino-svetozor",
    stavSchvaleni: "SCHVALENO" as const,
  },
  {
    nazev: "TEST BRÁNA E2E 03",
    datumOd: "2026-08-16",
    datumDo: "2026-08-16",
    cas: "10:03",
    mistoNeboTyp: MISTO,
    redakcniPolozkaId: "kino-svetozor",
    stavSchvaleni: "SCHVALENO" as const,
  },
  {
    nazev: "TEST BRÁNA E2E 04",
    datumOd: "2026-08-17",
    datumDo: "2026-08-17",
    cas: "10:04",
    mistoNeboTyp: MISTO,
    redakcniPolozkaId: "kino-svetozor",
    stavSchvaleni: "SCHVALENO" as const,
  },
  {
    nazev: "TEST BRÁNA E2E 05",
    datumOd: "2026-08-27",
    datumDo: "2026-08-27",
    cas: "10:05",
    mistoNeboTyp: MISTO,
    redakcniPolozkaId: "kino-svetozor",
    stavSchvaleni: "SCHVALENO" as const,
  },
  {
    nazev: "TEST BRÁNA E2E 06",
    datumOd: "2026-09-07",
    datumDo: "2026-09-07",
    cas: "10:06",
    mistoNeboTyp: MISTO,
    redakcniPolozkaId: "vylov-rozmberka",
    stavSchvaleni: "SCHVALENO" as const,
  },
] as const;

export type BranaE2eJednorazovyCleanupVysledek = {
  ids: string[];
  nazvy: string[];
  pocetPred: number;
  pocetPo: number;
};

function stop(duvod: string): never {
  throw new Error(`E2E cleanup STOP: ${duvod}. Nic nebylo uloženo.`);
}

function sediFingerprint(
  u: BranaKonkretniUdalost,
  fp: (typeof FINGERPRINTY)[number],
): boolean {
  return (
    u.nazev === fp.nazev &&
    u.datumOd === fp.datumOd &&
    u.datumDo === fp.datumDo &&
    u.cas === fp.cas &&
    u.mistoNeboTyp === fp.mistoNeboTyp &&
    u.redakcniPolozkaId === fp.redakcniPolozkaId &&
    u.stavSchvaleni === fp.stavSchvaleni
  );
}

function jeModelovePlatnaUdalost(u: BranaKonkretniUdalost): boolean {
  if (
    !(
      typeof u.id === "string" &&
      u.id.length > 0 &&
      typeof u.datumOd === "string" &&
      typeof u.datumDo === "string" &&
      typeof u.cas === "string" &&
      typeof u.mistoNeboTyp === "string" &&
      typeof u.nazev === "string"
    )
  ) {
    return false;
  }

  if (u.redakcniPolozkaId === null) {
    if (
      typeof u.rucniPoziceVDni !== "number" ||
      !Number.isInteger(u.rucniPoziceVDni) ||
      u.rucniPoziceVDni < 0
    ) {
      return false;
    }
  } else if (typeof u.redakcniPolozkaId === "string") {
    if (u.redakcniPolozkaId.trim().length === 0) {
      return false;
    }
    if (u.rucniPoziceVDni !== null) {
      return false;
    }
  } else {
    return false;
  }

  if (
    u.stavSchvaleni !== "CEKA_NA_SCHVALENI" &&
    u.stavSchvaleni !== "SCHVALENO" &&
    u.stavSchvaleni !== "VYRAZENO"
  ) {
    return false;
  }

  if (
    u.scanKlic !== undefined &&
    (typeof u.scanKlic !== "string" || u.scanKlic.trim().length === 0)
  ) {
    return false;
  }

  return true;
}

async function ulozitDokumentJednimPutem(dokument: {
  verzeUloziste: number;
  posledniScanDokoncen: boolean;
  udalosti: BranaKonkretniUdalost[];
}): Promise<void> {
  const volby = ziskatVolbyBranaAdminBlob();
  if (!volby.token) {
    stop("chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN");
  }
  await put(
    BRANA_KONKRETNI_UDALOSTI_BLOB_CESTA,
    JSON.stringify(dokument, null, 2),
    {
      ...volby,
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 0,
    },
  );
}

/**
 * Jednorázový fail-closed cleanup: 0 nebo přesně −6, jeden put až po všech kontrolách.
 * Identifikace pouze přes úplný fingerprint (ne substring, ne samotné ID ze seedu).
 */
export async function odstranitE2eJednorazovySeedSestiUdalosti(): Promise<BranaE2eJednorazovyCleanupVysledek> {
  if (!(await jeAdminPrihlasen())) {
    stop("nejste přihlášeni");
  }
  if (!maBranaAdminBlobKonfiguraci()) {
    stop("chybí konfigurace PRIVATE Blob administrace BRÁNY");
  }

  if (FINGERPRINTY.length !== 6) {
    stop("interní FINGERPRINTY musí mít přesně 6 položek");
  }

  const uloziste = await nacistKonkretniUdalosti();
  if (!uloziste.ok) {
    stop("nepodařilo se načíst konkrétní události");
  }

  const persistovane = uloziste.udalosti;
  const pocetPred = persistovane.length;

  const nalezene: BranaKonkretniUdalost[] = [];
  for (const fp of FINGERPRINTY) {
    const shody = persistovane.filter((u) => sediFingerprint(u, fp));
    if (shody.length === 0) {
      stop(`fingerprint „${fp.nazev}“ nenalezen`);
    }
    if (shody.length !== 1) {
      stop(
        `fingerprint „${fp.nazev}“ odpovídá ${shody.length} záznamům (očekáváno 1)`,
      );
    }
    nalezene.push(shody[0]!);
  }

  if (nalezene.length !== 6) {
    stop(`nalezeno ${nalezene.length} místo přesně 6`);
  }

  const ids = nalezene.map((u) => u.id);
  const idSet = new Set(ids);
  if (idSet.size !== 6) {
    stop("nalezená event ID nejsou unikátní");
  }

  for (const u of nalezene) {
    if (u.stavSchvaleni !== "SCHVALENO") {
      stop(`událost „${u.nazev}“ (${u.id}) není SCHVALENO`);
    }
  }

  for (const id of ids) {
    const vyskyt = persistovane.filter((u) => u.id === id);
    if (vyskyt.length !== 1) {
      stop(`event ID ${id} není unikátní v dokumentu (výskyt ${vyskyt.length})`);
    }
  }

  const zbyle = persistovane.filter((u) => !idSet.has(u.id));
  if (zbyle.length !== pocetPred - 6) {
    stop(
      `simulace odstranění ≠ původní − 6 (pred=${pocetPred}, po=${zbyle.length})`,
    );
  }

  for (const puvodni of persistovane) {
    if (idSet.has(puvodni.id)) {
      continue;
    }
    const stejne = zbyle.find((u) => u.id === puvodni.id);
    if (!stejne || JSON.stringify(stejne) !== JSON.stringify(puvodni)) {
      stop(`existující událost ${puvodni.id} by byla změněna`);
    }
  }

  for (const zbyvajici of zbyle) {
    if (idSet.has(zbyvajici.id)) {
      stop(`odstraněné ID ${zbyvajici.id} zůstalo ve výsledku`);
    }
    if (!jeModelovePlatnaUdalost(zbyvajici)) {
      stop(`výsledná událost ${zbyvajici.id} neprošla modelovou validací`);
    }
  }

  for (const odstranena of nalezene) {
    if (zbyle.some((u) => u.id === odstranena.id)) {
      stop(`odstraněná „${odstranena.nazev}“ zůstala ve výsledku`);
    }
  }

  const dokument = {
    verzeUloziste: VERZE_ULOZISTE,
    posledniScanDokoncen: uloziste.posledniScanDokoncen,
    udalosti: zbyle,
  };

  if (dokument.verzeUloziste !== VERZE_ULOZISTE) {
    stop("neplatná verze uložiště výsledného dokumentu");
  }
  if (typeof dokument.posledniScanDokoncen !== "boolean") {
    stop("neplatný posledniScanDokoncen výsledného dokumentu");
  }
  if (!Array.isArray(dokument.udalosti)) {
    stop("výsledné udalosti nejsou pole");
  }
  if (!dokument.udalosti.every(jeModelovePlatnaUdalost)) {
    stop("výsledný dokument neprošel modelovou validací událostí");
  }
  if (dokument.udalosti.length !== pocetPred - 6) {
    stop("výsledný dokument nemá počet = původní − 6");
  }

  // Jediný put – až po všech kontrolách.
  await ulozitDokumentJednimPutem(dokument);

  return {
    ids,
    nazvy: nalezene.map((u) => u.nazev),
    pocetPred,
    pocetPo: zbyle.length,
  };
}
