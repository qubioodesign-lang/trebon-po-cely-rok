import "server-only";

/**
 * Načte proměnnou prostředí za běhu.
 * Dynamický přístup process.env[klic] zabrání Next.js inline při buildu,
 * kdy proměnná ještě neexistovala (typický problém na Vercelu).
 */
export function ziskatEnv(klic: string): string | undefined {
  return process.env[klic];
}

/** True, pokud je Blob úložiště nakonfigurované */
export function pouzivaBlobUloziste(): boolean {
  return Boolean(
    ziskatEnv("BLOB_READ_WRITE_TOKEN") || ziskatEnv("BLOB_STORE_ID")
  );
}

/** Bezpečná diagnostika pro administraci – neobsahuje tajné hodnoty */
export interface DiagnozaBlob {
  trvaleUloziste: boolean;
  prostredi: {
    vercel: boolean;
    nodeEnv: string;
  };
  promenne: {
    BLOB_STORE_ID: boolean;
    BLOB_READ_WRITE_TOKEN: boolean;
    VERCEL_OIDC_TOKEN: boolean;
  };
  /** Náhled store ID (např. store_abc…) – jen pro ověření, že se načetlo */
  nahledStoreId: string | null;
}

export function ziskatDiagnozuBlob(): DiagnozaBlob {
  const storeId = ziskatEnv("BLOB_STORE_ID");

  return {
    trvaleUloziste: pouzivaBlobUloziste(),
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
