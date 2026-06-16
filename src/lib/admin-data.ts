import "server-only";

import { headers } from "next/headers";
import type { AdminData } from "@/types";
import { ziskatVsechnyPolozky } from "./polozky";
import { ziskatSouhrnMetrik } from "./metriky";
import { pouzivaBlobUloziste, ziskatDiagnozuBlob } from "./env-blob";

/** Načte položky, metriky a diagnostiku – vždy v serverovém kontextu s OIDC hlavičkou */
export async function nacistAdminData(): Promise<AdminData> {
  const hlavicky = await headers();
  const oidcHeader = hlavicky.get("x-vercel-oidc-token");

  const polozky = await ziskatVsechnyPolozky(oidcHeader);
  const metriky = await ziskatSouhrnMetrik(oidcHeader);
  const diagnoza = ziskatDiagnozuBlob(oidcHeader);

  return {
    polozky,
    metriky,
    trvaleUloziste: pouzivaBlobUloziste() && diagnoza.maAutentizaci,
    diagnoza,
  };
}
