/**
 * Klientské rozhodnutí o návštěvě BRÁNY. Bez sítě a bez Blobu.
 * Spuštění: npx tsx scripts/verify-brana-analytika-navsteva.ts
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { KLIC_VYLouCIT_ZE_STATISTIK } from "../src/lib/metriky-vylouceni";
import {
  BRANA_ANALYTIKA_PRIJEM_ZAPNUT,
  aplikovatDavkuAnalytiky,
  isoDenZData,
  prazdnyDokumentAnalytiky,
  validovatDavkuAnalytiky,
} from "../src/lib/brana/analytika/model";
import { dnesVPraze } from "../src/lib/brana/cas";
import { napojitRozpoznaniNavstevy } from "../src/lib/brana/analytika/napojeni-navstevy";
import {
  KLIC_BRANA_VYLOUCIT_ANALYTIKU,
  jeBranaAnalytikaVyloucena,
  nastavitBranaVylouceniAnalytiky,
  zobrazitVylouceniPoUlozeni,
  type BranaVylouceniUloziste,
} from "../src/lib/brana/analytika/vylouceni-zarizeni";
import {
  BRANA_NAVSTEVA_MIN_ODCHOD_MS,
  KLIC_BRANA_UZ_NAVSTIVIL,
  nacistVolitelnehoNavstevnika,
  oznacitOdchodDoPozadi,
  rozhodnoutZacatekNavstevy,
  zjistitSpusteni,
  type BranaNavstevaUloziste,
  type BranaNavstevaVstup,
} from "../src/lib/brana/analytika/navsteva-klient";
import {
  BRANA_ANALYTIKA_ODESLANI_CESTA,
  odeslatJednuNavstevu,
  odeslatRozpoznanouNavstevu,
  type BranaAnalytikaOdpoved,
  type BranaAnalytikaPozadavek,
} from "../src/lib/brana/analytika/odeslani-navstevy";

const MINUTA = 60 * 1000;
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

function ulozisteHaze(): BranaNavstevaUloziste {
  return {
    getItem: () => {
      throw new Error("úložiště nedostupné");
    },
    setItem: () => {
      throw new Error("úložiště nedostupné");
    },
    removeItem: () => {
      throw new Error("úložiště nedostupné");
    },
  };
}

function otevrit(
  uloziste: BranaNavstevaUloziste | null,
  ted: number,
  spusteni: "ikona" | "prohlizec" = "prohlizec",
) {
  return rozhodnoutZacatekNavstevy({
    uloziste,
    ted,
    spusteni,
    navstevnik: nacistVolitelnehoNavstevnika(),
  });
}

function testJednaNavstevaNaPanel(): void {
  const uloziste = pamet();
  const prvni = otevrit(uloziste, START, "prohlizec");
  const zitra = otevrit(uloziste, START + MINUTA, "prohlizec");
  const vikend = otevrit(uloziste, START + 2 * MINUTA, "prohlizec");
  const obnoveni = otevrit(uloziste, START + 3 * MINUTA, "prohlizec");
  const prekresleni = otevrit(uloziste, START + 4 * MINUTA, "prohlizec");

  assert(prvni.zaznamenat, "první otevření je návštěva");
  assert(
    prvni.zaznamenat && prvni.udalost.spusteni === "prohlizec",
    "první otevření nese způsob spuštění",
  );
  assert(
    prvni.zaznamenat && !("navstevnik" in prvni.udalost),
    "bez údaje návštěvník se pole neposílá",
  );
  assert(!zitra.zaznamenat, "přepnutí na Zítra novou návštěvu nezaloží");
  assert(!vikend.zaznamenat, "další přepnutí pohledu novou návštěvu nezaloží");
  assert(!obnoveni.zaznamenat, "obnovení stránky novou návštěvu nezaloží");
  assert(!prekresleni.zaznamenat, "opakované vykreslení novou návštěvu nezaloží");
}

function testOdchod(): void {
  const kratce = pamet();
  otevrit(kratce, START);
  oznacitOdchodDoPozadi(kratce, START + MINUTA);
  const poPeti = otevrit(kratce, START + MINUTA + 5 * MINUTA);
  assert(!poPeti.zaznamenat, "návrat po 5 minutách není nová návštěva");

  const presne = pamet();
  otevrit(presne, START, "ikona");
  oznacitOdchodDoPozadi(presne, START);
  const poTriceti = otevrit(presne, START + BRANA_NAVSTEVA_MIN_ODCHOD_MS, "ikona");
  assert(poTriceti.zaznamenat, "návrat po 30 minutách je nová návštěva");
  assert(
    poTriceti.zaznamenat && poTriceti.udalost.spusteni === "ikona",
    "návrat po 30 minutách zachová spuštění z ikony",
  );

  const dlouze = pamet();
  otevrit(dlouze, START);
  oznacitOdchodDoPozadi(dlouze, START);
  oznacitOdchodDoPozadi(dlouze, START + 60 * MINUTA);
  const poDvouHodinach = otevrit(dlouze, START + 2 * 60 * MINUTA);
  assert(poDvouHodinach.zaznamenat, "návrat po 2 hodinách je nová návštěva");
  assert(
    kratce.data.get("brana_analytika_skryto") === undefined,
    "krátký návrat smaže čas odchodu",
  );
}

function testSpusteniAUloziste(): void {
  const ikona = zjistitSpusteni({
    matchMedia: (dotaz) => ({
      matches: dotaz === "(display-mode: standalone)",
    }),
    navigator: { standalone: false },
  });
  const ios = zjistitSpusteni({
    matchMedia: () => ({ matches: false }),
    navigator: { standalone: true },
  });
  const prohlizec = zjistitSpusteni({
    matchMedia: () => ({ matches: false }),
    navigator: { standalone: false },
  });
  const bezOkna = zjistitSpusteni(undefined);
  const pady = zjistitSpusteni({
    matchMedia: () => {
      throw new Error("matchMedia selhalo");
    },
  });

  assert(ikona === "ikona", "standalone je spuštění z ikony");
  assert(ios === "ikona", "iOS navigator.standalone je spuštění z ikony");
  assert(prohlizec === "prohlizec", "běžné okno je prohlížeč");
  assert(bezOkna === "prohlizec", "chybějící okno je prohlížeč");
  assert(pady === "prohlizec", "selhání signálu ikony nespadne");

  let hozeno = false;
  let vysledek: ReturnType<typeof otevrit> | null = null;
  try {
    vysledek = otevrit(ulozisteHaze(), START);
  } catch {
    hozeno = true;
  }
  assert(!hozeno, "nedostupné úložiště nezpůsobí pád");
  assert(
    vysledek?.zaznamenat === false && vysledek.duvod === "uloziste-nedostupne",
    "nedostupné úložiště návštěvu nepředstírá",
  );
  assert(nacistVolitelnehoNavstevnika() === undefined, "trvalý návštěvník se nezakládá");

  const druhyPanel = pamet();
  const samostatne = otevrit(druhyPanel, START);
  assert(samostatne.zaznamenat, "nový panel je nová návštěva");
}

function testBezSiteABezVerejneBrany(): void {
  const modul = readFileSync(
    join("src", "lib", "brana", "analytika", "navsteva-klient.ts"),
    "utf8",
  );
  assert(!modul.includes("localStorage"), "modul nepoužívá trvalé úložiště prohlížeče");
  assert(!modul.includes("fetch("), "modul nic neodesílá");
  assert(!modul.includes("@vercel/blob"), "modul nezapisuje do Blobu");
  assert(!modul.includes("trebon_navstevnik_id"), "modul se nepojí s galerií");
  assert(!modul.includes("userAgent"), "modul nedělá otisk zařízení");
  assert(!modul.includes("geolocation"), "modul nečte polohu");

  const koreny = [join("src", "app"), join("src", "components")];
  const importy: string[] = [];
  for (const koren of koreny) {
    for (const soubor of vsechnySoubory(koren)) {
      const text = readFileSync(soubor, "utf8");
      if (text.includes("analytika/navsteva-klient")) {
        importy.push(soubor);
      }
    }
  }
  assert(importy.length === 0, "veřejná BRÁNA modul neimportuje");
}

type Simulace = {
  volani: BranaAnalytikaPozadavek[];
  adresy: string[];
  odeslat: (
    url: string,
    pozadavek: BranaAnalytikaPozadavek,
  ) => Promise<BranaAnalytikaOdpoved | void>;
};

function simulace(
  odpoved: () => Promise<BranaAnalytikaOdpoved | void>,
): Simulace {
  const stav: Simulace = {
    volani: [],
    adresy: [],
    odeslat: async (url, pozadavek) => {
      stav.adresy.push(url);
      stav.volani.push(pozadavek);
      return odpoved();
    },
  };
  return stav;
}

function vstupNavstevy(
  uloziste: BranaNavstevaUloziste,
  ted: number,
  spusteni: "ikona" | "prohlizec",
  navstevnik?: "novy" | "vracejici",
): BranaNavstevaVstup {
  return { uloziste, ted, spusteni, navstevnik };
}

async function testOdeslani(): Promise<void> {
  const uspech = simulace(async () => ({ ok: true, status: 200 }));
  const ikona = await odeslatJednuNavstevu(
    { typ: "navsteva", spusteni: "ikona", navstevnik: "novy" },
    uspech.odeslat,
  );
  const teloIkony = JSON.parse(uspech.volani[0]?.body ?? "{}") as unknown;
  assert(ikona.odeslano && ikona.pokusu === 1, "návštěva z ikony se odešle jednou");
  assert(
    uspech.adresy[0] === BRANA_ANALYTIKA_ODESLANI_CESTA,
    "požadavek míří na analytický endpoint",
  );
  assert(uspech.volani[0]?.method === "POST", "požadavek je POST");
  assert(
    uspech.volani[0]?.headers["Content-Type"] === "application/json",
    "požadavek je JSON",
  );
  assert(uspech.volani[0]?.credentials === "omit", "požadavek nepřikládá cookies");
  assert(validovatDavkuAnalytiky(teloIkony).ok, "dávka z ikony projde stávající validací");
  assert(
    JSON.stringify(teloIkony) ===
      JSON.stringify({
        udalosti: [{ typ: "navsteva", spusteni: "ikona", navstevnik: "novy" }],
      }),
    "formát návštěvy z ikony sedí",
  );

  const prohlizec = simulace(async () => ({ ok: true, status: 200 }));
  await odeslatJednuNavstevu(
    { typ: "navsteva", spusteni: "prohlizec" },
    prohlizec.odeslat,
  );
  const teloProhlizece = JSON.parse(prohlizec.volani[0]?.body ?? "{}") as {
    udalosti?: Array<Record<string, unknown>>;
  };
  assert(
    teloProhlizece.udalosti?.[0]?.spusteni === "prohlizec",
    "návštěva z prohlížeče nese prohlížeč",
  );
  assert(
    !("navstevnik" in (teloProhlizece.udalosti?.[0] ?? {})),
    "chybějící návštěvník se neposílá",
  );
  assert(
    validovatDavkuAnalytiky(teloProhlizece).ok,
    "dávka bez návštěvníka projde stávající validací",
  );

  const sit = simulace(async () => {
    throw new Error("síť nedostupná");
  });
  let padSite = false;
  let vysledekSite: Awaited<ReturnType<typeof odeslatJednuNavstevu>> | null = null;
  try {
    vysledekSite = await odeslatJednuNavstevu(
      { typ: "navsteva", spusteni: "ikona" },
      sit.odeslat,
    );
  } catch {
    padSite = true;
  }
  assert(!padSite, "selhání sítě nezpůsobí pád");
  assert(vysledekSite?.pokusu === 1 && vysledekSite.odeslano === false, "síť se neopakuje");
  assert(sit.volani.length === 1, "po chybě sítě zůstane jeden pokus");

  for (const status of [404, 500]) {
    const http = simulace(async () => ({ ok: false, status }));
    let pad = false;
    try {
      const vysledek = await odeslatJednuNavstevu(
        { typ: "navsteva", spusteni: "prohlizec" },
        http.odeslat,
      );
      assert(vysledek.pokusu === 1 && !vysledek.odeslano, `HTTP ${status} se neopakuje`);
    } catch {
      pad = true;
    }
    assert(!pad, `HTTP ${status} nezpůsobí pád`);
    assert(http.volani.length === 1, `HTTP ${status} má jeden pokus`);
  }

  const preruseni = simulace(async () => {
    throw new Error("požadavek přerušen");
  });
  const poPreruseni = await odeslatJednuNavstevu(
    { typ: "navsteva", spusteni: "ikona" },
    preruseni.odeslat,
  );
  assert(
    poPreruseni.pokusu === 1 && preruseni.volani.length === 1,
    "přerušení nezaloží další pokus",
  );

  const neplatna = simulace(async () => undefined);
  const poNeplatne = await odeslatJednuNavstevu(
    { typ: "navsteva", spusteni: "ikona" },
    neplatna.odeslat,
  );
  assert(!poNeplatne.odeslano && poNeplatne.pokusu === 1, "neplatná odpověď nespadne");

  const panel = pamet();
  const odesilac = simulace(async () => ({ ok: true, status: 200 }));
  const prvni = await odeslatRozpoznanouNavstevu(
    vstupNavstevy(panel, START, "ikona", "vracejici"),
    odesilac.odeslat,
  );
  const pohled = await odeslatRozpoznanouNavstevu(
    vstupNavstevy(panel, START + 60 * 1000, "ikona", "vracejici"),
    odesilac.odeslat,
  );
  const obnoveni = await odeslatRozpoznanouNavstevu(
    vstupNavstevy(panel, START + 2 * 60 * 1000, "ikona"),
    odesilac.odeslat,
  );
  assert(prvni.pokusu === 1, "rozpoznaná návštěva má jeden pokus");
  assert(pohled.pokusu === 0 && obnoveni.pokusu === 0, "pohled a obnovení už neodesílají");
  assert(odesilac.volani.length === 1, "jeden panel odešle nejvýš jednou");

  const chybnyPanel = pamet();
  const chyba = simulace(async () => {
    throw new Error("síť nedostupná");
  });
  await odeslatRozpoznanouNavstevu(vstupNavstevy(chybnyPanel, START, "prohlizec"), chyba.odeslat);
  await odeslatRozpoznanouNavstevu(
    vstupNavstevy(chybnyPanel, START + 60 * 1000, "prohlizec"),
    chyba.odeslat,
  );
  assert(chyba.volani.length === 1, "neúspěch nezaloží opakování na dalším pohledu");

  const navrat = pamet();
  const poOdchodu = simulace(async () => ({ ok: true, status: 200 }));
  await odeslatRozpoznanouNavstevu(vstupNavstevy(navrat, START, "ikona"), poOdchodu.odeslat);
  oznacitOdchodDoPozadi(navrat, START);
  const druha = await odeslatRozpoznanouNavstevu(
    vstupNavstevy(navrat, START + BRANA_NAVSTEVA_MIN_ODCHOD_MS, "ikona"),
    poOdchodu.odeslat,
  );
  assert(druha.pokusu === 1 && poOdchodu.volani.length === 2, "návrat po 30 minutách odešle znovu");

  const modul = readFileSync(
    join("src", "lib", "brana", "analytika", "odeslani-navstevy.ts"),
    "utf8",
  );
  assert(!modul.includes("fetch("), "odeslání samo nevolá síť");
  assert(!modul.includes("trebonpocelyrok"), "odeslání nemíří na produkční adresu");
  assert(!modul.includes("localStorage"), "odeslání nečte trvalé úložiště");
  assert(!modul.includes("sessionStorage"), "odeslání nečte úložiště panelu");
  assert(!modul.includes("@vercel/blob"), "odeslání nezapisuje do Blobu");
  assert(!modul.includes("setTimeout"), "odeslání nemá odložené opakování");
  assert(!modul.includes("userAgent"), "odeslání nedělá otisk zařízení");
  assert(!modul.includes("geolocation"), "odeslání nečte polohu");

  const importy: string[] = [];
  for (const koren of [join("src", "app"), join("src", "components")]) {
    for (const soubor of vsechnySoubory(koren)) {
      if (readFileSync(soubor, "utf8").includes("analytika/odeslani-navstevy")) {
        importy.push(soubor);
      }
    }
  }
  assert(importy.length === 0, "veřejná BRÁNA odesílání neimportuje");
}

function vsechnySoubory(adresar: string): string[] {
  const nalezene: string[] = [];
  for (const nazev of readdirSync(adresar)) {
    const cesta = join(adresar, nazev);
    if (statSync(cesta).isDirectory()) {
      nalezene.push(...vsechnySoubory(cesta));
      continue;
    }
    if (cesta.endsWith(".ts") || cesta.endsWith(".tsx")) {
      nalezene.push(cesta);
    }
  }
  return nalezene;
}

function ulozisteVylouceni(
  pocatek: Record<string, string> = {},
  selhat = false,
): BranaVylouceniUloziste & { data: Map<string, string> } {
  const data = new Map(Object.entries(pocatek));
  const hlidat = () => {
    if (selhat) {
      throw new Error("úložiště nedostupné");
    }
  };
  return {
    data,
    getItem: (klic) => {
      hlidat();
      return data.get(klic) ?? null;
    },
    setItem: (klic, hodnota) => {
      hlidat();
      data.set(klic, hodnota);
    },
    removeItem: (klic) => {
      hlidat();
      data.delete(klic);
    },
  };
}

async function sMístnímUlozistem<T>(
  uloziste: BranaVylouceniUloziste,
  akce: () => Promise<T> | T,
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

async function testVylouceni(): Promise<void> {
  const volne = ulozisteVylouceni();
  await sMístnímUlozistem(volne, async () => {
    const odesilac = simulace(async () => ({ ok: true, status: 200 }));
    const vysledek = await odeslatJednuNavstevu(
      { typ: "navsteva", spusteni: "prohlizec" },
      odesilac.odeslat,
    );
    assert(vysledek.pokusu === 1, "výchozí stav umožňuje odeslání");
  });

  const vyloucene = ulozisteVylouceni();
  const zapnuto = nastavitBranaVylouceniAnalytiky(true, vyloucene);
  assert(zapnuto.ok && zapnuto.vylouceno, "vyloučení se uloží");
  await sMístnímUlozistem(vyloucene, async () => {
    const odesilac = simulace(async () => ({ ok: true, status: 200 }));
    const primo = await odeslatJednuNavstevu(
      { typ: "navsteva", spusteni: "ikona", navstevnik: "novy" },
      odesilac.odeslat,
    );
    const rozpoznane = await odeslatRozpoznanouNavstevu(
      vstupNavstevy(pamet(), START, "ikona"),
      odesilac.odeslat,
    );
    assert(primo.pokusu === 0 && rozpoznane.pokusu === 0, "vyloučení zastaví každý pokus");
    assert(odesilac.volani.length === 0, "vyloučení neodešle požadavek");
  });

  const zruseno = nastavitBranaVylouceniAnalytiky(false, vyloucene);
  assert(zruseno.ok && !zruseno.vylouceno, "vyloučení lze zrušit");
  await sMístnímUlozistem(vyloucene, async () => {
    const panel = pamet();
    const odesilac = simulace(async () => ({ ok: true, status: 200 }));
    const znovu = await odeslatRozpoznanouNavstevu(
      vstupNavstevy(panel, START, "prohlizec"),
      odesilac.odeslat,
    );
    const pohled = await odeslatRozpoznanouNavstevu(
      vstupNavstevy(panel, START + MINUTA, "prohlizec"),
      odesilac.odeslat,
    );
    assert(znovu.pokusu === 1, "po zrušení vyloučení lze návštěvu odeslat");
    assert(pohled.pokusu === 0 && odesilac.volani.length === 1, "přepnutí pohledu neodešle duplicitu");
  });

  let pad = false;
  try {
    const nedostupne = ulozisteVylouceni({}, true);
    assert(!jeBranaAnalytikaVyloucena(nedostupne), "nedostupné čtení není vyloučení");
    const ulozeni = nastavitBranaVylouceniAnalytiky(true, nedostupne);
    assert(!ulozeni.ok, "selhání uložení není úspěch");
    assert(
      zobrazitVylouceniPoUlozeni(false, ulozeni) === false,
      "neúspěšné uložení se nezobrazí jako vyloučeno",
    );
    assert(
      zobrazitVylouceniPoUlozeni(true, { ok: false }) === true,
      "neúspěšné zrušení nezmění zobrazený stav",
    );
  } catch {
    pad = true;
  }
  assert(!pad, "nedostupné úložiště vyloučení nezpůsobí pád");

  const galerie = ulozisteVylouceni({ [KLIC_VYLouCIT_ZE_STATISTIK]: "1" });
  nastavitBranaVylouceniAnalytiky(true, galerie);
  assert(
    galerie.data.get(KLIC_VYLouCIT_ZE_STATISTIK) === "1",
    "vyloučení BRÁNY nemění klíč galerie",
  );
  assert(
    galerie.data.get(KLIC_BRANA_VYLOUCIT_ANALYTIKU) === "1",
    "BRÁNA používá vlastní klíč",
  );
  const klicBrany: string = KLIC_BRANA_VYLOUCIT_ANALYTIKU;
  const klicGalerie: string = KLIC_VYLouCIT_ZE_STATISTIK;
  assert(klicBrany !== klicGalerie, "klíče galerie a BRÁNY jsou různé");

  const modul = readFileSync(
    join("src", "lib", "brana", "analytika", "vylouceni-zarizeni.ts"),
    "utf8",
  );
  const odeslani = readFileSync(
    join("src", "lib", "brana", "analytika", "odeslani-navstevy.ts"),
    "utf8",
  );
  const prepinac = readFileSync(
    join("src", "components", "brana", "admin", "BranaAdminVylouceniZarizeni.tsx"),
    "utf8",
  );
  assert(!modul.includes(KLIC_VYLouCIT_ZE_STATISTIK), "modul vyloučení klíč galerie nezná");
  assert(!prepinac.includes("odeslani-navstevy"), "přepínač analytiku neodesílá");
  assert(
    odeslani.includes("jeOdeslaniBranaAnalytikyPovoleno"),
    "odeslání má společnou kontrolu vyloučení",
  );

  const verejne = vsechnySoubory(join("src", "app", "brana")).filter(
    (soubor) => !soubor.includes(`${join("admin")}`),
  );
  const napojeni = verejne.filter((soubor) => {
    const text = readFileSync(soubor, "utf8");
    return (
      text.includes("analytika/odeslani-navstevy") ||
      text.includes("analytika/navsteva-klient") ||
      text.includes("analytika/vylouceni-zarizeni")
    );
  });
  assert(napojeni.length === 0, "veřejná BRÁNA na vyloučení ani odeslání není napojená");
}

async function testNapojeni(): Promise<void> {
  assert(BRANA_ANALYTIKA_PRIJEM_ZAPNUT === false, "příjem pro napojení zůstává vypnutý");

  const vypnuto = simulace(async () => ({ ok: true, status: 200 }));
  let vypnuteCteni = false;
  try {
    const bezSite = await napojitRozpoznaniNavstevy(
      false,
      vstupNavstevy(ulozisteHaze(), START, "prohlizec"),
      vypnuto.odeslat,
      ulozisteHaze(),
    );
    assert(bezSite.pokusu === 0 && vypnuto.volani.length === 0, "vypnutá analytika nic neodesílá");
  } catch {
    vypnuteCteni = true;
  }
  assert(!vypnuteCteni, "vypnutá analytika nečte místní značku");

  const prazdne = pamet();
  const bezeZmeny = await napojitRozpoznaniNavstevy(
    false,
    vstupNavstevy(prazdne, START, "ikona"),
    vypnuto.odeslat,
  );
  assert(
    bezeZmeny.pokusu === 0 && prazdne.data.size === 0,
    "vypnutá analytika nemění stav návštěvy",
  );

  await sMístnímUlozistem(
    ulozisteVylouceni({ [KLIC_BRANA_VYLOUCIT_ANALYTIKU]: "1" }),
    async () => {
      const panel = pamet();
      const odesilac = simulace(async () => ({ ok: true, status: 200 }));
      let cteniPriznaku = 0;
      const priznak = pamet();
      const puvodniCteni = priznak.getItem.bind(priznak);
      priznak.getItem = (klic) => {
        cteniPriznaku += 1;
        return puvodniCteni(klic);
      };
      const vysledek = await napojitRozpoznaniNavstevy(
        true,
        vstupNavstevy(panel, START, "prohlizec"),
        odesilac.odeslat,
        priznak,
      );
      assert(vysledek.pokusu === 0 && odesilac.volani.length === 0, "vyloučené zařízení nic neodesílá");
      assert(panel.data.size === 0, "vyloučené zařízení nemění stav návštěvy");
      assert(cteniPriznaku === 0 && priznak.data.size === 0, "vyloučené zařízení nemění místní značku");
    },
  );

  await sMístnímUlozistem(ulozisteVylouceni(), async () => {
    const panel = pamet();
    const odesilac = simulace(async () => ({ ok: true, status: 200 }));
    const prvni = await napojitRozpoznaniNavstevy(
      true,
      vstupNavstevy(panel, START, "ikona"),
      odesilac.odeslat,
    );
    const pohled = await napojitRozpoznaniNavstevy(
      true,
      vstupNavstevy(panel, START + MINUTA, "ikona"),
      odesilac.odeslat,
    );
    const telo = JSON.parse(odesilac.volani[0]?.body ?? "{}") as {
      udalosti?: Array<{ typ?: string; spusteni?: string; navstevnik?: string }>;
    };
    assert(prvni.pokusu === 1 && prvni.odeslano, "povolené napojení odešle první návštěvu");
    assert(pohled.pokusu === 0 && odesilac.volani.length === 1, "přepnutí pohledu neodešle druhou návštěvu");
    assert(
      telo.udalosti?.[0]?.typ === "navsteva" &&
        telo.udalosti[0].spusteni === "ikona" &&
        telo.udalosti[0].navstevnik === undefined,
      "napojení neposílá druh návštěvníka",
    );
  });

  const komponenta = readFileSync(
    join("src", "components", "brana", "BranaRozpoznaniNavstevy.tsx"),
    "utf8",
  );
  const hlavni = readFileSync(join("src", "components", "brana", "BranaHlavni.tsx"), "utf8");
  const vzkaz = readFileSync(
    join("src", "components", "brana", "vzkaz", "BranaVzkazStranka.tsx"),
    "utf8",
  );
  const layout = readFileSync(join("src", "app", "brana", "layout.tsx"), "utf8");
  const kontrola = komponenta.indexOf("if (!BRANA_ANALYTIKA_PRIJEM_ZAPNUT)");
  const nacist = komponenta.indexOf("import(");
  assert(
    hlavni.includes("<BranaRozpoznaniNavstevy stranka={stranka} />"),
    "rozpoznání je na veřejné obrazovce",
  );
  assert(!vzkaz.includes("BranaRozpoznaniNavstevy"), "vzkaz návštěvu nepočítá");
  assert(!layout.includes("BranaRozpoznaniNavstevy"), "společný layout návštěvu nespouští");
  assert(
    kontrola !== -1 && nacist !== -1 && kontrola < nacist,
    "vypnutí skončí dřív než načtení návštěvy",
  );
  assert(komponenta.includes("return null"), "napojení nic nevykresluje");

  const vyskyty: string[] = [];
  for (const koren of [join("src", "app"), join("src", "components")]) {
    for (const soubor of vsechnySoubory(koren)) {
      if (readFileSync(soubor, "utf8").includes("BranaRozpoznaniNavstevy")) {
        vyskyty.push(soubor);
      }
    }
  }
  assert(vyskyty.length === 2, "rozpoznání má jediné veřejné místo");
}

async function testNavratNavstevnika(): Promise<void> {
  await sMístnímUlozistem(ulozisteVylouceni(), async () => {
    const priznak = pamet();
    const panel = pamet();
    const odesilac = simulace(async () => ({ ok: true, status: 200 }));
    const prvni = await napojitRozpoznaniNavstevy(
      true,
      vstupNavstevy(panel, START, "prohlizec"),
      odesilac.odeslat,
      priznak,
    );
    const obnoveni = await napojitRozpoznaniNavstevy(
      true,
      vstupNavstevy(panel, START + MINUTA, "prohlizec"),
      odesilac.odeslat,
      priznak,
    );
    const pohled = await napojitRozpoznaniNavstevy(
      true,
      vstupNavstevy(panel, START + 2 * MINUTA, "ikona"),
      odesilac.odeslat,
      priznak,
    );
    const telo = JSON.parse(odesilac.volani[0]?.body ?? "{}") as {
      udalosti?: Array<{ navstevnik?: string }>;
    };
    assert(prvni.odeslano && telo.udalosti?.[0]?.navstevnik === "novy", "první přijatá návštěva je nová");
    assert(priznak.data.get(KLIC_BRANA_UZ_NAVSTIVIL) === "1", "značka se zapíše až po přijetí");
    assert(obnoveni.pokusu === 0 && pohled.pokusu === 0, "obnovení ani přepnutí pohledu není nová návštěva");
    assert(odesilac.volani.length === 1, "jeden panel značku nepočítá znovu");

    const dalsiPanel = pamet();
    const dalsi = await napojitRozpoznaniNavstevy(
      true,
      vstupNavstevy(dalsiPanel, START + 3 * MINUTA, "prohlizec"),
      odesilac.odeslat,
      priznak,
    );
    const teloDalsi = JSON.parse(odesilac.volani[1]?.body ?? "{}") as {
      udalosti?: Array<{ navstevnik?: string }>;
    };
    assert(dalsi.odeslano && teloDalsi.udalosti?.[0]?.navstevnik === "vracejici", "další návštěva je vracející se");
    assert(priznak.data.size === 1, "značka nemá další údaje");
  });

  await sMístnímUlozistem(ulozisteVylouceni(), async () => {
    const priznak = pamet();
    const panel = pamet();
    const selhani = simulace(async () => ({ ok: false, status: 404 }));
    const neuspech = await napojitRozpoznaniNavstevy(
      true,
      vstupNavstevy(panel, START, "prohlizec"),
      selhani.odeslat,
      priznak,
    );
    assert(!neuspech.odeslano && priznak.data.size === 0, "neúspěšné přijetí značku nenastaví");

    const novyPanel = pamet();
    const oprava = simulace(async () => ({ ok: true, status: 200 }));
    const znovu = await napojitRozpoznaniNavstevy(
      true,
      vstupNavstevy(novyPanel, START, "prohlizec"),
      oprava.odeslat,
      priznak,
    );
    const telo = JSON.parse(oprava.volani[0]?.body ?? "{}") as {
      udalosti?: Array<{ navstevnik?: string }>;
    };
    assert(znovu.odeslano && telo.udalosti?.[0]?.navstevnik === "novy", "po neúspěchu je další návštěva stále nová");
  });

  await sMístnímUlozistem(ulozisteVylouceni(), async () => {
    const panel = pamet();
    const odesilac = simulace(async () => ({ ok: true, status: 200 }));
    let hozeno = false;
    try {
      const vysledek = await napojitRozpoznaniNavstevy(
        true,
        vstupNavstevy(panel, START, "prohlizec"),
        odesilac.odeslat,
        null,
      );
      const telo = JSON.parse(odesilac.volani[0]?.body ?? "{}") as {
        udalosti?: Array<{ navstevnik?: string }>;
      };
      assert(vysledek.odeslano, "nedostupné trvalé úložiště návštěvu nezahodí");
      assert(telo.udalosti?.[0]?.navstevnik === undefined, "bez úložiště se druh návštěvníka neposílá");
    } catch {
      hozeno = true;
    }
    assert(!hozeno, "nedostupné trvalé úložiště nezpůsobí pád");
  });

  await sMístnímUlozistem(ulozisteVylouceni(), async () => {
    const priznak = pamet();
    const panelA = pamet();
    const panelB = pamet();
    let uvolnit: () => void = () => {};
    const branik = new Promise<void>((resolve) => {
      uvolnit = resolve;
    });
    const odesilac = simulace(async () => {
      await branik;
      return { ok: true, status: 200 };
    });
    const prvni = napojitRozpoznaniNavstevy(
      true,
      vstupNavstevy(panelA, START, "prohlizec"),
      odesilac.odeslat,
      priznak,
    );
    const druhy = napojitRozpoznaniNavstevy(
      true,
      vstupNavstevy(panelB, START, "prohlizec"),
      odesilac.odeslat,
      priznak,
    );
    uvolnit();
    await prvni;
    await druhy;
    const jeste = await napojitRozpoznaniNavstevy(
      true,
      vstupNavstevy(panelA, START + MINUTA, "prohlizec"),
      odesilac.odeslat,
      priznak,
    );
    assert(odesilac.volani.length === 2, "dva panely odešlou dvě návštěvy, ne víc");
    assert(jeste.pokusu === 0, "další vykreslení panelu už návštěvu nepočítá");
  });

  const cas = new Date("2026-10-16T10:00:00.000Z");
  const den = isoDenZData(dnesVPraze(cas));
  const poNovem = aplikovatDavkuAnalytiky(
    prazdnyDokumentAnalytiky(),
    [{ typ: "navsteva", spusteni: "prohlizec", navstevnik: "novy" }],
    cas,
  );
  const poVracejicim = aplikovatDavkuAnalytiky(
    poNovem,
    [{ typ: "navsteva", spusteni: "prohlizec", navstevnik: "vracejici" }],
    cas,
  );
  const poStarsim = aplikovatDavkuAnalytiky(poVracejicim, [{ typ: "navsteva" }], cas);
  const souhrn = poStarsim.dny[den];
  assert(souhrn.navstevy === 3, "den sečte všechny návštěvy");
  assert(souhrn.novi === 1 && souhrn.vracejici === 1, "den sečte nové a vracející se bez korekce");
  assert(
    validovatDavkuAnalytiky({ udalosti: [{ typ: "navsteva" }] }).ok,
    "starší návštěva bez druhu zůstane platná",
  );
  const klicZnacky: string = KLIC_BRANA_UZ_NAVSTIVIL;
  assert(klicZnacky !== "trebon_navstevnik_id", "značka není identifikátor galerie");
}

async function main(): Promise<void> {
  testJednaNavstevaNaPanel();
  testOdchod();
  testSpusteniAUloziste();
  testBezSiteABezVerejneBrany();
  await testNapojeni();
  await testNavratNavstevnika();
  await sMístnímUlozistem(ulozisteVylouceni(), () => testOdeslani());
  await testVylouceni();

  if (selhalo > 0) {
    console.error(`\nSelhalo kontrol: ${selhalo}`);
    process.exit(1);
  }
  console.log("\nKlientské měření návštěv prošlo bez produkčního odeslání.");
}

void main();
