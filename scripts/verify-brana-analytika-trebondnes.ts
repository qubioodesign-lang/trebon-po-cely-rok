/**
 * Příchody přes trebondnes.cz. Bez produkčního Blob zápisu.
 * Spuštění: npx tsx scripts/verify-brana-analytika-trebondnes.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { dnesVPraze, okamzikZPrahy } from "../src/lib/brana/cas";
import {
  BRANA_ANALYTIKA_GRAF_OBDOBI,
  sestavitPodkladyGrafu,
} from "../src/lib/brana/analytika/grafy";
import {
  aplikovatDavkuAnalytiky,
  isoDenZData,
  parsovatDokumentAnalytiky,
  prazdnyDenAnalytiky,
  prazdnyDokumentAnalytiky,
  validovatDavkuAnalytiky,
} from "../src/lib/brana/analytika/model";
import {
  rozpoznatZdrojZAdresy,
  rozhodnoutZacatekNavstevy,
  type BranaNavstevaUloziste,
} from "../src/lib/brana/analytika/navsteva-klient";
import {
  odeslatRozpoznanouNavstevu,
  sestavitPozadavekNavstevy,
} from "../src/lib/brana/analytika/odeslani-navstevy";
import { KLIC_BRANA_VYLOUCIT_ANALYTIKU } from "../src/lib/brana/analytika/vylouceni-zarizeni";

const TED = okamzikZPrahy(2026, 1, 15, 12, 0);
const DEN = isoDenZData(dnesVPraze(TED));

let selhalo = 0;

function assert(ok: boolean, popis: string): void {
  if (ok) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhalo += 1;
  console.error(`FAIL ${popis}`);
}

function panel(): BranaNavstevaUloziste {
  const data = new Map<string, string>();
  return {
    getItem: (klic) => data.get(klic) ?? null,
    setItem: (klic, hodnota) => {
      data.set(klic, hodnota);
    },
    removeItem: (klic) => {
      data.delete(klic);
    },
  };
}

async function sUlozistem<T>(data: Map<string, string>, akce: () => Promise<T>): Promise<T> {
  const popis = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (klic: string) => data.get(klic) ?? null,
      setItem: (klic: string, hodnota: string) => {
        data.set(klic, hodnota);
      },
      removeItem: (klic: string) => {
        data.delete(klic);
      },
    },
  });
  try {
    return await akce();
  } finally {
    if (popis) {
      Object.defineProperty(globalThis, "localStorage", popis);
    } else {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  }
}

function testRozpoznani(): void {
  const samotne = rozpoznatZdrojZAdresy("?z=trebondnes");
  assert(samotne?.zdroj === "trebondnes", "z=trebondnes je vlastní zdroj");
  assert(
    rozpoznatZdrojZAdresy("?z=TREBONDNES")?.zdroj === "trebondnes",
    "značka trebondnes nerozlišuje velikost písmen",
  );
  assert(rozpoznatZdrojZAdresy("?z=qr")?.zdroj === "qr", "QR zůstává QR");
  assert(
    rozpoznatZdrojZAdresy("?zdroj=desktop-qr")?.zdroj === "qr",
    "desktopový QR zůstává QR",
  );
  assert(rozpoznatZdrojZAdresy("?z=sdileni")?.zdroj === "sdileni", "sdílení zůstává sdílení");
  assert(rozpoznatZdrojZAdresy("?z=qr&z=trebondnes")?.zdroj === "qr", "QR má přednost");
  assert(
    rozpoznatZdrojZAdresy("?z=trebondnes&zdroj=desktop-qr")?.zdroj === "qr",
    "desktopový QR má přednost",
  );
  assert(
    rozpoznatZdrojZAdresy("?z=trebondnes&z=sdileni")?.zdroj === "sdileni",
    "sdílení má přednost",
  );

  const ulozeno = panel();
  const prvni = rozhodnoutZacatekNavstevy({
    uloziste: ulozeno,
    ted: TED.getTime(),
    spusteni: "prohlizec",
    navstevnik: "novy",
    hledani: "?z=trebondnes",
  });
  assert(
    prvni.zaznamenat &&
      prvni.udalost.zdroj === "trebondnes" &&
      prvni.udalost.navstevnik === "novy" &&
      prvni.udalost.qrDesktop === undefined,
    "první příchod je jedna návštěva se zdrojem trebondnes",
  );
  const znovu = rozhodnoutZacatekNavstevy({
    uloziste: ulozeno,
    ted: TED.getTime() + 1_000,
    spusteni: "prohlizec",
    hledani: "?z=trebondnes",
  });
  assert(!znovu.zaznamenat, "stejná návštěva se nepočítá podruhé");
}

function testUlozeniAStarsiDen(): void {
  const davka = validovatDavkuAnalytiky({
    udalosti: [
      {
        typ: "navsteva",
        spusteni: "ikona",
        navstevnik: "vracejici",
        zdroj: "trebondnes",
      },
    ],
  });
  assert(davka.ok, "událost trebondnes projde");
  if (!davka.ok) {
    return;
  }
  const po = aplikovatDavkuAnalytiky(prazdnyDokumentAnalytiky(), davka.udalosti, TED);
  const den = po.dny[DEN];
  assert(
    den?.navstevy === 1 &&
      den.trebondnes === 1 &&
      den.vracejici === 1 &&
      den.novi === 0 &&
      den.zdroje.qr === 0 &&
      den.qrDesktop === 0 &&
      den.zdroje.sdileni === 0 &&
      den.spusteni.ikona === 1,
    "příchod zvýší návštěvy a trebondnes, ne QR ani sdílení",
  );

  const qr = validovatDavkuAnalytiky({
    udalosti: [{ typ: "navsteva", spusteni: "prohlizec", zdroj: "qr", qrDesktop: true }],
  });
  const sdileni = validovatDavkuAnalytiky({
    udalosti: [{ typ: "navsteva", spusteni: "prohlizec", zdroj: "sdileni" }],
  });
  assert(qr.ok && sdileni.ok, "původní zdroje dál projdou");
  if (!qr.ok || !sdileni.ok) {
    return;
  }
  const puvodni = aplikovatDavkuAnalytiky(
    aplikovatDavkuAnalytiky(prazdnyDokumentAnalytiky(), qr.udalosti, TED),
    sdileni.udalosti,
    TED,
  );
  const denPuvodni = puvodni.dny[DEN];
  assert(
    denPuvodni?.navstevy === 2 &&
      denPuvodni.zdroje.qr === 1 &&
      denPuvodni.qrDesktop === 1 &&
      denPuvodni.zdroje.sdileni === 1 &&
      denPuvodni.trebondnes === 0,
    "QR a sdílení trebondnes nezvýší",
  );

  const odmitnuto = validovatDavkuAnalytiky({
    udalosti: [{ typ: "navsteva", spusteni: "prohlizec", zdroj: "trebondnes", qrDesktop: true }],
  });
  assert(!odmitnuto.ok, "trebondnes nesmí nést příznak desktopového QR");

  const stary = prazdnyDenAnalytiky();
  stary.navstevy = 4;
  stary.zdroje.qr = 2;
  stary.zdroje.sdileni = 1;
  delete (stary as { trebondnes?: number }).trebondnes;
  const dokument = parsovatDokumentAnalytiky({ verze: 1, dny: { [DEN]: stary } });
  assert(
    dokument?.dny[DEN]?.trebondnes === 0 &&
      dokument.dny[DEN]?.navstevy === 4 &&
      dokument.dny[DEN]?.zdroje.qr === 2 &&
      dokument.dny[DEN]?.zdroje.sdileni === 1,
    "starší den bez pole zůstane čitelný a trebondnes je nula",
  );

  const poskozene = prazdnyDenAnalytiky();
  (poskozene as { trebondnes: unknown }).trebondnes = -1;
  assert(
    parsovatDokumentAnalytiky({ verze: 1, dny: { [DEN]: poskozene } }) === null,
    "záporný počet trebondnes odmítne dokument",
  );
}

function testGraf(): void {
  const den = prazdnyDenAnalytiky();
  den.navstevy = 5;
  den.trebondnes = 2;
  den.zdroje.qr = 1;
  const dokument = parsovatDokumentAnalytiky({ verze: 1, dny: { [DEN]: den } });
  assert(dokument !== null, "dokument pro graf je čitelný");
  if (!dokument) {
    return;
  }
  for (const obdobi of BRANA_ANALYTIKA_GRAF_OBDOBI) {
    const podklady = sestavitPodkladyGrafu(dokument, TED, obdobi);
    assert(
      podklady.obdobi === obdobi &&
        podklady.trebondnes.soucet === 2 &&
        podklady.trebondnes.prichod.length > 0 &&
        podklady.navstevnost.soucet === 5 &&
        podklady.qr.soucetCelkem === 1 &&
        podklady.sdileni.soucetPrichod === 0,
      `období ${obdobi} dní má řadu trebondnes a nemění QR ani sdílení`,
    );
  }

  const prazdny = sestavitPodkladyGrafu(prazdnyDokumentAnalytiky(), TED, 30);
  assert(prazdny.trebondnes.soucet === 0, "prázdný dokument má nulu");

  const graf = readFileSync(
    join("src", "components", "brana", "admin", "BranaAdminAnalytikaGrafy.tsx"),
    "utf8",
  );
  assert(graf.includes('nadpis="trebondnes.cz"'), "graf se jmenuje trebondnes.cz");
  assert(graf.includes('krivkaPoctu("trebondnes.cz"'), "graf má jednu řadu trebondnes.cz");
  assert(graf.includes('nadpis="QR"'), "graf QR zůstal");
  assert(
    graf.includes("QR desktop je část QR celkem. Součty se nesčítají."),
    "popis grafu QR zůstal",
  );
  assert(graf.includes('nadpis="Sdílení"'), "graf Sdílení zůstal");
}

async function testVylouceniAOdeslani(): Promise<void> {
  const pozadavek = sestavitPozadavekNavstevy({
    typ: "navsteva",
    spusteni: "prohlizec",
    navstevnik: "novy",
    zdroj: "trebondnes",
  });
  assert(
    pozadavek !== null &&
      pozadavek.body.includes('"zdroj":"trebondnes"') &&
      !pozadavek.body.includes('"qr"'),
    "odesílaná návštěva nese jen zdroj trebondnes",
  );

  const vyloucene = new Map<string, string>([[KLIC_BRANA_VYLOUCIT_ANALYTIKU, "1"]]);
  const ulozeno = panel();
  await sUlozistem(vyloucene, async () => {
    const volani: unknown[] = [];
    const vysledek = await odeslatRozpoznanouNavstevu(
      {
        uloziste: ulozeno,
        ted: TED.getTime(),
        spusteni: "prohlizec",
        hledani: "?z=trebondnes",
      },
      async () => {
        volani.push(true);
        return { ok: true };
      },
    );
    assert(vysledek.pokusu === 0 && volani.length === 0, "vyloučené zařízení událost neodešle");
  });
}

function testNedotceneSoubory(): void {
  const soubory = [
    join("src", "lib", "brana", "pwa-instalace.ts"),
    join("src", "components", "brana", "BranaVyzvaPlocha.tsx"),
    join("src", "lib", "brana", "vlozeny-android-prohlizec.ts"),
    join("src", "lib", "brana", "otevrit-v-chromu.ts"),
    join("src", "lib", "brana", "sdileni.ts"),
    join("src", "lib", "brana", "cesty.ts"),
    join("src", "middleware.ts"),
    join("public", "brana", "manifest.webmanifest"),
    join("public", "brana", "sw.js"),
  ];
  for (const soubor of soubory) {
    const text = readFileSync(soubor, "utf8");
    assert(!text.includes("trebondnes"), `${soubor} trebondnes neobsahuje`);
  }
}

async function main(): Promise<void> {
  testRozpoznani();
  testUlozeniAStarsiDen();
  testGraf();
  await testVylouceniAOdeslani();
  testNedotceneSoubory();
  if (selhalo > 0) {
    console.error(`Selhalo: ${selhalo}`);
    process.exitCode = 1;
  }
}

void main();
