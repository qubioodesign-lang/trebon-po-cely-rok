import "server-only";

import path from "path";
import { unzipSync } from "fflate";
import { put } from "@vercel/blob";
import type { UlozisteDat } from "@/lib/uloziste-dat";
import { ulozitDataBlob } from "@/lib/uloziste-blob";
import { pouzivaBlobUloziste, ziskatVolbyBlobAsync } from "@/lib/env-blob";
import { nacistZalohuZip } from "./uloziste-zaloh";
import {
  extrahovatUploadCestu,
  jePlatnaCestaZalohy,
  parsovatManifest,
  prectiTextZZip,
} from "./pomocne";
import { ziskatSouboryPolozky } from "@/lib/polozka-soubory";

const POVOLENE_TYPY: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

function ziskatContentType(nazevSouboru: string): string {
  const pripona = path.extname(nazevSouboru).toLowerCase();
  return POVOLENE_TYPY[pripona] ?? "application/octet-stream";
}

export interface VysledekObnovyZalohy {
  polozky: number;
  pushOdbery: number;
  soubory: number;
  vytvoreno: string;
}

/** Obnoví galerii a metadata ze ZIP zálohy uložené v Blobu */
export async function obnovitZeZalohy(
  pathname: string,
  oidcZHeaderu?: string | null
): Promise<VysledekObnovyZalohy> {
  if (!jePlatnaCestaZalohy(pathname)) {
    throw new Error("Neplatná cesta zálohy.");
  }

  if (!pouzivaBlobUloziste()) {
    throw new Error("Obnova zálohy je dostupná jen s aktivním Blob úložištěm.");
  }

  const volby = await ziskatVolbyBlobAsync(oidcZHeaderu);
  if (!volby.token && !volby.oidcToken) {
    throw new Error("Nelze obnovit zálohu – chybí autentizace k Blob úložišti.");
  }

  const zip = await nacistZalohuZip(pathname, oidcZHeaderu);
  const polozkyZip = unzipSync(zip);

  const manifest = parsovatManifest(prectiTextZZip(polozkyZip, "manifest.json"));
  const uloziste = JSON.parse(
    prectiTextZZip(polozkyZip, "data/uloziste.json")
  ) as UlozisteDat;

  if (!Array.isArray(uloziste.polozky)) {
    throw new Error("Záloha neobsahuje platná metadata galerie.");
  }

  const souboryVZip = new Map<string, Uint8Array>();
  for (const [klic, data] of Object.entries(polozkyZip)) {
    if (klic.startsWith("files/uploads/")) {
      souboryVZip.set(klic.slice("files/uploads/".length), data);
    }
  }

  let pocetSouboru = 0;

  for (const polozka of uloziste.polozky) {
    const cestySouboru = ziskatSouboryPolozky(polozka);
    const obnoveneUrl: string[] = [];

    for (const puvodniSoubor of cestySouboru) {
      const uploadCesta = extrahovatUploadCestu(puvodniSoubor);
      if (!uploadCesta) {
        throw new Error(
          `Metadata obsahují neplatnou cestu souboru u položky „${polozka.popis}“.`
        );
      }

      const obsah = souboryVZip.get(uploadCesta);
      if (!obsah) {
        throw new Error(
          `V záloze chybí soubor uploads/${uploadCesta} pro položku „${polozka.popis}“.`
        );
      }

      const vysledek = await put(`uploads/${uploadCesta}`, Buffer.from(obsah), {
        ...volby,
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: ziskatContentType(uploadCesta),
      });

      obnoveneUrl.push(vysledek.url);
      pocetSouboru += 1;
    }

    if (polozka.typ === "prolnuti") {
      polozka.soubory = obnoveneUrl;
      polozka.soubor = undefined;
    } else if (obnoveneUrl[0]) {
      polozka.soubor = obnoveneUrl[0];
      polozka.soubory = undefined;
    }
  }

  uloziste.pushOdbery = uloziste.pushOdbery ?? [];
  uloziste.metriky = uloziste.metriky ?? [];
  uloziste.verzeUloziste = 0;

  await ulozitDataBlob(uloziste, oidcZHeaderu);

  return {
    polozky: uloziste.polozky.length,
    pushOdbery: uloziste.pushOdbery.length,
    soubory: pocetSouboru,
    vytvoreno: manifest.vytvoreno,
  };
}
