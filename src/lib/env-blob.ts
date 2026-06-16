import "server-only";

/**
 * Načte proměnnou prostředí za běhu.
 * Dynamický přístup process.env[klic] zabrání Next.js inline při buildu.
 */
export function ziskatEnv(klic: string): string | undefined {
  return process.env[klic];
}

/** True během next build – OIDC token ještě není k dispozici */
export function jeBuildFaze(): boolean {
  return ziskatEnv("NEXT_PHASE") === "phase-production-build";
}

/**
 * True, pokud jsou k dispozici skutečné Blob credentials.
 * OIDC vyžaduje BLOB_STORE_ID + VERCEL_OIDC_TOKEN (ne jen store ID v dashboardu).
 */
export function maBlobAutentizaci(): boolean {
  if (ziskatEnv("BLOB_READ_WRITE_TOKEN")) {
    return true;
  }

  return Boolean(ziskatEnv("BLOB_STORE_ID") && ziskatEnv("VERCEL_OIDC_TOKEN"));
}

/** True, pokud má aplikace používat Blob úložiště (ne při buildu) */
export function pouzivaBlobUloziste(): boolean {
  if (jeBuildFaze()) {
    return false;
  }
  return maBlobAutentizaci();
}

/** Volby pro @vercel/blob SDK – explicitní storeId pro OIDC */
export function ziskatVolbyBlob(): { storeId?: string } {
  const storeId = ziskatEnv("BLOB_STORE_ID");
  if (!storeId) return {};
  return { storeId };
}

/** Bezpečná diagnostika pro administraci – neobsahuje tajné hodnoty */
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
  };
  nahledStoreId: string | null;
}

export function ziskatDiagnozuBlob(): DiagnozaBlob {
  const storeId = ziskatEnv("BLOB_STORE_ID");

  return {
    trvaleUloziste: pouzivaBlobUloziste(),
    maAutentizaci: maBlobAutentizaci(),
    jeBuild: jeBuildFaze(),
    prostredi: {
      vercel: ziskatEnv("VERCEL") === "1",
      nodeEnv: ziskatEnv("NODE_ENV") ?? "neznámé",
    },
    promenne: {
      BLOB_STORE_ID: Boolean(storeId),
      BLOB_READ_WRITE_TOKEN: Boolean(ziskatEnv("BLOB_READ_WRITE_TOKEN")),
      VERCEL_OIDC_TOKEN: Boolean(ziskatEnv("VERCEL_OIDC_TOKEN")),
    },
    nahledStoreId: storeId ? storeId.slice(0, 16) + "…" : null,
  };
}
