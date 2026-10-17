/**
 * Příchody přes QR BRÁNY. Bez produkčního Blob zápisu.
 * Spuštění: npx tsx scripts/verify-brana-analytika-qr.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { BlobPreconditionFailedError } from "@vercel/blob";
import { BRANA_DESKTOP_ADRESA, BRANA_DESKTOP_QR_URL } from "../src/lib/brana/desktop-pozvanka";
import {
  BRANA_ANALYTIKA_PRIJEM_ZAPNUT,
  aplikovatDavkuAnalytiky,
  isoDenZData,
  parsovatDokumentAnalytiky,
  prazdnyDenAnalytiky,
  validovatDavkuAnalytiky,
  type BranaAnalytikaDokument,
} from "../src/lib/brana/analytika/model";
import {
  BRANA_NAVSTEVA_MIN_ODCHOD_MS,
  oznacitOdchodDoPozadi,
  rozpoznatZdrojZAdresy,
  rozhodnoutZacatekNavstevy,
  type BranaNavstevaUloziste,
} from "../src/lib/brana/analytika/navsteva-klient";
import { odeslatRozpoznanouNavstevu } from "../src/lib/brana/analytika/odeslani-navstevy";
import { spustitRozpoznaniNavstevyVOkne } from "../src/lib/brana/analytika/napojeni-navstevy";
import { KLIC_BRANA_VYLOUCIT_ANALYTIKU } from "../src/lib/brana/analytika/vylouceni-zarizeni";
import {
  BranaAnalytikaUzExistujeError,
  zaznamenatDavkuAnalytiky,
  type BranaAnalytikaIo,
} from "../src/lib/brana/analytika/zapis";
import { dnesVPraze } from "../src/lib/brana/cas";

const CAS = new Date("2026-10-17T08:00:00.000Z");
const DEN = isoDenZData(dnesVPraze(CAS));
const START = 1_700_000_000_000;

let selhalo = 0;

function assert(ok: boolean, popis: string): void {
  if (ok) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhalo += 1;
  console.error(`FAIL ${popis}`);
}

function panel(): BranaNavstevaUloziste & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (klic) => data.get(klic) ?? null,
    setItem: (klic, hodnota) => {
      data.set(klic, hodnota);
    },
    removeItem: (klic) => {
      data.delete(klic);
    },
  };
}

function pamet(pocatek: BranaAnalytikaDokument | null) {
  const stav = {
    dokument: pocatek ? structuredClone(pocatek) : null,
    etag: pocatek ? 1 : 0,
    zapisy: 0,
  };
  const io: BranaAnalytikaIo = {
    nacist: async () => {
      if (!stav.dokument) {
        return { stav: "neexistuje" };
      }
      return {
        stav: "ok",
        dokument: structuredClone(stav.dokument),
        etag: String(stav.etag),
      };
    },
    zalozit: async (dokument) => {
      if (stav.dokument) {
        throw new BranaAnalytikaUzExistujeError();
      }
      stav.dokument = structuredClone(dokument);
      stav.etag = 1;
    },
    ulozit: async (dokument, etag) => {
      if (!stav.dokument || etag !== String(stav.etag)) {
        throw new BlobPreconditionFailedError();
      }
      stav.dokument = structuredClone(dokument);
      stav.etag += 1;
      stav.zapisy += 1;
    },
  };
  return { stav, io };
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
  const desktop = rozpoznatZdrojZAdresy("?zdroj=desktop-qr");
  assert(
    desktop?.zdroj === "qr" && desktop.qrDesktop === true,
    "desktopový QR je QR s příznakem desktop",
  );
  const ostatni = rozpoznatZdrojZAdresy("?z=qr");
  assert(ostatni?.zdroj === "qr" && ostatni.qrDesktop === undefined, "ostatní QR je jen QR");
  const velkaPismena = rozpoznatZdrojZAdresy("?zdroj=Desktop-QR");
  assert(velkaPismena?.zdroj === "qr" && velkaPismena.qrDesktop === true, "značka desktopu nerozlišuje velikost písmen");
  assert(rozpoznatZdrojZAdresy("") === null, "prázdná adresa není QR");
  assert(rozpoznatZdrojZAdresy("?pozadi=noc") === null, "neoznačená adresa není QR");
  assert(rozpoznatZdrojZAdresy("?zdroj=reklama") === null, "neznámý zdroj není QR");
  const sdileni = rozpoznatZdrojZAdresy("?z=sdileni");
  assert(sdileni?.zdroj === "sdileni" && !("qrDesktop" in sdileni), "sdílený odkaz je zdroj sdílení");
  assert(rozpoznatZdrojZAdresy("?z=SDILENI")?.zdroj === "sdileni", "značka sdílení nerozlišuje velikost písmen");
  assert(rozpoznatZdrojZAdresy("?z=wa") === null, "WhatsApp se v tomto kroku nerozpoznává");

  const oboji = rozpoznatZdrojZAdresy("?zdroj=desktop-qr&z=qr");
  assert(oboji?.zdroj === "qr" && oboji.qrDesktop === true, "obě QR značky jsou jeden desktopový QR");
  const sSdil = rozpoznatZdrojZAdresy("?z=qr&z=sdileni");
  assert(sSdil?.zdroj === "qr" && sSdil.qrDesktop === undefined, "QR má přednost před pozdější značkou sdílení");
  const naopak = rozpoznatZdrojZAdresy("?z=sdileni&z=qr");
  assert(naopak?.zdroj === "qr" && naopak.qrDesktop === undefined, "ostatní QR má přednost i před dřívější značkou sdílení");
  const desktopASdil = rozpoznatZdrojZAdresy("?zdroj=desktop-qr&z=sdileni");
  assert(desktopASdil?.zdroj === "qr" && desktopASdil.qrDesktop === true, "desktopový QR má přednost před sdílením");
  const sWa = rozpoznatZdrojZAdresy("?zdroj=desktop-qr&z=wa");
  assert(sWa?.zdroj === "qr" && sWa.qrDesktop === true, "desktopový QR zůstane jeden i vedle WhatsAppu");
  const neznamyAQr = rozpoznatZdrojZAdresy("?zdroj=neco&z=QR");
  assert(
    neznamyAQr?.zdroj === "qr" && neznamyAQr.qrDesktop === undefined,
    "neznámý zdroj neblokuje ostatní QR",
  );
}

async function testNavstevaASoucty(): Promise<void> {
  const ulozeno = panel();
  const desktop = rozhodnoutZacatekNavstevy({
    uloziste: ulozeno,
    ted: START,
    spusteni: "prohlizec",
    hledani: "?zdroj=desktop-qr",
  });
  assert(desktop.zaznamenat, "desktopový QR založí návštěvu");
  const znovu = rozhodnoutZacatekNavstevy({
    uloziste: ulozeno,
    ted: START + 1_000,
    spusteni: "prohlizec",
    hledani: "?zdroj=desktop-qr",
  });
  assert(!znovu.zaznamenat, "refresh stejné adresy další návštěvu nepřidá");

  const prepinani = panel();
  const tela: unknown[] = [];
  const odeslat = async (_adresa: string, pozadavek: { body: string }) => {
    tela.push(JSON.parse(pozadavek.body));
    return { ok: true };
  };
  await sUlozistem(new Map(), async () => {
    const prvni = await odeslatRozpoznanouNavstevu(
      {
        uloziste: prepinani,
        ted: START,
        spusteni: "prohlizec",
        hledani: "?z=qr",
      },
      odeslat,
      null,
      "dnes",
    );
    const druhy = await odeslatRozpoznanouNavstevu(
      {
        uloziste: prepinani,
        ted: START + 2_000,
        spusteni: "prohlizec",
        hledani: "?z=qr",
      },
      odeslat,
      null,
      "zitra",
    );
    assert(prvni.pokusu === 1 && druhy.pokusu === 1, "přepnutí pohledu odešle jen otevření");
    const davky = tela as Array<{ udalosti: Array<Record<string, unknown>> }>;
    const navstevy = davky.flatMap((davka) => davka.udalosti).filter((u) => u.typ === "navsteva");
    assert(navstevy.length === 1 && navstevy[0]?.zdroj === "qr" && !("qrDesktop" in (navstevy[0] ?? {})), "přepínání pohledů je pořád jedna QR návštěva");
  });

  const poOdchodu = panel();
  const prvniOdchod = rozhodnoutZacatekNavstevy({
    uloziste: poOdchodu,
    ted: START,
    spusteni: "ikona",
    hledani: "?zdroj=desktop-qr",
  });
  oznacitOdchodDoPozadi(poOdchodu, START + 1_000);
  const brzy = rozhodnoutZacatekNavstevy({
    uloziste: poOdchodu,
    ted: START + 1_000 + BRANA_NAVSTEVA_MIN_ODCHOD_MS - 1,
    spusteni: "ikona",
    hledani: "?zdroj=desktop-qr",
  });
  oznacitOdchodDoPozadi(poOdchodu, START + 2_000);
  const pozde = rozhodnoutZacatekNavstevy({
    uloziste: poOdchodu,
    ted: START + 2_000 + BRANA_NAVSTEVA_MIN_ODCHOD_MS,
    spusteni: "ikona",
    hledani: "?zdroj=desktop-qr",
  });
  assert(prvniOdchod.zaznamenat && !brzy.zaznamenat && pozde.zaznamenat, "nová návštěva vznikne až po 30 minutách");
  assert(
    pozde.zaznamenat && pozde.udalost.zdroj === "qr" && pozde.udalost.qrDesktop === true,
    "nová návštěva znovu přečte QR z adresy",
  );

  const sdileni = panel();
  const prvniSdileni = rozhodnoutZacatekNavstevy({
    uloziste: sdileni,
    ted: START,
    spusteni: "prohlizec",
    hledani: "?z=sdileni&pozadi=2",
  });
  const obnoveni = rozhodnoutZacatekNavstevy({
    uloziste: sdileni,
    ted: START + 1_000,
    spusteni: "prohlizec",
    hledani: "?z=sdileni",
  });
  assert(
    prvniSdileni.zaznamenat &&
      prvniSdileni.udalost.zdroj === "sdileni" &&
      !("qrDesktop" in prvniSdileni.udalost) &&
      !obnoveni.zaznamenat,
    "příchod ze sdílení je jedna návštěva a obnovení ji nezdvojí",
  );
  oznacitOdchodDoPozadi(sdileni, START + 2_000);
  const dalsiSdileni = rozhodnoutZacatekNavstevy({
    uloziste: sdileni,
    ted: START + 2_000 + BRANA_NAVSTEVA_MIN_ODCHOD_MS,
    spusteni: "prohlizec",
    hledani: "?z=sdileni",
  });
  assert(
    dalsiSdileni.zaznamenat && dalsiSdileni.udalost.zdroj === "sdileni",
    "po 30 minutách je nová návštěva ze sdílení znovu jeden zdroj",
  );

  const pohledy = panel();
  const telaSdileni: unknown[] = [];
  const odeslatSdileni = async (_adresa: string, pozadavek: { body: string }) => {
    telaSdileni.push(JSON.parse(pozadavek.body));
    return { ok: true };
  };
  await sUlozistem(new Map(), async () => {
    await odeslatRozpoznanouNavstevu(
      {
        uloziste: pohledy,
        ted: START,
        spusteni: "prohlizec",
        hledani: "?z=sdileni",
      },
      odeslatSdileni,
      null,
      "dnes",
    );
    await odeslatRozpoznanouNavstevu(
      {
        uloziste: pohledy,
        ted: START + 3_000,
        spusteni: "prohlizec",
        hledani: "?z=sdileni",
      },
      odeslatSdileni,
      null,
      "vikend",
    );
  });
  const navstevySdileni = (telaSdileni as Array<{ udalosti: Array<Record<string, unknown>> }>)
    .flatMap((davka) => davka.udalosti)
    .filter((udalost) => udalost.typ === "navsteva");
  assert(
    navstevySdileni.length === 1 && navstevySdileni[0]?.zdroj === "sdileni" && !JSON.stringify(navstevySdileni).includes("http"),
    "přepínání pohledů po příchodu ze sdílení neodešle druhou návštěvu ani adresu",
  );

  const cisty = pamet(null);
  const bezZnacky = await zaznamenatDavkuAnalytiky(
    { udalosti: [{ typ: "navsteva", spusteni: "prohlizec" }] },
    cisty.io,
    CAS,
  );
  const denBez = cisty.stav.dokument?.dny[DEN];
  assert(
    bezZnacky.ok && denBez?.navstevy === 1 && denBez.zdroje.qr === 0 && denBez.qrDesktop === 0,
    "neoznačená návštěva QR nezvýší",
  );

  const soucet = pamet(null);
  await zaznamenatDavkuAnalytiky(
    { udalosti: [{ typ: "navsteva", spusteni: "prohlizec", zdroj: "qr", qrDesktop: true }] },
    soucet.io,
    CAS,
  );
  await zaznamenatDavkuAnalytiky(
    { udalosti: [{ typ: "navsteva", spusteni: "prohlizec", zdroj: "qr" }] },
    soucet.io,
    CAS,
  );
  const den = soucet.stav.dokument?.dny[DEN];
  assert(den?.navstevy === 2, "dvě QR návštěvy jsou dvě návštěvy, ne čtyři");
  assert(den?.zdroje.qr === 2 && den.qrDesktop === 1, "QR celkem sčítá oba, QR desktop jen desktop");
  assert(den?.zdroje.whatsapp === 0 && den.zdroje.sdileni === 0 && den.sdileniKlik === 0, "QR nemění WhatsApp, příchod ze sdílení ani kliknutí");

  const prichod = pamet(null);
  const zeSdileni = await zaznamenatDavkuAnalytiky(
    { udalosti: [{ typ: "navsteva", spusteni: "prohlizec", zdroj: "sdileni" }] },
    prichod.io,
    CAS,
  );
  const denSdileni = prichod.stav.dokument?.dny[DEN];
  assert(
    zeSdileni.ok &&
      denSdileni?.navstevy === 1 &&
      denSdileni.zdroje.sdileni === 1 &&
      denSdileni.zdroje.qr === 0 &&
      denSdileni.qrDesktop === 0 &&
      denSdileni.sdileniKlik === 0,
    "příchod ze sdílení zvýší jen zdroje.sdileni a jednu návštěvu",
  );
  const klik = await zaznamenatDavkuAnalytiky(
    { udalosti: [{ typ: "sdileni" }] },
    prichod.io,
    CAS,
  );
  assert(
    klik.ok &&
      prichod.stav.dokument?.dny[DEN]?.sdileniKlik === 1 &&
      prichod.stav.dokument.dny[DEN]?.zdroje.sdileni === 1 &&
      prichod.stav.dokument.dny[DEN]?.navstevy === 1,
    "kliknutí na Sdílet zůstává samostatný součet",
  );
  assert(!JSON.stringify(den).includes("http"), "den neukládá adresu");
}

function testStarsiANeplatne(): void {
  const stary = prazdnyDenAnalytiky();
  delete (stary as { qrDesktop?: number }).qrDesktop;
  const dokument = parsovatDokumentAnalytiky({ verze: 1, dny: { [DEN]: stary } });
  assert(dokument?.dny[DEN]?.qrDesktop === 0, "starší den bez QR desktop zůstane čitelný");
  const poStare = aplikovatDavkuAnalytiky(dokument!, [{ typ: "navsteva" }], CAS);
  assert(
    poStare.dny[DEN]?.navstevy === 1 &&
      poStare.dny[DEN]?.zdroje.qr === 0 &&
      poStare.dny[DEN]?.zdroje.sdileni === 0,
    "starší událost návštěvy QR ani sdílení nepřidá",
  );

  const poskozene = prazdnyDenAnalytiky();
  (poskozene as { qrDesktop: unknown }).qrDesktop = "1";
  assert(
    parsovatDokumentAnalytiky({ verze: 1, dny: { [DEN]: poskozene } }) === null,
    "poškozené QR desktop dokument odmítne",
  );

  const odmitnute = [
    { udalosti: [{ typ: "navsteva", spusteni: "prohlizec", zdroj: "whatsapp" }] },
    { udalosti: [{ typ: "navsteva", spusteni: "prohlizec", zdroj: "sdileni", qrDesktop: true }] },
    { udalosti: [{ typ: "navsteva", spusteni: "prohlizec", qrDesktop: true }] },
    { udalosti: [{ typ: "navsteva", spusteni: "prohlizec", zdroj: "qr", url: BRANA_DESKTOP_QR_URL }] },
    { udalosti: [{ typ: "navsteva", spusteni: "prohlizec", zdroj: "qr", qrDesktop: false }] },
  ];
  assert(
    odmitnute.every((telo) => !validovatDavkuAnalytiky(telo).ok),
    "cizí zdroj, adresa a desktop bez QR se odmítnou",
  );
}

async function testVypnutiAVylouceni(): Promise<void> {
  assert(BRANA_ANALYTIKA_PRIJEM_ZAPNUT === true, "příjem je zapnutý");
  let cteniAdresy = 0;
  const puvodni = Object.getOwnPropertyDescriptor(globalThis, "window");
  const puvodniDokument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      get location() {
        cteniAdresy += 1;
        return { search: "?zdroj=desktop-qr" };
      },
      matchMedia: () => ({ matches: false }),
      navigator: {},
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      addEventListener() {},
      removeEventListener() {},
      querySelector() {
        return null;
      },
      visibilityState: "visible",
    },
  });
  try {
    const uklid = spustitRozpoznaniNavstevyVOkne("dnes");
    uklid();
  } finally {
    if (puvodni) {
      Object.defineProperty(globalThis, "window", puvodni);
    } else {
      delete (globalThis as { window?: unknown }).window;
    }
    if (puvodniDokument) {
      Object.defineProperty(globalThis, "document", puvodniDokument);
    } else {
      delete (globalThis as { document?: unknown }).document;
    }
  }
  assert(cteniAdresy === 1, "zapnutá analytika přečte adresu jednou kvůli QR a sdílení");

  const vyloucene = new Map<string, string>([[KLIC_BRANA_VYLOUCIT_ANALYTIKU, "1"]]);
  const ulozeno = panel();
  await sUlozistem(vyloucene, async () => {
    const volani: unknown[] = [];
    const vysledek = await odeslatRozpoznanouNavstevu(
      {
        uloziste: ulozeno,
        ted: START,
        spusteni: "prohlizec",
        hledani: "?zdroj=desktop-qr",
      },
      async () => {
        volani.push(true);
        return { ok: true };
      },
    );
    assert(vysledek.pokusu === 0 && volani.length === 0, "vyloučené zařízení QR neodešle");
    assert(ulozeno.data.size === 0, "vyloučené zařízení návštěvu nezapíše");
  });
}

function testOchrana(): void {
  assert(
    BRANA_DESKTOP_QR_URL === "https://www.trebonpocelyrok.cz/brana?zdroj=desktop-qr",
    "desktopový QR má stejný cíl a značku zdroje",
  );
  assert(BRANA_DESKTOP_ADRESA === "trebonpocelyrok.cz/brana", "text pod QR zůstal bez parametru");

  const panelQr = readFileSync(
    join("src", "components", "brana", "BranaDesktopInformacniPanel.tsx"),
    "utf8",
  );
  const css = readFileSync(join("src", "app", "brana", "brana.css"), "utf8");
  const stranka = readFileSync(
    join("src", "components", "brana", "BranaVerejnaStranka.tsx"),
    "utf8",
  );
  const sdileni = readFileSync(join("src", "lib", "brana", "sdileni.ts"), "utf8");
  const tlacitko = readFileSync(
    join("src", "components", "brana", "BranaTlacitkoSdileni.tsx"),
    "utf8",
  );
  const rozvrzeni = readFileSync(join("src", "app", "brana", "layout.tsx"), "utf8");
  const manifest = readFileSync(join("public", "brana", "manifest.webmanifest"), "utf8");
  const galerieQr = readFileSync(join("src", "lib", "desktop-pozvanka.ts"), "utf8");
  const napojeni = readFileSync(
    join("src", "lib", "brana", "analytika", "napojeni-navstevy.ts"),
    "utf8",
  );

  assert(panelQr.includes("BRANA_DESKTOP_QR_VELIKOST_PX"), "velikost QR zůstala");
  assert(panelQr.includes('dark: "#FFFFFF"') && panelQr.includes('light: "#00000000"'), "grafika QR zůstala");
  assert(
    css.includes("brana-desktop-informace") && css.includes("hidden md:flex"),
    "desktopový panel zůstává skrytý na mobilu",
  );
  assert(!stranka.includes("desktop-qr") && stranka.includes("pozadi"), "veřejná stránka čte jen variantu pozadí");
  assert(
    sdileni.includes("https://www.trebonpocelyrok.cz/brana?z=sdileni") &&
      !sdileni.includes("window.location.href") &&
      sdileni.includes('const title = "BRÁNA do Třeboně"'),
    "sdílení má pevnou adresu Dnes a původní titulek",
  );
  assert(!tlacitko.includes("rozpoznatQrZAdresy") && !sdileni.includes("zdroj=desktop-qr"), "tlačítko sdílení QR značku nepřidává");
  assert(!rozvrzeni.includes("zdroj") && rozvrzeni.includes("openGraph"), "náhledy nečtou QR parametr");
  assert(manifest.includes('"start_url": "/"'), "instalace má vlastní startovní adresu");
  assert(galerieQr.includes("?zdroj=${DESKTOP_POZVANKA_ZDROJ_QR}") && !galerieQr.includes("/brana"), "galerie má vlastní QR");
  const vyp = napojeni.indexOf("if (!BRANA_ANALYTIKA_PRIJEM_ZAPNUT)");
  const vyl = napojeni.indexOf("if (!jeOdeslaniBranaAnalytikyPovoleno())");
  const adresa = napojeni.indexOf("const hledani = hledaniZOkna()");
  assert(vyp !== -1 && vyp < vyl && vyl < adresa, "vypnutí i vyloučení skončí před čtením adresy");
}

async function main(): Promise<void> {
  testRozpoznani();
  await testNavstevaASoucty();
  testStarsiANeplatne();
  await testVypnutiAVylouceni();
  testOchrana();

  if (selhalo > 0) {
    console.error(`QR BRÁNY: ${selhalo} selhalo.`);
    process.exit(1);
  }
  console.log("QR BRÁNY: všechno sedí.");
}

void main();
