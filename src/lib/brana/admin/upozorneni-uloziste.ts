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
 * Nastavení budoucího Scanování + interního Web Push (bez odesílání).
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

/** Jedna interní PushSubscription – bez historie / multi-device. */
export type BranaPushSubscription = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type BranaUpozorneniNastaveniDokument = {
  /** Dočasná neaktivní rezerva – UI Web Push už nepoužívá */
  telefon: string;
  upozorneniAktivni: boolean;
  pushSubscription: BranaPushSubscription | null;
  /** ISO YYYY-MM-DD – pondělí; čas 9:00 Europe/Prague je systémový */
  pristiDlouhodobaKontrola: string | null;
  /** ISO YYYY-MM-DD – vyplní budoucí dlouhodobý cyklus po dokončení */
  posledniDokoncenaDlouhodobaKontrola: string | null;
  /** ISO YYYY-MM-DD – den posledního rychlého upozornění (max 1 / den) */
  posledniUpozorneniRychle: string | null;
  /** ISO YYYY-MM-DD – den posledního dlouhodobého upozornění */
  posledniUpozorneniDlouhodobe: string | null;
};

/** Veřejný pohled pro admin UI – bez endpoint/keys. */
export type BranaUpozorneniNastaveniProUi = {
  upozorneniAktivni: boolean;
  maPushSubscription: boolean;
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
    pushSubscription: null,
    pristiDlouhodobaKontrola: null,
    posledniDokoncenaDlouhodobaKontrola: null,
    posledniUpozorneniRychle: null,
    posledniUpozorneniDlouhodobe: null,
  };
}

export function dokumentNaUi(
  dokument: BranaUpozorneniNastaveniDokument,
): BranaUpozorneniNastaveniProUi {
  return {
    upozorneniAktivni: dokument.upozorneniAktivni,
    maPushSubscription: dokument.pushSubscription !== null,
    pristiDlouhodobaKontrola: dokument.pristiDlouhodobaKontrola,
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

export function validovatPushSubscriptionVstup(
  hodnota: unknown,
):
  | { ok: true; pushSubscription: BranaPushSubscription }
  | { ok: false; chyba: string } {
  if (!hodnota || typeof hodnota !== "object") {
    return { ok: false, chyba: "Push subscription není platná." };
  }
  const raw = hodnota as Record<string, unknown>;
  if (typeof raw.endpoint !== "string" || !raw.endpoint.trim()) {
    return { ok: false, chyba: "Push subscription nemá platný endpoint." };
  }
  if (
    !(
      raw.expirationTime === null ||
      (typeof raw.expirationTime === "number" &&
        Number.isFinite(raw.expirationTime))
    )
  ) {
    return {
      ok: false,
      chyba: "Push subscription má neplatný expirationTime.",
    };
  }
  if (!raw.keys || typeof raw.keys !== "object") {
    return { ok: false, chyba: "Push subscription nemá platné klíče." };
  }
  const keys = raw.keys as Record<string, unknown>;
  if (typeof keys.p256dh !== "string" || !keys.p256dh.trim()) {
    return { ok: false, chyba: "Push subscription nemá platný klíč p256dh." };
  }
  if (typeof keys.auth !== "string" || !keys.auth.trim()) {
    return { ok: false, chyba: "Push subscription nemá platný klíč auth." };
  }
  return {
    ok: true,
    pushSubscription: {
      endpoint: raw.endpoint.trim(),
      expirationTime: raw.expirationTime as number | null,
      keys: {
        p256dh: keys.p256dh.trim(),
        auth: keys.auth.trim(),
      },
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
 * Validace celého PRIVATE dokumentu před put.
 * AKTIVNÍ ⇒ musí existovat validní pushSubscription.
 * pushSubscription === null ⇒ upozorneniAktivni musí být false.
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

  const telefon = validovatTelefonVstup(raw.telefon ?? "");
  if (!telefon.ok) {
    return telefon;
  }

  if (typeof raw.upozorneniAktivni !== "boolean") {
    return { ok: false, chyba: "Stav upozornění musí být ANO nebo NE." };
  }

  let pushSubscription: BranaPushSubscription | null = null;
  if (raw.pushSubscription !== null && raw.pushSubscription !== undefined) {
    const sub = validovatPushSubscriptionVstup(raw.pushSubscription);
    if (!sub.ok) {
      return sub;
    }
    pushSubscription = sub.pushSubscription;
  }

  if (raw.upozorneniAktivni === true && pushSubscription === null) {
    return {
      ok: false,
      chyba: "Pro aktivní upozornění je nutná platná push subscription.",
    };
  }

  if (pushSubscription === null && raw.upozorneniAktivni === true) {
    return {
      ok: false,
      chyba: "Pro aktivní upozornění je nutná platná push subscription.",
    };
  }

  if (pushSubscription === null && raw.upozorneniAktivni !== false) {
    return {
      ok: false,
      chyba: "Bez push subscription musí být upozornění vypnutá.",
    };
  }

  const pristi = validovatPristiDlouhodobouKontroluVstup(
    raw.pristiDlouhodobaKontrola ?? null,
  );
  if (!pristi.ok) {
    return pristi;
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
      telefon: telefon.telefon,
      upozorneniAktivni: raw.upozorneniAktivni,
      pushSubscription,
      pristiDlouhodobaKontrola: pristi.pristiDlouhodobaKontrola,
      posledniDokoncenaDlouhodobaKontrola: posledniDokoncena.hodnota,
      posledniUpozorneniRychle: posledniRychle.hodnota,
      posledniUpozorneniDlouhodobe: posledniDlouhodobe.hodnota,
    },
  };
}

function parsovatDokument(
  parsed: unknown,
): BranaUpozorneniNastaveniDokument | null {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const raw = parsed as Record<string, unknown>;
  // Starší dokumenty bez pushSubscription → null.
  const sPush =
    "pushSubscription" in raw
      ? raw
      : { ...raw, pushSubscription: null, upozorneniAktivni: false };

  // Starší dokumenty s aktivním telefonem bez subscription → bezpečně VYPNUTO.
  if (
    sPush.upozorneniAktivni === true &&
    (sPush.pushSubscription === null || sPush.pushSubscription === undefined)
  ) {
    const opraveno = { ...sPush, upozorneniAktivni: false };
    const validace = validovatUpozorneniDokument(opraveno);
    return validace.ok ? validace.dokument : null;
  }

  const validace = validovatUpozorneniDokument(sPush);
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

async function nacistNeboVychoziDokument(): Promise<BranaUpozorneniNastaveniDokument> {
  const cteni = await nacistTextZPrivateBlob();
  if (cteni.stav === "neexistuje") {
    return vychoziUpozorneniNastaveni();
  }

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
  return stary;
}

/**
 * Načte nastavení upozornění z PRIVATE Blobu (bez admin kontroly).
 * - Objekt neexistuje → výchozí VYPNUTO (Blob se nevytváří).
 * - Jiná chyba / neplatný dokument → ok: false.
 */
async function nacistUpozorneniNastaveniDokument(): Promise<NacistUpozorneniNastaveniVysledek> {
  noStore();

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
 * Načte nastavení upozornění.
 * - Objekt neexistuje → výchozí VYPNUTO (Blob se nevytváří).
 * - Jiná chyba / neplatný dokument → ok: false.
 */
export async function nacistUpozorneniNastaveni(): Promise<NacistUpozorneniNastaveniVysledek> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  return nacistUpozorneniNastaveniDokument();
}

/**
 * Read-only načtení pro důvěryhodný scheduler (po ověření CRON_SECRET).
 * Bez admin session. Žádný put.
 */
export async function nacistUpozorneniNastaveniProScheduler(): Promise<NacistUpozorneniNastaveniVysledek> {
  return nacistUpozorneniNastaveniDokument();
}

/** Uloží pouze příští dlouhodobou kontrolu; ostatní pole zachová. */
export async function ulozitPristiDlouhodobouKontrolu(
  pristiDlouhodobaKontrola: string | null,
): Promise<BranaUpozorneniNastaveniDokument> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit nastavení upozornění: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const pristi = validovatPristiDlouhodobouKontroluVstup(
    pristiDlouhodobaKontrola,
  );
  if (!pristi.ok) {
    throw new Error(pristi.chyba);
  }

  const stary = await nacistNeboVychoziDokument();
  const vyslednyNavrh: BranaUpozorneniNastaveniDokument = {
    ...stary,
    pristiDlouhodobaKontrola: pristi.pristiDlouhodobaKontrola,
  };

  const celek = validovatUpozorneniDokument(vyslednyNavrh);
  if (!celek.ok) {
    throw new Error(celek.chyba);
  }

  await ulozitDokument(celek.dokument);
  return celek.dokument;
}

/** Uloží / nahradí jedinou PushSubscription a zapne upozornění. */
export async function ulozitPushSubscription(
  subscription: unknown,
): Promise<BranaUpozorneniNastaveniDokument> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit nastavení upozornění: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const sub = validovatPushSubscriptionVstup(subscription);
  if (!sub.ok) {
    throw new Error(sub.chyba);
  }

  const stary = await nacistNeboVychoziDokument();
  const vyslednyNavrh: BranaUpozorneniNastaveniDokument = {
    ...stary,
    pushSubscription: sub.pushSubscription,
    upozorneniAktivni: true,
  };

  const celek = validovatUpozorneniDokument(vyslednyNavrh);
  if (!celek.ok) {
    throw new Error(celek.chyba);
  }

  await ulozitDokument(celek.dokument);
  return celek.dokument;
}

/** Odstraní PushSubscription a vypne upozornění. */
export async function vypnoutPushSubscription(): Promise<BranaUpozorneniNastaveniDokument> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit nastavení upozornění: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const stary = await nacistNeboVychoziDokument();
  const vyslednyNavrh: BranaUpozorneniNastaveniDokument = {
    ...stary,
    pushSubscription: null,
    upozorneniAktivni: false,
  };

  const celek = validovatUpozorneniDokument(vyslednyNavrh);
  if (!celek.ok) {
    throw new Error(celek.chyba);
  }

  await ulozitDokument(celek.dokument);
  return celek.dokument;
}

/**
 * Zápis posledniUpozorneniRychle pro důvěryhodný scheduler (po ověření CRON_SECRET).
 * Pouze YYYY-MM-DD. Nemění ostatní pole. Bez admin session.
 * Volat výhradně po úspěšném webpush.sendNotification.
 */
export async function ulozitPosledniUpozorneniRychleProScheduler(
  posledniUpozorneniRychle: string,
): Promise<BranaUpozorneniNastaveniDokument> {
  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error(
      "Nelze uložit nastavení upozornění: chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.",
    );
  }

  const den = validovatVolitelnyIsoDenPole(
    posledniUpozorneniRychle,
    "Poslední rychlé upozornění",
  );
  if (!den.ok || den.hodnota === null) {
    throw new Error(
      "Poslední rychlé upozornění musí být datum ve formátu RRRR-MM-DD.",
    );
  }

  const stary = await nacistNeboVychoziDokument();
  const vyslednyNavrh: BranaUpozorneniNastaveniDokument = {
    ...stary,
    posledniUpozorneniRychle: den.hodnota,
  };

  const celek = validovatUpozorneniDokument(vyslednyNavrh);
  if (!celek.ok) {
    throw new Error(celek.chyba);
  }

  await ulozitDokument(celek.dokument);
  return celek.dokument;
}
