import "server-only";

import fs from "fs";
import path from "path";
import type { AdminVysledek } from "@/types";
import { seraditPolozky, nacistData } from "./uloziste-dat";
import {
  efektivniPoradiPolozek,
  jePlatnyCasRotaceProlnuti,
} from "./rotace-prolnuti";
import { prazdnySouhrnKomunity, spocitatSouhrnKomunity } from "./komunita";
import { prazdnySouhrnMetrik, ziskatSouhrnZUloziste } from "./metriky";
import {
  prazdnySouhrnChovaniNavstevniku,
  spocitatSouhrnChovaniNavstevniku,
} from "./chovani-navstevniku";
import { prazdnySouhrnAnalytics, ziskatSouhrnAnalytics } from "./analytics";
import { sloucitProlnutiCasovani, PROLNUTI_CASOVANI_VYCHOZI } from "./prolnuti-casovani";
import {
  nacistVsechnyVzkazy,
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
  let chovaniNavstevniku = prazdnySouhrnChovaniNavstevniku();
  let pocetPushOdberu = 0;
  let prolnutiCasovani = PROLNUTI_CASOVANI_VYCHOZI;
  let desktopPozvankaFotografie: string | null = null;
  let vzkazyTreboni: AdminVysledek["data"]["vzkazyTreboni"] = [];
  let legacyVzkazy: AdminVysledek["data"]["vzkazyTreboni"] = [];
  let rotaceProlnutiOd: string | null = null;
  let polozkaPosledniPublikace: AdminVysledek["data"]["polozkaPosledniPublikace"] =
    null;

  try {
    const uloziste = await nacistData(oidcHeader);
    const zakladniPoradi = seraditPolozky(uloziste.polozky);
    const casRotace = jePlatnyCasRotaceProlnuti(uloziste.rotaceProlnutiOd)
      ? uloziste.rotaceProlnutiOd.trim()
      : null;
    polozky = efektivniPoradiPolozek(
      uloziste.polozky,
      casRotace,
      Date.now()
    );
    rotaceProlnutiOd = casRotace;
    polozkaPosledniPublikace =
      zakladniPoradi.find((polozka) => polozka.aktivni) ?? null;
    metriky = ziskatSouhrnZUloziste(uloziste);
    komunita = spocitatSouhrnKomunity(uloziste);
    analytics = ziskatSouhrnAnalytics(uloziste, zakladniPoradi);
    chovaniNavstevniku = spocitatSouhrnChovaniNavstevniku(uloziste);
    pocetPushOdberu = uloziste.pushOdbery?.length ?? 0;
    prolnutiCasovani = sloucitProlnutiCasovani(uloziste.prolnutiCasovani);
    desktopPozvankaFotografie = uloziste.desktopPozvankaFotografie ?? null;
    legacyVzkazy = uloziste.vzkazyTreboni ?? [];
  } catch (error) {
    const zprava =
      error instanceof Error
        ? error.message
        : "Nepodařilo se načíst data z Blob úložiště";
    chyby.uloziste = zprava;
    chyby.polozky = zprava;
    chyby.metriky = zprava;
  }

  try {
    vzkazyTreboni = seraditVzkazyOdNejnovejsich(
      await nacistVsechnyVzkazy(oidcHeader, legacyVzkazy)
    );
  } catch (error) {
    chyby.vzkazyTreboni =
      error instanceof Error
        ? error.message
        : "Nepodařilo se načíst vzkazy Třeboni";
  }

  return {
    data: {
      polozky,
      metriky,
      komunita,
      analytics,
      chovaniNavstevniku,
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
      rotaceProlnutiOd,
      polozkaPosledniPublikace,
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
