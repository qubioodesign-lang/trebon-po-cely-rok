import type { DiagnozaBlob } from "@/types";

export function BlokDiagnozy({ diagnoza }: { diagnoza: DiagnozaBlob }) {
  return (
    <div className="mx-auto max-w-sm rounded border border-amber-700/20 p-3 text-left font-mono text-[10px] leading-relaxed text-text-jemny">
      <p>diagnoza za běhu:</p>
      <p>vercel: {diagnoza.prostredi.vercel ? "ano" : "ne"}</p>
      <p>autentizace: {diagnoza.maAutentizaci ? "ano" : "ne"}</p>
      <p>node: {diagnoza.prostredi.nodeEnv}</p>
      <p>BLOB_STORE_ID: {diagnoza.promenne.BLOB_STORE_ID ? "ano" : "ne"}</p>
      <p>
        BLOB_READ_WRITE_TOKEN:{" "}
        {diagnoza.promenne.BLOB_READ_WRITE_TOKEN ? "ano" : "ne"}
      </p>
      <p>
        VERCEL_OIDC_TOKEN:{" "}
        {diagnoza.promenne.VERCEL_OIDC_TOKEN ? "ano" : "ne"}
      </p>
      <p>
        OIDC z hlavičky: {diagnoza.promenne.OIDC_Z_HEADERU ? "ano" : "ne"}
      </p>
      {diagnoza.nahledStoreId && <p>store: {diagnoza.nahledStoreId}</p>}
      {diagnoza.doporuceni && (
        <p className="mt-2 text-amber-700/90">{diagnoza.doporuceni}</p>
      )}
    </div>
  );
}
