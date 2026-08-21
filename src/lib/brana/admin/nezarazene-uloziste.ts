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
  pridatNesparovaneDoNezarazenych,
  BRANA_NEZARAZENE_VERZE_ULOZISTE,
  smazatNezarazenyNalezVDokumentu,
  vychoziNezarazeneDokument,
  vyresitOtevreneNezarazenePodleKlicu,
  type BranaNezarazeneDokument,
  type BranaNezarazenyNalez,
  type BranaNezarazenyScanKandidat,
} from "./nezarazene";
import {
  zmenitNezarazeneDokumentAtomickySIo,
  type BranaNezarazeneDokumentMutace,
} from "./nezarazene-cas";

/**
 * Samostatný PRIVATE Blob objekt – inbox nespárovaných scan nálezů.
 * Nesmí se míchat s konkrétními událostmi ani redakčním pořadím.
 */
export const BRANA_NEZARAZENE_BLOB_CESTA = "data/brana-nezarazene.json";

export const BRANA_NEZARAZENE_CHYBA_CTENI =
  "Nezařazené se nepodařilo načíst. Žádná data nebyla změněna.";

export type NacistNezarazeneVysledek =
  | { ok: true; otevrene: BranaNezarazenyNalez[] }
  | { ok: false };

type BlobCteniTextu =
  | { stav: "neexistuje" }
  | { stav: "ok"; text: string };

type BlobCteniProZapis =
  | { stav: "neexistuje" }
  | { stav: "ok"; dokument: BranaNezarazeneDokument; etag: string };

function zalogovatChybuCteni(duvod: string, error?: unknown): void {
  if (error === undefined) {
    console.error(`[brana-nezarazene] ${duvod}`);
    return;
  }
  console.error(`[brana-nezarazene] ${duvod}`, error);
}

function jePlatnyNalez(hodnota: unknown): hodnota is BranaNezarazenyNalez {
  if (!hodnota || typeof hodnota !== "object") {
    return false;
  }
  const n = hodnota as Record<string, unknown>;
  return (
    typeof n.id === "string" &&
    n.id.trim().length > 0 &&
    typeof n.klic === "string" &&
    n.klic.length > 0 &&
    typeof n.zdrojId === "string" &&
    n.zdrojId.trim().length > 0 &&
    typeof n.zdrojNazev === "string" &&
    typeof n.datumOd === "string" &&
    typeof n.datumDo === "string" &&
    typeof n.cas === "string" &&
    typeof n.mistoNeboTyp === "string" &&
    typeof n.nazev === "string" &&
    n.nazev.trim().length > 0
  );
}

function normalizovatNalez(n: BranaNezarazenyNalez): BranaNezarazenyNalez {
  return {
    id: n.id.trim(),
    klic: n.klic,
    zdrojId: n.zdrojId.trim(),
    zdrojNazev: n.zdrojNazev.trim(),
    datumOd: n.datumOd.trim(),
    datumDo: n.datumDo.trim() || n.datumOd.trim(),
    cas: n.cas.trim(),
    mistoNeboTyp: n.mistoNeboTyp.trim(),
    nazev: n.nazev.trim(),
  };
}

function parsovatDokument(parsed: unknown): BranaNezarazeneDokument | null {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const root = parsed as {
    verzeUloziste?: unknown;
    otevrene?: unknown;
    odmitnuteKlice?: unknown;
  };
  if (!Array.isArray(root.otevrene) || !root.otevrene.every(jePlatnyNalez)) {
    return null;
  }
  if (!Array.isArray(root.odmitnuteKlice)) {
    return null;
  }
  const odmitnuteKlice: string[] = [];
  for (const k of root.odmitnuteKlice) {
    if (typeof k !== "string" || k.length === 0) {
      return null;
    }
    odmitnuteKlice.push(k);
  }
  return {
    verzeUloziste:
      typeof root.verzeUloziste === "number"
        ? root.verzeUloziste
        : BRANA_NEZARAZENE_VERZE_ULOZISTE,
    otevrene: root.otevrene.map(normalizovatNalez),
    odmitnuteKlice,
  };
}

async function nacistTextZPrivateBlob(): Promise<BlobCteniTextu> {
  const volby = ziskatVolbyBranaAdminBlob();

  if (!volby.token) {
    throw new Error("Chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.");
  }

  try {
    const vysledek = await get(BRANA_NEZARAZENE_BLOB_CESTA, {
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
    const meta = await head(BRANA_NEZARAZENE_BLOB_CESTA, volby);
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
    const vysledek = await get(BRANA_NEZARAZENE_BLOB_CESTA, {
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
      throw new Error(BRANA_NEZARAZENE_CHYBA_CTENI);
    }

    const dokument = parsovatDokument(parsed);
    if (!dokument) {
      throw new Error(BRANA_NEZARAZENE_CHYBA_CTENI);
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
  dokument: BranaNezarazeneDokument,
  etag: string | null,
): Promise<void> {
  const volby = ziskatVolbyBranaAdminBlob();

  if (!volby.token) {
    throw new Error(
      "Nelze uložit Nezařazené: chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  await put(BRANA_NEZARAZENE_BLOB_CESTA, JSON.stringify(dokument, null, 2), {
    ...volby,
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
    ...(etag !== null ? { ifMatch: etag } : {}),
  });
}

async function zmenitNezarazeneDokumentAtomicky<T>(
  mutator: (
    dokument: BranaNezarazeneDokument,
  ) => BranaNezarazeneDokumentMutace<BranaNezarazeneDokument, T>,
): Promise<T> {
  return zmenitNezarazeneDokumentAtomickySIo(
    {
      nacist: nacistDokumentSEtagProZapis,
      vychoziDokument: vychoziNezarazeneDokument,
      validovat: (dokument) => parsovatDokument(dokument),
      ulozit: ulozitDokumentSIfMatch,
      jePreconditionChyba: (error) =>
        error instanceof BlobPreconditionFailedError,
    },
    mutator,
  );
}

async function nacistNezarazeneJadro(): Promise<NacistNezarazeneVysledek> {
  noStore();

  if (!maBranaAdminBlobKonfiguraci()) {
    zalogovatChybuCteni("chybí konfigurace Blob store");
    return { ok: false };
  }

  try {
    const cteni = await nacistTextZPrivateBlob();
    if (cteni.stav === "neexistuje") {
      return { ok: true, otevrene: [] };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(cteni.text) as unknown;
    } catch (error) {
      zalogovatChybuCteni("neplatný JSON", error);
      return { ok: false };
    }
    const dokument = parsovatDokument(parsed);
    if (!dokument) {
      zalogovatChybuCteni("neplatný tvar dokumentu");
      return { ok: false };
    }
    return { ok: true, otevrene: dokument.otevrene };
  } catch (error) {
    zalogovatChybuCteni("selhalo čtení", error);
    return { ok: false };
  }
}

/** Otevřené Nezařazené pro admin UI. */
export async function nacistNezarazene(): Promise<NacistNezarazeneVysledek> {
  if (!(await jeAdminPrihlasen())) {
    return { ok: false };
  }
  return nacistNezarazeneJadro();
}

function jeStejnyDokument(
  a: BranaNezarazeneDokument,
  b: BranaNezarazeneDokument,
): boolean {
  const stejneOtevrene =
    a.otevrene.length === b.otevrene.length &&
    a.otevrene.every((n, i) => n.id === b.otevrene[i]?.id);
  const stejneOdmitnute =
    a.odmitnuteKlice.length === b.odmitnuteKlice.length &&
    a.odmitnuteKlice.every((k, i) => k === b.odmitnuteKlice[i]);
  return stejneOtevrene && stejneOdmitnute;
}

async function ulozitNesparovaneJadro(args: {
  zdrojId: string;
  zdrojNazev: string;
  nesparovane: readonly BranaNezarazenyScanKandidat[];
}): Promise<void> {
  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit Nezařazené: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  await zmenitNezarazeneDokumentAtomicky((dokument) => {
    const po = pridatNesparovaneDoNezarazenych(dokument, {
      ...args,
      noveId: () => `nez-${crypto.randomUUID()}`,
    });
    if (jeStejnyDokument(dokument, po)) {
      return { typ: "bezZmeny", vysledek: undefined };
    }
    return { typ: "zapsat", dokument: po, vysledek: undefined };
  });
}

async function vyresitPoMatchiJadro(
  uspesneZpracovaneKlice: readonly string[],
): Promise<void> {
  if (uspesneZpracovaneKlice.length === 0) {
    return;
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze aktualizovat Nezařazené: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  await zmenitNezarazeneDokumentAtomicky((dokument) => {
    const po = vyresitOtevreneNezarazenePodleKlicu(
      dokument,
      uspesneZpracovaneKlice,
    );
    if (jeStejnyDokument(dokument, po)) {
      return { typ: "bezZmeny", vysledek: undefined };
    }
    return { typ: "zapsat", dokument: po, vysledek: undefined };
  });
}

/**
 * Persist nových NO-MATCH před CEKA writerem.
 * Dedup + filtr odmítnutých. Neprovádí resolve matched.
 */
export async function ulozitNesparovaneNezarazene(args: {
  zdrojId: string;
  zdrojNazev: string;
  nesparovane: readonly BranaNezarazenyScanKandidat[];
}): Promise<void> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }
  await ulozitNesparovaneJadro(args);
}

/** Persist NO-MATCH pro scheduler (bez admin session). */
export async function ulozitNesparovaneNezarazeneProScheduler(args: {
  zdrojId: string;
  zdrojNazev: string;
  nesparovane: readonly BranaNezarazenyScanKandidat[];
}): Promise<void> {
  await ulozitNesparovaneJadro(args);
}

/**
 * Po úspěšném pridatCekajici: vyřeš matched klíče z otevřených.
 * Volat až když CEKA cesta doběhla bez throw.
 */
export async function vyresitNezarazenePoUspesnemMatchi(
  uspesneZpracovaneKlice: readonly string[],
): Promise<void> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }
  await vyresitPoMatchiJadro(uspesneZpracovaneKlice);
}

/** Resolve matched otevřených pro scheduler. */
export async function vyresitNezarazenePoUspesnemMatchiProScheduler(
  uspesneZpracovaneKlice: readonly string[],
): Promise<void> {
  await vyresitPoMatchiJadro(uspesneZpracovaneKlice);
}

async function smazatNezarazenyNalezJadro(id: string): Promise<void> {
  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze smazat Nezařazené: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  await zmenitNezarazeneDokumentAtomicky((dokument) => {
    const vysledek = smazatNezarazenyNalezVDokumentu(dokument, id);
    if ("chyba" in vysledek) {
      throw new Error(vysledek.chyba);
    }
    return { typ: "zapsat", dokument: vysledek, vysledek: undefined };
  });
}

/** Smazat z otevřených + paměť klíče (neblokuje budoucí MATCH→CEKA). */
export async function smazatNezarazenyNalez(id: string): Promise<void> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }
  await smazatNezarazenyNalezJadro(id);
}
