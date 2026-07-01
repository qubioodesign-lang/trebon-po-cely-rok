import "server-only";

import fs from "fs";
import path from "path";
import type { AdminVysledek } from "@/types";
import { seraditPolozky, nacistData } from "./uloziste-dat";
import { prazdnySouhrnKomunity, spocitatSouhrnKomunity } from "./komunita";
import { prazdnySouhrnMetrik, ziskatSouhrnZUloziste } from "./metriky";
import { prazdnySouhrnAnalytics, ziskatSouhrnAnalytics } from "./analytics";
import { sloucitProlnutiCasovani, PROLNUTI_CASOVANI_VYCHOZI } from "./prolnuti-casovani";
import {
  normalizovatVzkazy,
  seraditVzkazyOdNejnovejsich,
} from "./vzkaz-treboni";
import { sestavitUrlDesktopPozvankaFotografie } from "./desktop-pozvanka-nastaveni";
import {
  maBlobKonfiguraci,
  pouzivaBlobUloziste,
  ziskatDiagnozuBlob,
  ziskatOidcZHlavicek,
} from "./env-blob";

const CESTA_LOKALNI_UPLOADS = path.join(process.cwd(), "public", "uploads");

function lzeVytvoritZalohu(): boolean {
  if (maBlobKonfiguraci()) {
    return true;
  }

  return fs.existsSync(CESTA_LOKALNI_UPLOADS);
}

export { lzeVytvoritZalohu };

export async function ziskatOidcZRequestu(): Promise<string | null> {
  return ziskatOidcZHlavicek();
}

/**
 * Načte administraci jedním čtením Blobu (stejně jako veřejný web).
 * Položky a metriky pocházejí ze stejného snapshotu – nelze rozejet.
 */
export async function nacistAdminData(): Promise<AdminVysledek> {
  const oidcHeader = await ziskatOidcZRequestu();
  const lzeZalohovat = lzeVytvoritZalohu();
  const diagnoza = ziskatDiagnozuBlob(oidcHeader, { lzeZalohovat });
  const chyby: AdminVysledek["chyby"] = {};

  let polozky: AdminVysledek["data"]["polozky"] = [];
  let metriky = prazdnySouhrnMetrik();
  let komunita = prazdnySouhrnKomunity();
  let analytics = prazdnySouhrnAnalytics();
  let pocetPushOdberu = 0;
  let prolnutiCasovani = PROLNUTI_CASOVANI_VYCHOZI;
  let desktopPozvankaFotografie: string | null = null;
  let vzkazyTreboni: AdminVysledek["data"]["vzkazyTreboni"] = [];

  try {
    const uloziste = await nacistData(oidcHeader);
    polozky = seraditPolozky(uloziste.polozky);
    metriky = ziskatSouhrnZUloziste(uloziste);
    komunita = spocitatSouhrnKomunity(uloziste);
    analytics = ziskatSouhrnAnalytics(uloziste, polozky);
    pocetPushOdberu = uloziste.pushOdbery?.length ?? 0;
    prolnutiCasovani = sloucitProlnutiCasovani(uloziste.prolnutiCasovani);
    desktopPozvankaFotografie = uloziste.desktopPozvankaFotografie ?? null;
    vzkazyTreboni = seraditVzkazyOdNejnovejsich(normalizovatVzkazy(uloziste));
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
      komunita,
      analytics,
      pocetPushOdberu,
      trvaleUloziste: diagnoza.trvaleUloziste,
      lzeVytvoritZalohu: lzeVytvoritZalohu(),
      diagnoza,
      prolnutiCasovani,
      desktopPozvankaFotografie,
      desktopPozvankaFotografieUrl: sestavitUrlDesktopPozvankaFotografie(
        desktopPozvankaFotografie
      ),
      vzkazyTreboni,
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
