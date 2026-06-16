import "server-only";

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

/** Má projekt nakonfigurované Blob úložiště (store ID nebo read-write token) */
export function maBlobKonfiguraci(): boolean {
  return Boolean(ziskatEnv("BLOB_STORE_ID") || ziskatEnv("BLOB_READ_WRITE_TOKEN"));
}

/**
 * True, pokud lze Blob použít za běhu.
 * Stačí BLOB_STORE_ID (OIDC řeší SDK) nebo BLOB_READ_WRITE_TOKEN.
 */
export function pouzivaBlobUloziste(): boolean {
  if (jeBuildFaze()) return false;
  return maBlobKonfiguraci();
}

/** Má k dispozici alespoň jeden způsob autentizace */
export function maBlobAutentizaci(oidcZHeaderu?: string | null): boolean {
  if (ziskatEnv("BLOB_READ_WRITE_TOKEN")) return true;
  if (oidcZHeaderu) return true;
  if (ziskatEnv("VERCEL_OIDC_TOKEN")) return true;
  // Na Vercelu s propojeným store SDK autentizuje přes x-vercel-oidc-token
  if (ziskatEnv("VERCEL") === "1" && ziskatEnv("BLOB_STORE_ID")) return true;
  return false;
}

/** Volby pro @vercel/blob – synchronní, pouze z env */
export function ziskatVolbyBlob(): {
  storeId?: string;
  token?: string;
  oidcToken?: string;
} {
  const volby: { storeId?: string; token?: string; oidcToken?: string } = {};

  const storeId = ziskatEnv("BLOB_STORE_ID");
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

  // Dynamicky načti hlavičku, pokud nebyla předána
  if (!volby.oidcToken && !volby.token && ziskatEnv("BLOB_STORE_ID")) {
    try {
      const { headers } = await import("next/headers");
      const hlavicky = await headers();
      const oidc = hlavicky.get("x-vercel-oidc-token");
      if (oidc) volby.oidcToken = oidc;
    } catch {
      // Mimo request kontext
    }
  }

  return volby;
}

/** Bezpečná diagnostika – neobsahuje tajné hodnoty */
export interface DiagnozaBlob {
  trvaleUloziste: boolean;
  maAutentizaci: boolean;
  jeBuild: boolean;
  prostredi: {
    vercel: boolean;
    nodeEnv: string;
  };
  promenne: {
    BLOB_STORE_ID: boolean;
    BLOB_READ_WRITE_TOKEN: boolean;
    VERCEL_OIDC_TOKEN: boolean;
    OIDC_Z_HEADERU: boolean;
  };
  nahledStoreId: string | null;
  doporuceni: string | null;
}

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
