/**
 * Stisk sdílení BRÁNY. Bez produkčního Blob zápisu.
 * Spuštění: npx tsx scripts/verify-brana-analytika-sdileni.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { BlobPreconditionFailedError } from "@vercel/blob";
import { BRANA_SDILENA_ADRESA, sdiletBrana } from "../src/lib/brana/sdileni";
import { obslouzitStiskSdileni } from "../src/lib/brana/analytika/sdileni-klik";
import { zaznamenatKlikSdileniVOkne } from "../src/lib/brana/analytika/napojeni-navstevy";
import {
  BRANA_ANALYTIKA_PRIJEM_ZAPNUT,
  aplikovatDavkuAnalytiky,
  isoDenZData,
  prazdnyDenAnalytiky,
  prazdnyDokumentAnalytiky,
  validovatDavkuAnalytiky,
  type BranaAnalytikaDokument,
} from "../src/lib/brana/analytika/model";
import {
  BRANA_ANALYTIKA_ODESLANI_CESTA,
  odeslatKlikSdileni,
  type BranaAnalytikaPozadavek,
} from "../src/lib/brana/analytika/odeslani-navstevy";
import { KLIC_BRANA_VYLOUCIT_ANALYTIKU } from "../src/lib/brana/analytika/vylouceni-zarizeni";
import {
  BranaAnalytikaUzExistujeError,
  zaznamenatDavkuAnalytiky,
  type BranaAnalytikaIo,
} from "../src/lib/brana/analytika/zapis";
import { dnesVPraze } from "../src/lib/brana/cas";

const CAS = new Date("2026-10-17T08:00:00.000Z");
const DEN = isoDenZData(dnesVPraze(CAS));
const ADRESA = "https://brana.example/brana/zitra?x=1";

let selhalo = 0;

function assert(ok: boolean, popis: string): void {
  if (ok) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhalo += 1;
  console.error(`FAIL ${popis}`);
}

function dokumentSeSdilenim(sdileniKlik: number, navstevy = 0): BranaAnalytikaDokument {
  const den = prazdnyDenAnalytiky();
  den.sdileniKlik = sdileniKlik;
  den.navstevy = navstevy;
  return { verze: 1, dny: { [DEN]: den } };
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

async function sUlozistem<T>(
  data: Map<string, string>,
  akce: () => Promise<T>,
): Promise<T> {
  const popis = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const uloziste = {
    getItem: (klic: string) => data.get(klic) ?? null,
    setItem: (klic: string, hodnota: string) => {
      data.set(klic, hodnota);
    },
    removeItem: (klic: string) => {
      data.delete(klic);
    },
  };
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

async function sProhlizecem<T>(
  navigator: Record<string, unknown>,
  akce: () => Promise<T>,
  href = ADRESA,
): Promise<T> {
  const okno = Object.getOwnPropertyDescriptor(globalThis, "window");
  const puvodni = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { href } },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: navigator,
  });
  try {
    return await akce();
  } finally {
    if (okno) {
      Object.defineProperty(globalThis, "window", okno);
    } else {
      delete (globalThis as { window?: unknown }).window;
    }
    if (puvodni) {
      Object.defineProperty(globalThis, "navigator", puvodni);
    } else {
      delete (globalThis as { navigator?: unknown }).navigator;
    }
  }
}

async function testStisky(): Promise<void> {
  let zapisy = 0;
  let sdileni = 0;
  const zaznamenat = () => {
    zapisy += 1;
    return Promise.resolve();
  };
  const sdilet = async () => {
    sdileni += 1;
    return "sdileno" as const;
  };

  await obslouzitStiskSdileni({ prijima: true, sdilet, zaznamenat });
  assert(zapisy === 1 && sdileni === 1, "jeden stisk je jedna událost a jedno sdílení");

  await obslouzitStiskSdileni({ prijima: true, sdilet, zaznamenat });
  assert(zapisy === 2 && sdileni === 2, "opakovaný stisk je další událost");
}

async function testNecekaNaAnalytiku(): Promise<void> {
  let sdileniZacalo = false;
  let uvolnit: () => void = () => {};
  const cekani = new Promise<void>((resolve) => {
    uvolnit = resolve;
  });
  const beh = obslouzitStiskSdileni({
    prijima: true,
    zaznamenat: () => cekani,
    sdilet: async () => {
      sdileniZacalo = true;
      return "sdileno";
    },
  });
  assert(sdileniZacalo, "sdílení nečeká na odeslání analytiky");
  uvolnit();
  await beh;
}

async function testZruseniAVysledkySdileni(): Promise<void> {
  const volani: Array<{ title?: string; url?: string }> = [];
  const schranka: string[] = [];

  let zapisy = 0;
  await obslouzitStiskSdileni({
    prijima: true,
    zaznamenat: () => {
      zapisy += 1;
    },
    sdilet: async () => {
      throw new DOMException("zrušeno", "AbortError");
    },
  });
  assert(zapisy === 1, "zrušení nabídky už započítaný stisk nemění");

  const sdileno = await sProhlizecem(
    {
      share: async (data: { title?: string; url?: string }) => {
        volani.push(data);
      },
      clipboard: { writeText: async (text: string) => {
        schranka.push(text);
      } },
    },
    () => sdiletBrana(),
  );
  assert(sdileno === "sdileno" && volani.length === 1, "systémové sdílení se dokončí jako dřív");
  assert(
    volani[0]?.title === "BRÁNA do Třeboně" && volani[0]?.url === BRANA_SDILENA_ADRESA,
    "titulek zůstal a adresa je vždy Dnes",
  );
  assert(schranka.length === 0, "úspěšné sdílení schránku nevolá");

  schranka.length = 0;
  let zruseno = false;
  try {
    await sProhlizecem(
      {
        share: async () => {
          throw new DOMException("zrušeno", "AbortError");
        },
        clipboard: { writeText: async (text: string) => {
          schranka.push(text);
        } },
      },
      () => sdiletBrana(),
    );
  } catch (error) {
    zruseno = error instanceof DOMException && error.name === "AbortError";
  }
  assert(zruseno && schranka.length === 0, "zrušení nabídky nespustí kopírování");

  const zaloha = await sProhlizecem(
    {
      share: async () => {
        throw new DOMException("nelze", "NotAllowedError");
      },
      clipboard: { writeText: async (text: string) => {
        schranka.push(text);
      } },
    },
    () => sdiletBrana(),
  );
  assert(zaloha === "zkopirovano" && schranka.at(-1) === BRANA_SDILENA_ADRESA, "jiná chyba nabídky zkopíruje pevnou adresu Dnes");

  const zkopirovano = await sProhlizecem(
    {
      clipboard: { writeText: async (text: string) => {
        schranka.push(text);
      } },
    },
    () => sdiletBrana(),
  );
  assert(
    zkopirovano === "zkopirovano" && schranka.at(-1) === BRANA_SDILENA_ADRESA,
    "bez systémového sdílení se zkopíruje pevná adresa Dnes",
  );

  const pohledy = [
    "https://www.trebonpocelyrok.cz/brana",
    "https://www.trebonpocelyrok.cz/brana/zitra?pozadi=2",
    "https://www.trebonpocelyrok.cz/brana/vikend?z=qr",
    "https://www.trebonpocelyrok.cz/brana/7-dni?zdroj=desktop-qr",
    "https://brana.trebonpocelyrok.cz/vyhled?z=wa",
  ];
  for (const href of pohledy) {
    const sdilenoZPohledu = await sProhlizecem(
      {
        share: async (data: { title?: string; url?: string }) => {
          volani.push(data);
        },
      },
      () => sdiletBrana(),
      href,
    );
    assert(
      sdilenoZPohledu === "sdileno" &&
        volani.at(-1)?.url === BRANA_SDILENA_ADRESA &&
        volani.at(-1)?.title === "BRÁNA do Třeboně" &&
        !volani.at(-1)?.url?.includes("desktop-qr") &&
        volani.at(-1)?.url !== href,
      "každý pohled sdílí stejnou adresu Dnes bez původních parametrů",
    );
  }
}

async function testVypnutoAVylouceniASelhani(): Promise<void> {
  let zapisy = 0;
  let sdileni = 0;
  await obslouzitStiskSdileni({
    prijima: false,
    zaznamenat: () => {
      zapisy += 1;
    },
    sdilet: async () => {
      sdileni += 1;
      return "zkopirovano";
    },
  });
  assert(zapisy === 0 && sdileni === 1, "vypnutá analytika stisk neodešle a sdílení nechá");
  const vypnuteOkno = await zaznamenatKlikSdileniVOkne();
  assert(vypnuteOkno.pokusu === 0 && !vypnuteOkno.odeslano, "vypnuté okno sdílení požadavek nevytvoří");

  let hozeno = false;
  await obslouzitStiskSdileni({
    prijima: true,
    zaznamenat: () => {
      throw new Error("analytika selhala");
    },
    sdilet: async () => {
      sdileni += 1;
      return "sdileno";
    },
  });
  await obslouzitStiskSdileni({
    prijima: true,
    zaznamenat: () => Promise.reject(new Error("síť")),
    sdilet: async () => {
      sdileni += 1;
      return "sdileno";
    },
  }).catch(() => {
    hozeno = true;
  });
  assert(!hozeno && sdileni === 3, "chyba analytiky sdílení nezmění a nevyhodí");

  const tela: unknown[] = [];
  await sUlozistem(new Map(), async () => {
    const prvni = await odeslatKlikSdileni(async (_adresa, pozadavek) => {
      tela.push(JSON.parse(pozadavek.body));
      return { ok: true };
    });
    const druhy = await odeslatKlikSdileni(async (_adresa, pozadavek) => {
      tela.push(JSON.parse(pozadavek.body));
      return { ok: true };
    });
    assert(prvni.pokusu === 1 && druhy.pokusu === 1, "každý stisk je samostatné odeslání");
    assert(
      JSON.stringify(tela[0]) === JSON.stringify({ udalosti: [{ typ: "sdileni" }] }) &&
        JSON.stringify(tela[1]) === JSON.stringify(tela[0]),
      "odesílá se jen typ sdílení, dvakrát",
    );
  });

  const vyloucene = new Map<string, string>([[KLIC_BRANA_VYLOUCIT_ANALYTIKU, "1"]]);
  await sUlozistem(vyloucene, async () => {
    const volani: BranaAnalytikaPozadavek[] = [];
    const vysledek = await odeslatKlikSdileni(async (_adresa, pozadavek) => {
      volani.push(pozadavek);
      return { ok: true };
    });
    assert(vysledek.pokusu === 0 && volani.length === 0, "vyloučené zařízení požadavek neodešle");
    assert(vyloucene.get(KLIC_BRANA_VYLOUCIT_ANALYTIKU) === "1", "vyloučení se odesláním nemění");
  });

  await sUlozistem(new Map(), async () => {
    let pokusu = 0;
    const vysledek = await odeslatKlikSdileni(async () => {
      pokusu += 1;
      throw new Error("síť");
    });
    assert(vysledek.pokusu === 1 && vysledek.odeslano === false && pokusu === 1, "neúspěch se neopakuje");
  });
}

async function testDenAStarsiUdalosti(): Promise<void> {
  const prazdny = pamet(null);
  const prvni = await zaznamenatDavkuAnalytiky(
    { udalosti: [{ typ: "sdileni" }] },
    prazdny.io,
    CAS,
    "trebonsko",
  );
  const druhy = await zaznamenatDavkuAnalytiky(
    { udalosti: [{ typ: "sdileni" }] },
    prazdny.io,
    CAS,
    "trebonsko",
  );
  const den = prazdny.stav.dokument?.dny[DEN];
  assert(prvni.ok && druhy.ok && den?.sdileniKlik === 2, "dva stisky dají denní součet 2");
  assert(den?.navstevy === 0 && den.oblast.trebonsko === 0, "stisk nemění návštěvy ani oblast");
  assert(den?.pohledy.dnes.prvni === 0 && den.prochazeni.dnes.delsi === 0, "stisk nemění pohledy ani procházení");
  assert(den?.zdroje.sdileni === 0 && den.konecObsahu.vikend === 0, "stisk není příchod ani starý konec obsahu");

  const starsi = pamet(dokumentSeSdilenim(2, 4));
  const navsteva = await zaznamenatDavkuAnalytiky(
    { udalosti: [{ typ: "navsteva", spusteni: "prohlizec" }] },
    starsi.io,
    CAS,
  );
  assert(
    navsteva.ok &&
      starsi.stav.dokument?.dny[DEN]?.navstevy === 5 &&
      starsi.stav.dokument.dny[DEN]?.sdileniKlik === 2,
    "starší návštěva přičte návštěvu a sdílení nechá",
  );
  const klik = await zaznamenatDavkuAnalytiky(
    { udalosti: [{ typ: "sdileni" }] },
    starsi.io,
    CAS,
  );
  assert(
    klik.ok && starsi.stav.dokument?.dny[DEN]?.sdileniKlik === 3 && starsi.stav.dokument.dny[DEN]?.navstevy === 5,
    "nový stisk zvýší jen uložený součet sdílení",
  );

  const odmitnute = [
    { udalosti: [{ typ: "sdileni", url: ADRESA }] },
    { udalosti: [{ typ: "sdileni", aplikace: "ios" }] },
    { udalosti: [{ typ: "sdileni", navstevnikId: "a" }] },
  ];
  assert(
    odmitnute.every((telo) => !validovatDavkuAnalytiky(telo).ok),
    "adresa, aplikace a identifikátor se odmítnou",
  );

  const plny = dokumentSeSdilenim(Number.MAX_SAFE_INTEGER);
  const ochrana = pamet(plny);
  let hodilo = false;
  try {
    await zaznamenatDavkuAnalytiky({ udalosti: [{ typ: "sdileni" }] }, ochrana.io, CAS);
  } catch {
    hodilo = true;
  }
  assert(
    hodilo && ochrana.stav.zapisy === 0 && ochrana.stav.dokument?.dny[DEN]?.sdileniKlik === Number.MAX_SAFE_INTEGER,
    "přetečení součet neuloží",
  );

  const jenNavsteva = aplikovatDavkuAnalytiky(
    prazdnyDokumentAnalytiky(),
    [{ typ: "navsteva" }],
    CAS,
  );
  assert(jenNavsteva.dny[DEN]?.sdileniKlik === 0 && jenNavsteva.dny[DEN]?.navstevy === 1, "starší událost návštěvy zůstává platná");
}

function testZdroje(): void {
  assert(BRANA_ANALYTIKA_PRIJEM_ZAPNUT === false, "příjem zůstává vypnutý");

  const tlacitko = readFileSync(
    join("src", "components", "brana", "BranaTlacitkoSdileni.tsx"),
    "utf8",
  );
  const sdileni = readFileSync(join("src", "lib", "brana", "sdileni.ts"), "utf8");
  const klik = readFileSync(join("src", "lib", "brana", "analytika", "sdileni-klik.ts"), "utf8");
  const galerie = [
    join("src", "lib", "sdileni.ts"),
    join("src", "components", "OdkazSdilet.tsx"),
    join("src", "lib", "analytics.ts"),
    join("src", "app", "api", "metriky", "route.ts"),
    join("src", "app", "page.tsx"),
  ].map((cesta) => readFileSync(cesta, "utf8")).join("\n");

  const kontrola = tlacitko.indexOf("if (!BRANA_ANALYTIKA_PRIJEM_ZAPNUT)");
  const dynamicky = tlacitko.indexOf("import(");
  assert(kontrola !== -1 && dynamicky !== -1 && kontrola < dynamicky, "vypnutí skončí před načtením odeslání");
  assert(
    tlacitko.includes("analytika/napojeni-navstevy") && !tlacitko.includes("odeslani-navstevy"),
    "tlačítko nenačítá odeslání napřímo",
  );
  assert(tlacitko.includes("sdilet: () => sdiletBrana()"), "tlačítko volá původní sdílení");
  assert(tlacitko.includes('aria-label="Sdílet"'), "tlačítko zůstalo na svém místě a se stejným popiskem");
  assert(!tlacitko.includes("localStorage") && !tlacitko.includes("document.cookie"), "tlačítko nečte úložiště ani cookie");
  assert(
    !sdileni.includes("analytika") &&
      !sdileni.includes("window.location.href") &&
      sdileni.includes(BRANA_SDILENA_ADRESA),
    "funkce sdílení má jen pevnou adresu a analytiku nečte",
  );
  assert(sdileni.includes('const title = "BRÁNA do Třeboně"'), "titulek sdílení zůstal");
  assert(!klik.includes("fetch(") && !klik.includes("localStorage"), "obsluha stisku sama nic neodesílá");
  assert(!galerie.includes("odeslatKlikSdileni") && !galerie.includes("sdileni-klik"), "galerie měření BRÁNY nemá");
  assert(BRANA_ANALYTIKA_ODESLANI_CESTA === "/api/brana/analytika", "sdílení používá existující endpoint");
}

async function main(): Promise<void> {
  await testStisky();
  await testNecekaNaAnalytiku();
  await testZruseniAVysledkySdileni();
  await testVypnutoAVylouceniASelhani();
  await testDenAStarsiUdalosti();
  testZdroje();

  if (selhalo > 0) {
    console.error(`Sdílení BRÁNY: ${selhalo} selhalo.`);
    process.exit(1);
  }
  console.log("Sdílení BRÁNY: všechno sedí.");
}

void main();
