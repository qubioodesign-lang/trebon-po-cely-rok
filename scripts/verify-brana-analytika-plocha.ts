/**
 * Analytika nabídky Přidat na plochu. Bez produkčního Blob zápisu.
 * Spuštění: npx tsx scripts/verify-brana-analytika-plocha.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { dnesVPraze, okamzikZPrahy, pridatDny } from "../src/lib/brana/cas";
import { sestavitPodkladyGrafu } from "../src/lib/brana/analytika/grafy";
import {
  aplikovatDavkuAnalytiky,
  isoDenZData,
  parsovatDokumentAnalytiky,
  prazdnyDenAnalytiky,
  prazdnyDokumentAnalytiky,
  validovatDavkuAnalytiky,
  type BranaAnalytikaDen,
  type BranaAnalytikaDokument,
} from "../src/lib/brana/analytika/model";
import {
  maSePocitatNabidkaPlochy,
  odeslatPlochuBezPreruseni,
  odeslatUdalostPlochy,
  smiOdeslatZobrazeniPlochy,
} from "../src/lib/brana/analytika/odeslani-navstevy";
import {
  nastavitBranaVylouceniAnalytiky,
  type BranaVylouceniUloziste,
} from "../src/lib/brana/analytika/vylouceni-zarizeni";

const CAS = okamzikZPrahy(2026, 1, 15, 12, 0);
const DEN = isoDenZData(dnesVPraze(CAS));

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

function dokument(dny: Record<string, BranaAnalytikaDen>): BranaAnalytikaDokument {
  return { verze: 1, dny };
}

function testStarsiSouhrn(): void {
  const surovy = prazdnyDenAnalytiky();
  surovy.navstevy = 4;
  surovy.proklikTrebon = 2;
  delete (surovy as { plochaZobrazeni?: number }).plochaZobrazeni;
  delete (surovy as { plochaKlik?: number }).plochaKlik;
  delete (surovy as { plochaZavreni?: number }).plochaZavreni;
  const nacteny = parsovatDokumentAnalytiky({ verze: 1, dny: { [DEN]: surovy } });
  const den = nacteny?.dny[DEN];
  assert(nacteny !== null && den?.navstevy === 4 && den.proklikTrebon === 2, "A starší souhrn bez polí plochy zůstane");
  assert(
    den?.plochaZobrazeni === 0 && den.plochaKlik === 0 && den.plochaZavreni === 0,
    "A chybějící počty plochy jsou nula",
  );

  const poskozeny = prazdnyDenAnalytiky();
  (poskozeny as { plochaKlik: number }).plochaKlik = -1;
  assert(
    parsovatDokumentAnalytiky({ verze: 1, dny: { [DEN]: poskozeny } }) === null,
    "A záporný počet plochy souhrn odmítne",
  );
}

function testNavstevySeNemeni(): void {
  const po = aplikovatDavkuAnalytiky(
    prazdnyDokumentAnalytiky(),
    [
      { typ: "plochaZobrazeni" },
      { typ: "plochaKlik" },
      { typ: "plochaZavreni" },
    ],
    CAS,
  );
  const den = po.dny[DEN];
  assert(den?.navstevy === 0 && den.novi === 0 && den.vracejici === 0, "B události plochy nezvýší návštěvy");
  assert(
    den?.plochaZobrazeni === 1 && den.plochaKlik === 1 && den.plochaZavreni === 1,
    "B každá událost zvýší jen svůj počet",
  );
  assert(po.zarizeniMereniOd === null, "B událost plochy nezaloží měření zařízení");

  const cizi = validovatDavkuAnalytiky({
    udalosti: [{ typ: "plochaKlik", navstevnik: "novy" }],
  });
  assert(!cizi.ok, "B cizí údaj v události plochy se odmítne");
}

function uloziste(hodnota: string | null): BranaVylouceniUloziste {
  const data = new Map<string, string>();
  if (hodnota !== null) {
    data.set("brana_vyloucit_analytiku", hodnota);
  }
  return {
    getItem: (klic) => data.get(klic) ?? null,
    setItem: (klic, dalsi) => {
      data.set(klic, dalsi);
    },
    removeItem: (klic) => {
      data.delete(klic);
    },
  };
}

async function sUlozistem<T>(
  hodnota: string | null,
  akce: () => Promise<T>,
): Promise<T> {
  const popis = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: uloziste(hodnota),
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

async function testVylouceniASelhani(): Promise<void> {
  const vyloucene = uloziste("1");
  assert(nastavitBranaVylouceniAnalytiky(true, vyloucene).ok, "C vyloučení se nastaví");
  await sUlozistem("1", async () => {
    let volani = 0;
    const vysledek = await odeslatUdalostPlochy("plochaKlik", async () => {
      volani += 1;
      return { ok: true, status: 200 };
    });
    assert(vysledek.pokusu === 0 && volani === 0, "C vyloučené zařízení nic neodešle");
  });

  const pad = await odeslatUdalostPlochy("plochaZobrazeni", async () => {
    throw new Error("síť");
  });
  assert(pad.pokusu === 1 && pad.odeslano === false, "G neúspěšný POST se neopakuje a nevyhodí se ven");

  let dialog = false;
  try {
    void odeslatUdalostPlochy("plochaKlik", async () => {
      throw new Error("síť");
    }).catch(() => undefined);
    dialog = true;
  } catch {
    dialog = false;
  }
  assert(dialog, "G selhání odeslání nezastaví následující instalační krok");

  let dialogPoVyjimce = false;
  let odeslanoPriVyjimce = 0;
  odeslatPlochuBezPreruseni(
    "plochaKlik",
    "PROMPT",
    () => {
      throw new Error("rozpoznani prostredi");
    },
    async () => {
      odeslanoPriVyjimce += 1;
      return { ok: true, status: 200 };
    },
  );
  dialogPoVyjimce = true;
  assert(
    dialogPoVyjimce && odeslanoPriVyjimce === 0,
    "výjimka rozpoznání prostředí nezastaví instalaci a nic neodešle",
  );
}

function testRozliseni(): void {
  assert(smiOdeslatZobrazeniPlochy(false, true), "D první zobrazení se smí odeslat");
  assert(!smiOdeslatZobrazeniPlochy(true, true), "D druhé zobrazení téhož načtení se neodesílá");
  assert(!smiOdeslatZobrazeniPlochy(false, false), "D nepočítaná nabídka se neodesílá");

  assert(!maSePocitatNabidkaPlochy(true, "PROMPT"), "E facebookové klepnutí se nepočítá");
  assert(!maSePocitatNabidkaPlochy(true, "ZATIM_NEDOSTUPNA"), "E facebooková nabídka bez dialogu se nepočítá");
  assert(!maSePocitatNabidkaPlochy(true, "IOS_INSTALACE"), "E facebook na iOS se touto cestou nepočítá");
  assert(!maSePocitatNabidkaPlochy(false, "CHROME_INTENT"), "E přechod do Chromu se nepočítá");

  assert(maSePocitatNabidkaPlochy(false, "PROMPT"), "F Chrome po Facebooku i přímý Chrome se počítá");
  assert(maSePocitatNabidkaPlochy(false, "ZATIM_NEDOSTUPNA"), "F Chrome bez připraveného dialogu se počítá");
  assert(maSePocitatNabidkaPlochy(false, "IOS_INSTALACE"), "F iOS návod se počítá");
}

function testZdrojInstalace(): void {
  const zdroj = readFileSync(join("src", "components", "brana", "BranaVyzvaPlocha.tsx"), "utf8");
  const prompt = zdroj.slice(
    zdroj.indexOf('if (okamzita.typ === "PROMPT")'),
    zdroj.indexOf('if (okamzita.typ === "IOS_INSTALACE")'),
  );
  const ios = zdroj.slice(
    zdroj.indexOf('if (okamzita.typ === "IOS_INSTALACE")'),
    zdroj.indexOf('if (okamzita.typ === "CHROME_INTENT")'),
  );
  const prechod = zdroj.slice(
    zdroj.indexOf('if (okamzita.typ === "CHROME_INTENT")'),
    zdroj.indexOf("jeFacebookNaAndroidu() &&"),
  );
  const facebook = zdroj.slice(
    zdroj.indexOf("jeFacebookNaAndroidu() &&"),
    zdroj.indexOf('odeslatRozhodnutiPlochy("plochaKlik", "ZATIM_NEDOSTUPNA")'),
  );

  assert(
    prompt.includes('odeslatRozhodnutiPlochy("plochaKlik", okamzita.typ)') &&
      !prompt.includes("await odeslat") &&
      !prompt.includes("jeFacebookNaAndroidu()") &&
      prompt.indexOf("odeslatRozhodnutiPlochy") < prompt.indexOf("await vyvolatInstalacniDialog"),
    "H před systémovým dialogem není await analytiky",
  );
  assert(ios.includes("otevritBranaIosInstalacniObrazovku"), "I iOS větev otevírá návod");
  assert(
    prechod.includes("window.location.href = okamzita.url") && !prechod.includes("odeslatPlochu"),
    "I přechod do Chromu zůstává bez analytiky",
  );
  assert(
    facebook.includes("otevritFacebookInstalacniVrstvu();") && !facebook.includes("odeslatPlochu"),
    "E facebooková vrstva se neodesílá",
  );
  assert(zdroj.includes("BRANA_PRIPRAVA_MAX_MS"), "I čekání na přípravu dialogu zůstalo");
  assert(!zdroj.includes("otevrenoVChromu"), "F Chrome po Facebooku nemá zvláštní čítač");

  const instalace = readFileSync(join("src", "lib", "brana", "pwa-instalace.ts"), "utf8");
  assert(!instalace.includes("plocha"), "I pwa-instalace.ts se měřením nemění");
}

function testObdobiGrafu(): void {
  const dny = {
    [DEN]: denS((den) => {
      den.navstevy = 10;
      den.plochaZobrazeni = 4;
      den.plochaKlik = 2;
      den.plochaZavreni = 1;
    }),
    [posun(DEN, -3)]: denS((den) => {
      den.navstevy = 5;
      den.plochaKlik = 1;
    }),
    [posun(DEN, -20)]: denS((den) => {
      den.navstevy = 8;
      den.plochaKlik = 4;
    }),
    [posun(DEN, -60)]: denS((den) => {
      den.navstevy = 2;
      den.plochaKlik = 2;
    }),
    [posun(DEN, -200)]: denS((den) => {
      den.navstevy = 1;
      den.plochaKlik = 3;
    }),
  };

  const tyden = sestavitPodkladyGrafu(dokument(dny), CAS, 7);
  const mesic = sestavitPodkladyGrafu(dokument(dny), CAS, 30);
  const ctvrt = sestavitPodkladyGrafu(dokument(dny), CAS, 90);
  const rok = sestavitPodkladyGrafu(dokument(dny), CAS, 365);

  assert(tyden.plocha.soucetKlik === 3 && tyden.navstevnost.soucet === 15, "J sedm dní sčítá jen své dny");
  assert(tyden.plocha.podilKlikNaNavstevy === 20, "J podíl je 100 × klepnutí / návštěvy téhož období");
  assert(mesic.plocha.soucetKlik === 7 && mesic.navstevnost.soucet === 23, "J třicet dní přidá starší den");
  assert(ctvrt.plocha.soucetKlik === 9 && ctvrt.plocha.podilKlikNaNavstevy === 36, "J devadesát dní má vlastní podíl");
  assert(rok.plocha.soucetKlik === 12 && rok.navstevnost.soucet === 26, "J rok sečte všechny uložené dny");
  assert(tyden.plocha.soucetZobrazeni === 4 && tyden.plocha.soucetZavreni === 1, "J zobrazení a křížek jsou samostatné");

  const pres = sestavitPodkladyGrafu(
    dokument({
      [DEN]: denS((den) => {
        den.navstevy = 2;
        den.plochaKlik = 5;
      }),
    }),
    CAS,
    7,
  );
  assert(pres.plocha.podilKlikNaNavstevy === 250, "J podíl smí být nad 100 procent");

  const nula = sestavitPodkladyGrafu(prazdnyDokumentAnalytiky(), CAS, 30);
  assert(nula.plocha.podilKlikNaNavstevy === null, "J nula návštěv nedá procento");
}

async function main(): Promise<void> {
  testStarsiSouhrn();
  testNavstevySeNemeni();
  await testVylouceniASelhani();
  testRozliseni();
  testZdrojInstalace();
  testObdobiGrafu();

  if (selhalo > 0) {
    console.error(`Selhalo ${selhalo} kontrol.`);
    process.exit(1);
  }
  console.log("Analytika plochy: všechno sedí.");
}

void main();
