import "server-only";

import {
  BlobNotFoundError,
  BlobPreconditionFailedError,
  get,
  head,
  put,
} from "@vercel/blob";
import { unstable_noStore as noStore } from "next/cache";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import {
  maBranaAdminBlobKonfiguraci,
  ziskatVolbyBranaAdminBlob,
} from "./env-blob-brana-admin";
import {
  parsovatRadarDokument,
  pridatRucniNalezDoHistorie,
  pouzitRadarStopu,
  radarDnesIso,
  seraditPracovniStopy,
  smazatRadarStopu,
  uklidRadarDokument,
  validovatRucniRadarNalezVstup,
  vychoziRadarDokument,
  jeStejnyRadarDokument,
  zapsatRadarScanDoDokumentu,
  type BranaRadarDokument,
  type BranaRadarPracovniStopa,
  type BranaRadarScanKandidatVstup,
} from "./radar";
import {
  zmenitRadarDokumentAtomickySIo,
  type BranaRadarDokumentMutace,
} from "./radar-cas";

/**
 * Samostatný PRIVATE Blob objekt výzkumného RADARU.
 * Nesmí se míchat s Kalendářem, Nezařazenými, Zdroji ani Redakčním pořadím.
 */
export const BRANA_RADAR_BLOB_CESTA = "data/brana-radar.json";

export const BRANA_RADAR_CHYBA_CTENI =
  "RADAR se nepodařilo načíst. Žádná data nebyla změněna.";

export type NacistRadarVysledek =
  | { ok: true; pracovni: BranaRadarPracovniStopa[] }
  | { ok: false };

type BlobCteniTextu =
  | { stav: "neexistuje" }
  | { stav: "ok"; text: string };

type BlobCteniProZapis =
  | { stav: "neexistuje" }
  | { stav: "ok"; dokument: BranaRadarDokument; etag: string };

function zalogovatChybuCteni(duvod: string, error?: unknown): void {
  if (error === undefined) {
    console.error(`[brana-radar] ${duvod}`);
    return;
  }
  console.error(`[brana-radar] ${duvod}`, error);
}

async function nacistTextZPrivateBlob(): Promise<BlobCteniTextu> {
  const volby = ziskatVolbyBranaAdminBlob();

  if (!volby.token) {
    throw new Error("Chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.");
  }

  try {
    const vysledek = await get(BRANA_RADAR_BLOB_CESTA, {
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

async function nacistDokumentSEtagProZapis(): Promise<BlobCteniProZapis> {
  const volby = ziskatVolbyBranaAdminBlob();

  if (!volby.token) {
    throw new Error("Chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.");
  }

  let etag: string;
  try {
    const meta = await head(BRANA_RADAR_BLOB_CESTA, volby);
    if (typeof meta.etag !== "string" || meta.etag.length === 0) {
      throw new Error(
        "Nelze bezpečně uložit: Blob HEAD nevrátil etag. Nic nebylo změněno.",
      );
    }
    etag = meta.etag;
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return { stav: "neexistuje" };
    }
    throw error;
  }

  try {
    const vysledek = await get(BRANA_RADAR_BLOB_CESTA, {
      access: "private",
      useCache: false,
      ...volby,
    });

    if (vysledek === null || !vysledek.stream) {
      throw new Error("Blob zmizel mezi HEAD a GET. Nic nebylo uloženo.");
    }

    const text = await new Response(vysledek.stream).text();

    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      throw new Error(BRANA_RADAR_CHYBA_CTENI);
    }

    const dokument = parsovatRadarDokument(parsed);
    if (!dokument) {
      throw new Error(BRANA_RADAR_CHYBA_CTENI);
    }

    return { stav: "ok", dokument, etag };
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      throw new Error("Blob zmizel mezi HEAD a GET. Nic nebylo uloženo.");
    }
    throw error;
  }
}

async function ulozitDokumentSIfMatch(
  dokument: BranaRadarDokument,
  etag: string | null,
): Promise<void> {
  const volby = ziskatVolbyBranaAdminBlob();

  if (!volby.token) {
    throw new Error(
      "Nelze uložit RADAR: chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  await put(BRANA_RADAR_BLOB_CESTA, JSON.stringify(dokument, null, 2), {
    ...volby,
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
    ...(etag !== null ? { ifMatch: etag } : {}),
  });
}

async function zmenitRadarDokumentAtomicky<T>(
  mutator: (
    dokument: BranaRadarDokument,
  ) => BranaRadarDokumentMutace<BranaRadarDokument, T>,
): Promise<T> {
  return zmenitRadarDokumentAtomickySIo(
    {
      nacist: nacistDokumentSEtagProZapis,
      vychoziDokument: vychoziRadarDokument,
      validovat: (dokument) => parsovatRadarDokument(dokument),
      ulozit: ulozitDokumentSIfMatch,
      jePreconditionChyba: (error) =>
        error instanceof BlobPreconditionFailedError,
    },
    mutator,
  );
}

function ukliditDokument(dokument: BranaRadarDokument): BranaRadarDokument {
  return uklidRadarDokument(dokument, radarDnesIso());
}

async function nacistRadarJenCteniUklidene(): Promise<NacistRadarVysledek> {
  const cteni = await nacistTextZPrivateBlob();
  if (cteni.stav === "neexistuje") {
    return { ok: true, pracovni: [] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(cteni.text) as unknown;
  } catch (error) {
    zalogovatChybuCteni("neplatný JSON", error);
    return { ok: false };
  }
  const dokument = parsovatRadarDokument(parsed);
  if (!dokument) {
    zalogovatChybuCteni("neplatný tvar dokumentu");
    return { ok: false };
  }
  const uklizeny = ukliditDokument(dokument);
  return { ok: true, pracovni: seraditPracovniStopy(uklizeny.pracovni) };
}

async function nacistRadarJadro(): Promise<NacistRadarVysledek> {
  noStore();

  if (!maBranaAdminBlobKonfiguraci()) {
    zalogovatChybuCteni("chybí konfigurace Blob store");
    return { ok: false };
  }

  try {
    const dokument = await zmenitRadarDokumentAtomicky((surovy) => {
      const uklizeny = ukliditDokument(surovy);
      if (jeStejnyRadarDokument(surovy, uklizeny)) {
        return { typ: "bezZmeny", vysledek: uklizeny };
      }
      return { typ: "zapsat", dokument: uklizeny, vysledek: uklizeny };
    });
    return { ok: true, pracovni: seraditPracovniStopy(dokument.pracovni) };
  } catch (error) {
    zalogovatChybuCteni("úklid se neuložil", error);
    try {
      return await nacistRadarJenCteniUklidene();
    } catch (cteniError) {
      zalogovatChybuCteni("selhalo čtení", cteniError);
      return { ok: false };
    }
  }
}

/** Stav pracovního RADARU pro admin UI. Historii na klienta nepředává. */
export async function nacistRadar(): Promise<NacistRadarVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { ok: false };
  }
  return nacistRadarJadro();
}

export type BranaRadarUceniSnapshot = {
  datumOd: string;
  cas: string;
  nazev: string;
  kde: string;
  url: string;
};

async function pridatRucniNalezJadro(
  vstup: unknown,
): Promise<BranaRadarUceniSnapshot> {
  const validace = validovatRucniRadarNalezVstup(vstup);
  if (!validace.ok) {
    throw new Error(validace.chyba);
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit RADAR: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  return zmenitRadarDokumentAtomicky((surovy) => {
    const uklizeny = ukliditDokument(surovy);
    const po = pridatRucniNalezDoHistorie(uklizeny, validace.nalez, {
      noveId: () => `radar-${crypto.randomUUID()}`,
      tedIso: new Date().toISOString(),
    });
    const snapshot: BranaRadarUceniSnapshot = {
      datumOd: validace.nalez.datumOd,
      cas: validace.nalez.cas,
      nazev: validace.nalez.nazev,
      kde: validace.nalez.kde,
      url: validace.nalez.url,
    };
    if (jeStejnyRadarDokument(surovy, po)) {
      return { typ: "bezZmeny", vysledek: snapshot };
    }
    return { typ: "zapsat", dokument: po, vysledek: snapshot };
  });
}

/** Uloží ruční nález pouze do historie RADARU. Kalendář nemění. */
export async function pridatRucniRadarNalez(
  vstup: unknown,
): Promise<BranaRadarUceniSnapshot> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }
  return pridatRucniNalezJadro(vstup);
}

async function pouzitRadarStopuJadro(
  id: string,
): Promise<BranaRadarUceniSnapshot> {
  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit RADAR: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  return zmenitRadarDokumentAtomicky((surovy) => {
    const uklizeny = ukliditDokument(surovy);
    const idTrim = id.trim();
    const stopa = uklizeny.pracovni.find((s) => s.id === idTrim);
    if (!stopa) {
      throw new Error("Stopa už není v pracovním RADARU.");
    }
    const snapshot: BranaRadarUceniSnapshot = {
      datumOd: stopa.datumOd,
      cas: stopa.cas,
      nazev: stopa.nazev,
      kde: stopa.kde,
      url: stopa.url,
    };
    const po = pouzitRadarStopu(uklizeny, id, {
      tedIso: new Date().toISOString(),
    });
    if ("chyba" in po) {
      throw new Error(po.chyba);
    }
    return { typ: "zapsat", dokument: po, vysledek: snapshot };
  });
}

/** Použít: historie RADAR_POUZITO + otisk. Kalendář nemění. */
export async function pouzitRadarPracovniStopu(
  id: string,
): Promise<BranaRadarUceniSnapshot> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }
  return pouzitRadarStopuJadro(id);
}

async function smazatRadarStopuJadro(id: string): Promise<void> {
  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit RADAR: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  await zmenitRadarDokumentAtomicky((surovy) => {
    const uklizeny = ukliditDokument(surovy);
    const po = smazatRadarStopu(uklizeny, id);
    if ("chyba" in po) {
      throw new Error(po.chyba);
    }
    return { typ: "zapsat", dokument: po, vysledek: undefined };
  });
}

/** Smazat: jen otisk, bez historie. Kalendář nemění. */
export async function smazatRadarPracovniStopu(id: string): Promise<void> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }
  await smazatRadarStopuJadro(id);
}

/**
 * Scheduler: úklid + zápis kandidátů do data/brana-radar.json.
 * Bez admin session. Kalendář, Zdroje ani razítko Rychlého scanu nemění.
 */
export async function zapsatRadarScanProScheduler(
  kandidati: readonly BranaRadarScanKandidatVstup[],
  args: { tedIso: string },
): Promise<void> {
  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit RADAR: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  await zmenitRadarDokumentAtomicky((surovy) => {
    const uklizeny = ukliditDokument(surovy);
    const po = zapsatRadarScanDoDokumentu(uklizeny, kandidati, {
      tedIso: args.tedIso,
      noveId: () => `radar-${crypto.randomUUID()}`,
      dnesIso: radarDnesIso(),
      behDokoncen: true,
    });
    if (jeStejnyRadarDokument(surovy, po)) {
      return { typ: "bezZmeny", vysledek: undefined };
    }
    return { typ: "zapsat", dokument: po, vysledek: undefined };
  });
}
