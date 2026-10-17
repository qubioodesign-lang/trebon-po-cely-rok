/**
 * Podklady administrativních grafů BRÁNY. Bez produkčního Blob zápisu.
 * Spuštění: npx tsx scripts/verify-brana-analytika-grafy.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { dnesVPraze, okamzikZPrahy, pridatDny } from "../src/lib/brana/cas";
import {
  BRANA_ANALYTIKA_GRAF_VYCHOZI_OBDOBI,
  hraniceUchovaniGrafu,
  hodnotaNavstevZaDen,
  jeDenDostupnyProGraf,
  sestavitPodkladyGrafu,
  type BranaAnalytikaGrafObdobi,
  type PodkladyGrafuBrany,
} from "../src/lib/brana/analytika/grafy";
import { pripravitPodkladyGrafu } from "../src/lib/brana/analytika/podklady-grafu";
import {
  BRANA_ANALYTIKA_PRIJEM_ZAPNUT,
  isoDenZData,
  parsovatDokumentAnalytiky,
  prazdnyDenAnalytiky,
  prazdnyDokumentAnalytiky,
  type BranaAnalytikaDen,
  type BranaAnalytikaDokument,
} from "../src/lib/brana/analytika/model";

const TED = okamzikZPrahy(2026, 1, 15, 12, 0);
const DNES = isoDenZData(dnesVPraze(TED));

let selhalo = 0;

function assert(ok: boolean, popis: string): void {
  if (ok) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhalo += 1;
  console.error(`FAIL ${popis}`);
}

function posun(iso: string, dny: number): string {
  const [rok, mesic, den] = iso.split("-").map(Number);
  return isoDenZData(pridatDny({ rok, mesic, den }, dny));
}

function denS(uprava: (den: BranaAnalytikaDen) => void): BranaAnalytikaDen {
  const den = prazdnyDenAnalytiky();
  uprava(den);
  return den;
}

function dokumentS(dny: Record<string, BranaAnalytikaDen>): BranaAnalytikaDokument {
  return { verze: 1, dny };
}

function rada(
  obdobi: BranaAnalytikaGrafObdobi,
  dny: Record<string, BranaAnalytikaDen>,
  ted = TED,
): PodkladyGrafuBrany {
  return sestavitPodkladyGrafu(dokumentS(dny), ted, obdobi);
}

function testObdobi(): void {
  const prazdny = prazdnyDokumentAnalytiky();
  const vychozi = sestavitPodkladyGrafu(prazdny, TED);
  assert(
    BRANA_ANALYTIKA_GRAF_VYCHOZI_OBDOBI === 30 && vychozi.obdobi === 30 && vychozi.okno.pocetDnu === 30,
    "výchozí období má 30 dní",
  );
  assert(vychozi.okno.do === DNES && vychozi.okno.od === posun(DNES, -29), "třicet dní končí dneškem");
  assert(
    vychozi.predchoziOkno?.do === posun(vychozi.okno.od, -1) &&
      vychozi.predchoziOkno.od === posun(vychozi.predchoziOkno.do, -29),
    "předchozích 30 dní končí den před aktuálním oknem",
  );

  for (const obdobi of [7, 30, 90] as const) {
    const podklady = sestavitPodkladyGrafu(prazdny, TED, obdobi);
    const navstevy = podklady.navstevnost.aktualni.map((bod) => bod.od);
    assert(
      podklady.rozliseni === "den" &&
        navstevy.length === obdobi &&
        navstevy[0] === posun(DNES, -(obdobi - 1)) &&
        navstevy[navstevy.length - 1] === DNES &&
        navstevy.every((den, poradi) => poradi === 0 || den === posun(navstevy[poradi - 1] ?? den, 1)),
      `${obdobi} dní je souvislá řada včetně dneška`,
    );
    assert(
      podklady.predchoziOkno?.pocetDnu === obdobi &&
        podklady.navstevnost.predchozi?.length === obdobi &&
        podklady.predchoziOkno.do === posun(podklady.okno.od, -1) &&
        podklady.predchoziOkno.od >= hraniceUchovaniGrafu(DNES),
      `předchozí období ${obdobi} dní je stejně dlouhé a ještě v uchování`,
    );
  }

  const presRok = okamzikZPrahy(2026, 1, 3, 12, 0);
  const dnesPresRok = isoDenZData(dnesVPraze(presRok));
  const tyden = sestavitPodkladyGrafu(prazdny, presRok, 7);
  assert(
    tyden.okno.od === "2025-12-28" &&
      tyden.okno.do === dnesPresRok &&
      tyden.predchoziOkno?.od === "2025-12-21" &&
      tyden.predchoziOkno.do === "2025-12-27",
    "sedm dní umí přejít přelom roku",
  );
}

function testRokANuly(): void {
  const stary = posun(hraniceUchovaniGrafu(DNES), -1);
  const podklady = rada(365, {
    "2025-01-16": denS((den) => {
      den.navstevy = 2;
    }),
    "2026-01-15": denS((den) => {
      den.navstevy = 3;
    }),
    "2025-02-10": denS(() => undefined),
    [stary]: denS((den) => {
      den.navstevy = 100;
    }),
  });
  const leden2025 = podklady.navstevnost.aktualni[0];
  const unor = podklady.navstevnost.aktualni.find((bod) => bod.rok === 2025 && bod.mesic === 2);
  const leden2026 = podklady.navstevnost.aktualni[podklady.navstevnost.aktualni.length - 1];

  assert(podklady.rozliseni === "mesic" && podklady.navstevnost.aktualni.length === 13, "rok má 13 měsíčních bodů");
  assert(podklady.predchoziOkno === null && podklady.navstevnost.predchozi === null, "rok nepřipravuje předchozí období");
  assert(
    leden2025?.od === "2025-01-16" &&
      leden2025.do === "2025-01-31" &&
      leden2025.pocetDnu === 16 &&
      leden2025.den === null &&
      leden2025.hodnota === 2,
    "první měsíc roku zůstane neúplný",
  );
  assert(unor?.pocetDnu === 28 && unor.hodnota === 0 && unor.nedostupnychDnu === 0, "prázdný uložený měsíc je naměřená nula");
  assert(
    leden2026?.od === "2026-01-01" && leden2026.do === DNES && leden2026.pocetDnu === 15 && leden2026.hodnota === 3,
    "poslední měsíc sahá jen po dnešek",
  );
  assert(podklady.navstevnost.soucet === 5 && podklady.navstevnost.zmenaProcent === null, "roční součet ignoruje data mimo uchování");
  assert(
    hodnotaNavstevZaDen(dokumentS({ [stary]: denS((den) => {
      den.navstevy = 9;
    }) }), stary, DNES) === null &&
      !jeDenDostupnyProGraf(stary, DNES) &&
      hodnotaNavstevZaDen(prazdnyDokumentAnalytiky(), hraniceUchovaniGrafu(DNES), DNES) === 0,
    "historický den není nula a chybějící den v uchování je nula",
  );

  const tyden = rada(7, {
    [DNES]: denS((den) => {
      den.navstevy = 4;
    }),
  });
  assert(
    tyden.navstevnost.soucet === 4 &&
      tyden.navstevnost.aktualni.filter((bod) => bod.hodnota === 0).length === 6 &&
      tyden.navstevnost.aktualni.every((bod) => bod.nedostupnychDnu === 0),
    "chybějící dny v sedmidenním okně jsou nuly",
  );
}

function testRady(): void {
  const vcera = posun(DNES, -1);
  const predDvema = posun(DNES, -2);
  const predchoziDen = posun(DNES, -7);
  const podklady = rada(7, {
    [predchoziDen]: denS((den) => {
      den.navstevy = 10;
    }),
    [predDvema]: denS((den) => {
      den.prochazeni.dnes = { delsi: 0, konec: 0 };
    }),
    [vcera]: denS((den) => {
      den.prochazeni.dnes = { delsi: 3, konec: 0 };
    }),
    [DNES]: denS((den) => {
      den.navstevy = 15;
      den.novi = 2;
      den.vracejici = 1;
      den.spusteni = { ikona: 2, prohlizec: 3 };
      den.oblast = { trebonsko: 1, mimo_trebonsko: 1, neurceno: 2 };
      den.pohledy.dnes = { prvni: 1, dalsi: 4 };
      den.prochazeni.dnes = { delsi: 1, konec: 1 };
      den.konecObsahu = { vikend: 99, "7-dni": 99 };
      den.sdileniKlik = 4;
      den.zdroje.sdileni = 1;
      den.zdroje.qr = 5;
      den.zdroje.whatsapp = 7;
      den.qrDesktop = 2;
    }),
  });

  assert(podklady.navstevnost.soucet === 15 && podklady.navstevnost.soucetPredchozi === 10, "návštěvy mají aktuální i předchozí součet");
  assert(podklady.navstevnost.zmenaProcent === 50, "změna proti předchozímu období je 50 procent");
  assert(
    podklady.navratovost.soucetNovi === 2 &&
      podklady.navratovost.soucetVracejici === 1 &&
      !("rozdil" in podklady.navratovost),
    "noví a vracející se se nedopočítávají do všech návštěv",
  );
  assert(podklady.spusteni.soucetIkona === 2 && podklady.spusteni.soucetProhlizec === 3, "ikona a prohlížeč zůstávají oddělené");
  assert(
    podklady.geografie.soucty.trebonsko === 1 &&
      podklady.geografie.soucty.mimo_trebonsko === 1 &&
      podklady.geografie.soucty.neurceno === 2 &&
      podklady.geografie.procenta.trebonsko === 25 &&
      podklady.geografie.procenta.mimo_trebonsko === 25 &&
      podklady.geografie.procenta.neurceno === 50,
    "geografie má součty a podíly tří kategorií",
  );
  assert(podklady.kalendar.soucty.dnes === 5 && podklady.kalendar.soucty.zitra === 0, "kalendář sčítá první a další otevření");

  const prochazeni = podklady.prochazeni.rady.dnes;
  const bezDelky = prochazeni.find((bod) => bod.od === predDvema);
  const nedosazeny = prochazeni.find((bod) => bod.od === vcera);
  const dosazeny = prochazeni.find((bod) => bod.od === DNES);
  assert(bezDelky?.procento === null && bezDelky.delsi === 0, "nulový jmenovatel procházení není nula procent");
  assert(nedosazeny?.procento === 0 && dosazeny?.procento === 100, "dosažený a nedosažený konec zůstávají oddělené");
  assert(
    podklady.prochazeni.soucty.dnes.delsi === 4 &&
      podklady.prochazeni.soucty.dnes.konec === 1 &&
      podklady.prochazeni.soucty.dnes.procento === 25,
    "procento procházení je vážený součet, ne průměr procent",
  );
  assert(podklady.prochazeni.soucty.vikend.konec === 0, "starší konec obsahu se do procházení nepočítá");
  assert(
    podklady.sdileni.soucetKlik === 4 &&
      podklady.sdileni.soucetPrichod === 1 &&
      !("pomer" in podklady.sdileni),
    "stisk a příchod ze sdílení nejsou konverzní poměr",
  );
  assert(
    podklady.qr.soucetCelkem === 5 &&
      podklady.qr.soucetDesktop === 2 &&
      !("soucet" in podklady.qr),
    "QR desktop zůstává podmnožina a k celku se nepřičítá",
  );

  const rocni = rada(365, {
    [predDvema]: denS((den) => {
      den.prochazeni.dnes = { delsi: 0, konec: 0 };
    }),
    [vcera]: denS((den) => {
      den.prochazeni.dnes = { delsi: 3, konec: 0 };
    }),
    [DNES]: denS((den) => {
      den.prochazeni.dnes = { delsi: 1, konec: 1 };
    }),
  });
  const leden = rocni.prochazeni.rady.dnes.find((bod) => bod.rok === 2026 && bod.mesic === 1);
  assert(leden?.procento === 25 && leden.pocetDnu === 15, "měsíc počítá procento až ze součtu dnů");

  const bezPredchoziho = rada(7, {
    [DNES]: denS((den) => {
      den.navstevy = 4;
    }),
  });
  assert(bezPredchoziho.navstevnost.zmenaProcent === null, "změna proti nulovému období není procento");
  const pokles = rada(7, {
    [predchoziDen]: denS((den) => {
      den.navstevy = 8;
    }),
  });
  assert(pokles.navstevnost.zmenaProcent === -100, "pokles na nulu je mínus 100 procent");
}

function testStarsiAPrazdne(): void {
  const surovy = prazdnyDenAnalytiky();
  surovy.navstevy = 3;
  delete (surovy as { qrDesktop?: number }).qrDesktop;
  delete (surovy as { prochazeni?: unknown }).prochazeni;
  delete (surovy as { oblast?: unknown }).oblast;
  const starsi = parsovatDokumentAnalytiky({ verze: 1, dny: { [DNES]: surovy } });
  assert(starsi !== null, "starší den bez nových polí zůstane čitelný");
  const podklady = sestavitPodkladyGrafu(starsi ?? prazdnyDokumentAnalytiky(), TED, 7);
  assert(
    podklady.navstevnost.soucet === 3 &&
      podklady.qr.soucetCelkem === 0 &&
      podklady.qr.soucetDesktop === 0 &&
      podklady.geografie.procenta.trebonsko === null &&
      podklady.prochazeni.soucty.dnes.procento === null,
    "chybějící novější pole jsou nuly a procento bez jmenovatele chybí",
  );

  const prazdny = sestavitPodkladyGrafu(prazdnyDokumentAnalytiky(), TED, 7);
  assert(
    prazdny.navstevnost.soucet === 0 &&
      prazdny.navstevnost.zmenaProcent === null &&
      prazdny.geografie.procenta.neurceno === null &&
      prazdny.prochazeni.soucty["7-dni"].procento === null,
    "prázdný dokument má nulové počty a nedostupná procenta",
  );
}

async function testCteni(): Promise<void> {
  let cteni = 0;
  let zapisy = 0;
  const odmitnuty = await pripravitPodkladyGrafu({
    ted: TED,
    jePrihlasen: async () => false,
    nacist: async () => {
      cteni += 1;
      return { stav: "ok", dokument: prazdnyDokumentAnalytiky() };
    },
  });
  assert(odmitnuty.ok === false && odmitnuty.duvod === "neprihlasen" && cteni === 0 && zapisy === 0, "nepřihlášený uživatel data nedostane");

  const selhaniPrihlaseni = await pripravitPodkladyGrafu({
    ted: TED,
    jePrihlasen: async () => {
      throw new Error("cookie");
    },
    nacist: async () => {
      cteni += 1;
      return { stav: "ok", dokument: prazdnyDokumentAnalytiky() };
    },
  });
  assert(selhaniPrihlaseni.ok === false && selhaniPrihlaseni.duvod === "neprihlasen" && cteni === 0, "chyba ověření čtení nespustí");

  const prazdne = await pripravitPodkladyGrafu({
    ted: TED,
    obdobi: 7,
    jePrihlasen: async () => true,
    nacist: async () => {
      cteni += 1;
      return { stav: "neexistuje" };
    },
  });
  assert(
    prazdne.ok && prazdne.navstevnost.soucet === 0 && cteni === 1 && zapisy === 0,
    "chybějící dokument je prázdný výsledek bez zápisu",
  );

  const chyba = await pripravitPodkladyGrafu({
    ted: TED,
    jePrihlasen: async () => true,
    nacist: async () => {
      throw new Error("síť");
    },
  });
  const poskozeny = await pripravitPodkladyGrafu({
    ted: TED,
    jePrihlasen: async () => true,
    nacist: async () => ({ stav: "poskozeny" }),
  });
  assert(
    chyba.ok === false && chyba.duvod === "chyba-cteni" && !("navstevnost" in chyba),
    "chyba čtení není nulová návštěvnost",
  );
  assert(
    poskozeny.ok === false && poskozeny.duvod === "poskozeny-dokument" && !("navstevnost" in poskozeny),
    "poškozený dokument se nevydává za nuly a nepřepisuje se",
  );

  const json = JSON.stringify(prazdne);
  assert(
    !json.includes("etag") && !json.includes("token") && !json.includes("BLOB") && !json.includes("whatsapp"),
    "výstup neobsahuje token, etag ani surový dokument",
  );
}

function testZapojeni(): void {
  const cteni = readFileSync(join("src", "lib", "brana", "analytika", "cteni-administrace.ts"), "utf8");
  const uloziste = readFileSync(join("src", "lib", "brana", "analytika", "uloziste.ts"), "utf8");
  const stranka = readFileSync(join("src", "app", "brana", "admin", "analytika", "page.tsx"), "utf8");
  const endpoint = readFileSync(join("src", "app", "api", "brana", "analytika", "route.ts"), "utf8");
  const zacatek = uloziste.indexOf("export async function nacistBranaAnalytikuKeCteni");
  const konec = uloziste.indexOf("export async function zalozitPrazdnouBranaAnalytikuVBlobu");
  const telo = uloziste.slice(zacatek, konec);

  assert(BRANA_ANALYTIKA_PRIJEM_ZAPNUT === true, "příjem analytiky je zapnutý");
  assert(
    cteni.indexOf("await jeAdminPrihlasen()") !== -1 &&
      cteni.indexOf("await jeAdminPrihlasen()") < cteni.indexOf("() => nacistBranaAnalytikuKeCteni()"),
    "administrativní čtení ověří přihlášení dřív než Blob",
  );
  assert(!telo.includes("put(") && !telo.includes("ifMatch") && !telo.includes("etag"), "čtení do Blobu nezapisuje ani nevrací etag");
  assert(
    stranka.includes("nacistPodkladyGrafuProAdministraci") &&
      stranka.includes("BranaAdminVylouceniZarizeni") &&
      !stranka.includes("sestavitPodkladyGrafu"),
    "stránka čte podklady přes chráněné čtení a výpočty neopakuje",
  );
  assert(!endpoint.includes("grafy") && !endpoint.includes("cteni-administrace"), "veřejný endpoint grafy nevydává");
}

async function main(): Promise<void> {
  testObdobi();
  testRokANuly();
  testRady();
  testStarsiAPrazdne();
  await testCteni();
  testZapojeni();

  if (selhalo > 0) {
    console.error(`Podklady grafů: ${selhalo} selhalo.`);
    process.exit(1);
  }
  console.log("Podklady grafů BRÁNY: všechno sedí.");
}

void main();
