import "server-only";

import { BlobNotFoundError, get, put } from "@vercel/blob";
import { unstable_noStore as noStore } from "next/cache";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import { okamzikVPraze, okamzikZPrahy } from "@/lib/brana/cas";
import {
  maBranaAdminBlobKonfiguraci,
  ziskatVolbyBranaAdminBlob,
} from "./env-blob-brana-admin";

/**
 * Objekt v PRIVATE Blob store administrace BRÁNY.
 * Nastavení budoucího Scanování + Upozornění (bez SMS / cronu).
 */
export const BRANA_UPOZORNENI_NASTAVENI_BLOB_CESTA =
  "data/brana-upozorneni-nastaveni.json";

/** Bezpečná zpráva pro klienta – bez tokenů a interních podrobností */
export const BRANA_UPOZORNENI_CHYBA_CTENI =
  "Nastavení upozornění se nepodařilo načíst. Žádná data nebyla změněna.";

/** Systémový čas budoucích scanů / upozornění (Europe/Prague). */
export const BRANA_UPOZORNENI_CAS_HODINA = 9;
export const BRANA_UPOZORNENI_CAS_MINUTA = 0;

/** Interval dlouhodobého cyklu v kalendářních dnech (kotva + 21). */
export const BRANA_UPOZORNENI_DLOUHODOBY_INTERVAL_DNI = 21;

const TELEFON_MAX_DELKA = 32;

export type BranaUpozorneniNastaveniDokument = {
  telefon: string;
  upozorneniAktivni: boolean;
  /** ISO YYYY-MM-DD – pondělí; čas 9:00 Europe/Prague je systémový */
  pristiDlouhodobaKontrola: string | null;
  /** ISO YYYY-MM-DD – vyplní budoucí dlouhodobý cyklus po dokončení */
  posledniDokoncenaDlouhodobaKontrola: string | null;
  /** ISO YYYY-MM-DD – den posledního rychlého upozornění (max 1 SMS / den) */
  posledniUpozorneniRychle: string | null;
  /** ISO YYYY-MM-DD – den posledního dlouhodobého upozornění */
  posledniUpozorneniDlouhodobe: string | null;
};

export type BranaUpozorneniNastaveniVstup = {
  telefon: string;
  upozorneniAktivni: boolean;
  pristiDlouhodobaKontrola: string | null;
};

export type NacistUpozorneniNastaveniVysledek =
  | { ok: true; dokument: BranaUpozorneniNastaveniDokument }
  | { ok: false };

type BlobCteniTextu =
  | { stav: "neexistuje" }
  | { stav: "ok"; text: string };

/** Výchozí bezpečný stav – žádný Blob se nevytváří. */
export function vychoziUpozorneniNastaveni(): BranaUpozorneniNastaveniDokument {
  return {
    telefon: "",
    upozorneniAktivni: false,
    pristiDlouhodobaKontrola: null,
    posledniDokoncenaDlouhodobaKontrola: null,
    posledniUpozorneniRychle: null,
    posledniUpozorneniDlouhodobe: null,
  };
}

function zalogovatChybuCteni(duvod: string, error?: unknown): void {
  if (error === undefined) {
    console.error(`[brana-upozorneni-nastaveni] ${duvod}`);
    return;
  }
  console.error(`[brana-upozorneni-nastaveni] ${duvod}`, error);
}

function jeIsoDen(hodnota: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(hodnota);
}

/** Pondělí v Europe/Prague pro daný kalendářní den YYYY-MM-DD. */
export function jePondeliIsoDen(isoDen: string): boolean {
  if (!jeIsoDen(isoDen)) {
    return false;
  }
  const [rok, mesic, den] = isoDen.split("-").map(Number);
  const okamzik = okamzikZPrahy(rok, mesic, den, 12, 0);
  return okamzikVPraze(okamzik).denVTydnu === 1;
}

export function validovatTelefonVstup(
  hodnota: unknown,
): { ok: true; telefon: string } | { ok: false; chyba: string } {
  if (typeof hodnota !== "string") {
    return { ok: false, chyba: "Telefon musí být text." };
  }
  const telefon = hodnota.trim();
  if (telefon.length > TELEFON_MAX_DELKA) {
    return {
      ok: false,
      chyba: `Telefon smí mít nejvýše ${TELEFON_MAX_DELKA} znaků.`,
    };
  }
  if (telefon.length === 0) {
    return { ok: true, telefon: "" };
  }
  // Trim only – bez přepisování formátu; + předvolba a číslice / mezery / pomlčky.
  if (!/^\+?[0-9][0-9\s\-()]{0,30}$/.test(telefon)) {
    return {
      ok: false,
      chyba: "Telefon může obsahovat číslice, mezery, pomlčky a volitelné +.",
    };
  }
  return { ok: true, telefon };
}

export function validovatPristiDlouhodobouKontroluVstup(
  hodnota: unknown,
):
  | { ok: true; pristiDlouhodobaKontrola: string | null }
  | { ok: false; chyba: string } {
  if (hodnota === null || hodnota === undefined || hodnota === "") {
    return { ok: true, pristiDlouhodobaKontrola: null };
  }
  if (typeof hodnota !== "string" || !jeIsoDen(hodnota.trim())) {
    return {
      ok: false,
      chyba: "Příští dlouhodobá kontrola musí být datum ve formátu RRRR-MM-DD.",
    };
  }
  const den = hodnota.trim();
  if (!jePondeliIsoDen(den)) {
    return {
      ok: false,
      chyba: "Příští dlouhodobá kontrola musí připadat na pondělí.",
    };
  }
  return { ok: true, pristiDlouhodobaKontrola: den };
}

export function validovatUpozorneniNastaveniVstup(
  vstup: unknown,
):
  | { ok: true; nastaveni: BranaUpozorneniNastaveniVstup }
  | { ok: false; chyba: string } {
  if (!vstup || typeof vstup !== "object") {
    return { ok: false, chyba: "Neplatný vstup nastavení upozornění." };
  }
  const raw = vstup as Record<string, unknown>;

  const telefon = validovatTelefonVstup(raw.telefon);
  if (!telefon.ok) {
    return telefon;
  }

  if (typeof raw.upozorneniAktivni !== "boolean") {
    return { ok: false, chyba: "Stav upozornění musí být ANO nebo NE." };
  }

  if (raw.upozorneniAktivni === true && telefon.telefon.length === 0) {
    return {
      ok: false,
      chyba: "Pro aktivní upozornění je nutné zadat telefon.",
    };
  }

  const pristi = validovatPristiDlouhodobouKontroluVstup(
    raw.pristiDlouhodobaKontrola,
  );
  if (!pristi.ok) {
    return pristi;
  }

  return {
    ok: true,
    nastaveni: {
      telefon: telefon.telefon,
      upozorneniAktivni: raw.upozorneniAktivni,
      pristiDlouhodobaKontrola: pristi.pristiDlouhodobaKontrola,
    },
  };
}

function validovatVolitelnyIsoDenPole(
  hodnota: unknown,
  nazevPole: string,
): { ok: true; hodnota: string | null } | { ok: false; chyba: string } {
  if (hodnota === null || hodnota === undefined) {
    return { ok: true, hodnota: null };
  }
  if (typeof hodnota !== "string" || !jeIsoDen(hodnota)) {
    return {
      ok: false,
      chyba: `${nazevPole} musí být datum ve formátu RRRR-MM-DD nebo prázdné.`,
    };
  }
  return { ok: true, hodnota };
}

/**
 * Validace celého PRIVATE dokumentu (všech 6 polí) před put.
 * Zahrnuje vztah: aktivní upozornění ⇒ neprázdný validní telefon.
 */
export function validovatUpozorneniDokument(
  vstup: unknown,
):
  | { ok: true; dokument: BranaUpozorneniNastaveniDokument }
  | { ok: false; chyba: string } {
  if (!vstup || typeof vstup !== "object") {
    return { ok: false, chyba: "Neplatný dokument nastavení upozornění." };
  }
  const raw = vstup as Record<string, unknown>;

  const editovatelne = validovatUpozorneniNastaveniVstup({
    telefon: raw.telefon,
    upozorneniAktivni: raw.upozorneniAktivni,
    pristiDlouhodobaKontrola: raw.pristiDlouhodobaKontrola,
  });
  if (!editovatelne.ok) {
    return editovatelne;
  }

  const posledniDokoncena = validovatVolitelnyIsoDenPole(
    raw.posledniDokoncenaDlouhodobaKontrola,
    "Poslední dokončená dlouhodobá kontrola",
  );
  if (!posledniDokoncena.ok) {
    return posledniDokoncena;
  }

  const posledniRychle = validovatVolitelnyIsoDenPole(
    raw.posledniUpozorneniRychle,
    "Poslední rychlé upozornění",
  );
  if (!posledniRychle.ok) {
    return posledniRychle;
  }

  const posledniDlouhodobe = validovatVolitelnyIsoDenPole(
    raw.posledniUpozorneniDlouhodobe,
    "Poslední dlouhodobé upozornění",
  );
  if (!posledniDlouhodobe.ok) {
    return posledniDlouhodobe;
  }

  return {
    ok: true,
    dokument: {
      ...editovatelne.nastaveni,
      posledniDokoncenaDlouhodobaKontrola: posledniDokoncena.hodnota,
      posledniUpozorneniRychle: posledniRychle.hodnota,
      posledniUpozorneniDlouhodobe: posledniDlouhodobe.hodnota,
    },
  };
}

function parsovatDokument(
  parsed: unknown,
): BranaUpozorneniNastaveniDokument | null {
  const validace = validovatUpozorneniDokument(parsed);
  if (!validace.ok) {
    return null;
  }
  return validace.dokument;
}

async function nacistTextZPrivateBlob(): Promise<BlobCteniTextu> {
  const volby = ziskatVolbyBranaAdminBlob();

  if (!volby.token) {
    throw new Error("Chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.");
  }

  try {
    const vysledek = await get(BRANA_UPOZORNENI_NASTAVENI_BLOB_CESTA, {
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
  dokument: BranaUpozorneniNastaveniDokument,
): Promise<void> {
  const volby = ziskatVolbyBranaAdminBlob();

  if (!volby.token) {
    throw new Error(
      "Nelze uložit nastavení upozornění: chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  await put(
    BRANA_UPOZORNENI_NASTAVENI_BLOB_CESTA,
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
 * Načte nastavení upozornění.
 * - Objekt neexistuje → výchozí VYPNUTO (Blob se nevytváří).
 * - Jiná chyba / neplatný dokument → ok: false.
 */
export async function nacistUpozorneniNastaveni(): Promise<NacistUpozorneniNastaveniVysledek> {
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
      return { ok: true, dokument: vychoziUpozorneniNastaveni() };
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

    return { ok: true, dokument };
  } catch (error) {
    zalogovatChybuCteni("selhání čtení PRIVATE Blobu", error);
    return { ok: false };
  }
}

/**
 * Uloží editovatelná pole nastavení upozornění.
 * Stavová pole posledních upozornění / dokončené kontroly zachová.
 */
export async function ulozitUpozorneniNastaveni(
  vstup: BranaUpozorneniNastaveniVstup,
): Promise<BranaUpozorneniNastaveniDokument> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit nastavení upozornění: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const validace = validovatUpozorneniNastaveniVstup(vstup);
  if (!validace.ok) {
    throw new Error(validace.chyba);
  }

  const cteni = await nacistTextZPrivateBlob();

  let stavova: Pick<
    BranaUpozorneniNastaveniDokument,
    | "posledniDokoncenaDlouhodobaKontrola"
    | "posledniUpozorneniRychle"
    | "posledniUpozorneniDlouhodobe"
  > = {
    posledniDokoncenaDlouhodobaKontrola: null,
    posledniUpozorneniRychle: null,
    posledniUpozorneniDlouhodobe: null,
  };

  if (cteni.stav !== "neexistuje") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(cteni.text) as unknown;
    } catch {
      throw new Error(BRANA_UPOZORNENI_CHYBA_CTENI);
    }

    const stary = parsovatDokument(parsed);
    if (!stary) {
      throw new Error(BRANA_UPOZORNENI_CHYBA_CTENI);
    }

    stavova = {
      posledniDokoncenaDlouhodobaKontrola:
        stary.posledniDokoncenaDlouhodobaKontrola,
      posledniUpozorneniRychle: stary.posledniUpozorneniRychle,
      posledniUpozorneniDlouhodobe: stary.posledniUpozorneniDlouhodobe,
    };
  }

  const vyslednyNavrh: BranaUpozorneniNastaveniDokument = {
    ...validace.nastaveni,
    ...stavova,
  };

  const celek = validovatUpozorneniDokument(vyslednyNavrh);
  if (!celek.ok) {
    throw new Error(celek.chyba);
  }

  await ulozitDokument(celek.dokument);
  return celek.dokument;
}
