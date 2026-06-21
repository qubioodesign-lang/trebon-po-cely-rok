import "server-only";

import type { AdminVysledek } from "@/types";
import { seraditPolozky, nacistData } from "./uloziste-dat";
import { prazdnySouhrnMetrik, ziskatSouhrnZUloziste } from "./metriky";
import { prazdnySouhrnAnalytics, ziskatSouhrnAnalytics } from "./analytics";
import { pouzivaBlobUloziste, ziskatDiagnozuBlob, ziskatOidcZHlavicek } from "./env-blob";

export async function ziskatOidcZRequestu(): Promise<string | null> {
  return ziskatOidcZHlavicek();
}

/**
 * Načte administraci jedním čtením Blobu (stejně jako veřejný web).
 * Položky a metriky pocházejí ze stejného snapshotu – nelze rozejet.
 */
export async function nacistAdminData(): Promise<AdminVysledek> {
  const oidcHeader = await ziskatOidcZRequestu();
  const diagnoza = ziskatDiagnozuBlob(oidcHeader);
  const chyby: AdminVysledek["chyby"] = {};

  let polozky: AdminVysledek["data"]["polozky"] = [];
  let metriky = prazdnySouhrnMetrik();
  let analytics = prazdnySouhrnAnalytics();
  let pocetPushOdberu = 0;

  try {
    const uloziste = await nacistData(oidcHeader);
    polozky = seraditPolozky(uloziste.polozky);
    metriky = ziskatSouhrnZUloziste(uloziste);
    analytics = ziskatSouhrnAnalytics(uloziste, polozky);
    pocetPushOdberu = uloziste.pushOdbery?.length ?? 0;
  } catch (error) {
    const zprava =
      error instanceof Error
        ? error.message
        : "Nepodařilo se načíst data z Blob úložiště";
    chyby.uloziste = zprava;
    chyby.polozky = zprava;
    chyby.metriky = zprava;
  }

  return {
    data: {
      polozky,
      metriky,
      analytics,
      pocetPushOdberu,
      trvaleUloziste: pouzivaBlobUloziste() && diagnoza.maAutentizaci,
      diagnoza,
    },
    chyby,
  };
}

/** Zpráva pro chybějící Blob autentizaci při zápisu (server actions často nemají OIDC hlavičku) */
export function zpravaChybejiciBlobAutentizace(): string {
  return (
    "Chybí autentizace k Blob úložišti. Server actions na Vercelu často nedostanou OIDC token – " +
    "přidejte BLOB_READ_WRITE_TOKEN do Environment Variables (Vercel → Storage → Blob → Tokens) a redeployujte."
  );
}
