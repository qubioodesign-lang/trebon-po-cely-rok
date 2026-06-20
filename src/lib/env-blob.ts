import "server-only";

import type { DiagnozaBlob } from "@/types";

/**
 * Načte proměnnou prostředí za běhu.
 * Dynamický přístup process.env[klic] zabrání Next.js inline při buildu.
 */
export function ziskatEnv(klic: string): string | undefined {
  return process.env[klic];
}

/** True během next build – Blob se nepoužívá */
export function jeBuildFaze(): boolean {
  return ziskatEnv("NEXT_PHASE") === "phase-production-build";
}

/** ID Blob store – z env nebo z read-write tokenu (formát vercel_blob_rw_<storeId>_<suffix>) */
export function ziskatBlobStoreId(): string | undefined {
  const storeId = ziskatEnv("BLOB_STORE_ID");
  if (storeId) {
    return storeId.startsWith("store_") ? storeId.slice("store_".length) : storeId;
  }

  const token = ziskatEnv("BLOB_READ_WRITE_TOKEN");
  if (!token?.startsWith("vercel_blob_rw_")) return undefined;

  const casti = token.split("_");
  const zTokenu = casti[3];
  return zTokenu && /^[a-z0-9]+$/i.test(zTokenu) ? zTokenu : undefined;
}

/** Má projekt nakonfigurované Blob úložiště (store ID nebo read-write token) */
export function maBlobKonfiguraci(): boolean {
  return Boolean(ziskatBlobStoreId() || ziskatEnv("BLOB_READ_WRITE_TOKEN"));
}

/**
 * True, pokud lze Blob použít za běhu.
 * Stačí BLOB_STORE_ID (OIDC řeší SDK) nebo BLOB_READ_WRITE_TOKEN.
 */
export function pouzivaBlobUloziste(): boolean {
  if (jeBuildFaze()) return false;
  return maBlobKonfiguraci();
}

/** Má k dispozici alespoň jeden způsob autentizace (skutečný token, ne jen store ID) */
export function maBlobAutentizaci(oidcZHeaderu?: string | null): boolean {
  if (ziskatEnv("BLOB_READ_WRITE_TOKEN")) return true;
  if (oidcZHeaderu) return true;
  if (ziskatEnv("VERCEL_OIDC_TOKEN")) return true;
  return false;
}

/** Volby pro @vercel/blob – synchronní, pouze z env */
export function ziskatVolbyBlob(): {
  storeId?: string;
  token?: string;
  oidcToken?: string;
} {
  const volby: { storeId?: string; token?: string; oidcToken?: string } = {};

  const storeId = ziskatBlobStoreId();
  if (storeId) volby.storeId = storeId;

  const readWrite = ziskatEnv("BLOB_READ_WRITE_TOKEN");
  if (readWrite) volby.token = readWrite;

  const oidc = ziskatEnv("VERCEL_OIDC_TOKEN");
  if (oidc) volby.oidcToken = oidc;

  return volby;
}

/**
 * Volby pro @vercel/blob včetně OIDC tokenu z request hlavičky.
 * Vercel často posílá token v x-vercel-oidc-token, ne v process.env.
 */
export async function ziskatVolbyBlobAsync(oidcZHeaderu?: string | null): Promise<{
  storeId?: string;
  token?: string;
  oidcToken?: string;
}> {
  const volby = ziskatVolbyBlob();

  if (!volby.oidcToken && oidcZHeaderu) {
    volby.oidcToken = oidcZHeaderu;
  }

  // Bez BLOB_READ_WRITE_TOKEN spoléháme na OIDC z hlavičky (API routes, server actions)
  if (!volby.oidcToken && !volby.token && maBlobKonfiguraci()) {
    const oidc = oidcZHeaderu ?? (await ziskatOidcZHlavicek());
    if (oidc) volby.oidcToken = oidc;
  }

  return volby;
}

/** OIDC token z Vercel hlavičky požadavku (stejně jako administrace). */
export async function ziskatOidcZHlavicek(): Promise<string | null> {
  try {
    const { headers } = await import("next/headers");
    const hlavicky = await headers();
    return hlavicky.get("x-vercel-oidc-token");
  } catch {
    return null;
  }
}

/** Bezpečná diagnostika – neobsahuje tajné hodnoty */
export type { DiagnozaBlob } from "@/types";

export function ziskatDiagnozuBlob(oidcZHeaderu?: string | null): DiagnozaBlob {
  const storeId = ziskatEnv("BLOB_STORE_ID");
  const maReadWrite = Boolean(ziskatEnv("BLOB_READ_WRITE_TOKEN"));
  const maOidcEnv = Boolean(ziskatEnv("VERCEL_OIDC_TOKEN"));
  const maOidcHeader = Boolean(oidcZHeaderu);
  const autentizace = maBlobAutentizaci(oidcZHeaderu);

  let doporuceni: string | null = null;
  if (!autentizace && storeId) {
    doporuceni =
      "Přidejte BLOB_READ_WRITE_TOKEN z Vercel → Storage → váš Blob → .env.local / Tokens";
  }

  return {
    trvaleUloziste: pouzivaBlobUloziste() && autentizace,
    maAutentizaci: autentizace,
    jeBuild: jeBuildFaze(),
    prostredi: {
      vercel: ziskatEnv("VERCEL") === "1",
      nodeEnv: ziskatEnv("NODE_ENV") ?? "neznámé",
    },
    promenne: {
      BLOB_STORE_ID: Boolean(storeId),
      BLOB_READ_WRITE_TOKEN: maReadWrite,
      VERCEL_OIDC_TOKEN: maOidcEnv,
      OIDC_Z_HEADERU: maOidcHeader,
    },
    nahledStoreId: storeId ? storeId.slice(0, 16) + "…" : null,
    doporuceni,
  };
}
