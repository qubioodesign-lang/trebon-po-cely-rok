/**
 * Facebook náhled třetí fotografie. Jen umělé položky, bez sítě a bez zápisu.
 * Spuštění: npx tsx scripts/verify-nahled-facebook.ts
 */

import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import type { Polozka } from "../src/types";
import { ziskatTretiSouborProlnuti } from "../src/lib/polozka-soubory";
import { metadataNahleduProlnuti } from "../src/lib/nahled-facebook";
import {
  sestavitSdileciUrl,
  sestavitUrlNahleduFacebook,
} from "../src/lib/sdileni";
import {
  bylaNavstevaVSession,
  oznacitNavstevuVSession,
  urcitZdrojNavstevy,
} from "../src/lib/zdroj-navstev";
import {
  efektivniPoradiPolozek,
  idPrvnihoViditelnehoProlnuti,
  polozkyVerejneGalerie,
} from "../src/lib/rotace-prolnuti";

const KOREN = path.resolve(__dirname, "..");
const ZAKLAD = "https://www.trebonpocelyrok.cz";
const DEN = 24 * 60 * 60 * 1000;
const TED = Date.parse("2026-06-02T12:00:00.000Z");

let selhani = 0;

function overit(podminka: boolean, popis: string): void {
  if (podminka) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhani += 1;
  console.error(`FAIL  ${popis}`);
}

function snimek(nazev: string): string {
  return `https://blob.example/uploads/${nazev}.jpg`;
}

function prolnuti(
  id: string,
  poradi: number,
  aktivni: boolean,
  soubory: string[]
): Polozka {
  return {
    id,
    typ: "prolnuti",
    soubory,
    popis: id,
    datumPorizeni: null,
    datumPublikace: "2026-01-01T00:00:00.000Z",
    poradi,
    aktivni,
  };
}

function fotografie(id: string, poradi: number): Polozka {
  return {
    id,
    typ: "fotografie",
    soubor: snimek(id),
    popis: id,
    datumPorizeni: null,
    datumPublikace: "2026-01-01T00:00:00.000Z",
    poradi,
    aktivni: true,
  };
}

function urlObrazku(meta: Metadata | null): string | null {
  const images = meta?.openGraph?.images;
  const prvni = Array.isArray(images) ? images[0] : images;
  if (!prvni || typeof prvni === "string" || prvni instanceof URL) {
    return typeof prvni === "string" ? prvni : null;
  }
  return typeof prvni.url === "string" ? prvni.url : null;
}

function urlStranky(meta: Metadata | null): string | null {
  const url = meta?.openGraph?.url;
  return typeof url === "string" ? url : null;
}

const skryte = prolnuti("skryte", 0, false, [
  snimek("skryte-a"),
  snimek("skryte-b"),
  snimek("skryte-c"),
]);
const foto = fotografie("foto", 1);
const druhe = prolnuti("druhe", 2, true, [
  snimek("druhe-a"),
  snimek("druhe-b"),
  snimek("druhe-c"),
]);
const prvniPoRotaci = prolnuti("prvni-po-rotaci", 3, true, [
  snimek("rotace-a"),
  snimek("rotace-b"),
  snimek("rotace-c"),
]);
const dveFotky = prolnuti("jen-dve", 4, true, [
  snimek("dve-a"),
  snimek("dve-b"),
]);

const ulozeno = [skryte, foto, druhe, prvniPoRotaci];
const poRotaci = efektivniPoradiPolozek(
  ulozeno,
  new Date(TED - DEN - 1000).toISOString(),
  TED
);
const verejne = polozkyVerejneGalerie(
  ulozeno,
  new Date(TED - DEN - 1000).toISOString(),
  TED
);
const idZVerejneGalerie =
  verejne.find((polozka) => polozka.typ === "prolnuti")?.id ?? null;
const idZTlacitka = idPrvnihoViditelnehoProlnuti(poRotaci);

overit(
  poRotaci[0]?.id === "skryte",
  "prvni radek po rotaci je skryte prolnuti"
);
overit(
  idZTlacitka === "prvni-po-rotaci",
  "tlacitko bere prolnuti po rotaci, ne skryte ani fotku"
);
overit(
  idZTlacitka === idZVerejneGalerie,
  "stejne ID jako prvni prolnuti verejne galerie"
);
overit(idZTlacitka !== poRotaci[0]?.id, "neni to prvni radek administrace");

const cil = poRotaci.find((polozka) => polozka.id === idZTlacitka);
const odkaz = sestavitUrlNahleduFacebook(idZTlacitka ?? "");
overit(
  odkaz === `${ZAKLAD}/?nahled=prvni-po-rotaci`,
  "odkaz obsahuje trvale ID prvniho verejneho prolnuti"
);
overit(!odkaz.includes("polozka=") && !odkaz.includes("z=sdileni"), "odkaz nema rezim sdileni");
overit(
  ziskatTretiSouborProlnuti(cil!) === snimek("rotace-c"),
  "kopiruje se prolnuti, ktere ma treti snimek"
);

const nahled = metadataNahleduProlnuti(cil ?? null, ZAKLAD);
overit(urlObrazku(nahled) === snimek("rotace-c"), "og:image je treti fotografie");
overit(urlObrazku(nahled) !== snimek("rotace-a"), "og:image neni prvni fotografie");
overit(urlStranky(nahled) === odkaz, "og:url je cela adresa s nahled");
overit(nahled?.title === "Třeboň po celý rok", "titulek zustava");
overit(
  nahled?.description === "Na chvíli zpátky do Třeboně.",
  "popis zustava"
);

const nahledSkryte = metadataNahleduProlnuti(skryte, ZAKLAD);
overit(
  urlObrazku(nahledSkryte) === snimek("skryte-c"),
  "skryte prolnuti dal vraci svou treti fotografii"
);
overit(
  urlStranky(nahledSkryte) === `${ZAKLAD}/?nahled=skryte`,
  "skryte prolnuti si drzi vlastni adresu"
);

const odkazDruhe = sestavitUrlNahleduFacebook(druhe.id);
const nahledDruhe = metadataNahleduProlnuti(druhe, ZAKLAD);
overit(odkaz !== odkazDruhe, "dve prolnuti maji ruzne adresy");
overit(
  urlObrazku(nahled) !== urlObrazku(nahledDruhe),
  "dve prolnuti maji ruzne treti fotografie"
);

overit(
  metadataNahleduProlnuti(dveFotky, ZAKLAD) === null,
  "bez treti fotografie se nahled nevytvori"
);
overit(
  ziskatTretiSouborProlnuti(dveFotky) === null,
  "dva snimky nemaji treti soubor"
);

const sdileni = sestavitSdileciUrl("navstevnik");
overit(
  sdileni.includes("polozka=navstevnik") && sdileni.includes("z=sdileni"),
  "navstevnicke sdileni zustava polozka a z=sdileni"
);
overit(!sdileni.includes("nahled="), "navstevnicke sdileni nepouziva nahled");

const stranka = fs.readFileSync(path.join(KOREN, "src/app/page.tsx"), "utf8");
const [metadataCast, galerieCast] = stranka.split(
  "export default async function HlavniStranka"
);
overit(metadataCast.includes("nahled"), "metadata ctou parametr nahled");
overit(
  !galerieCast.includes("nahled"),
  "verejna galerie parametr nahled necte"
);
overit(
  galerieCast.includes("pocatecniPolozkaId") &&
    galerieCast.includes("const { polozka: pocatecniPolozkaId }"),
  "start galerie dal ridí jen polozka"
);

const analytika = fs.readFileSync(
  path.join(KOREN, "src/lib/zdroj-navstev.ts"),
  "utf8"
);
overit(!analytika.includes("nahled"), "analytika nema novou vetev pro nahled");
overit(
  analytika.includes('params.get("polozka")') &&
    analytika.includes('z === "sdileni"'),
  "sdileni se dal pozna jen podle polozka nebo z=sdileni"
);

const pamet = new Map<string, string>();
Object.assign(globalThis, {
  window: {},
  sessionStorage: {
    getItem: (klic: string) => pamet.get(klic) ?? null,
    setItem: (klic: string, hodnota: string) => {
      pamet.set(klic, hodnota);
    },
  },
  document: { referrer: "https://www.facebook.com/trebon" },
});

function nastavAdresu(search: string, referrer: string) {
  Object.assign(globalThis, {
    window: { location: { search } },
    document: { referrer },
  });
}

nastavAdresu("?nahled=prvni-po-rotaci", "https://www.facebook.com/trebon");
overit(
  urcitZdrojNavstevy() === "ostatni",
  "nahled s referrerem je jeden bezny zdroj ostatni"
);
nastavAdresu("?nahled=prvni-po-rotaci", "");
overit(
  urcitZdrojNavstevy() === "primy",
  "nahled bez referreru je primy vstup"
);
overit(urcitZdrojNavstevy() !== "sdileni", "nahled nespousti udalost sdileni");
nastavAdresu("?polozka=navstevnik&z=sdileni", "");
overit(
  urcitZdrojNavstevy() === "sdileni",
  "dosavadni odkaz polozka a z=sdileni dale pocita sdileni"
);

overit(!bylaNavstevaVSession(), "navsteva jeste neni v relaci");
oznacitNavstevuVSession();
overit(bylaNavstevaVSession(), "druha navsteva ve stejne relaci se neopakuje");

if (selhani > 0) {
  console.error(`Selhalo ${selhani} kontrol.`);
  process.exit(1);
}

console.log("Vsechny kontroly nahledu prosly.");
