import "server-only";

import { del, list, put } from "@vercel/blob";
import {
  maBlobAutentizaciProZapis,
  pouzivaBlobUloziste,
  ziskatOidcZHlavicek,
  ziskatVolbyBlobAsync,
} from "@/lib/env-blob";
import { overitSouborVerejne } from "@/lib/soubory";

/** Veřejné snímky pro facebookový odkaz. Mimo uploads/ galerie. */
export const BRANA_FACEBOOK_NAHLED_PREFIX = "brana-facebook/";

export const BRANA_FACEBOOK_ODKAZ_ZAKLAD =
  "https://www.trebonpocelyrok.cz/brana";

const MAX_BAJTU = 8 * 1024 * 1024;
const MAX_STRANA = 16_000;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PNG_SIGNATURA = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

type PriponaNahledu = "png" | "jpg";

type OverenyNahled = {
  telo: Buffer;
  contentType: "image/png" | "image/jpeg";
  pripona: PriponaNahledu;
};

export function jeBranaFacebookFbk(hodnota: string): boolean {
  return UUID.test(hodnota);
}

export function sestavitBranaFacebookOdkaz(id: string): string {
  return `${BRANA_FACEBOOK_ODKAZ_ZAKLAD}?fbk=${id.toLowerCase()}`;
}

function jePng(telo: Buffer): boolean {
  if (telo.length < PNG_SIGNATURA.length) return false;
  return PNG_SIGNATURA.every((bajt, index) => telo[index] === bajt);
}

function jeJpeg(telo: Buffer): boolean {
  return telo.length >= 4 && telo[0] === 0xff && telo[1] === 0xd8 && telo[2] === 0xff;
}

/** PNG musí mít IHDR a končit chunkem IEND. Obrázek se nepřekódovává. */
function jeCelyPng(telo: Buffer): boolean {
  if (!jePng(telo)) return false;

  let offset = 8;
  let prvniChunk = true;
  let videlIhdr = false;
  let sirka = 0;
  let vyska = 0;

  while (offset + 12 <= telo.length) {
    const delka = telo.readUInt32BE(offset);
    const typ = telo.toString("ascii", offset + 4, offset + 8);
    const konec = offset + 12 + delka;
    if (delka > telo.length || konec > telo.length) return false;
    if (prvniChunk && typ !== "IHDR") return false;
    prvniChunk = false;

    if (typ === "IHDR") {
      if (videlIhdr || delka < 13) return false;
      sirka = telo.readUInt32BE(offset + 8);
      vyska = telo.readUInt32BE(offset + 12);
      if (sirka < 1 || vyska < 1 || sirka > MAX_STRANA || vyska > MAX_STRANA) {
        return false;
      }
      videlIhdr = true;
    }

    if (typ === "IEND") {
      return videlIhdr && delka === 0 && konec === telo.length && sirka > 0 && vyska > 0;
    }

    offset = konec;
  }

  return false;
}

/** Konec snímku může mít za sebou jen krátký doslov editoru. */
function maKonecJpeg(telo: Buffer): boolean {
  const od = Math.max(2, telo.length - 32);
  for (let i = telo.length - 2; i >= od; i -= 1) {
    if (telo[i] === 0xff && telo[i + 1] === 0xd9) return true;
  }
  return false;
}

function jeZnackaBezDelky(znacka: number): boolean {
  return znacka === 0x01 || (znacka >= 0xd0 && znacka <= 0xd9);
}

function jeSof(znacka: number): boolean {
  return (
    znacka >= 0xc0 &&
    znacka <= 0xcf &&
    znacka !== 0xc4 &&
    znacka !== 0xc8 &&
    znacka !== 0xcc
  );
}

/** JPEG musí mít rozměr v SOF a konec snímku. Obrázek se nepřekódovává. */
function jeCelyJpeg(telo: Buffer): boolean {
  if (!jeJpeg(telo) || !maKonecJpeg(telo)) return false;

  let i = 2;
  let sirka = 0;
  let vyska = 0;

  while (i + 1 < telo.length) {
    if (telo[i] !== 0xff) return false;
    while (i < telo.length && telo[i] === 0xff) i += 1;
    if (i >= telo.length) return false;

    const znacka = telo[i];
    i += 1;

    if (znacka === 0xd9) return false;
    if (znacka === 0xda) return sirka > 0 && vyska > 0;
    if (jeZnackaBezDelky(znacka)) continue;
    if (i + 1 >= telo.length) return false;

    const delka = telo.readUInt16BE(i);
    if (delka < 2 || i + delka > telo.length) return false;

    if (jeSof(znacka)) {
      if (delka < 7 || sirka > 0) return false;
      vyska = telo.readUInt16BE(i + 3);
      sirka = telo.readUInt16BE(i + 5);
      if (sirka < 1 || vyska < 1 || sirka > MAX_STRANA || vyska > MAX_STRANA) {
        return false;
      }
    }

    i += delka;
  }

  return false;
}

function overitNahled(soubor: File, telo: Buffer): OverenyNahled {
  if (telo.length > MAX_BAJTU) {
    throw new Error("Obrázek je větší než 8 MB. Odkaz nebyl vytvořen.");
  }
  if (telo.length < 32) {
    throw new Error("Lze nahrát jen úplný PNG nebo JPEG. Odkaz nebyl vytvořen.");
  }

  const typ = soubor.type.toLowerCase();
  if (typ === "image/png" && jeCelyPng(telo)) {
    return { telo, contentType: "image/png", pripona: "png" };
  }
  if (typ === "image/jpeg" && jeCelyJpeg(telo)) {
    return { telo, contentType: "image/jpeg", pripona: "jpg" };
  }

  throw new Error("Lze nahrát jen úplný PNG nebo JPEG. Odkaz nebyl vytvořen.");
}

async function smazatJenTentoNovySoubor(
  url: string,
  oidc: string | null,
): Promise<void> {
  try {
    const volby = await ziskatVolbyBlobAsync(oidc);
    await del(url, volby);
  } catch {
    // Selhání úklidu nesmí vrátit odkaz.
  }
}

/**
 * Uloží původní soubor a vrátí odkaz až po veřejném ověření.
 * Při chybě nový soubor smaže. Starší snímky nemění.
 */
export async function ulozitBranaFacebookNahled(soubor: File): Promise<{
  id: string;
  odkaz: string;
  nahledUrl: string;
}> {
  const oidc = await ziskatOidcZHlavicek();
  if (!pouzivaBlobUloziste() || !maBlobAutentizaciProZapis(oidc)) {
    throw new Error("Obrázek nelze uložit. Odkaz nebyl vytvořen.");
  }

  if (typeof soubor.size === "number" && soubor.size > MAX_BAJTU) {
    throw new Error("Obrázek je větší než 8 MB. Odkaz nebyl vytvořen.");
  }

  const overeny = overitNahled(soubor, Buffer.from(await soubor.arrayBuffer()));
  const id = crypto.randomUUID().toLowerCase();
  const cesta = `${BRANA_FACEBOOK_NAHLED_PREFIX}${id}.${overeny.pripona}`;
  const volby = await ziskatVolbyBlobAsync(oidc);

  const blob = await put(cesta, overeny.telo, {
    ...volby,
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: overeny.contentType,
  });

  if (blob.pathname !== cesta) {
    await smazatJenTentoNovySoubor(blob.url, oidc);
    throw new Error("Obrázek se nepodařilo uložit. Odkaz nebyl vytvořen.");
  }

  try {
    await overitSouborVerejne(blob.url);
  } catch {
    await smazatJenTentoNovySoubor(blob.url, oidc);
    throw new Error(
      "Obrázek zatím není veřejně dostupný. Odkaz nebyl vytvořen.",
    );
  }

  return {
    id,
    odkaz: sestavitBranaFacebookOdkaz(id),
    nahledUrl: blob.url,
  };
}

/** Najde už uložený snímek. Neznámé nebo chybějící id vrátí null a nic nevyhazuje. */
export async function najitBranaFacebookNahled(
  id: string,
): Promise<{ url: string; contentType: "image/png" | "image/jpeg" } | null> {
  if (!jeBranaFacebookFbk(id)) return null;

  try {
    const volby = await ziskatVolbyBlobAsync(await ziskatOidcZHlavicek());
    const nalezene = await list({
      ...volby,
      prefix: `${BRANA_FACEBOOK_NAHLED_PREFIX}${id.toLowerCase()}.`,
      limit: 3,
    });
    const shody = nalezene.blobs.filter((blob) => {
      const cesta = blob.pathname;
      return (
        cesta === `${BRANA_FACEBOOK_NAHLED_PREFIX}${id.toLowerCase()}.png` ||
        cesta === `${BRANA_FACEBOOK_NAHLED_PREFIX}${id.toLowerCase()}.jpg`
      );
    });
    if (shody.length !== 1) return null;

    const soubor = shody[0];
    const contentType = soubor.pathname.endsWith(".png")
      ? "image/png"
      : "image/jpeg";
    return { url: soubor.url, contentType };
  } catch {
    return null;
  }
}
