/**
 * Lokální ověření ZIP schématu brana-backup v1.
 * Bez produkčního Blob WRITE. Spuštění:
 * npx tsx scripts/verify-brana-zaloha.ts
 */

import { strToU8, zipSync } from "fflate";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { BlobPreconditionFailedError } from "@vercel/blob";
import {
  zmenitDokumentAtomickySIo,
  type BranaCasIo,
} from "../src/lib/brana/admin/konkretni-udalosti-cas";
import { vytvoritVychoziRedakcniPoradi } from "../src/lib/brana/admin/redakcni-kostra";
import { jePlatnaCestaBranaZalohy } from "../src/lib/brana/admin/zaloha/pomocne";
import {
  BRANA_ZALOHA_PREFIX,
  BRANA_ZALOHA_SCHEMA,
  BRANA_ZALOHA_SOUBORY,
  BRANA_ZALOHA_VERZE,
  type BranaZalohaDokumentyTexty,
} from "../src/lib/brana/admin/zaloha/typy";
import { validovatKonkretniUdalostiZalohy } from "../src/lib/brana/admin/zaloha/validace";
import {
  parsovatBranaZalohuZip,
  sestavitBranaZalohuZip,
  simulovatObnovuBranaZalohy,
} from "../src/lib/brana/admin/zaloha/zip";

let selhalo = 0;

function assert(ok: boolean, popis: string): void {
  if (ok) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhalo += 1;
  console.error(`FAIL ${popis}`);
}

function vychoziUpozorneniText(): string {
  return JSON.stringify(
    {
      telefon: "",
      upozorneniAktivni: false,
      pushSubscription: null,
      pristiDlouhodobaKontrola: null,
      posledniDokoncenaDlouhodobaKontrola: null,
      posledniUpozorneniRychle: null,
      posledniUpozorneniDlouhodobe: null,
      posledniUpozorneniAsistovaneKotva: null,
      posledniRychlySkupinovyScan: null,
      posledniDlouhySkupinovyScan: null,
      schvalenoDoIso: null,
    },
    null,
    2,
  );
}

function fixtureTexty(): BranaZalohaDokumentyTexty {
  return {
    "data/brana-konkretni-udalosti.json": JSON.stringify(
      {
        verzeUloziste: 1,
        posledniScanDokoncen: true,
        udalosti: [
          {
            id: "u1",
            redakcniPolozkaId: "test-id",
            datumOd: "2026-08-22",
            datumDo: "2026-08-22",
            cas: "18:00",
            mistoNeboTyp: "Sál",
            nazev: "Koncert",
            rucniPoziceVDni: null,
            stavSchvaleni: "SCHVALENO",
          },
        ],
      },
      null,
      2,
    ),
    "data/brana-redakcni-poradi.json": JSON.stringify(
      {
        verzeUloziste: 2,
        polozky: vytvoritVychoziRedakcniPoradi(),
      },
      null,
      2,
    ),
    "data/brana-zdroje.json": JSON.stringify(
      {
        zdroje: [
          {
            id: "z1",
            nazev: "Město",
            typ: "RYCHLY",
            url: "https://example.com/program",
          },
        ],
      },
      null,
      2,
    ),
    "data/brana-upozorneni-nastaveni.json": vychoziUpozorneniText(),
    "data/brana-nezarazene.json": JSON.stringify(
      {
        verzeUloziste: 1,
        otevrene: [],
        odmitnuteKlice: [],
      },
      null,
      2,
    ),
  };
}

function zipMaSoubor(zip: Uint8Array, cesta: string): boolean {
  const parsovana = parsovatBranaZalohuZip(zip);
  return typeof parsovana.texty[cesta as keyof typeof parsovana.texty] === "string";
}

const texty = fixtureTexty();
const zip = sestavitBranaZalohuZip({
  typ: "manual",
  vytvoreno: "2026-08-22T10:00:00.000Z",
  dokumenty: texty,
});

const parsovana = parsovatBranaZalohuZip(zip);

assert(parsovana.manifest.schema === BRANA_ZALOHA_SCHEMA, "schema brana-backup");
assert(parsovana.manifest.version === BRANA_ZALOHA_VERZE, "verze 1");
assert(parsovana.manifest.typ === "manual", "typ manual");

for (const soubor of BRANA_ZALOHA_SOUBORY) {
  assert(zipMaSoubor(zip, soubor), `ZIP obsahuje ${soubor}`);
}

const zipText = new TextDecoder().decode(zip);
assert(!zipText.includes("manifest.webmanifest"), "ZIP bez manifest.webmanifest");
assert(!zipText.includes("sw.js"), "ZIP bez sw.js");
assert(!/brana-radar/.test(zipText), "ZIP bez RADAR");
assert(!zipText.includes("uloziste.json"), "ZIP bez Třeboň uloziste.json");
assert(
  !zipText.includes("brana-zdroje-nastaveni"),
  "ZIP bez brana-zdroje-nastaveni.json",
);

assert(
  JSON.parse(parsovana.texty["data/brana-konkretni-udalosti.json"]).udalosti[0]
    .nazev === "Koncert",
  "parsování ZIP zpět zachová kalendář",
);
assert(
  parsovana.dokumenty["data/brana-zdroje.json"].zdroje[0].id === "z1",
  "parsování ZIP zpět zachová zdroje",
);

const obnovene = simulovatObnovuBranaZalohy(zip);
assert(
  JSON.stringify(obnovene["data/brana-konkretni-udalosti.json"]) ===
    JSON.stringify(parsovana.dokumenty["data/brana-konkretni-udalosti.json"]),
  "simulace obnovy v paměti vrátí stejné dokumenty",
);

let trebonSchemaOdmitnuto = false;
try {
  const trebonZip = sestavitBranaZalohuZip({
    typ: "manual",
    dokumenty: texty,
  });
  const trebonSoubory: Record<string, Uint8Array> = {
    "manifest.json": strToU8(
      JSON.stringify({
        schema: "trebon-backup",
        version: 1,
        vytvoreno: "2026-08-22T10:00:00.000Z",
        typ: "manual",
        souhrn: { polozky: 0, soubory: 0, pushOdbery: 0, maMetriky: false },
      }),
    ),
  };
  for (const soubor of BRANA_ZALOHA_SOUBORY) {
    trebonSoubory[soubor] = strToU8(texty[soubor]);
  }
  void trebonZip;
  parsovatBranaZalohuZip(zipSync(trebonSoubory, { level: 6 }));
} catch (error) {
  const zprava = error instanceof Error ? error.message : "";
  trebonSchemaOdmitnuto = zprava.includes("trebon-backup");
}
assert(trebonSchemaOdmitnuto, "odmítnutí schématu trebon-backup");

let zakazaneOdmitnuto = 0;
const zakazane = [
  "data/brana-radar.json",
  "data/brana-zdroje-nastaveni.json",
  "data/uloziste.json",
  "sw.js",
  "settings/manifest.webmanifest.json",
];
for (const cesta of zakazane) {
  const soubory: Record<string, Uint8Array> = {
    "manifest.json": strToU8(
      JSON.stringify({
        schema: BRANA_ZALOHA_SCHEMA,
        version: BRANA_ZALOHA_VERZE,
        vytvoreno: "2026-08-22T10:00:00.000Z",
        typ: "manual",
      }),
    ),
    [cesta]: strToU8("{}"),
  };
  for (const soubor of BRANA_ZALOHA_SOUBORY) {
    soubory[soubor] = strToU8(texty[soubor]);
  }
  try {
    parsovatBranaZalohuZip(zipSync(soubory, { level: 6 }));
  } catch {
    zakazaneOdmitnuto += 1;
  }
}
assert(
  zakazaneOdmitnuto === zakazane.length,
  "odmítnutí ZIP s RADAR / SW / Třeboň / nastavení zdrojů",
);

assert(
  jePlatnaCestaBranaZalohy(`${BRANA_ZALOHA_PREFIX}2026-08-22T10-00-00-abcd1234.zip`),
  "platná cesta BRÁNA zálohy",
);
assert(
  !jePlatnaCestaBranaZalohy("backups/manual/foo.zip"),
  "odmítnutí Třeboň prefixu",
);
assert(
  !jePlatnaCestaBranaZalohy(`${BRANA_ZALOHA_PREFIX}../tajne.zip`),
  "odmítnutí .. v cestě",
);
assert(
  !jePlatnaCestaBranaZalohy(`${BRANA_ZALOHA_PREFIX}pod/slozka.zip`),
  "odmítnutí vnořené cesty",
);

const root = join(__dirname, "..");
const ui = readFileSync(
  join(root, "src/components/brana/admin/BranaAdminZalohy.tsx"),
  "utf8",
);
const actions = readFileSync(join(root, "src/app/brana/admin/actions.ts"), "utf8");
const indexZalohy = readFileSync(
  join(root, "src/lib/brana/admin/zaloha/index.ts"),
  "utf8",
);
const stahnout = existsSync(
  join(root, "src/app/api/brana/admin/zaloha/stahnout/route.ts"),
);

assert(ui.includes("Vytvořit zálohu"), "UI má Vytvořit zálohu");
assert(ui.includes("Stáhnout"), "UI má Stáhnout");
assert(ui.includes("nacistSeznamBranaZalohAkce"), "UI načítá seznam záloh");
assert(ui.includes("vytvoritBranaZalohuAkce"), "UI volá vytvoření zálohy");
assert(
  ui.includes("/api/brana/admin/zaloha/stahnout"),
  "UI stahuje přes chráněnou route",
);
assert(stahnout, "existuje download route");
assert(
  ui.includes("Obnova — zatím nepoužívat"),
  "UI má neaktivní informaci o obnově",
);
assert(
  ui.includes(
    "Obnovu živých dat provedeme pouze jako samostatně ověřený bezpečnostní krok.",
  ),
  "UI má vysvětlení deaktivované obnovy",
);
assert(!ui.includes("obnovitBranaZalohuAkce"), "UI nevolá akci obnovy");
assert(!ui.includes("handleObnovit"), "UI nemá handler obnovy");
assert(
  !ui.includes(">Obnovit<") && !ui.includes("> Obnovit <"),
  "UI nemá aktivní tlačítko Obnovit",
);
assert(
  !actions.includes("obnovitBranaZalohuAkce") &&
    !actions.includes("obnovitBranaZalohu("),
  "actions.ts nemá serverovou akci obnovy",
);
assert(
  actions.includes("vytvoritBranaZalohuAkce") &&
    actions.includes("nacistSeznamBranaZalohAkce"),
  "actions.ts má vytvoření a seznam",
);
assert(
  !indexZalohy.includes("obnovitBranaZalohu") &&
    !indexZalohy.includes("./obnovit"),
  "veřejné API záloh neexportuje živou obnovu",
);
assert(!existsSync(join(root, "src/lib/brana/admin/zaloha/obnovit.ts")), "živý restore modul je odstraněn");
assert(
  !ui.includes("manifest.webmanifest") &&
    !ui.includes("sw.js") &&
    !actions.includes("manifest.webmanifest"),
  "zálohy nesahají na PWA soubory",
);

type Kalendar = {
  verzeUloziste: number;
  posledniScanDokoncen: boolean;
  udalosti: unknown[];
};

const zivyKalendar: Kalendar = {
  verzeUloziste: 1,
  posledniScanDokoncen: false,
  udalosti: [],
};
let etag = "etag-1";
let zapsano: Kalendar | null = null;

const io: BranaCasIo<unknown> = {
  nacist: async () => ({ stav: "ok", dokument: zivyKalendar, etag }),
  vychoziDokument: () => zivyKalendar,
  validovat: validovatKonkretniUdalostiZalohy,
  ulozit: async (dokument, ifMatch) => {
    if (ifMatch !== etag) {
      throw new BlobPreconditionFailedError();
    }
    zapsano = dokument as Kalendar;
  },
  jePreconditionChyba: (error) => error instanceof BlobPreconditionFailedError,
};

async function overitCasObnovuVPameti(): Promise<void> {
  await zmenitDokumentAtomickySIo(io, () => ({
    typ: "zapsat",
    dokument: obnovene["data/brana-konkretni-udalosti.json"],
    vysledek: true,
  }));

  assert(
    zapsano !== null &&
      Array.isArray(zapsano.udalosti) &&
      (zapsano.udalosti[0] as { nazev?: string }).nazev === "Koncert",
    "simulace CAS obnovy kalendáře v paměti (bez Blob WRITE)",
  );
}

void overitCasObnovuVPameti()
  .then(() => {
    if (selhalo > 0) {
      console.error(`\nFAIL ${selhalo} kontrol`);
      process.exit(1);
    }
    console.log("\nOK verify-brana-zaloha");
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
