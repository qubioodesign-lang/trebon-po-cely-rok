/**
 * Otevření pohledů Kalendáře BRÁNY. Bez sítě a bez Blobu.
 * Spuštění: npx tsx scripts/verify-brana-analytika-pohledy.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import {
  BRANA_ANALYTIKA_PRIJEM_ZAPNUT,
  aplikovatDavkuAnalytiky,
  isoDenZData,
  prazdnyDenAnalytiky,
  prazdnyDokumentAnalytiky,
  validovatDavkuAnalytiky,
  type BranaAnalytikaPohled,
  type BranaAnalytikaUdalost,
} from "../src/lib/brana/analytika/model";
import { dnesVPraze } from "../src/lib/brana/cas";
import {
  napojitRozpoznaniNavstevy,
  spustitRozpoznaniNavstevyVOkne,
} from "../src/lib/brana/analytika/napojeni-navstevy";
import {
  BRANA_NAVSTEVA_MIN_ODCHOD_MS,
  KLIC_BRANA_UZ_NAVSTIVIL,
  oznacitOdchodDoPozadi,
  rozhodnoutOtevreniPohledu,
  type BranaNavstevaUloziste,
} from "../src/lib/brana/analytika/navsteva-klient";
import {
  BRANA_ANALYTIKA_ODESLANI_CESTA,
  type BranaAnalytikaPozadavek,
} from "../src/lib/brana/analytika/odeslani-navstevy";
import {
  KLIC_BRANA_VYLOUCIT_ANALYTIKU,
  type BranaVylouceniUloziste,
} from "../src/lib/brana/analytika/vylouceni-zarizeni";

const START = 1_700_000_000_000;
const MINUTA = 60 * 1000;
const CAS = new Date("2026-10-16T10:00:00.000Z");
const KLIC_POHLED = "brana_analytika_pohled";

let selhalo = 0;
let krok = START;

function assert(ok: boolean, popis: string): void {
  if (ok) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhalo += 1;
  console.error(`FAIL ${popis}`);
}

type Udalost = {
  typ?: string;
  spusteni?: string;
  navstevnik?: string;
  pohled?: string;
  raz?: string;
};

function pamet(): BranaNavstevaUloziste & { data: Map<string, string>; zapisu: number } {
  const data = new Map<string, string>();
  const uloziste = {
    data,
    zapisu: 0,
    getItem: (klic: string) => data.get(klic) ?? null,
    setItem: (klic: string, hodnota: string) => {
      uloziste.zapisu += 1;
      data.set(klic, hodnota);
    },
    removeItem: (klic: string) => {
      data.delete(klic);
    },
  };
  return uloziste;
}

function ulozisteHaze(sahnuti: { pocet: number }): BranaNavstevaUloziste {
  const selhat = () => {
    sahnuti.pocet += 1;
    throw new Error("úložiště nedostupné");
  };
  return { getItem: selhat, setItem: selhat, removeItem: selhat };
}

function prazdneMistni(): BranaVylouceniUloziste {
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

function vylouceneMistni(): BranaVylouceniUloziste {
  const uloziste = prazdneMistni();
  uloziste.setItem(KLIC_BRANA_VYLOUCIT_ANALYTIKU, "1");
  return uloziste;
}

async function sMístnímUlozistem<T>(
  uloziste: BranaVylouceniUloziste,
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

function simulace(ok: boolean) {
  const volani: BranaAnalytikaPozadavek[] = [];
  return {
    volani,
    odeslat: async (url: string, pozadavek: BranaAnalytikaPozadavek) => {
      if (url !== BRANA_ANALYTIKA_ODESLANI_CESTA) {
        throw new Error("cizí adresa");
      }
      volani.push(pozadavek);
      if (!ok) {
        return { ok: false, status: 404 };
      }
      return { ok: true, status: 200 };
    },
  };
}

function udalosti(pozadavek: BranaAnalytikaPozadavek | undefined): Udalost[] {
  const telo = JSON.parse(pozadavek?.body ?? "{}") as { udalosti?: Udalost[] };
  return telo.udalosti ?? [];
}

async function otevrit(
  panel: BranaNavstevaUloziste,
  pohled: BranaAnalytikaPohled,
  odeslat: (url: string, pozadavek: BranaAnalytikaPozadavek) => Promise<{ ok?: boolean }>,
  priznak?: BranaNavstevaUloziste | null,
) {
  krok += MINUTA;
  return napojitRozpoznaniNavstevy(
    true,
    { uloziste: panel, ted: krok, spusteni: "prohlizec" },
    odeslat,
    priznak,
    pohled,
  );
}

function soucetPohledu(
  den: ReturnType<typeof prazdnyDenAnalytiky>,
  pohled: BranaAnalytikaPohled,
  raz: "prvni" | "dalsi",
): number {
  return den.pohledy[pohled][raz];
}

async function testPohledy(): Promise<void> {
  assert(BRANA_ANALYTIKA_PRIJEM_ZAPNUT === false, "příjem zůstává vypnutý");

  const sahnutiVypnuto = { pocet: 0 };
  const vypnuto = simulace(true);
  const bezMer = await napojitRozpoznaniNavstevy(
    false,
    {
      uloziste: ulozisteHaze(sahnutiVypnuto),
      ted: START,
      spusteni: "prohlizec",
    },
    vypnuto.odeslat,
    ulozisteHaze(sahnutiVypnuto),
    "dnes",
  );
  assert(bezMer.pokusu === 0 && vypnuto.volani.length === 0, "vypnutá analytika pohled neodešle");
  assert(sahnutiVypnuto.pocet === 0, "vypnutá analytika na úložiště nesáhne");
  const uklid = spustitRozpoznaniNavstevyVOkne("vikend");
  assert(typeof uklid === "function", "vypnuté spuštění v okně jen vrátí úklid");
  uklid();

  await sMístnímUlozistem(vylouceneMistni(), async () => {
    const sahnuti = { pocet: 0 };
    const odesilac = simulace(true);
    const vysledek = await napojitRozpoznaniNavstevy(
      true,
      {
        uloziste: ulozisteHaze(sahnuti),
        ted: START,
        spusteni: "ikona",
      },
      odesilac.odeslat,
      ulozisteHaze(sahnuti),
      "vyhled",
    );
    assert(vysledek.pokusu === 0 && odesilac.volani.length === 0, "vyloučené zařízení pohled neodešle");
    assert(sahnuti.pocet === 0, "vyloučené zařízení značku pohledu nezapisuje");
  });

  await sMístnímUlozistem(prazdneMistni(), async () => {
    const dnes = pamet();
    const odesilac = simulace(true);
    const prvni = await otevrit(dnes, "dnes", odesilac.odeslat);
    const telo = udalosti(odesilac.volani[0]);
    assert(prvni.odeslano && odesilac.volani.length === 1, "první otevření na Dnes se odešle jednou");
    assert(
      telo[0]?.typ === "navsteva" && telo[1]?.pohled === "dnes" && telo[1]?.raz === "prvni",
      "první pohled Dnes je v téže dávce jako návštěva",
    );
    assert(
      odesilac.volani[0]?.credentials === "omit" && odesilac.volani[0]?.keepalive === true,
      "pohled používá stejné odeslání bez přihlášení",
    );

    const zapisuPoPrvnim = dnes.zapisu;
    const prekresleni = await otevrit(dnes, "dnes", odesilac.odeslat);
    assert(prekresleni.pokusu === 0 && odesilac.volani.length === 1, "překreslení bez změny pohledu se nepočítá");
    assert(dnes.zapisu === zapisuPoPrvnim, "překreslení značku pohledu nepřepisuje");
    const znovu = rozhodnoutOtevreniPohledu(dnes, "dnes", false);
    assert(znovu === null && dnes.zapisu === zapisuPoPrvnim, "opakované rozhodnutí stejného pohledu nic nezapíše");

    const obnoveni = await otevrit(dnes, "dnes", odesilac.odeslat);
    assert(obnoveni.pokusu === 0 && odesilac.volani.length === 1, "obnovení stránky další otevření nevytvoří");

    const zitra = await otevrit(dnes, "zitra", odesilac.odeslat);
    const poZitre = udalosti(odesilac.volani[1]);
    assert(zitra.odeslano && poZitre.length === 1, "přechod Dnes → Zítra odešle jen otevření");
    assert(
      poZitre[0]?.typ === "pohled" && poZitre[0]?.pohled === "zitra" && poZitre[0]?.raz === "dalsi",
      "Zítra je další otevření",
    );
    assert(
      odesilac.volani.every((volani) => udalosti(volani).filter((polozka) => polozka.typ === "navsteva").length <= 1) &&
        odesilac.volani.flatMap(udalosti).filter((polozka) => polozka.typ === "navsteva").length === 1,
      "přechod pohledu nezaloží druhou návštěvu",
    );

    const vikend = pamet();
    const primy = simulace(true);
    const primo = await otevrit(vikend, "vikend", primy.odeslat);
    const primoTelo = udalosti(primy.volani[0]);
    assert(primo.odeslano, "přímé otevření Víkendu se započítá");
    assert(
      primoTelo[1]?.pohled === "vikend" && primoTelo[1]?.raz === "prvni",
      "první pohled je Víkend, ne výchozí Dnes",
    );
    assert(
      !primoTelo.some((polozka) => polozka.pohled === "dnes"),
      "přímý odkaz se neodvozuje z výchozího pohledu",
    );

    const kolecko = pamet();
    const cesta = simulace(true);
    await otevrit(kolecko, "dnes", cesta.odeslat);
    await otevrit(kolecko, "vikend", cesta.odeslat);
    await otevrit(kolecko, "dnes", cesta.odeslat);
    const cestaUdalosti = cesta.volani.flatMap(udalosti);
    assert(
      cestaUdalosti.filter((polozka) => polozka.pohled === "dnes" && polozka.raz === "prvni").length === 1 &&
        cestaUdalosti.filter((polozka) => polozka.pohled === "vikend" && polozka.raz === "dalsi").length === 1 &&
        cestaUdalosti.filter((polozka) => polozka.pohled === "dnes" && polozka.raz === "dalsi").length === 1,
      "Dnes → Víkend → Dnes počítá návrat jako další otevření",
    );
    assert(kolecko.data.get(KLIC_POHLED) === "dnes", "v panelu zůstane jen poslední pohled");
    assert(kolecko.data.size === 2, "navigace návštěvníka se neukládá jako historie");
    assert(
      cestaUdalosti.filter((polozka) => polozka.typ === "navsteva").length === 1,
      "cesta přes pohledy zůstane jedna návštěva",
    );

    const tyden = pamet();
    const dale = simulace(true);
    await otevrit(tyden, "dnes", dale.odeslat);
    await otevrit(tyden, "7-dni", dale.odeslat);
    await otevrit(tyden, "vyhled", dale.odeslat);
    const daleUdalosti = dale.volani.flatMap(udalosti);
    assert(
      daleUdalosti.some((polozka) => polozka.pohled === "7-dni" && polozka.raz === "dalsi") &&
        daleUdalosti.some((polozka) => polozka.pohled === "vyhled" && polozka.raz === "dalsi"),
      "7 dní a Výhled se počítají jako další otevření",
    );

    const priznak = pamet();
    const neuspech = pamet();
    const selhani = simulace(false);
    const prvniSelhani = await otevrit(neuspech, "zitra", selhani.odeslat, priznak);
    const druheSelhani = await otevrit(neuspech, "zitra", selhani.odeslat, priznak);
    assert(prvniSelhani.pokusu === 1 && prvniSelhani.odeslano === false, "neúspěšná návštěva má jeden pokus");
    assert(
      udalosti(selhani.volani[0])[0]?.typ === "navsteva" &&
        udalosti(selhani.volani[0])[1]?.raz === "prvni" &&
        udalosti(selhani.volani[0])[1]?.pohled === "zitra",
      "neúspěšná návštěva nese první pohled ve stejné dávce",
    );
    assert(druheSelhani.pokusu === 0 && selhani.volani.length === 1, "neúspěch se neopakuje ani pro první pohled");
    assert(priznak.data.get(KLIC_BRANA_UZ_NAVSTIVIL) === undefined, "neúspěch nezapíše značku návštěvníka");

    let uvolnit = () => {};
    const brana = new Promise<void>((resolve) => {
      uvolnit = resolve;
    });
    const poradi: string[] = [];
    let cekaPrvni = true;
    const panelPoradi = pamet();
    const odeslatPoradi = async (_url: string, pozadavek: BranaAnalytikaPozadavek) => {
      poradi.push(pozadavek.body);
      if (cekaPrvni) {
        cekaPrvni = false;
        await brana;
      }
      return { ok: true, status: 200 };
    };
    const prvniLet = otevrit(panelPoradi, "dnes", odeslatPoradi);
    const druhyLet = otevrit(panelPoradi, "zitra", odeslatPoradi);
    assert(poradi.length === 2, "další pohled se rozhodne ještě před dokončením návštěvy");
    const prvniDavka = JSON.parse(poradi[0] ?? "{}") as { udalosti?: Udalost[] };
    const druhaDavka = JSON.parse(poradi[1] ?? "{}") as { udalosti?: Udalost[] };
    assert(
      prvniDavka.udalosti?.[0]?.typ === "navsteva" &&
        prvniDavka.udalosti?.[1]?.raz === "prvni" &&
        prvniDavka.udalosti?.[1]?.pohled === "dnes",
      "první dávka má návštěvu a až potom první pohled",
    );
    assert(
      druhaDavka.udalosti?.length === 1 &&
        druhaDavka.udalosti[0]?.pohled === "zitra" &&
        druhaDavka.udalosti[0]?.raz === "dalsi",
      "souběžný přechod nezaloží druhý první pohled",
    );
    uvolnit();
    await prvniLet;
    await druhyLet;

    const navrat = pamet();
    const poOdchodu = simulace(true);
    await otevrit(navrat, "dnes", poOdchodu.odeslat);
    oznacitOdchodDoPozadi(navrat, krok);
    krok += BRANA_NAVSTEVA_MIN_ODCHOD_MS;
    const nova = await otevrit(navrat, "dnes", poOdchodu.odeslat);
    const novaTela = poOdchodu.volani.flatMap(udalosti);
    assert(nova.odeslano, "návrat po 30 minutách je nová návštěva");
    assert(
      novaTela.filter((polozka) => polozka.typ === "navsteva").length === 2 &&
        novaTela.filter((polozka) => polozka.pohled === "dnes" && polozka.raz === "prvni").length === 2 &&
        novaTela.filter((polozka) => polozka.raz === "dalsi").length === 0,
      "nová návštěva má znovu první pohled a není další otevření",
    );

    const den = aplikovatDavkuAnalytiky(
      prazdnyDokumentAnalytiky(),
      [
        { typ: "navsteva", spusteni: "prohlizec", navstevnik: "novy" },
        { typ: "pohled", pohled: "dnes", raz: "prvni" },
      ],
      CAS,
      "trebonsko",
    );
    const poDalsich = aplikovatDavkuAnalytiky(
      den,
      [
        { typ: "pohled", pohled: "zitra", raz: "dalsi" },
        { typ: "pohled", pohled: "vikend", raz: "dalsi" },
        { typ: "pohled", pohled: "dnes", raz: "dalsi" },
        { typ: "pohled", pohled: "7-dni", raz: "dalsi" },
        { typ: "pohled", pohled: "vyhled", raz: "dalsi" },
      ],
      CAS,
      "trebonsko",
    );
    const poStarem = aplikovatDavkuAnalytiky(poDalsich, [{ typ: "navsteva" }], CAS);
    const soucet = poStarem.dny[isoDenZData(dnesVPraze(CAS))];
    assert(soucet?.navstevy === 2, "denní součet návštěv počítá jen návštěvy");
    assert(soucet?.novi === 1 && soucet?.vracejici === 0, "pohled nemění nové a vracející se");
    assert(soucet?.oblast.trebonsko === 1, "oblast se přičte jen k návštěvě, ne ke každému pohledu");
    assert(soucetPohledu(soucet!, "dnes", "prvni") === 1, "Dnes má jedno první otevření");
    assert(soucetPohledu(soucet!, "dnes", "dalsi") === 1, "návrat na Dnes je jedno další otevření");
    assert(soucetPohledu(soucet!, "zitra", "dalsi") === 1, "Zítra má jedno další otevření");
    assert(soucetPohledu(soucet!, "vikend", "dalsi") === 1, "Víkend má jedno další otevření");
    assert(soucetPohledu(soucet!, "7-dni", "dalsi") === 1, "7 dní má jedno další otevření");
    assert(soucetPohledu(soucet!, "vyhled", "dalsi") === 1, "Výhled má jedno další otevření");
    assert(soucetPohledu(soucet!, "zitra", "prvni") === 0, "Zítra v této cestě není první pohled");
    assert(
      soucet?.konecObsahu.vikend === 0 && soucet?.konecObsahu["7-dni"] === 0,
      "konec obsahu se tímto krokem nemění",
    );
    assert(soucet?.sdileniKlik === 0 && soucet?.proklikTrebon === 0, "sdílení a proklik se nemění");

    const stare = prazdnyDokumentAnalytiky();
    const denStary = prazdnyDenAnalytiky();
    denStary.pohledy.dnes = { prvni: 5, dalsi: 6 };
    denStary.konecObsahu = { vikend: 3, "7-dni": 4 };
    stare.dny[isoDenZData(dnesVPraze(CAS))] = denStary;
    const poStarsiUdalosti = aplikovatDavkuAnalytiky(stare, [{ typ: "navsteva" }], CAS);
    const zachovano = poStarsiUdalosti.dny[isoDenZData(dnesVPraze(CAS))];
    assert(
      validovatDavkuAnalytiky({ udalosti: [{ typ: "navsteva" }] }).ok &&
        zachovano?.navstevy === 1 &&
        zachovano.pohledy.dnes.prvni === 5 &&
        zachovano.pohledy.dnes.dalsi === 6 &&
        zachovano.konecObsahu.vikend === 3,
      "starší událost návštěvy zůstane platná a počty pohledů nezmění",
    );
    assert(
      validovatDavkuAnalytiky({
        udalosti: [{ typ: "pohled", pohled: "vikend", raz: "prvni" }],
      }).ok,
      "samotné otevření pohledu je platná událost",
    );
    const odmitnute: unknown[] = [
      { udalosti: [{ typ: "pohled" }] },
      { udalosti: [{ typ: "pohled", pohled: "dnes", raz: "konec" }] },
      { udalosti: [{ typ: "pohled", pohled: "domu", raz: "prvni" }] },
      { udalosti: [{ typ: "pohled", pohled: "dnes", raz: "prvni", navstevnik: "novy" }] },
      { udalosti: [{ typ: "navsteva", pohled: "dnes" }] },
      { udalosti: [{ typ: "scroll", pohled: "dnes" }] },
    ];
    assert(
      odmitnute.every((teloDavky) => !validovatDavkuAnalytiky(teloDavky).ok),
      "cizí, neúplné a starší zakázané události se odmítnou",
    );

    const platne = validovatDavkuAnalytiky({
      udalosti: [
        { typ: "navsteva" },
        { typ: "pohled", pohled: "7-dni", raz: "dalsi" },
      ] satisfies BranaAnalytikaUdalost[],
    });
    assert(
      platne.ok && platne.ok && platne.udalosti.length === 2,
      "dávka snese starší návštěvu i otevření pohledu vedle sebe",
    );
  });

  const komponenta = readFileSync(
    join("src", "components", "brana", "BranaRozpoznaniNavstevy.tsx"),
    "utf8",
  );
  const hlavni = readFileSync(join("src", "components", "brana", "BranaHlavni.tsx"), "utf8");
  const swipe = readFileSync(join("src", "components", "brana", "BranaSwipeObsah.tsx"), "utf8");
  const obrazovka = readFileSync(join("src", "components", "brana", "BranaObrazovka.tsx"), "utf8");
  const galerie = readFileSync(join("src", "app", "page.tsx"), "utf8");
  const kontrola = komponenta.indexOf("if (!BRANA_ANALYTIKA_PRIJEM_ZAPNUT)");
  const nacist = komponenta.indexOf("import(");
  assert(kontrola !== -1 && nacist !== -1 && kontrola < nacist, "vypnutí skončí dřív než načtení měření");
  assert(komponenta.includes("[stranka]"), "měření sleduje skutečně zobrazenou stránku");
  assert(hlavni.includes("<BranaRozpoznaniNavstevy stranka={stranka} />"), "veřejná obrazovka předá svůj pohled");
  assert(!swipe.includes("analytika"), "swipe zůstává původní navigace");
  assert(!obrazovka.includes("analytika"), "obrazovka nedostala nový navigační mechanismus");
  assert(!galerie.includes("BranaRozpoznaniNavstevy"), "galerie měření pohledů nemá");
  assert(!komponenta.includes("document.cookie"), "měření nezakládá cookie");
}

testPohledy()
  .then(() => {
    if (selhalo > 0) {
      console.error(`Selhalo: ${selhalo}`);
      process.exit(1);
    }
    console.log("Pohledy BRÁNY: všechno sedí.");
  })
  .catch((chyba: unknown) => {
    console.error(chyba);
    process.exit(1);
  });
