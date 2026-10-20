/**
 * Zařízení v analytice BRÁNY. Jen paměť a simulovaná data, bez Blob zápisu.
 * Spuštění: npx tsx scripts/verify-brana-analytika-zarizeni.ts
 */

import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BlobPreconditionFailedError } from "@vercel/blob";
import {
  BRANA_ANALYTIKA_GRAF_OBDOBI,
  sestavitPodkladyGrafu,
  type BodPoctuGrafu,
  type BranaAnalytikaGrafObdobi,
  type PodkladyGrafuBrany,
} from "../src/lib/brana/analytika/grafy";
import {
  aplikovatDavkuAnalytiky,
  isoDenZData,
  parsovatDokumentAnalytiky,
  prazdnyDenAnalytiky,
  prazdnyDokumentAnalytiky,
  validovatDavkuAnalytiky,
  type BranaAnalytikaDen,
  type BranaAnalytikaDokument,
  type BranaAnalytikaZarizeni,
} from "../src/lib/brana/analytika/model";
import { klasifikovatZarizeniZUserAgent } from "../src/lib/brana/analytika/zarizeni";
import {
  BranaAnalytikaUzExistujeError,
  zaznamenatDavkuAnalytiky,
  type BranaAnalytikaIo,
} from "../src/lib/brana/analytika/zapis";
import { dnesVPraze } from "../src/lib/brana/cas";

const CAS_HISTORIE = new Date("2026-10-01T10:00:00.000Z");
const CAS_SDILENI = new Date("2026-10-15T10:00:00.000Z");
const CAS = new Date("2026-10-16T10:00:00.000Z");
const CAS_DALSI = new Date("2026-10-17T10:00:00.000Z");
const DEN_HISTORIE = isoDenZData(dnesVPraze(CAS_HISTORIE));
const DEN_SDILENI = isoDenZData(dnesVPraze(CAS_SDILENI));
const DEN = isoDenZData(dnesVPraze(CAS));
const DEN_DALSI = isoDenZData(dnesVPraze(CAS_DALSI));

const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const ANDROID_TABLET =
  "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD_JAKO_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const LINUX =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const CHROMEOS =
  "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

let selhalo = 0;

function assert(ok: boolean, popis: string): void {
  if (ok) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhalo += 1;
  console.error(`FAIL ${popis}`);
}

function klon<T>(hodnota: T): T {
  return JSON.parse(JSON.stringify(hodnota)) as T;
}

function soucetZarizeni(den: BranaAnalytikaDen): number {
  return den.zarizeni.android + den.zarizeni.ios + den.zarizeni.pocitac + den.zarizeni.ostatni;
}

function dokumentSHistorii(): BranaAnalytikaDokument {
  const den = prazdnyDenAnalytiky();
  den.navstevy = 8;
  den.novi = 3;
  den.vracejici = 5;
  den.oblast.trebonsko = 8;
  return { verze: 1, dny: { [DEN_HISTORIE]: den } };
}

function bodProDen(body: readonly BodPoctuGrafu[], den: string): BodPoctuGrafu | undefined {
  return body.find((bod) => bod.od <= den && den <= bod.do);
}

type Pamat = {
  dokument: BranaAnalytikaDokument | null;
  etag: number;
};

function ioZPameti(pamat: Pamat): BranaAnalytikaIo {
  return {
    nacist: async () => {
      if (!pamat.dokument) {
        return { stav: "neexistuje" };
      }
      return { stav: "ok", dokument: klon(pamat.dokument), etag: String(pamat.etag) };
    },
    zalozit: async (dokument) => {
      if (pamat.dokument) {
        throw new BranaAnalytikaUzExistujeError();
      }
      pamat.dokument = klon(dokument);
      pamat.etag = 1;
    },
    ulozit: async (dokument, etag) => {
      if (!pamat.dokument || etag !== String(pamat.etag)) {
        throw new BlobPreconditionFailedError();
      }
      pamat.dokument = klon(dokument);
      pamat.etag += 1;
    },
  };
}

function testRozpoznani(): void {
  const vzorky: Array<[unknown, BranaAnalytikaZarizeni, string]> = [
    [ANDROID, "android", "Android telefon"],
    [ANDROID_TABLET, "android", "Android tablet"],
    [IPHONE, "ios", "iPhone"],
    [IPAD, "ios", "iPad se svým názvem"],
    [IPAD_JAKO_MAC, "pocitac", "iPad vydávající se za Mac zůstane počítač"],
    [WINDOWS, "pocitac", "Windows"],
    [MAC, "pocitac", "Mac"],
    [LINUX, "pocitac", "Linux desktop"],
    [CHROMEOS, "pocitac", "ChromeOS"],
    ["", "ostatni", "prázdná hlavička"],
    ["   ", "ostatni", "hlavička ze mezer"],
    [null, "ostatni", "chybějící hlavička"],
    [undefined, "ostatni", "undefined hlavička"],
    ["Mozilla/5.0 (compatible; Googlebot/2.1)", "ostatni", "neznámý klient"],
    ["Windows Phone 8.1", "ostatni", "Windows Phone není počítač"],
  ];
  for (const [vstup, ocekavano, popis] of vzorky) {
    assert(klasifikovatZarizeniZUserAgent(vstup) === ocekavano, popis);
  }
  assert(
    klasifikovatZarizeniZUserAgent(`${"A".repeat(5000)} Android`) === "ostatni",
    "příliš dlouhá hlavička se nečte dál než do bezpečné délky",
  );
}

function testNavstevaAHistorie(): void {
  const historie = dokumentSHistorii();
  const pred = klon(historie.dny[DEN_HISTORIE]);
  const poSdileni = aplikovatDavkuAnalytiky(historie, [{ typ: "sdileni" }], CAS_SDILENI);
  const denSdileni = poSdileni.dny[DEN_SDILENI];
  assert(poSdileni.zarizeniMereniOd === null, "samotné sdílení měření zařízení nespustí");
  assert(denSdileni?.sdileniKlik === 1, "sdílení dál přičítá svůj čítač");
  assert(
    denSdileni !== undefined && soucetZarizeni(denSdileni) === 0,
    "sdílení nezvýší žádné počítadlo zařízení",
  );

  const poIos = aplikovatDavkuAnalytiky(
    poSdileni,
    [{ typ: "navsteva", spusteni: "ikona", navstevnik: "novy", zdroj: "qr", qrDesktop: true }],
    CAS,
    "trebonsko",
    "ios",
  );
  const den = poIos.dny[DEN];
  assert(poIos.zarizeniMereniOd === DEN, "první návštěva uloží začátek měření");
  assert(den?.navstevy === 1, "návštěva se dál počítá");
  assert(den?.novi === 1 && den.vracejici === 0, "nový a vracející se zůstávají beze změny významu");
  assert(den?.spusteni.ikona === 1 && den.spusteni.prohlizec === 0, "způsob spuštění se nemění");
  assert(den?.oblast.trebonsko === 1, "geografie se nemění");
  assert(den?.zdroje.qr === 1 && den.qrDesktop === 1, "QR zůstává QR, ne zařízení");
  assert(
    den?.zarizeni.ios === 1 &&
      den.zarizeni.android === 0 &&
      den.zarizeni.pocitac === 0 &&
      den.zarizeni.ostatni === 0,
    "jedna návštěva zvýší právě jedno počítadlo",
  );
  assert(
    den !== undefined && soucetZarizeni(den) === den.navstevy,
    "součet zařízení v měřeném dni odpovídá návštěvám",
  );
  assert(
    JSON.stringify(poIos.dny[DEN_HISTORIE]) === JSON.stringify(pred),
    "historický den zůstane beze změny",
  );

  const poPohledu = aplikovatDavkuAnalytiky(
    poIos,
    [{ typ: "pohled", pohled: "dnes", raz: "prvni" }],
    CAS,
  );
  assert(poPohledu.dny[DEN]?.pohledy.dnes.prvni === 1, "otevření pohledu se dál počítá");
  assert(poPohledu.dny[DEN]?.zarizeni.ios === 1, "pohled zařízení nezvýší");
  assert(poPohledu.zarizeniMereniOd === DEN, "další zápis začátek měření nepřesune");

  const poDruhe = aplikovatDavkuAnalytiky(
    poPohledu,
    [{ typ: "navsteva", spusteni: "prohlizec", navstevnik: "vracejici" }],
    CAS_DALSI,
    "mimo_trebonsko",
    "android",
  );
  assert(poDruhe.zarizeniMereniOd === DEN, "začátek měření zůstane i další den");
  assert(poDruhe.dny[DEN_DALSI]?.zarizeni.android === 1, "druhý den přičte své zařízení");
  assert(poDruhe.dny[DEN]?.zarizeni.ios === 1, "starší měřený den se nepřepíše");
  assert(
    poDruhe.dny[DEN_DALSI]?.vracejici === 1 && poDruhe.dny[DEN_DALSI]?.oblast.mimo_trebonsko === 1,
    "vracející se návštěvník a oblast se chovají jako dřív",
  );

  const znovu = parsovatDokumentAnalytiky(poDruhe);
  assert(znovu?.zarizeniMereniOd === DEN, "uložený začátek měření přežije kontrolu dokumentu");
  const jesteJednou = znovu
    ? aplikovatDavkuAnalytiky(znovu, [{ typ: "proklikTrebon" }], CAS_DALSI)
    : null;
  assert(jesteJednou?.zarizeniMereniOd === DEN, "proklik začátek měření nemění");
  assert(jesteJednou?.dny[DEN_DALSI]?.proklikTrebon === 1, "proklik se dál počítá zvlášť");
  assert(jesteJednou?.dny[DEN_DALSI]?.zarizeni.android === 1, "proklik zařízení nezvýší");
}

function testStarySoubor(): void {
  const bezPole = parsovatDokumentAnalytiky({ verze: 1, dny: {} });
  assert(bezPole?.zarizeniMereniOd === null, "starý soubor bez data zůstane platný");
  const sNulou = parsovatDokumentAnalytiky({ verze: 1, dny: {}, zarizeniMereniOd: null });
  assert(sNulou?.zarizeniMereniOd === null, "prázdný začátek měření je platný");
  const sDatem = parsovatDokumentAnalytiky({
    verze: 1,
    dny: {},
    zarizeniMereniOd: "2026-10-16",
  });
  assert(sDatem?.zarizeniMereniOd === "2026-10-16", "platné datum se přečte zpět");
  assert(
    parsovatDokumentAnalytiky({ verze: 1, dny: {}, zarizeniMereniOd: "2026-02-31" }) === null,
    "neplatné datum se nepřepíše tichým novým začátkem",
  );
  assert(
    !validovatDavkuAnalytiky({ udalosti: [{ typ: "navsteva", zarizeni: "android" }] }).ok,
    "prohlížeč nemůže zařízení poslat v dávce",
  );
}

function testGrafy(dokument: BranaAnalytikaDokument): Record<
  BranaAnalytikaGrafObdobi,
  PodkladyGrafuBrany
> {
  const podklady = {
    7: sestavitPodkladyGrafu(dokument, CAS_DALSI, 7),
    30: sestavitPodkladyGrafu(dokument, CAS_DALSI, 30),
    90: sestavitPodkladyGrafu(dokument, CAS_DALSI, 90),
    365: sestavitPodkladyGrafu(dokument, CAS_DALSI, 365),
  };
  for (const obdobi of BRANA_ANALYTIKA_GRAF_OBDOBI) {
    const graf = podklady[obdobi];
    assert(graf.zarizeni.mereniOd === DEN, `období ${obdobi} zná uložený začátek`);
    assert(graf.zarizeni.android.length > 0, `období ${obdobi} má řadu Android`);
    const mereny = bodProDen(graf.zarizeni.ios, DEN);
    assert(mereny?.hodnota === 1, `období ${obdobi} ukáže měřený den`);
    if (obdobi === 365) {
      assert(
        bodProDen(graf.zarizeni.android, "2026-09-15")?.hodnota === null,
        "rok nekreslí měsíc před měřením jako nulu",
      );
    } else {
      assert(
        bodProDen(graf.zarizeni.android, DEN_SDILENI)?.hodnota === null,
        `období ${obdobi} nekreslí den před měřením jako nulu`,
      );
    }
    const procenta = graf.zarizeni.procenta;
    const soucet =
      (procenta.android ?? 0) +
      (procenta.ios ?? 0) +
      (procenta.pocitac ?? 0) +
      (procenta.ostatni ?? 0);
    assert(Math.abs(soucet - 100) < 0.000001, `období ${obdobi} má podíly se součtem 100`);
    const soucetZarizeniGrafu =
      (graf.zarizeni.soucty.android ?? 0) +
      (graf.zarizeni.soucty.ios ?? 0) +
      (graf.zarizeni.soucty.pocitac ?? 0) +
      (graf.zarizeni.soucty.ostatni ?? 0);
    assert(soucetZarizeniGrafu === 2, `období ${obdobi} sčítá jen dvě měřené návštěvy`);
  }

  const devadesat = podklady[90];
  assert(devadesat.navstevnost.soucet === 10, "historické návštěvy v návštěvnosti zůstávají");
  assert(
    bodProDen(devadesat.zarizeni.android, DEN_HISTORIE)?.hodnota === null,
    "historický den s návštěvami není naměřená nula zařízení",
  );
  assert(
    devadesat.zarizeni.soucty.android === 1 &&
      devadesat.zarizeni.soucty.ios === 1 &&
      devadesat.zarizeni.procenta.android === 50 &&
      devadesat.zarizeni.procenta.ios === 50 &&
      devadesat.zarizeni.procenta.pocitac === 0 &&
      devadesat.zarizeni.procenta.ostatni === 0,
    "podíly se počítají jen z měřených návštěv",
  );

  const prazdne = sestavitPodkladyGrafu(prazdnyDokumentAnalytiky(), CAS_DALSI, 30);
  assert(prazdne.zarizeni.mereniOd === null, "prázdný soubor měření ještě nemá");
  assert(
    prazdne.zarizeni.android.every((bod) => bod.hodnota === null) &&
      prazdne.zarizeni.procenta.android === null,
    "bez začátku měření graf nemá nuly ani podíly",
  );
  return podklady;
}

async function testVykresleni(
  podklady: Record<BranaAnalytikaGrafObdobi, PodkladyGrafuBrany>,
): Promise<void> {
  (globalThis as { React?: typeof React }).React = React;
  const { BranaAdminAnalytikaGrafy } = await import(
    "../src/components/brana/admin/BranaAdminAnalytikaGrafy"
  );
  const html = renderToStaticMarkup(
    createElement(BranaAdminAnalytikaGrafy, { podklady }),
  );
  const spusteni = html.indexOf("Způsob spuštění");
  const zarizeni = html.indexOf(">Zařízení<");
  const geografie = html.indexOf("Geografie");
  assert(
    spusteni >= 0 && zarizeni > spusteni && geografie > zarizeni,
    "graf Zařízení je mezi způsobem spuštění a geografií",
  );
  const usek = html.slice(zarizeni, geografie);
  assert(usek.includes("až od 16. 10. 2026"), "graf uvádí konkrétní začátek měření");
  assert(usek.includes("nejsou to naměřené nuly"), "historie není popsaná jako naměřená nula");
  assert(usek.includes("Android") && usek.includes("iPhone / iOS"), "graf má názvy kategorií");
  assert(usek.includes("Počítač") && usek.includes("Ostatní"), "graf má počítač a ostatní");
  assert(usek.includes("50") && usek.includes("%"), "graf ukazuje podíly");
  assert(usek.includes('class="block h-44 w-full max-w-full touch-pan-y"'), "graf zůstává na šířku stránky");
  assert(usek.includes("flex flex-wrap"), "legendy se na úzké šířce zalamují");
  assert(html.includes("7 dní") && html.includes("30 dní") && html.includes("90 dní") && html.includes("Rok"), "přepínač období zůstává");

  const prazdne = {
    7: sestavitPodkladyGrafu(prazdnyDokumentAnalytiky(), CAS_DALSI, 7),
    30: sestavitPodkladyGrafu(prazdnyDokumentAnalytiky(), CAS_DALSI, 30),
    90: sestavitPodkladyGrafu(prazdnyDokumentAnalytiky(), CAS_DALSI, 90),
    365: sestavitPodkladyGrafu(prazdnyDokumentAnalytiky(), CAS_DALSI, 365),
  };
  const prazdneHtml = renderToStaticMarkup(
    createElement(BranaAdminAnalytikaGrafy, { podklady: prazdne }),
  );
  const prazdnyUsek = prazdneHtml.slice(
    prazdneHtml.indexOf(">Zařízení<"),
    prazdneHtml.indexOf("Geografie"),
  );
  assert(prazdnyUsek.includes("Zařízení se zatím nesledují."), "prázdný stav řekne, že měření nezačalo");
  assert(
    prazdnyUsek.includes("Ve vybraném období není žádná měřená návštěva."),
    "bez měření se neukáže podíl",
  );
  assert(!prazdnyUsek.includes("%"), "prázdný stav neobsahuje procenta");
}

async function testSoubehAOpakovani(): Promise<void> {
  const pamat: Pamat = { dokument: dokumentSHistorii(), etag: 1 };
  const io = ioZPameti(pamat);
  const puvodni = io.ulozit;
  let prvni = true;
  io.ulozit = async (dokument, etag) => {
    if (prvni) {
      prvni = false;
      const soucasny = pamat.dokument;
      const den = soucasny?.dny[DEN] ?? prazdnyDenAnalytiky();
      if (soucasny) {
        soucasny.dny[DEN] = { ...den, navstevy: den.navstevy + 1 };
        pamat.etag += 1;
      }
      throw new BlobPreconditionFailedError();
    }
    await puvodni(dokument, etag);
  };

  const vysledek = await zaznamenatDavkuAnalytiky(
    { udalosti: [{ typ: "navsteva" }] },
    io,
    CAS,
    "neurceno",
    "pocitac",
  );
  const den = pamat.dokument?.dny[DEN];
  assert(vysledek.ok, "zápis po konfliktu projde na další pokus");
  assert(den?.navstevy === 2, "návštěva se po opakování započte jednou");
  assert(den?.zarizeni.pocitac === 1, "zařízení se po opakování započte jednou");
  assert(
    den !== undefined &&
      den.zarizeni.android + den.zarizeni.ios + den.zarizeni.ostatni === 0,
    "opakování nezvýší ostatní kategorie",
  );
  assert(pamat.dokument?.zarizeniMereniOd === DEN, "začátek měření se uloží až při úspěšném zápisu");
  assert(pamat.dokument?.dny[DEN_HISTORIE]?.navstevy === 8, "opakování historický den nemění");

  const soubeh: Pamat = { dokument: prazdnyDokumentAnalytiky(), etag: 1 };
  const ioSoubeh = ioZPameti(soubeh);
  const [android, ios] = await Promise.all([
    zaznamenatDavkuAnalytiky(
      { udalosti: [{ typ: "navsteva" }] },
      ioSoubeh,
      CAS,
      undefined,
      "android",
    ),
    zaznamenatDavkuAnalytiky(
      { udalosti: [{ typ: "navsteva" }] },
      ioSoubeh,
      CAS,
      undefined,
      "ios",
    ),
  ]);
  const spolecny = soubeh.dokument?.dny[DEN];
  assert(android.ok && ios.ok, "dva souběžné zápisy oba projdou");
  assert(spolecny?.navstevy === 2, "souběh započte dvě návštěvy");
  assert(
    spolecny?.zarizeni.android === 1 && spolecny.zarizeni.ios === 1,
    "souběh započte každé zařízení jednou",
  );
  assert(soubeh.dokument?.zarizeniMereniOd === DEN, "souběh začátek měření nepřepisuje sem a tam");
}

async function main(): Promise<void> {
  testRozpoznani();
  testStarySoubor();
  const historie = dokumentSHistorii();
  const poSdileni = aplikovatDavkuAnalytiky(historie, [{ typ: "sdileni" }], CAS_SDILENI);
  const poIos = aplikovatDavkuAnalytiky(
    poSdileni,
    [{ typ: "navsteva", spusteni: "ikona", navstevnik: "novy", zdroj: "qr", qrDesktop: true }],
    CAS,
    "trebonsko",
    "ios",
  );
  const poPohledu = aplikovatDavkuAnalytiky(
    poIos,
    [{ typ: "pohled", pohled: "dnes", raz: "prvni" }],
    CAS,
  );
  const dokument = aplikovatDavkuAnalytiky(
    poPohledu,
    [{ typ: "navsteva", spusteni: "prohlizec", navstevnik: "vracejici" }],
    CAS_DALSI,
    "mimo_trebonsko",
    "android",
  );
  testNavstevaAHistorie();
  const podklady = testGrafy(dokument);
  await testVykresleni(podklady);
  await testSoubehAOpakovani();

  if (selhalo > 0) {
    console.error(`\nSelhalo kontrol: ${selhalo}`);
    process.exit(1);
  }
  console.log("\nZařízení v analytice prošlo bez produkčního zápisu.");
}

void main();
