import "server-only";

import { BlobNotFoundError, get } from "@vercel/blob";
import { BRANA_KONKRETNI_UDALOSTI_BLOB_CESTA } from "@/lib/brana/admin/konkretni-udalosti-uloziste";
import { vychoziNezarazeneDokument } from "@/lib/brana/admin/nezarazene";
import { BRANA_NEZARAZENE_BLOB_CESTA } from "@/lib/brana/admin/nezarazene-uloziste";
import { vytvoritVychoziRedakcniPoradi } from "@/lib/brana/admin/redakcni-kostra";
import {
  BRANA_REDAKCNI_PORADI_BLOB_CESTA,
  BRANA_REDAKCNI_VERZE_ULOZISTE,
} from "@/lib/brana/admin/redakcni-poradi-uloziste";
import {
  BRANA_UPOZORNENI_NASTAVENI_BLOB_CESTA,
  vychoziUpozorneniNastaveni,
} from "@/lib/brana/admin/upozorneni-uloziste";
import { BRANA_ZDROJE_BLOB_CESTA } from "@/lib/brana/admin/zdroje-uloziste";
import {
  maBranaAdminBlobKonfiguraci,
  ziskatVolbyBranaAdminBlob,
} from "@/lib/brana/admin/env-blob-brana-admin";
import {
  BRANA_ZALOHA_KALENDAR_VERZE,
  BRANA_ZALOHA_SOUBORY,
  type BranaZalohaDokumentyTexty,
  type BranaZalohaSoubor,
} from "./typy";

type BlobCteniTextu =
  | { stav: "neexistuje" }
  | { stav: "ok"; text: string };

async function nacistTextZPrivateBlob(cesta: string): Promise<BlobCteniTextu> {
  if (!maBranaAdminBlobKonfiguraci()) {
    throw new Error("Chybí konfigurace PRIVATE Blob store administrace BRÁNY.");
  }

  const volby = ziskatVolbyBranaAdminBlob();
  if (!volby.token) {
    throw new Error("Chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.");
  }

  try {
    const vysledek = await get(cesta, {
      access: "private",
      ...volby,
    });

    if (vysledek === null) {
      return { stav: "neexistuje" };
    }

    if (!vysledek.stream) {
      throw new Error("Blob get vrátil odpověď bez použitelného streamu.");
    }

    const text = await new Response(vysledek.stream).text();
    return { stav: "ok", text };
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return { stav: "neexistuje" };
    }
    throw error;
  }
}

function vychoziTextKalendare(): string {
  return JSON.stringify(
    {
      verzeUloziste: BRANA_ZALOHA_KALENDAR_VERZE,
      posledniScanDokoncen: false,
      udalosti: [],
    },
    null,
    2,
  );
}

function vychoziTextRedakcnihoPoradi(): string {
  return JSON.stringify(
    {
      verzeUloziste: BRANA_REDAKCNI_VERZE_ULOZISTE,
      polozky: vytvoritVychoziRedakcniPoradi(),
    },
    null,
    2,
  );
}

function vychoziTextZdroju(): string {
  return JSON.stringify({ zdroje: [] }, null, 2);
}

function vychoziTextUpozorneni(): string {
  return JSON.stringify(vychoziUpozorneniNastaveni(), null, 2);
}

function vychoziTextNezarazenych(): string {
  return JSON.stringify(vychoziNezarazeneDokument(), null, 2);
}

const VYCHOZI_PODLE_CESTY: Record<BranaZalohaSoubor, () => string> = {
  "data/brana-konkretni-udalosti.json": vychoziTextKalendare,
  "data/brana-redakcni-poradi.json": vychoziTextRedakcnihoPoradi,
  "data/brana-zdroje.json": vychoziTextZdroju,
  "data/brana-upozorneni-nastaveni.json": vychoziTextUpozorneni,
  "data/brana-nezarazene.json": vychoziTextNezarazenych,
};

const BLOB_CESTA_PODLE_SOUBORU: Record<BranaZalohaSoubor, string> = {
  "data/brana-konkretni-udalosti.json": BRANA_KONKRETNI_UDALOSTI_BLOB_CESTA,
  "data/brana-redakcni-poradi.json": BRANA_REDAKCNI_PORADI_BLOB_CESTA,
  "data/brana-zdroje.json": BRANA_ZDROJE_BLOB_CESTA,
  "data/brana-upozorneni-nastaveni.json": BRANA_UPOZORNENI_NASTAVENI_BLOB_CESTA,
  "data/brana-nezarazene.json": BRANA_NEZARAZENE_BLOB_CESTA,
};

/**
 * Načte živé JSON dokumenty z PRIVATE store.
 * Chybějící Blob → stejný výchozí stav, jaký čtenáři vrací v paměti (Blob se nevytváří).
 */
export async function nacistDokumentyProZalohu(): Promise<BranaZalohaDokumentyTexty> {
  const texty = {} as BranaZalohaDokumentyTexty;

  for (const soubor of BRANA_ZALOHA_SOUBORY) {
    const cteni = await nacistTextZPrivateBlob(BLOB_CESTA_PODLE_SOUBORU[soubor]);
    texty[soubor] =
      cteni.stav === "ok" ? cteni.text : VYCHOZI_PODLE_CESTY[soubor]();
  }

  return texty;
}
