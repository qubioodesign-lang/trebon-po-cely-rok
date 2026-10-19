/**
 * Základ analytiky BRÁNY. Bez produkčního Blob zápisu.
 * Spuštění: npx tsx scripts/verify-brana-analytika-zaklad.ts
 */

import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { BlobPreconditionFailedError } from "@vercel/blob";
import { BRANA_ZALOHA_SOUBORY } from "../src/lib/brana/admin/zaloha/typy";
import {
  BRANA_ANALYTIKA_BLOB_CESTA,
  BRANA_ANALYTIKA_MAX_DNU,
  BRANA_ANALYTIKA_MAX_UDALOSTI,
  BRANA_ANALYTIKA_PRIJEM_ZAPNUT,
  aplikovatDavkuAnalytiky,
  isoDenZData,
  validovatDavkuAnalytiky,
  parsovatDokumentAnalytiky,
  prazdnyDenAnalytiky,
  prazdnyDokumentAnalytiky,
} from "../src/lib/brana/analytika/model";
import { vytvoritOdpovedPrijmu } from "../src/lib/brana/analytika/prijem";
import { dnesVPraze, pridatDny } from "../src/lib/brana/cas";
import {
  BranaAnalytikaKonfliktError,
  BranaAnalytikaUlozisteError,
  BranaAnalytikaUzExistujeError,
  zalozitPrazdnouAnalytiku,
  zaznamenatDavkuAnalytiky,
  type BranaAnalytikaCteni,
  type BranaAnalytikaIo,
} from "../src/lib/brana/analytika/zapis";
import type { BranaAnalytikaDokument } from "../src/lib/brana/analytika/model";

const CAS = new Date("2026-10-16T10:00:00.000Z");
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

function klon<T>(hodnota: T): T {
  return JSON.parse(JSON.stringify(hodnota)) as T;
}

function dokumentSNavstevou(navstevy: number, sdileniKlik = 0): BranaAnalytikaDokument {
  const den = prazdnyDenAnalytiky();
  den.navstevy = navstevy;
  den.sdileniKlik = sdileniKlik;
  return { verze: 1, dny: { [DEN]: den } };
}

type Pamat = {
  dokument: BranaAnalytikaDokument | null;
  etag: number;
  zapisy: number;
  zalozeni: number;
  etagyZapisu: string[];
  cteni: number;
  kalendar: { polozek: number };
};

function vytvoritPamat(pocatek: BranaAnalytikaDokument | null): Pamat {
  return {
    dokument: pocatek ? klon(pocatek) : null,
    etag: pocatek ? 1 : 0,
    zapisy: 0,
    zalozeni: 0,
    etagyZapisu: [],
    cteni: 0,
    kalendar: { polozek: 7 },
  };
}

function ioZPameti(pamat: Pamat): BranaAnalytikaIo {
  return {
    nacist: async () => {
      pamat.cteni += 1;
      if (!pamat.dokument) {
        return { stav: "neexistuje" };
      }
      const cteni: BranaAnalytikaCteni = {
        stav: "ok",
        dokument: klon(pamat.dokument),
        etag: String(pamat.etag),
      };
      return cteni;
    },
    zalozit: async (dokument) => {
      if (pamat.dokument) {
        throw new BranaAnalytikaUzExistujeError();
      }
      pamat.dokument = klon(dokument);
      pamat.etag = 1;
      pamat.zalozeni += 1;
    },
    ulozit: async (dokument, etag) => {
      if (!pamat.dokument) {
        throw new Error("zápis bez existujícího souboru");
      }
      if (etag !== String(pamat.etag)) {
        throw new BlobPreconditionFailedError();
      }
      pamat.etagyZapisu.push(etag);
      pamat.dokument = klon(dokument);
      pamat.etag += 1;
      pamat.zapisy += 1;
    },
  };
}

function davka(pocet: number, typ: string = "navsteva") {
  return { udalosti: Array.from({ length: pocet }, () => ({ typ })) };
}

async function testSdkIfMatch(): Promise<void> {
  const dist = join("node_modules", "@vercel", "blob", "dist");
  const indexJs = readFileSync(join(dist, "index.js"), "utf8");
  const typy = readFileSync(join(dist, "index.d.ts"), "utf8");
  const chunk = readdirSync(dist).find(
    (nazev) => nazev.startsWith("chunk-") && nazev.endsWith(".js"),
  );
  assert(Boolean(chunk), "v balíčku je implementační chunk");
  const chunkJs = chunk ? readFileSync(join(dist, chunk), "utf8") : "";

  assert(typy.includes("ifMatch?: string"), "typy SDK obsahují ifMatch");
  assert(
    typy.includes("class BlobPreconditionFailedError"),
    "SDK exportuje BlobPreconditionFailedError",
  );
  assert(indexJs.includes('"ifMatch"'), "put v SDK má ifMatch mezi povolenými volbami");
  assert(
    chunkJs.includes('ifMatch: "x-if-match"'),
    "SDK posílá ifMatch jako hlavičku x-if-match",
  );
  assert(
    chunkJs.includes('case "precondition_failed"'),
    "SDK mapuje precondition_failed na BlobPreconditionFailedError",
  );
}

async function testOdmitnuti(): Promise<void> {
  const pamat = vytvoritPamat(dokumentSNavstevou(4, 2));
  const pred = klon(pamat.dokument);

  const neznama = await zaznamenatDavkuAnalytiky(
    { udalosti: [{ typ: "scroll" }] },
    ioZPameti(pamat),
    CAS,
  );
  const smisena = await zaznamenatDavkuAnalytiky(
    { udalosti: [{ typ: "navsteva" }, { typ: "navsteva", navstevnikId: "x" }] },
    ioZPameti(pamat),
    CAS,
  );
  const velka = await zaznamenatDavkuAnalytiky(
    davka(BRANA_ANALYTIKA_MAX_UDALOSTI + 1),
    ioZPameti(pamat),
    CAS,
  );
  const prazdna = await zaznamenatDavkuAnalytiky(
    { udalosti: [] },
    ioZPameti(pamat),
    CAS,
  );

  assert(!neznama.ok, "neznámá událost se odmítne");
  assert(!smisena.ok, "událost s cizím polem se odmítne");
  assert(!velka.ok, "dávka nad limit se odmítne");
  assert(!prazdna.ok, "prázdná dávka se odmítne");
  assert(pamat.zapisy === 0, "odmítnutá dávka nezapisuje");
  assert(
    JSON.stringify(pamat.dokument) === JSON.stringify(pred),
    "odmítnutá dávka nezmění uložený den",
  );
  assert(pamat.kalendar.polozek === 7, "odmítnutí nesáhne na cizí objekt");
}

async function testSoubeh(): Promise<void> {
  const pamat = vytvoritPamat(dokumentSNavstevou(5, 3));
  let prvniZapis = true;
  const io = ioZPameti(pamat);
  const puvodniUlozit = io.ulozit;

  io.ulozit = async (dokument, etag) => {
    if (prvniZapis) {
      prvniZapis = false;
      const soucasny = pamat.dokument;
      if (!soucasny) {
        throw new Error("chybí výchozí dokument");
      }
      const den = soucasny.dny[DEN];
      soucasny.dny[DEN] = { ...den, navstevy: den.navstevy + 1 };
      pamat.etag += 1;
      throw new BlobPreconditionFailedError();
    }
    await puvodniUlozit(dokument, etag);
  };

  const vysledek = await zaznamenatDavkuAnalytiky(davka(1), io, CAS);
  const den = pamat.dokument?.dny[DEN];

  assert(vysledek.ok, "zápis po konfliktu etag projde na další pokus");
  assert(den?.navstevy === 7, "oba přírůstky zůstanou: 5 + cizí 1 + vlastní 1");
  assert(den?.sdileniKlik === 3, "souběh nepřepíše ostatní čítače dne");
  assert(pamat.kalendar.polozek === 7, "souběh analytiky nemění cizí objekt");
}

async function testPoskozeniAVypadek(): Promise<void> {
  const poskozena: BranaAnalytikaCteni = {
    stav: "ok",
    dokument: { verze: 1, dny: { spatne: prazdnyDenAnalytiky() } },
    etag: "1",
  };
  let ulozeno = false;
  let hozeno = false;

  try {
    await zaznamenatDavkuAnalytiky(
      davka(1),
      {
        nacist: async () => poskozena,
        zalozit: async () => {
          ulozeno = true;
        },
        ulozit: async () => {
          ulozeno = true;
        },
      },
      CAS,
    );
  } catch (error) {
    hozeno = error instanceof BranaAnalytikaUlozisteError;
  }

  assert(hozeno, "poškozený dokument se odmítne uložit");
  assert(!ulozeno, "poškozený dokument se nepřepíše");

  const pamat = vytvoritPamat(dokumentSNavstevou(1, 1));
  const pred = klon(pamat.dokument);
  let vypadek = false;
  try {
    await zaznamenatDavkuAnalytiky(
      davka(1),
      {
        nacist: async () => ({
          stav: "ok",
          dokument: klon(pamat.dokument as BranaAnalytikaDokument),
          etag: "1",
        }),
        zalozit: async () => {
          throw new Error("založení se nemá volat");
        },
        ulozit: async () => {
          throw new Error("úložiště nedostupné");
        },
      },
      CAS,
    );
  } catch (error) {
    vypadek = error instanceof Error && error.message === "úložiště nedostupné";
  }

  assert(vypadek, "výpadek úložiště se vrátí jako chyba zápisu");
  assert(
    JSON.stringify(pamat.dokument) === JSON.stringify(pred),
    "při výpadku zůstane analytika v původním stavu",
  );
  assert(pamat.kalendar.polozek === 7, "výpadek analytiky nemění cizí objekt");
}

async function testNovySouborAOrez(): Promise<void> {
  const pamat = vytvoritPamat(null);
  const vysledek = await zaznamenatDavkuAnalytiky(davka(2), ioZPameti(pamat), CAS);
  assert(vysledek.ok, "první dávka doplní návštěvy až po založení");
  assert(pamat.zalozeni === 1, "chybějící soubor se založí jen jednou");
  assert(
    pamat.etagyZapisu.length === 1 && pamat.etagyZapisu[0] === "1",
    "následný zápis jde s etag pro ifMatch",
  );
  assert(pamat.dokument?.dny[DEN]?.navstevy === 2, "první dávka přičte návštěvy");
  assert(pamat.dokument?.dny[DEN]?.sdileniKlik === 0, "nepřičtený čítač zůstane nula");

  const stary = isoDenZData(
    pridatDny(dnesVPraze(CAS), -BRANA_ANALYTIKA_MAX_DNU),
  );
  const dokument = prazdnyDokumentAnalytiky();
  dokument.dny[stary] = prazdnyDenAnalytiky();
  dokument.dny[stary].sdileniKlik = 9;
  dokument.dny[DEN] = prazdnyDenAnalytiky();
  const orezany = aplikovatDavkuAnalytiky(dokument, [{ typ: "navsteva" }], CAS);

  assert(!(stary in orezany.dny), "den mimo okno se při zápisu neponechá");
  assert(orezany.dny[DEN]?.navstevy === 1, "aktuální den po ořezu zůstane");
  assert(
    parsovatDokumentAnalytiky(orezany)?.dny[DEN]?.navstevy === 1,
    "výsledek zápisu znovu projde kontrolou struktury",
  );
}

async function testZalozeni(): Promise<void> {
  const prazdna = vytvoritPamat(null);
  const zalozene = await zalozitPrazdnouAnalytiku(ioZPameti(prazdna));
  assert(zalozene.ok, "chybějící soubor se založí");
  assert(
    JSON.stringify(prazdna.dokument) ===
      JSON.stringify(prazdnyDokumentAnalytiky()),
    "založený dokument je verze 1 a prázdné dny",
  );
  assert(prazdna.zalozeni === 1, "založení proběhne jedním vložením");
  assert(prazdna.zapisy === 0, "založení nepoužije podmíněný přepis");

  const plna = vytvoritPamat(dokumentSNavstevou(4, 2));
  const pred = klon(plna.dokument);
  let vlozeni = 0;
  const existujici = await zalozitPrazdnouAnalytiku({
    ...ioZPameti(plna),
    zalozit: async () => {
      vlozeni += 1;
    },
  });
  assert(!existujici.ok && existujici.duvod === "existuje", "existující soubor se nezakládá znovu");
  assert(vlozeni === 0, "u existujícího souboru se vložení nezavolá");
  assert(
    JSON.stringify(plna.dokument) === JSON.stringify(pred),
    "existující návštěvy zůstanou",
  );

  const soubeh = vytvoritPamat(null);
  const io = ioZPameti(soubeh);
  const [prvni, druhy] = await Promise.all([
    zalozitPrazdnouAnalytiku(io),
    zalozitPrazdnouAnalytiku(io),
  ]);
  const uspechy = [prvni, druhy].filter((vysledek) => vysledek.ok).length;
  assert(uspechy === 1, "ze dvou souběžných založení projde jedno");
  assert(
    JSON.stringify(soubeh.dokument) === JSON.stringify(prazdnyDokumentAnalytiky()),
    "souběh ponechá prázdný dokument",
  );
  assert(soubeh.zalozeni === 1, "druhé založení soubor nepřepíše");

  const pamat = vytvoritPamat(null);
  let prepis = 0;
  let hozeno = false;
  try {
    await zaznamenatDavkuAnalytiky(
      davka(1),
      {
        nacist: async () => ({ stav: "neexistuje" }),
        zalozit: async () => {
          throw new Error("vložení selhalo");
        },
        ulozit: async () => {
          prepis += 1;
        },
      },
      CAS,
    );
  } catch (error) {
    hozeno = error instanceof Error && error.message === "vložení selhalo";
  }
  assert(hozeno, "selhání založení se neobchází");
  assert(prepis === 0, "po selhání založení nenásleduje přepis");
  assert(pamat.dokument === null, "neúspěšné založení soubor nevytvoří");
}

async function testKonfliktLimit(): Promise<void> {
  let pokusu = 0;
  let hozeno = false;
  try {
    await zaznamenatDavkuAnalytiky(
      davka(1),
      {
        nacist: async () => ({
          stav: "ok",
          dokument: dokumentSNavstevou(1),
          etag: "1",
        }),
        zalozit: async () => {
          throw new Error("založení se nemá volat");
        },
        ulozit: async () => {
          pokusu += 1;
          throw new BlobPreconditionFailedError();
        },
      },
      CAS,
    );
  } catch (error) {
    hozeno = error instanceof BranaAnalytikaKonfliktError;
  }

  assert(hozeno, "vyčerpaný souběh skončí chybou, ne tichým přepsáním");
  assert(pokusu === 8, "souběh má omezený počet pokusů");
}

async function testNavstevnost(): Promise<void> {
  const vychozi = dokumentSNavstevou(4, 2);
  const denVychozi = vychozi.dny[DEN];
  denVychozi.spusteni = { ikona: 1, prohlizec: 3 };
  denVychozi.novi = 2;
  denVychozi.vracejici = 1;
  denVychozi.proklikTrebon = 8;
  denVychozi.pohledy.dnes = { prvni: 5, dalsi: 6 };

  const pamat = vytvoritPamat(vychozi);
  const io = ioZPameti(pamat);

  const ikona = await zaznamenatDavkuAnalytiky(
    { udalosti: [{ typ: "navsteva", spusteni: "ikona", navstevnik: "novy" }] },
    io,
    CAS,
  );
  const poIkone = pamat.dokument?.dny[DEN];
  assert(ikona.ok, "návštěva z ikony s novým návštěvníkem se přijme");
  assert(poIkone?.navstevy === 5, "ikona zvýší počet návštěv");
  assert(poIkone?.spusteni.ikona === 2, "ikona zvýší spuštění z ikony");
  assert(poIkone?.spusteni.prohlizec === 3, "ikona nezvýší prohlížeč");
  assert(poIkone?.novi === 3, "ikona zvýší nové návštěvníky");
  assert(poIkone?.vracejici === 1, "ikona nezvýší vracející se");

  const prohlizec = await zaznamenatDavkuAnalytiky(
    {
      udalosti: [
        { typ: "navsteva", spusteni: "prohlizec", navstevnik: "vracejici" },
      ],
    },
    io,
    CAS,
  );
  const poProhlizeci = pamat.dokument?.dny[DEN];
  assert(prohlizec.ok, "návštěva z prohlížeče s vracejícím se se přijme");
  assert(poProhlizeci?.navstevy === 6, "prohlížeč zvýší počet návštěv");
  assert(poProhlizeci?.spusteni.prohlizec === 4, "prohlížeč zvýší spuštění z prohlížeče");
  assert(poProhlizeci?.spusteni.ikona === 2, "prohlížeč nezvýší ikonu");
  assert(poProhlizeci?.vracejici === 2, "prohlížeč zvýší vracející se");
  assert(poProhlizeci?.novi === 3, "prohlížeč nezvýší nové");

  const bezNavstevnika = await zaznamenatDavkuAnalytiky(
    { udalosti: [{ typ: "navsteva", spusteni: "prohlizec" }] },
    io,
    CAS,
  );
  const poBez = pamat.dokument?.dny[DEN];
  assert(bezNavstevnika.ok, "návštěva bez údaje návštěvník se přijme");
  assert(poBez?.navstevy === 7, "návštěva bez návštěvníka zvýší návštěvy");
  assert(poBez?.spusteni.prohlizec === 5, "návštěva bez návštěvníka zvýší způsob spuštění");
  assert(poBez?.novi === 3, "návštěva bez návštěvníka nezvýší nové");
  assert(poBez?.vracejici === 2, "návštěva bez návštěvníka nezvýší vracející se");

  const predOdmitnutim = klon(pamat.dokument);
  const zapisuPred = pamat.zapisy;
  const spatneSpusteni = await zaznamenatDavkuAnalytiky(
    { udalosti: [{ typ: "navsteva", spusteni: "android" }] },
    io,
    CAS,
  );
  const spatnyNavstevnik = await zaznamenatDavkuAnalytiky(
    { udalosti: [{ typ: "navsteva", spusteni: "ikona", navstevnik: "host" }] },
    io,
    CAS,
  );
  const ciziPole = await zaznamenatDavkuAnalytiky(
    { udalosti: [{ typ: "navsteva", spusteni: "ikona", adresa: "https://www.trebonpocelyrok.cz/brana" }] },
    io,
    CAS,
  );
  assert(!spatneSpusteni.ok, "neplatný způsob spuštění se odmítne");
  assert(!spatnyNavstevnik.ok, "neplatný druh návštěvníka se odmítne");
  assert(!ciziPole.ok, "nepovolené pole návštěvy se odmítne");
  assert(pamat.zapisy === zapisuPred, "odmítnutá návštěvnost nezapisuje");
  assert(
    JSON.stringify(pamat.dokument) === JSON.stringify(predOdmitnutim),
    "odmítnutá návštěvnost nezmění uložený den",
  );

  const starsi = parsovatDokumentAnalytiky(vychozi);
  const poStarsiDavce = aplikovatDavkuAnalytiky(
    starsi ?? prazdnyDokumentAnalytiky(),
    [{ typ: "navsteva" }],
    CAS,
  );
  const denStarsich = poStarsiDavce.dny[DEN];
  assert(starsi?.verze === 1, "starší dokument verze 1 zůstane čitelný");
  assert(denStarsich?.navstevy === 5, "starší událost bez údajů zvýší jen návštěvy");
  assert(denStarsich?.spusteni.ikona === 1, "starší událost nezmění spuštění z ikony");
  assert(denStarsich?.spusteni.prohlizec === 3, "starší událost nezmění prohlížeč");
  assert(denStarsich?.novi === 2, "starší událost nezmění nové návštěvníky");
  assert(denStarsich?.vracejici === 1, "starší událost nezmění vracející se");
  assert(denStarsich?.sdileniKlik === 2, "starší údaj o sdílení zůstane");
  assert(denStarsich?.proklikTrebon === 8, "starší proklik zůstane");
  assert(
    denStarsich?.pohledy.dnes.prvni === 5 && denStarsich.pohledy.dnes.dalsi === 6,
    "starší počty pohledů zůstanou",
  );
  assert(pamat.kalendar.polozek === 7, "návštěvnost nemění cizí objekt");
  assert(pamat.zapisy === 3, "návštěvnost se ověřuje jen v paměti");
}

function testHraniceModulu(): void {
  const uloziste = readFileSync(
    join("src", "lib", "brana", "analytika", "uloziste.ts"),
    "utf8",
  );
  const route = readFileSync(
    join("src", "app", "api", "brana", "analytika", "route.ts"),
    "utf8",
  );
  const zaloha = (BRANA_ZALOHA_SOUBORY as readonly string[]).includes(
    BRANA_ANALYTIKA_BLOB_CESTA,
  );

  assert(
    BRANA_ANALYTIKA_BLOB_CESTA === "data/brana-analytika.json",
    "cesta souboru je samostatná analytika",
  );
  assert(!zaloha, "analytika není v seznamu zálohy kalendáře");
  assert(uloziste.includes("BRANA_ANALYTIKA_BLOB_CESTA"), "zápis používá cestu analytiky");
  assert(uloziste.includes("ifMatch: etag"), "úprava existujícího souboru předává ifMatch");
  const zalozitCast = uloziste.slice(
    uloziste.indexOf("async function zalozitBezPrepsani"),
    uloziste.indexOf("async function ulozitSIfMatch"),
  );
  assert(zalozitCast.includes("allowOverwrite: false"), "založení zakazuje přepsání");
  assert(!zalozitCast.includes("allowOverwrite: true"), "založení nemá přepis jako náhradu");
  assert(!zalozitCast.includes("ifMatch"), "založení nemíchá podmínku úpravy");
  assert(!uloziste.includes("uloziste.json"), "zápis nejde do galerie");
  assert(
    !uloziste.includes("brana-konkretni-udalosti"),
    "zápis nejde do kalendáře",
  );
  assert(
    !uloziste.includes("brana-upozorneni-nastaveni"),
    "zápis nejde do upozornění",
  );
  assert(BRANA_ANALYTIKA_PRIJEM_ZAPNUT === true, "veřejný příjem je zapnutý");

  const post = vytvoritOdpovedPrijmu("POST");
  const get = vytvoritOdpovedPrijmu("GET");
  assert(post === null, "POST při zapnutém příjmu pokračuje do zápisu");
  assert(get?.status === 405, "GET statistiky nevrací");
  assert(route.includes("vytvoritOdpovedPrijmu"), "endpoint používá stejnou bránu");
  const teloPost = route.slice(route.indexOf("export async function POST"));
  assert(
    teloPost.indexOf("odpovedOdmitnuti") !== -1 &&
      teloPost.indexOf("odpovedOdmitnuti") <
        teloPost.indexOf("zaznamenatBranaAnalytikuDoBlobu"),
    "endpoint otevře úložiště až po bráně příjmu",
  );
}

function testProklikTrebon(): void {
  const poKliku = aplikovatDavkuAnalytiky(
    prazdnyDokumentAnalytiky(),
    [{ typ: "proklikTrebon" }, { typ: "proklikTrebon" }],
    CAS,
  );
  const den = poKliku.dny[DEN];
  assert(den?.proklikTrebon === 2, "dva prokliky dají denní součet 2");
  assert(
    den?.navstevy === 0 &&
      den.novi === 0 &&
      den.vracejici === 0 &&
      den.sdileniKlik === 0 &&
      den.zdroje.qr === 0 &&
      den.zdroje.sdileni === 0 &&
      den.pohledy.dnes.prvni === 0 &&
      den.prochazeni.dnes.delsi === 0 &&
      den.oblast.trebonsko === 0,
    "proklik mění jen své počítadlo",
  );

  const poOstatnich = aplikovatDavkuAnalytiky(
    poKliku,
    [
      { typ: "navsteva" },
      { typ: "sdileni" },
      { typ: "pohled", pohled: "dnes", raz: "prvni" },
      { typ: "prochazeni", pohled: "dnes", metrika: "delsi" },
    ],
    CAS,
  );
  const dalsi = poOstatnich.dny[DEN];
  assert(dalsi?.proklikTrebon === 2, "ostatní události proklik nemění");
  assert(
    dalsi?.navstevy === 1 && dalsi.sdileniKlik === 1 && dalsi.pohledy.dnes.prvni === 1,
    "ostatní události se přičtou ve svých počítadlech",
  );

  const cisty = validovatDavkuAnalytiky({ udalosti: [{ typ: "proklikTrebon" }] });
  const cizi = validovatDavkuAnalytiky({
    udalosti: [{ typ: "proklikTrebon", url: "https://www.trebonpocelyrok.cz" }],
  });
  assert(cisty.ok && cisty.udalosti.length === 1, "čistý proklik se přijme");
  assert(!cizi.ok, "proklik s cizím polem se odmítne");
}

async function main(): Promise<void> {
  await testSdkIfMatch();
  await testOdmitnuti();
  await testSoubeh();
  await testPoskozeniAVypadek();
  await testNovySouborAOrez();
  await testZalozeni();
  await testKonfliktLimit();
  await testNavstevnost();
  testProklikTrebon();
  testHraniceModulu();

  if (selhalo > 0) {
    console.error(`\nSelhalo kontrol: ${selhalo}`);
    process.exit(1);
  }

  console.log("\nZáklad analytiky BRÁNY prošel bez zápisu do produkce.");
}

void main();
