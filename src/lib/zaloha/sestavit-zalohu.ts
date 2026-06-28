import "server-only";

import fs from "fs";
import path from "path";
import { zipSync, strToU8 } from "fflate";
import { nacistDataCerstve } from "@/lib/uloziste-dat";
import { pouzivaBlobUloziste } from "@/lib/env-blob";
import { PUSH_TITULEK, PUSH_TEXT } from "@/lib/push-notifikace";
import { ziskatSouboryPolozky } from "@/lib/polozka-soubory";
import {
  ZALOHA_SCHEMA,
  ZALOHA_VERZE,
  type ManifestZalohy,
  type NastaveniProjektuZalohy,
} from "./typy";
import { cestaSouboruVZip, extrahovatUploadCestu } from "./pomocne";

const CESTA_MANIFEST = path.join(process.cwd(), "public", "manifest.json");
const CESTA_LOKALNI_UPLOADS = path.join(process.cwd(), "public", "uploads");

function nacistWebManifest(): string {
  if (!fs.existsSync(CESTA_MANIFEST)) {
    return JSON.stringify({ name: "Třeboň po celý rok" }, null, 2);
  }
  return fs.readFileSync(CESTA_MANIFEST, "utf-8");
}

function sestavitNastaveni(): NastaveniProjektuZalohy {
  return {
    vapidVerejnyKlic: process.env.VAPID_VEREJNY_KLIC ?? "",
    vapidEmail: process.env.VAPID_EMAIL ?? "mailto:admin@trebon-po-cely-rok.cz",
    pushTitulek: PUSH_TITULEK,
    pushText: PUSH_TEXT,
    schemaVerze: ZALOHA_VERZE,
  };
}

async function stahnoutSouborPolozky(soubor: string): Promise<Uint8Array> {
  if (soubor.startsWith("http://") || soubor.startsWith("https://")) {
    const odpoved = await fetch(soubor, { cache: "no-store" });
    if (!odpoved.ok) {
      throw new Error(
        `Soubor ${soubor} se nepodařilo stáhnout (HTTP ${odpoved.status}).`
      );
    }
    return new Uint8Array(await odpoved.arrayBuffer());
  }

  const uploadCesta = extrahovatUploadCestu(soubor) ?? soubor;
  const cesta = path.join(CESTA_LOKALNI_UPLOADS, uploadCesta);
  if (!fs.existsSync(cesta)) {
    throw new Error(`Lokální soubor ${uploadCesta} nebyl nalezen.`);
  }
  return new Uint8Array(fs.readFileSync(cesta));
}

/** Sestaví ZIP zálohu z aktuálních produkčních dat (read-only) */
export async function sestavitZalohuZip(
  oidcZHeaderu?: string | null
): Promise<Uint8Array> {
  if (!pouzivaBlobUloziste() && !fs.existsSync(CESTA_LOKALNI_UPLOADS)) {
    throw new Error("Zálohu lze vytvořit jen při aktivním Blob úložišti nebo lokálních souborech.");
  }

  const uloziste = await nacistDataCerstve(oidcZHeaderu);
  const souboryZip: Record<string, Uint8Array> = {};
  let pocetSouboru = 0;

  for (const polozka of uloziste.polozky) {
    for (const soubor of ziskatSouboryPolozky(polozka)) {
      const uploadCesta = extrahovatUploadCestu(soubor);
      if (!uploadCesta) {
        throw new Error(
          `Položka „${polozka.popis}“ nemá rozpoznatelnou cestu souboru.`
        );
      }

      const obsah = await stahnoutSouborPolozky(soubor);
      souboryZip[cestaSouboruVZip(uploadCesta)] = obsah;
      pocetSouboru += 1;
    }
  }

  const manifest: ManifestZalohy = {
    schema: ZALOHA_SCHEMA,
    version: ZALOHA_VERZE,
    vytvoreno: new Date().toISOString(),
    typ: "manual",
    souhrn: {
      polozky: uloziste.polozky.length,
      soubory: pocetSouboru,
      pushOdbery: uloziste.pushOdbery?.length ?? 0,
      maMetriky: Boolean(uloziste.metrikyAgregovane),
    },
  };

  souboryZip["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
  souboryZip["data/uloziste.json"] = strToU8(JSON.stringify(uloziste, null, 2));
  souboryZip["settings/manifest.webmanifest.json"] = strToU8(nacistWebManifest());
  souboryZip["settings/project.json"] = strToU8(
    JSON.stringify(sestavitNastaveni(), null, 2)
  );

  return zipSync(souboryZip, { level: 6 });
}
