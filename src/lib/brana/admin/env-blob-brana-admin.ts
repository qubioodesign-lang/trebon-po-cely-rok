import "server-only";

import { ziskatEnv } from "@/lib/env-blob";

/**
 * Volby výhradně pro PRIVATE Blob store administrace BRÁNY.
 * Oddělené od PUBLIC store Třeboně (BLOB_STORE_ID / BLOB_READ_WRITE_TOKEN).
 */
export function ziskatBranaAdminBlobStoreId(): string | undefined {
  const storeId = ziskatEnv("BLOB_BRANA_ADMIN_STORE_ID");
  if (!storeId) {
    return undefined;
  }
  return storeId.startsWith("store_")
    ? storeId.slice("store_".length)
    : storeId;
}

export function maBranaAdminBlobKonfiguraci(): boolean {
  return Boolean(
    ziskatBranaAdminBlobStoreId() ||
      ziskatEnv("BLOB_BRANA_ADMIN_READ_WRITE_TOKEN"),
  );
}

export function ziskatVolbyBranaAdminBlob(): {
  storeId?: string;
  token?: string;
} {
  const volby: { storeId?: string; token?: string } = {};

  const storeId = ziskatBranaAdminBlobStoreId();
  if (storeId) {
    volby.storeId = storeId;
  }

  const token = ziskatEnv("BLOB_BRANA_ADMIN_READ_WRITE_TOKEN");
  if (token) {
    volby.token = token;
  }

  return volby;
}
