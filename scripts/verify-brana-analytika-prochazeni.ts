/**
 * Procházení seznamu Kalendáře. Bez sítě a bez Blobu.
 * Spuštění: npx tsx scripts/verify-brana-analytika-prochazeni.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import {
  BRANA_ANALYTIKA_PRIJEM_ZAPNUT,
  aplikovatDavkuAnalytiky,
  isoDenZData,
  parsovatDokumentAnalytiky,
  prazdnyDenAnalytiky,
  prazdnyDokumentAnalytiky,
  validovatDavkuAnalytiky,
  type BranaAnalytikaPohled,
} from "../src/lib/brana/analytika/model";
import { dnesVPraze } from "../src/lib/brana/cas";
import { spustitRozpoznaniNavstevyVOkne } from "../src/lib/brana/analytika/napojeni-navstevy";
import {
  BRANA_NAVSTEVA_MIN_ODCHOD_MS,
  oznacitOdchodDoPozadi,
  type BranaNavstevaUloziste,
} from "../src/lib/brana/analytika/navsteva-klient";
import { odeslatRozpoznanouNavstevu } from "../src/lib/brana/analytika/odeslani-navstevy";
import {
  nactiRozmerySeznamu,
  pocatecniStavProchazeni,
  posouditKrokProchazeni,
  prijmoutMetrikyProchazeni,
  pripojitMereniProchazeni,
  smazatZnackyProchazeni,
  type DuvodMereniProchazeni,
  type MereniSeznamu,
} from "../src/lib/brana/analytika/prochazeni-obsahu";
import { KLIC_BRANA_VYLOUCIT_ANALYTIKU } from "../src/lib/brana/analytika/vylouceni-zarizeni";

const CAS = new Date("2026-10-16T10:00:00.000Z");
const START = 1_700_000_000_000;
const PORT = 500;

let selhalo = 0;

function assert(ok: boolean, popis: string): void {
  if (ok) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhalo += 1;
  console.error(`FAIL ${popis}`);
}

function pamet(): BranaNavstevaUloziste & { data: Map<string, string> } {
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

type Krok = { duvod: DuvodMereniProchazeni; mereni: MereniSeznamu };

function mereni(
  seznamSpodek: number,
  scrollTop: number,
  pripraveno = true,
): MereniSeznamu {
  return { pripraveno, seznamSpodek, portSpodek: PORT, scrollTop };
}

function projed(
  panel: BranaNavstevaUloziste,
  pohled: BranaAnalytikaPohled,
  kroky: Krok[],
) {
  let stav = pocatecniStavProchazeni();
  const udalosti: Array<{ pohled: string; metrika: string }> = [];
  for (const krok of kroky) {
    const vysledek = posouditKrokProchazeni(stav, krok.mereni, krok.duvod);
    stav = vysledek.stav;
    udalosti.push(
      ...prijmoutMetrikyProchazeni(panel, pohled, {
        delsi: vysledek.delsi,
        konec: vysledek.konec,
      }),
    );
  }
  return udalosti;
}

function kratky(): Krok[] {
  return [{ duvod: "layout", mereni: mereni(400, 0) }];
}

function dlouhyAKonec(): Krok[] {
  return [
    { duvod: "layout", mereni: mereni(900, 0) },
    { duvod: "scroll", mereni: mereni(800, 100) },
    { duvod: "scroll", mereni: mereni(500, 400) },
  ];
}

function metriky(udalosti: Array<{ metrika: string }>, metrika: string): number {
  return udalosti.filter((udalost) => udalost.metrika === metrika).length;
}

async function testProchazeni(): Promise<void> {
  assert(BRANA_ANALYTIKA_PRIJEM_ZAPNUT === false, "příjem zůstává vypnutý");
  const uklid = spustitRozpoznaniNavstevyVOkne("dnes");
  uklid();
  assert(typeof uklid === "function", "vypnuté měření scroll neposlouchá");

  const dnesKratky = projed(pamet(), "dnes", kratky());
  assert(dnesKratky.length === 0, "krátký obsah Dnes scrollování nevyžaduje");

  const dnesDlouhy = projed(pamet(), "dnes", dlouhyAKonec());
  assert(metriky(dnesDlouhy, "delsi") === 1, "dlouhý obsah Dnes se započítá jednou");
  assert(metriky(dnesDlouhy, "konec") === 1, "Dnes započítá skutečné dosažení konce");

  const zitraKratky = projed(pamet(), "zitra", [
    ...kratky(),
    { duvod: "scroll", mereni: mereni(320, 80) },
  ]);
  assert(zitraKratky.length === 0, "krátké Zítra ani rezerva pod seznamem konec nepředstírá");

  const zitraDlouhy = projed(pamet(), "zitra", dlouhyAKonec());
  assert(
    metriky(zitraDlouhy, "delsi") === 1 && metriky(zitraDlouhy, "konec") === 1,
    "dlouhé Zítra má obě metriky",
  );

  for (const pohled of ["vikend", "7-dni", "vyhled"] as const) {
    const udalosti = projed(pamet(), pohled, dlouhyAKonec());
    assert(
      metriky(udalosti, "delsi") === 1 && metriky(udalosti, "konec") === 1,
      `${pohled} počítá delší obsah i dosažený konec`,
    );
  }

  const predKoncem = projed(pamet(), "dnes", [
    { duvod: "layout", mereni: mereni(900, 0) },
    { duvod: "scroll", mereni: mereni(800, 100) },
    { duvod: "scroll", mereni: mereni(700, 200) },
  ]);
  assert(metriky(predKoncem, "delsi") === 1 && metriky(predKoncem, "konec") === 0, "zastavení před koncem konec nezapočítá");

  const opakovany = projed(pamet(), "vikend", [
    ...dlouhyAKonec(),
    { duvod: "scroll", mereni: mereni(480, 420) },
    { duvod: "scroll", mereni: mereni(490, 410) },
  ]);
  assert(metriky(opakovany, "konec") === 1, "opakovaný scroll konec nepřičítá znovu");

  const navsteva = pamet();
  const poprve = projed(navsteva, "dnes", dlouhyAKonec());
  const navrat = projed(navsteva, "dnes", dlouhyAKonec());
  assert(poprve.length === 2 && navrat.length === 0, "návrat do stejného pohledu metriky znovu nepřičte");

  const poNovem = projed(navsteva, "zitra", dlouhyAKonec());
  assert(poNovem.length === 2, "jiný pohled stejné návštěvy má vlastní metriky");

  smazatZnackyProchazeni(navsteva);
  const znovu = projed(navsteva, "dnes", dlouhyAKonec());
  assert(znovu.length === 2, "nová návštěva může stejný pohled počítat znovu");

  const dynamicky = projed(pamet(), "7-dni", [
    { duvod: "layout", mereni: mereni(0, 0, false) },
    { duvod: "render", mereni: mereni(0, 0, false) },
    { duvod: "layout", mereni: mereni(420, 0) },
    { duvod: "obsah", mereni: mereni(980, 0) },
    { duvod: "scroll", mereni: mereni(500, 480) },
  ]);
  assert(
    metriky(dynamicky, "delsi") === 1 && metriky(dynamicky, "konec") === 1,
    "neúplný seznam se nehodnotí a delší doplnění ano",
  );

  const rozmer = projed(pamet(), "vyhled", [
    { duvod: "layout", mereni: mereni(900, 0) },
    { duvod: "scroll", mereni: mereni(760, 140) },
    { duvod: "resize", mereni: mereni(500, 140) },
    { duvod: "render", mereni: mereni(500, 140) },
  ]);
  assert(
    metriky(rozmer, "delsi") === 1 && metriky(rozmer, "konec") === 0,
    "změna rozměrů ani render nevytvoří dosažení konce",
  );

  const obnoveni = pamet();
  projed(obnoveni, "dnes", [{ duvod: "layout", mereni: mereni(900, 0) }]);
  const poObnoveni = projed(obnoveni, "dnes", [
    { duvod: "layout", mereni: mereni(500, 400) },
    { duvod: "render", mereni: mereni(500, 400) },
  ]);
  assert(poObnoveni.length === 0, "obnovení stránky na konci samo konec nezapočítá");

  const sahnuti = { pocet: 0 };
  const haze = {
    getItem() {
      sahnuti.pocet += 1;
      throw new Error("úložiště");
    },
    setItem() {
      sahnuti.pocet += 1;
      throw new Error("úložiště");
    },
    removeItem() {
      sahnuti.pocet += 1;
      throw new Error("úložiště");
    },
  };
  const bezPripojeni = pripojitMereniProchazeni(
    { addEventListener() { throw new Error("nesmí poslouchat"); } } as unknown as HTMLElement,
    haze,
    "dnes",
    async () => { throw new Error("nesmí odeslat"); },
    undefined,
    false,
  );
  bezPripojeni();
  assert(sahnuti.pocet === 0, "vypnuté nebo nepovolené měření na úložiště nesáhne");

  const plocha = vytvorPlochu();
  const panelPlochy = pamet();
  const odeslane: string[] = [];
  const uklidPlochy = pripojitMereniProchazeni(
    plocha.koren,
    panelPlochy,
    "dnes",
    async (udalosti) => {
      odeslane.push(udalosti.map((udalost) => udalost.metrika).join(","));
      throw new Error("síť");
    },
    plocha.poslouchat,
  );
  assert(plocha.passive === true, "scroll se poslouchá pasivně na stávající ploše");
  assert(odeslane.join(",") === "delsi", "dlouhý seznam odešle jednou, že scrollování bylo třeba");
  plocha.scrollTop = 400;
  plocha.seznamSpodek = 500;
  plocha.scroll();
  plocha.scroll();
  assert(odeslane.join(",") === "delsi,konec", "neúspěšný konec se neposílá znovu");
  plocha.portSpodek = 2000;
  plocha.zmenitRozmer();
  assert(odeslane.length === 2, "změna rozměru po neúspěchu nezaloží frontu");
  uklidPlochy();
  plocha.scroll();
  assert(odeslane.length === 2, "úklid posluchač scrollu odebere");
  const znacka = [...panelPlochy.data.values()].join("|");
  assert(znacka === "dnes=dk" && !znacka.includes("400"), "značka nemá souřadnice ani historii pohybu");

  const prazdne = prazdneMistni();
  await sMístnímUlozistem(prazdne, async () => {
    const panel = pamet();
    const odesilac = simulace();
    await odeslatRozpoznanouNavstevu(
      { uloziste: panel, ted: START, spusteni: "prohlizec" },
      odesilac.odeslat,
    );
    prijmoutMetrikyProchazeni(panel, "dnes", { delsi: true, konec: true });
    await odeslatRozpoznanouNavstevu(
      { uloziste: panel, ted: START + 60_000, spusteni: "prohlizec" },
      odesilac.odeslat,
    );
    const behem = prijmoutMetrikyProchazeni(panel, "dnes", { delsi: true, konec: false });
    assert(odesilac.volani === 1, "procházení nemění pravidlo jedné návštěvy");
    assert(behem.length === 0, "stejná návštěva značku procházení nesmaže");
    oznacitOdchodDoPozadi(panel, START);
    await odeslatRozpoznanouNavstevu(
      { uloziste: panel, ted: START + BRANA_NAVSTEVA_MIN_ODCHOD_MS, spusteni: "prohlizec" },
      odesilac.odeslat,
    );
    const poNavsteve = prijmoutMetrikyProchazeni(panel, "dnes", { delsi: true, konec: false });
    assert(odesilac.volani === 2 && poNavsteve.length === 1, "nová návštěva značky procházení uvolní");
  });

  await sMístnímUlozistem(vylouceneMistni(), async () => {
    const volani: unknown[] = [];
    const vysledek = await import("../src/lib/brana/analytika/odeslani-navstevy").then((modul) =>
      modul.odeslatUdalostiProchazeni(
        [{ typ: "prochazeni", pohled: "vyhled", metrika: "konec" }],
        async () => {
          volani.push(true);
          return { ok: true };
        },
      ),
    );
    assert(vysledek.pokusu === 0 && volani.length === 0, "vyloučené zařízení procházení neodešle");
  });

  const den = aplikovatDavkuAnalytiky(
    prazdnyDokumentAnalytiky(),
    [
      { typ: "navsteva", spusteni: "prohlizec" },
      { typ: "pohled", pohled: "dnes", raz: "prvni" },
      { typ: "prochazeni", pohled: "dnes", metrika: "delsi" },
      { typ: "prochazeni", pohled: "dnes", metrika: "konec" },
      { typ: "prochazeni", pohled: "zitra", metrika: "delsi" },
      { typ: "prochazeni", pohled: "vikend", metrika: "delsi" },
      { typ: "prochazeni", pohled: "vikend", metrika: "konec" },
      { typ: "prochazeni", pohled: "7-dni", metrika: "delsi" },
      { typ: "prochazeni", pohled: "7-dni", metrika: "konec" },
      { typ: "prochazeni", pohled: "vyhled", metrika: "konec" },
    ],
    CAS,
    "trebonsko",
  );
  const klic = isoDenZData(dnesVPraze(CAS));
  const soucet = den.dny[klic];
  assert(soucet?.navstevy === 1 && soucet.oblast.trebonsko === 1, "procházení nezvyšuje návštěvy ani oblast");
  assert(soucet?.pohledy.dnes.prvni === 1 && soucet.pohledy.dnes.dalsi === 0, "otevření pohledu zůstává oddělené");
  assert(soucet?.prochazeni.dnes.delsi === 1 && soucet.prochazeni.dnes.konec === 1, "Dnes má oba denní součty");
  assert(soucet?.prochazeni.zitra.delsi === 1 && soucet.prochazeni.zitra.konec === 0, "Zítra má jen delší obsah");
  assert(soucet?.prochazeni.vikend.konec === 1 && soucet.prochazeni["7-dni"].konec === 1, "Víkend a 7 dní mají konec");
  assert(soucet?.prochazeni.vyhled.delsi === 0 && soucet.prochazeni.vyhled.konec === 1, "Výhled má samostatný konec");
  assert(
    soucet?.konecObsahu.vikend === 0 && soucet.konecObsahu["7-dni"] === 0,
    "starší dvoupoložkový konec obsahu se nemění",
  );

  const staryDen = prazdnyDenAnalytiky();
  staryDen.konecObsahu = { vikend: 3, "7-dni": 4 };
  staryDen.pohledy.dnes = { prvni: 5, dalsi: 6 };
  const bezProchazeni = { ...staryDen } as Partial<typeof staryDen>;
  delete bezProchazeni.prochazeni;
  const staryDokument = parsovatDokumentAnalytiky({
    verze: 1,
    dny: { [klic]: bezProchazeni },
  });
  const poStarem = aplikovatDavkuAnalytiky(
    staryDokument ?? prazdnyDokumentAnalytiky(),
    [{ typ: "navsteva" }],
    CAS,
  );
  const zachovano = poStarem.dny[klic];
  assert(
    validovatDavkuAnalytiky({ udalosti: [{ typ: "navsteva" }] }).ok &&
      zachovano?.navstevy === 1 &&
      zachovano.prochazeni.dnes.delsi === 0 &&
      zachovano.konecObsahu.vikend === 3 &&
      zachovano.pohledy.dnes.prvni === 5,
    "starší den bez procházení zůstane platný a součty jsou nulové",
  );
  assert(
    validovatDavkuAnalytiky({
      udalosti: [{ typ: "prochazeni", pohled: "dnes", metrika: "delsi" }],
    }).ok,
    "událost procházení je platná",
  );
  const odmitnute = [
    { udalosti: [{ typ: "prochazeni", pohled: "dnes" }] },
    { udalosti: [{ typ: "prochazeni", pohled: "dnes", metrika: "konec", scrollTop: 10 }] },
    { udalosti: [{ typ: "scroll", pohled: "dnes" }] },
    { udalosti: [{ typ: "prochazeni", pohled: "domu", metrika: "delsi" }] },
  ];
  assert(
    odmitnute.every((telo) => !validovatDavkuAnalytiky(telo).ok),
    "souřadnice, neúplné a cizí události se odmítnou",
  );
  const neuplny = prazdnyDenAnalytiky();
  neuplny.prochazeni = { dnes: { delsi: 1, konec: 0 } } as typeof neuplny.prochazeni;
  assert(
    parsovatDokumentAnalytiky({ verze: 1, dny: { [klic]: neuplny } }) === null,
    "neúplné procházení dokument odmítne",
  );

  const napojeni = readFileSync(
    join("src", "lib", "brana", "analytika", "napojeni-navstevy.ts"),
    "utf8",
  );
  const komponenta = readFileSync(
    join("src", "components", "brana", "BranaRozpoznaniNavstevy.tsx"),
    "utf8",
  );
  const swipe = readFileSync(join("src", "components", "brana", "BranaSwipeObsah.tsx"), "utf8");
  const galerie = readFileSync(join("src", "app", "page.tsx"), "utf8");
  const vyp = napojeni.indexOf("if (!BRANA_ANALYTIKA_PRIJEM_ZAPNUT)");
  const vyl = napojeni.indexOf("if (!jeOdeslaniBranaAnalytikyPovoleno())");
  const pripoj = napojeni.indexOf("pripojitProchazeniVOkne");
  assert(vyp !== -1 && vyl !== -1 && pripoj !== -1 && vyp < vyl && vyl < pripoj, "vypnutí i vyloučení skončí před měřením");
  assert(
    komponenta.indexOf("if (!BRANA_ANALYTIKA_PRIJEM_ZAPNUT)") < komponenta.indexOf("import("),
    "veřejná stránka při vypnutí měření nenačte",
  );
  assert(!swipe.includes("prochazeni-obsahu"), "swipe a scroll zůstaly původní");
  assert(!galerie.includes("prochazeni-obsahu"), "galerie procházení nemá");
  assert(!readFileSync(join("src", "lib", "brana", "analytika", "prochazeni-obsahu.ts"), "utf8").includes("document.cookie"), "měření nezakládá cookie");

  const prechod = vytvorPlochu();
  prechod.prechod = true;
  assert(nactiRozmerySeznamu(prechod.koren) === null, "běžící listování se nehodnotí předčasně");
}

function vytvorPlochu() {
  const stav = {
    scrollTop: 0,
    seznamSpodek: 900,
    seznamVyska: 900,
    portSpodek: PORT,
    portVyska: PORT,
    prechod: false,
    passive: false,
    scroll: () => {},
    zmenitRozmer: () => {},
    koren: null as unknown as HTMLElement,
  };
  const posluchace = new Map<string, Array<() => void>>();
  const seznam = {
    childElementCount: 4,
    getBoundingClientRect: () => ({ bottom: stav.seznamSpodek, height: stav.seznamVyska }),
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  const inner = {
    getBoundingClientRect: () => ({ bottom: stav.seznamSpodek, height: stav.seznamVyska }),
    querySelector: () => null,
    querySelectorAll: (sel: string) => (sel === ".brana-seznam-akci" ? [seznam] : []),
    addEventListener() {},
    removeEventListener() {},
    scrollTop: 0,
  };
  const koren = {
    get scrollTop() {
      return stav.scrollTop;
    },
    set scrollTop(hodnota: number) {
      stav.scrollTop = hodnota;
    },
    getBoundingClientRect: () => ({ bottom: stav.portSpodek, height: stav.portVyska }),
    querySelector: (sel: string) => {
      if (sel.includes("bezi")) {
        return stav.prechod ? seznam : null;
      }
      if (sel.includes("vnitr") || sel.includes("prijezd")) {
        return inner;
      }
      return null;
    },
    querySelectorAll: () => [],
    addEventListener: (typ: string, fn: () => void, moznosti?: { passive?: boolean }) => {
      if (typ === "scroll" && moznosti?.passive) {
        stav.passive = true;
      }
      const seznamPosluchacu = posluchace.get(typ) ?? [];
      seznamPosluchacu.push(fn);
      posluchace.set(typ, seznamPosluchacu);
    },
    removeEventListener: (typ: string, fn: () => void) => {
      posluchace.set(
        typ,
        (posluchace.get(typ) ?? []).filter((polozka) => polozka !== fn),
      );
    },
  };
  stav.scroll = () => {
    for (const fn of posluchace.get("scroll") ?? []) {
      fn();
    }
  };
  const rozmer: Array<() => void> = [];
  stav.zmenitRozmer = () => {
    for (const fn of rozmer) {
      fn();
    }
  };
  const vysledek = Object.assign(stav, {
    koren: koren as unknown as HTMLElement,
    poslouchat: (cil: unknown, callback: () => void) => {
      if (cil === koren) {
        rozmer.push(callback);
      }
      return () => {};
    },
  });
  return vysledek;
}

function simulace() {
  const odesilac = {
    volani: 0,
    async odeslat() {
      odesilac.volani += 1;
      return { ok: true, status: 200 };
    },
  };
  return odesilac;
}

function prazdneMistni() {
  const data = new Map<string, string>();
  return {
    getItem: (klic: string) => data.get(klic) ?? null,
    setItem: (klic: string, hodnota: string) => {
      data.set(klic, hodnota);
    },
    removeItem: (klic: string) => {
      data.delete(klic);
    },
  };
}

function vylouceneMistni() {
  const uloziste = prazdneMistni();
  uloziste.setItem(KLIC_BRANA_VYLOUCIT_ANALYTIKU, "1");
  return uloziste;
}

async function sMístnímUlozistem<T>(
  uloziste: ReturnType<typeof prazdneMistni>,
  akce: () => Promise<T>,
): Promise<T> {
  const popis = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: uloziste,
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

testProchazeni()
  .then(() => {
    if (selhalo > 0) {
      console.error(`Selhalo: ${selhalo}`);
      process.exit(1);
    }
    console.log("Procházení BRÁNY: všechno sedí.");
  })
  .catch((chyba: unknown) => {
    console.error(chyba);
    process.exit(1);
  });
