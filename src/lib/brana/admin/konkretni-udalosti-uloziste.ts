import "server-only";

import { BlobNotFoundError, get, put } from "@vercel/blob";
import { unstable_noStore as noStore } from "next/cache";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import {
  maBranaAdminBlobKonfiguraci,
  ziskatVolbyBranaAdminBlob,
} from "./env-blob-brana-admin";
import {
  jeBranaStavSchvaleni,
  normalizovatStavSchvaleni,
  normalizovatVerejnaJazykovaPoleZBlobu,
  dnesIsoVPraze,
  jeUdalostCelaMinula,
  vytvoritScanKlicAutomatickeUdalosti,
  type BranaKonkretniUdalost,
} from "./konkretni-udalost";
import { validovatRucniUdalostVstup, validovatAutomatickouCekaUpravuVstup } from "./rucni-udalost-validace";

/**
 * Samostatný objekt v PRIVATE Blob store administrace BRÁNY.
 * Nesmí se míchat s data/brana-redakcni-poradi.json.
 * Obsahuje jen ručně uložené konkrétní události + stav posledního scanu.
 */
export const BRANA_KONKRETNI_UDALOSTI_BLOB_CESTA =
  "data/brana-konkretni-udalosti.json";

const VERZE_ULOZISTE = 1;

export const BRANA_KONKRETNI_UDALOSTI_CHYBA_CTENI =
  "Konkrétní události se nepodařilo načíst. Žádná data nebyla změněna.";

export type BranaKonkretniUdalostiDokument = {
  verzeUloziste: number;
  /** Odemyká výjimečný ruční zápis – nastaví skutečný scan Zdrojů */
  posledniScanDokoncen: boolean;
  /**
   * Persistované konkrétní události (ruční i budoucí automatické ze scanu).
   * Ukázková data sem nepatří.
   */
  udalosti: BranaKonkretniUdalost[];
};

export type NacistKonkretniUdalostiVysledek =
  | {
      ok: true;
      posledniScanDokoncen: boolean;
      udalosti: BranaKonkretniUdalost[];
    }
  | { ok: false };

type BlobCteniTextu =
  | { stav: "neexistuje" }
  | { stav: "ok"; text: string };

function zalogovatChybuCteni(duvod: string, error?: unknown): void {
  if (error === undefined) {
    console.error(`[brana-konkretni-udalosti] ${duvod}`);
    return;
  }
  console.error(`[brana-konkretni-udalosti] ${duvod}`, error);
}

function vychoziDokument(): BranaKonkretniUdalostiDokument {
  return {
    verzeUloziste: VERZE_ULOZISTE,
    posledniScanDokoncen: false,
    udalosti: [],
  };
}

/**
 * Persistovaná událost z Blobu.
 * - ruční: redakcniPolozkaId = null, rucniPoziceVDni >= 0
 * - automatická: redakcniPolozkaId neprázdný string, rucniPoziceVDni = null
 * Pole stavSchvaleni smí chybět (starší záznamy) – pak SCHVALENO.
 * Pole scanKlic smí chybět (starší / ruční záznamy).
 */
function jeUdalostZBlobu(hodnota: unknown): boolean {
  if (!hodnota || typeof hodnota !== "object") {
    return false;
  }
  const u = hodnota as Record<string, unknown>;
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

  if (u.stavSchvaleni !== undefined && !jeBranaStavSchvaleni(u.stavSchvaleni)) {
    return false;
  }

  if (
    u.scanKlic !== undefined &&
    u.scanKlic !== null &&
    (typeof u.scanKlic !== "string" || u.scanKlic.trim().length === 0)
  ) {
    return false;
  }

  return true;
}

function normalizovatUdalostZBlobu(hodnota: unknown): BranaKonkretniUdalost {
  const u = hodnota as Record<string, unknown>;
  const redakcniPolozkaId =
    u.redakcniPolozkaId === null
      ? null
      : (u.redakcniPolozkaId as string).trim();
  const scanKlic =
    typeof u.scanKlic === "string" && u.scanKlic.trim().length > 0
      ? u.scanKlic.trim()
      : undefined;
  const jazyk = normalizovatVerejnaJazykovaPoleZBlobu(u);
  const verejnaPole = jazyk.ok ? jazyk.pole : {};
  return {
    id: (u.id as string).trim(),
    redakcniPolozkaId,
    datumOd: u.datumOd as string,
    datumDo: u.datumDo as string,
    cas: u.cas as string,
    mistoNeboTyp: u.mistoNeboTyp as string,
    nazev: u.nazev as string,
    rucniPoziceVDni:
      redakcniPolozkaId === null ? (u.rucniPoziceVDni as number) : null,
    stavSchvaleni: normalizovatStavSchvaleni(u.stavSchvaleni),
    ...(scanKlic !== undefined ? { scanKlic } : {}),
    ...verejnaPole,
  };
}

function parsovatDokument(
  parsed: unknown,
): BranaKonkretniUdalostiDokument | null {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const data = parsed as Record<string, unknown>;
  if (data.verzeUloziste !== VERZE_ULOZISTE) {
    return null;
  }
  if (typeof data.posledniScanDokoncen !== "boolean") {
    return null;
  }
  if (!Array.isArray(data.udalosti)) {
    return null;
  }
  if (!data.udalosti.every(jeUdalostZBlobu)) {
    return null;
  }
  return {
    verzeUloziste: VERZE_ULOZISTE,
    posledniScanDokoncen: data.posledniScanDokoncen,
    udalosti: data.udalosti.map(normalizovatUdalostZBlobu),
  };
}

async function nacistTextZPrivateBlob(): Promise<BlobCteniTextu> {
  const volby = ziskatVolbyBranaAdminBlob();

  if (!volby.token) {
    throw new Error("Chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.");
  }

  try {
    const vysledek = await get(BRANA_KONKRETNI_UDALOSTI_BLOB_CESTA, {
      access: "private",
      ...volby,
    });

    if (vysledek === null) {
      return { stav: "neexistuje" };
    }

    if (!vysledek.stream) {
      throw new Error("Blob get vrátil odpověď bez použitelného streamu.");
    }

    const text = await new Response(vysledek.stream).text();
    return { stav: "ok", text };
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return { stav: "neexistuje" };
    }
    throw error;
  }
}

async function ulozitDokument(
  dokument: BranaKonkretniUdalostiDokument,
): Promise<void> {
  const volby = ziskatVolbyBranaAdminBlob();

  if (!volby.token) {
    throw new Error(
      "Nelze uložit konkrétní události: chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
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
 * Načte ruční konkrétní události a stav posledního scanu.
 * - Objekt neexistuje → prázdný seznam, scan nedokončen (Blob se nevytváří).
 * - Jiná chyba → ok: false.
 */
export async function nacistKonkretniUdalosti(): Promise<NacistKonkretniUdalostiVysledek> {
  noStore();

  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    zalogovatChybuCteni(
      "chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN",
    );
    return { ok: false };
  }

  try {
    const cteni = await nacistTextZPrivateBlob();

    if (cteni.stav === "neexistuje") {
      const prazdny = vychoziDokument();
      return {
        ok: true,
        posledniScanDokoncen: prazdny.posledniScanDokoncen,
        udalosti: prazdny.udalosti,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(cteni.text) as unknown;
    } catch (error) {
      zalogovatChybuCteni("neplatný JSON v Blob dokumentu", error);
      return { ok: false };
    }

    const dokument = parsovatDokument(parsed);
    if (!dokument) {
      zalogovatChybuCteni("Blob dokument neprošel validací");
      return { ok: false };
    }

    return {
      ok: true,
      posledniScanDokoncen: dokument.posledniScanDokoncen,
      udalosti: dokument.udalosti,
    };
  } catch (error) {
    zalogovatChybuCteni("selhání čtení PRIVATE Blobu", error);
    return { ok: false };
  }
}

async function nacistDokumentProZapis(): Promise<BranaKonkretniUdalostiDokument> {
  const cteni = await nacistTextZPrivateBlob();
  if (cteni.stav === "neexistuje") {
    return vychoziDokument();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cteni.text) as unknown;
  } catch (error) {
    zalogovatChybuCteni("neplatný JSON při zápisu", error);
    throw new Error(BRANA_KONKRETNI_UDALOSTI_CHYBA_CTENI);
  }

  const dokument = parsovatDokument(parsed);
  if (!dokument) {
    throw new Error(BRANA_KONKRETNI_UDALOSTI_CHYBA_CTENI);
  }
  return dokument;
}

/** Nastaví stav „poslední scan dokončen“ – bez falešného scanu Zdrojů. */
export async function nastavitPosledniScanDokoncen(
  dokoncen: boolean,
): Promise<void> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit stav scanu: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const dokument = await nacistDokumentProZapis();
  dokument.posledniScanDokoncen = dokoncen;
  await ulozitDokument(dokument);
}

/** Přidá jednu ruční konkrétní událost. Ukázková data se nezapisují. */
export async function pridatRucniKonkretniUdalost(
  vstup: unknown,
): Promise<BranaKonkretniUdalost> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit událost: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const validace = validovatRucniUdalostVstup(vstup);
  if (!validace.ok) {
    throw new Error(validace.chyba);
  }

  const dokument = await nacistDokumentProZapis();

  if (!dokument.posledniScanDokoncen) {
    throw new Error(
      "Ruční zápis je dostupný až po dokončení posledního scanu.",
    );
  }

  const nova: BranaKonkretniUdalost = {
    id: `rucni-${crypto.randomUUID()}`,
    ...validace.udalost,
  };

  dokument.udalosti = [...dokument.udalosti, nova];
  await ulozitDokument(dokument);
  return nova;
}

/**
 * Aktualizuje jednu existující ruční událost podle id.
 * Při chybě čtení nic nezapisuje. Ukázková data a Redakční pořadí nemění.
 */
export async function upravitRucniKonkretniUdalost(
  id: string,
  vstup: unknown,
): Promise<BranaKonkretniUdalost> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit událost: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const idTrim = typeof id === "string" ? id.trim() : "";
  if (!idTrim) {
    throw new Error("Chybí id události.");
  }

  const validace = validovatRucniUdalostVstup(vstup);
  if (!validace.ok) {
    throw new Error(validace.chyba);
  }

  const dokument = await nacistDokumentProZapis();

  if (!dokument.posledniScanDokoncen) {
    throw new Error(
      "Ruční zápis je dostupný až po dokončení posledního scanu.",
    );
  }

  const index = dokument.udalosti.findIndex((u) => u.id === idTrim);
  if (index < 0) {
    throw new Error("Ruční událost nebyla nalezena.");
  }

  const aktualizovana: BranaKonkretniUdalost = {
    id: idTrim,
    ...validace.udalost,
  };

  const noveUdalosti = dokument.udalosti.slice();
  noveUdalosti[index] = aktualizovana;
  dokument.udalosti = noveUdalosti;

  const overeni = parsovatDokument(dokument);
  if (!overeni) {
    throw new Error("Výsledný dokument neprošel validací. Nic nebylo uloženo.");
  }

  await ulozitDokument(overeni);
  return aktualizovana;
}

/**
 * Odstraní jednu ruční událost podle id.
 * Při chybě čtení nic nezapisuje.
 */
export async function smazatRucniKonkretniUdalost(id: string): Promise<void> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze smazat událost: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const idTrim = typeof id === "string" ? id.trim() : "";
  if (!idTrim) {
    throw new Error("Chybí id události.");
  }

  const dokument = await nacistDokumentProZapis();

  if (!dokument.posledniScanDokoncen) {
    throw new Error(
      "Ruční zápis je dostupný až po dokončení posledního scanu.",
    );
  }

  const pred = dokument.udalosti.length;
  const noveUdalosti = dokument.udalosti.filter((u) => u.id !== idTrim);
  if (noveUdalosti.length === pred) {
    throw new Error("Ruční událost nebyla nalezena.");
  }

  dokument.udalosti = noveUdalosti;

  const overeni = parsovatDokument(dokument);
  if (!overeni) {
    throw new Error("Výsledný dokument neprošel validací. Nic nebylo uloženo.");
  }

  await ulozitDokument(overeni);
}

/**
 * Schválí jednu persistovanou konkrétní událost:
 * CEKA_NA_SCHVALENI → SCHVALENO.
 * Mění pouze stavSchvaleni. Ukázková data neřeší (nejsou v Blobu).
 * Již SCHVALENO → bez zápisu, vrátí stávající záznam.
 */
export async function schvalitKonkretniUdalost(
  id: string,
): Promise<BranaKonkretniUdalost> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze schválit událost: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const idTrim = typeof id === "string" ? id.trim() : "";
  if (!idTrim) {
    throw new Error("Chybí id události.");
  }

  const dokument = await nacistDokumentProZapis();
  const index = dokument.udalosti.findIndex((u) => u.id === idTrim);
  if (index < 0) {
    throw new Error("Událost nebyla nalezena.");
  }

  const existujici = dokument.udalosti[index];
  if (existujici.stavSchvaleni === "SCHVALENO") {
    return existujici;
  }
  if (existujici.stavSchvaleni !== "CEKA_NA_SCHVALENI") {
    throw new Error("Událost nelze schválit.");
  }

  const schvalena: BranaKonkretniUdalost = {
    ...existujici,
    stavSchvaleni: "SCHVALENO",
  };

  const noveUdalosti = dokument.udalosti.slice();
  noveUdalosti[index] = schvalena;
  dokument.udalosti = noveUdalosti;

  const overeni = parsovatDokument(dokument);
  if (!overeni) {
    throw new Error("Výsledný dokument neprošel validací. Nic nebylo uloženo.");
  }

  await ulozitDokument(overeni);
  return schvalena;
}

/**
 * Hromadně schválí explicitní seznam ID: CEKA_NA_SCHVALENI → SCHVALENO.
 * Fail-closed: jakékoli neplatné ID → žádný zápis.
 * scanKlic není podmínkou. Nemění +21 ani jiná stavová pole.
 */
export async function schvalitKontroluKonkretnichUdalosti(
  ids: readonly string[],
): Promise<{ pocetSchvalenych: number }> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze schválit kontrolu: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const unikani: string[] = [];
  const videna = new Set<string>();
  for (const surove of ids) {
    if (typeof surove !== "string") {
      throw new Error("Neplatné id v dávce. Nic nebylo uloženo.");
    }
    const idTrim = surove.trim();
    if (!idTrim) {
      throw new Error("Neplatné id v dávce. Nic nebylo uloženo.");
    }
    if (videna.has(idTrim)) {
      continue;
    }
    videna.add(idTrim);
    unikani.push(idTrim);
  }

  if (unikani.length === 0) {
    throw new Error("Chybí id událostí ke schválení.");
  }

  const dokument = await nacistDokumentProZapis();
  const podleId = new Map(dokument.udalosti.map((u) => [u.id, u] as const));
  const indexyKeSchvaleni: number[] = [];

  for (const id of unikani) {
    const existujici = podleId.get(id);
    if (!existujici) {
      throw new Error(
        "Kontrolu nelze schválit: některá událost nebyla nalezena. Nic nebylo uloženo.",
      );
    }
    if (existujici.redakcniPolozkaId === null) {
      throw new Error(
        "Kontrolu nelze schválit: dávka obsahuje ruční událost. Nic nebylo uloženo.",
      );
    }
    if (existujici.stavSchvaleni !== "CEKA_NA_SCHVALENI") {
      throw new Error(
        "Kontrolu nelze schválit: dávka obsahuje položku, která už není čekající. Nic nebylo uloženo.",
      );
    }
    const index = dokument.udalosti.findIndex((u) => u.id === id);
    if (index < 0) {
      throw new Error(
        "Kontrolu nelze schválit: některá událost nebyla nalezena. Nic nebylo uloženo.",
      );
    }
    indexyKeSchvaleni.push(index);
  }

  const noveUdalosti = dokument.udalosti.slice();
  for (const index of indexyKeSchvaleni) {
    noveUdalosti[index] = {
      ...noveUdalosti[index],
      stavSchvaleni: "SCHVALENO",
    };
  }
  dokument.udalosti = noveUdalosti;

  const overeni = parsovatDokument(dokument);
  if (!overeni) {
    throw new Error("Výsledný dokument neprošel validací. Nic nebylo uloženo.");
  }

  await ulozitDokument(overeni);
  return { pocetSchvalenych: indexyKeSchvaleni.length };
}

/**
 * Upraví obsah automatické CEKA nebo SCHVALENO události se stabilním scanKlic.
 * Zachová id, redakcniPolozkaId, scanKlic, rucniPoziceVDni=null a stávající stavSchvaleni.
 * Bez scanKlic → fail-closed (úprava by rozbila obsahový fallback dedup).
 */
export async function upravitAutomatickouCekaUdalost(
  id: string,
  vstup: unknown,
): Promise<BranaKonkretniUdalost> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit událost: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const idTrim = typeof id === "string" ? id.trim() : "";
  if (!idTrim) {
    throw new Error("Chybí id události.");
  }

  const validace = validovatAutomatickouCekaUpravuVstup(vstup);
  if (!validace.ok) {
    throw new Error(validace.chyba);
  }

  const dokument = await nacistDokumentProZapis();
  const index = dokument.udalosti.findIndex((u) => u.id === idTrim);
  if (index < 0) {
    throw new Error("Událost nebyla nalezena.");
  }

  const existujici = dokument.udalosti[index];
  if (existujici.redakcniPolozkaId === null) {
    throw new Error("Ruční událost nelze upravit touto cestou.");
  }
  if (
    existujici.stavSchvaleni !== "CEKA_NA_SCHVALENI" &&
    existujici.stavSchvaleni !== "SCHVALENO"
  ) {
    throw new Error(
      "Upravit lze pouze čekající nebo schválenou automatickou událost.",
    );
  }
  if (
    typeof existujici.scanKlic !== "string" ||
    existujici.scanKlic.length === 0
  ) {
    throw new Error(
      "Tuto starší automatickou událost nelze bezpečně upravit (chybí scanKlic).",
    );
  }

  const upravena: BranaKonkretniUdalost = {
    id: existujici.id,
    redakcniPolozkaId: existujici.redakcniPolozkaId,
    datumOd: validace.uprava.datumOd,
    datumDo: validace.uprava.datumDo,
    cas: validace.uprava.cas,
    mistoNeboTyp: validace.uprava.mistoNeboTyp,
    nazev: validace.uprava.nazev,
    rucniPoziceVDni: null,
    stavSchvaleni: existujici.stavSchvaleni,
    scanKlic: existujici.scanKlic,
    ...(existujici.verejneCo !== undefined
      ? {
          verejneCo: existujici.verejneCo,
          verejneRozliseni: existujici.verejneRozliseni ?? null,
        }
      : {}),
  };

  const noveUdalosti = dokument.udalosti.slice();
  noveUdalosti[index] = upravena;
  dokument.udalosti = noveUdalosti;

  const overeni = parsovatDokument(dokument);
  if (!overeni) {
    throw new Error("Výsledný dokument neprošel validací. Nic nebylo uloženo.");
  }

  await ulozitDokument(overeni);
  return upravena;
}

/**
 * Vyřadí automatickou CEKA nebo SCHVALENO událost → VYRAZENO.
 * Zachová id, redakcniPolozkaId, scanKlic (pokud je) a obsah.
 * Záznam zůstává v Blobu kvůli dedupu.
 */
export async function vyrazitAutomatickouCekaUdalost(
  id: string,
): Promise<BranaKonkretniUdalost> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze vyřadit událost: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const idTrim = typeof id === "string" ? id.trim() : "";
  if (!idTrim) {
    throw new Error("Chybí id události.");
  }

  const dokument = await nacistDokumentProZapis();
  const index = dokument.udalosti.findIndex((u) => u.id === idTrim);
  if (index < 0) {
    throw new Error("Událost nebyla nalezena.");
  }

  const existujici = dokument.udalosti[index];
  if (existujici.redakcniPolozkaId === null) {
    throw new Error("Ruční událost nelze vyřadit touto cestou.");
  }
  if (
    existujici.stavSchvaleni !== "CEKA_NA_SCHVALENI" &&
    existujici.stavSchvaleni !== "SCHVALENO"
  ) {
    throw new Error(
      "Vyřadit lze pouze čekající nebo schválenou automatickou událost.",
    );
  }

  const vyrazena: BranaKonkretniUdalost = {
    ...existujici,
    rucniPoziceVDni: null,
    stavSchvaleni: "VYRAZENO",
  };

  const noveUdalosti = dokument.udalosti.slice();
  noveUdalosti[index] = vyrazena;
  dokument.udalosti = noveUdalosti;

  const overeni = parsovatDokument(dokument);
  if (!overeni) {
    throw new Error("Výsledný dokument neprošel validací. Nic nebylo uloženo.");
  }

  await ulozitDokument(overeni);
  return vyrazena;
}

export type BranaScanAutomatickaUdalostVstup = {
  redakcniPolozkaId: string;
  datumOd: string;
  datumDo: string;
  cas: string;
  mistoNeboTyp: string;
  nazev: string;
  verejneCo?: string | null;
  verejneRozliseni?: string | null;
};

export type PridatCekajiciZeScanuVysledek = {
  pridano: number;
  jizExistuje: number;
};

function jeDuplicitniAutomatickaUdalost(
  existujici: BranaKonkretniUdalost,
  kandidat: BranaScanAutomatickaUdalostVstup,
  kandidatScanKlic: string,
): boolean {
  // Stav (CEKA / SCHVALENO / VYRAZENO) se záměrně neřeší.
  if (
    typeof existujici.scanKlic === "string" &&
    existujici.scanKlic.length > 0
  ) {
    return existujici.scanKlic === kandidatScanKlic;
  }

  // Fallback pro starší záznamy bez scanKlic.
  return (
    existujici.redakcniPolozkaId === kandidat.redakcniPolozkaId &&
    existujici.datumOd === kandidat.datumOd &&
    existujici.cas.trim() === kandidat.cas.trim() &&
    existujici.nazev.trim().toLowerCase() === kandidat.nazev.trim().toLowerCase()
  );
}

/**
 * Append automatických událostí ze scanu ve stavu CEKA_NA_SCHVALENI (bez admin kontroly).
 * Jedno načtení → deduplikace → validace → jeden put.
 * Nemění posledniScanDokoncen.
 * Při chybě čtení nebo žádné nové události nic nezapisuje.
 */
async function pridatCekajiciAutomatickeUdalostiZeScanuJadro(
  kandidati: readonly BranaScanAutomatickaUdalostVstup[],
): Promise<PridatCekajiciZeScanuVysledek> {
  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit výsledek scanu: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const dokument = await nacistDokumentProZapis();
  let pridano = 0;
  let jizExistuje = 0;
  const nove = dokument.udalosti.slice();
  const dnesIso = dnesIsoVPraze();

  for (const kandidat of kandidati) {
    const redakcniPolozkaId = kandidat.redakcniPolozkaId.trim();
    if (!redakcniPolozkaId) {
      continue;
    }

    const normalizovany: BranaScanAutomatickaUdalostVstup = {
      redakcniPolozkaId,
      datumOd: kandidat.datumOd.trim(),
      datumDo: kandidat.datumDo.trim(),
      cas: kandidat.cas.trim(),
      mistoNeboTyp: kandidat.mistoNeboTyp.trim(),
      nazev: kandidat.nazev.trim(),
      ...(kandidat.verejneCo !== undefined
        ? {
            verejneCo: kandidat.verejneCo,
            verejneRozliseni:
              kandidat.verejneRozliseni === undefined
                ? null
                : kandidat.verejneRozliseni,
          }
        : {}),
    };

    if (!normalizovany.nazev || !normalizovany.datumOd) {
      continue;
    }

    if (jeUdalostCelaMinula(normalizovany, dnesIso)) {
      continue;
    }

    const scanKlic = vytvoritScanKlicAutomatickeUdalosti({
      redakcniPolozkaId: normalizovany.redakcniPolozkaId,
      datumOd: normalizovany.datumOd,
      cas: normalizovany.cas,
      nazev: normalizovany.nazev,
    });

    if (
      nove.some((u) =>
        jeDuplicitniAutomatickaUdalost(u, normalizovany, scanKlic),
      )
    ) {
      jizExistuje += 1;
      continue;
    }

    const nova: BranaKonkretniUdalost = {
      id: `auto-${crypto.randomUUID()}`,
      redakcniPolozkaId: normalizovany.redakcniPolozkaId,
      datumOd: normalizovany.datumOd,
      datumDo: normalizovany.datumDo || normalizovany.datumOd,
      cas: normalizovany.cas,
      mistoNeboTyp: normalizovany.mistoNeboTyp,
      nazev: normalizovany.nazev,
      rucniPoziceVDni: null,
      stavSchvaleni: "CEKA_NA_SCHVALENI",
      scanKlic,
      ...(normalizovany.verejneCo !== undefined
        ? {
            verejneCo: normalizovany.verejneCo,
            verejneRozliseni: normalizovany.verejneRozliseni ?? null,
          }
        : {}),
    };
    nove.push(nova);
    pridano += 1;
  }

  if (pridano === 0) {
    return { pridano, jizExistuje };
  }

  dokument.udalosti = nove;

  const overeni = parsovatDokument(dokument);
  if (!overeni) {
    throw new Error("Výsledný dokument neprošel validací. Nic nebylo uloženo.");
  }

  await ulozitDokument(overeni);
  return { pridano, jizExistuje };
}

/**
 * Append automatických událostí ze scanu ve stavu CEKA_NA_SCHVALENI.
 * Jedno načtení → deduplikace → validace → jeden put.
 * Nemění posledniScanDokoncen (ruční scan jednoho zdroje ≠ konec redakční fáze).
 * Při chybě čtení nebo žádné nové události nic nezapisuje.
 */
export async function pridatCekajiciAutomatickeUdalostiZeScanu(
  kandidati: readonly BranaScanAutomatickaUdalostVstup[],
): Promise<PridatCekajiciZeScanuVysledek> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  return pridatCekajiciAutomatickeUdalostiZeScanuJadro(kandidati);
}

/**
 * Stejný append CEKA_NA_SCHVALENI pro důvěryhodný scheduler (po ověření CRON_SECRET).
 * Bez admin session. Nemění posledniScanDokoncen. Žádný push.
 */
export async function pridatCekajiciAutomatickeUdalostiZeScanuProScheduler(
  kandidati: readonly BranaScanAutomatickaUdalostVstup[],
): Promise<PridatCekajiciZeScanuVysledek> {
  return pridatCekajiciAutomatickeUdalostiZeScanuJadro(kandidati);
}

export type BranaUklidMinulychUdalostiVysledek = {
  odstraneno: number;
  zustalo: number;
};

/**
 * Denní úklid: odstraní z udalosti[] všechny záznamy s posledním platným dnem
 * před dneškem (Europe/Prague). Stav schválení nerozhoduje.
 * PUT jen při skutečné změně. Idempotentní. Pro scheduler (CRON_SECRET).
 */
export async function uklidMinulychKonkretnichUdalostiProScheduler(
  okamzik: Date = new Date(),
): Promise<BranaUklidMinulychUdalostiVysledek> {
  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uklidit události: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const dnesIso = dnesIsoVPraze(okamzik);
  const dokument = await nacistDokumentProZapis();
  const pred = dokument.udalosti.length;
  const zachovane = dokument.udalosti.filter(
    (u) => !jeUdalostCelaMinula(u, dnesIso),
  );

  if (zachovane.length === pred) {
    return { odstraneno: 0, zustalo: pred };
  }

  dokument.udalosti = zachovane;
  const overeni = parsovatDokument(dokument);
  if (!overeni) {
    throw new Error("Výsledný dokument neprošel validací. Nic nebylo uloženo.");
  }

  await ulozitDokument(overeni);
  return {
    odstraneno: pred - zachovane.length,
    zustalo: zachovane.length,
  };
}
