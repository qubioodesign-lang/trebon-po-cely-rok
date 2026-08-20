/**
 * RADAR krok 1: vlastní úložiště, prázdný inbox, ruční + Přidat.
 * Spuštění: npx tsx scripts/verify-brana-radar-krok-1.ts
 * Bez Blob WRITE, bez scanu, bez produkčního zápisu.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import {
  BRANA_ADMIN_SPRAVA_SEKCE,
  type BranaAdminSpravaSekce,
} from "../src/lib/brana/admin/sekce";
import {
  parsovatRadarDokument,
  pridatRucniNalezDoHistorie,
  pouzitRadarStopu,
  seraditPracovniStopy,
  smazatRadarStopu,
  uklidRadarDokument,
  validovatPracovniRadarStopu,
  validovatRucniRadarNalezVstup,
  vytvoritRadarOtiskKlic,
  vychoziRadarDokument,
  type BranaRadarDokument,
  type BranaRadarPracovniStopa,
} from "../src/lib/brana/admin/radar";

let selhalo = 0;
function assert(ok: boolean, popis: string): void {
  if (ok) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhalo += 1;
  console.error(`FAIL ${popis}`);
}

const koren = join(__dirname, "..");

function cist(rel: string): string {
  return readFileSync(join(koren, rel), "utf8");
}

const zakazaneSoubory = [
  "src/lib/brana/admin/skenovat-zdroj.ts",
  "src/lib/brana/admin/zdroj-scan-parser.ts",
  "src/lib/brana/admin/scan-ceka-zapis.ts",
  "src/lib/brana/admin/zdroje-uloziste.ts",
  "src/lib/brana/admin/konkretni-udalosti-uloziste.ts",
  "src/app/api/brana/casovy-plan/route.ts",
  "vercel.json",
  "src/lib/brana/admin/skenovat-rychle-zdroje-automaticky.ts",
  "src/lib/brana/admin/skenovat-dlouhodobe-zdroje-automaticky.ts",
  "src/lib/brana/admin/skupinovy-scan-stav.ts",
] as const;

const zakazaneImporty = [
  "skenovat-zdroj",
  "zdroj-scan-parser",
  "scan-ceka-zapis",
  "zdroje-uloziste",
  "konkretni-udalosti-uloziste",
  "casovy-plan",
  "redakcni-poradi-uloziste",
  "nezarazene-uloziste",
];

const stopa: BranaRadarPracovniStopa = {
  id: "stopa-1",
  radarVstupId: "region-trebonsko",
  datumOd: "2026-08-22",
  cas: "19:00",
  nazev: "Jazz na terase",
  kde: "U Vodníka",
  url: "https://example.test/jazz",
  nalezenoAt: "2026-08-20T12:00:00.000Z",
};

const dokumentSBudoucimiPoli: BranaRadarDokument = {
  verzeUloziste: 1,
  pracovni: [stopa],
  smazatOtisky: [{ klic: "smazat-1", datumOd: "2026-08-21" }],
  historie: [
    {
      id: "hist-pouzito",
      puvod: "RADAR_POUZITO",
      datumOd: "2026-08-10",
      cas: "18:00",
      nazev: "Starší nález",
      kde: "Rondo",
      radarVstupId: "region-trebonsko",
      url: "https://example.test/stary",
      rozhodnutoAt: "2026-08-09T10:00:00.000Z",
      nalezenoAt: "2026-08-08T09:00:00.000Z",
    },
  ],
  posledniBehAt: "2026-08-20T07:00:00.000Z",
};

// A. sekce RADAR existuje
const radarSekce = BRANA_ADMIN_SPRAVA_SEKCE.find((s) => s.id === "radar");
assert(
  radarSekce?.label === "RADAR" && radarSekce.segment === "radar",
  "A: Správa má sekci RADAR",
);
const strankaRadar = join(
  koren,
  "src/app/brana/admin/sprava/radar/page.tsx",
);
assert(existsSync(strankaRadar), "A: stránka sprava/radar existuje");
const strankaText = cist("src/app/brana/admin/sprava/radar/page.tsx");
assert(
  strankaText.includes('aktivniSpravaSekce="radar"'),
  "A: stránka aktivuje sekci radar",
);
assert(
  /\bRADAR\b/.test(strankaText) &&
    strankaText.includes(
      "Výzkumný přehled. Nic odsud se automaticky nepublikuje do BRÁNY.",
    ),
  "A: nadpis a informační věta",
);

// B. prázdný pracovní RADAR
assert(
  strankaText.includes("BranaAdminRadarSeznam"),
  "B: stránka zobrazuje pracovní seznam",
);
const seznamText = cist(
  "src/components/brana/admin/BranaAdminRadarSeznam.tsx",
);
assert(
  seznamText.includes("RADAR zatím nemá žádné pracovní stopy."),
  "B: prázdný pracovní seznam",
);
assert(
  !strankaText.includes("Historie") &&
    !seznamText.includes("Historie") &&
    !seznamText.includes("historie"),
  "B: stránka nezobrazuje historii",
);
const vychozi = vychoziRadarDokument();
assert(
  vychozi.pracovni.length === 0 &&
    vychozi.smazatOtisky.length === 0 &&
    vychozi.historie.length === 0 &&
    vychozi.posledniBehAt === null &&
    vychozi.verzeUloziste === 1,
  "B: výchozí dokument je prázdný",
);

// C. validace vyžaduje datum + název
assert(
  validovatRucniRadarNalezVstup({
    datumOd: "",
    cas: "",
    nazev: "Jazz",
    kde: "",
    url: "",
  }).ok === false,
  "C: chybí datum → chyba",
);
assert(
  validovatRucniRadarNalezVstup({
    datumOd: "2026-08-22",
    cas: "",
    nazev: "   ",
    kde: "",
    url: "",
  }).ok === false,
  "C: chybí název → chyba",
);
assert(
  validovatRucniRadarNalezVstup({
    datumOd: "2026-02-31",
    cas: "",
    nazev: "Jazz",
    kde: "",
    url: "",
  }).ok === false,
  "C: neplatné datum → chyba",
);
const platny = validovatRucniRadarNalezVstup({
  datumOd: " 2026-08-22 ",
  cas: "19:00:00",
  nazev: "  Jazz na terase  ",
  kde: "  U Vodníka  ",
  url: "  https://example.test/jazz  ",
});
assert(platny.ok, "C: platný vstup s volitelnými poli projde");
if (platny.ok) {
  assert(
    platny.nalez.datumOd === "2026-08-22" &&
      platny.nalez.cas === "19:00" &&
      platny.nalez.nazev === "Jazz na terase" &&
      platny.nalez.kde === "U Vodníka" &&
      platny.nalez.url === "https://example.test/jazz",
    "C: trim a normalizace času, bez vymýšlení",
  );
}
const jenPovinne = validovatRucniRadarNalezVstup({
  datumOd: "2026-08-22",
  cas: "",
  nazev: "Jazz",
  kde: "",
  url: "",
});
assert(jenPovinne.ok, "C: jen datum + název stačí");
if (jenPovinne.ok) {
  assert(
    jenPovinne.nalez.cas === "" &&
      jenPovinne.nalez.kde === "" &&
      jenPovinne.nalez.url === "",
    "C: chybějící volitelná pole zůstanou prázdná",
  );
}

// D + E. ruční nález jen do historie, bez pracovní stopy
const po = pridatRucniNalezDoHistorie(vychoziRadarDokument(), {
  datumOd: "2026-08-22",
  cas: "",
  nazev: "Jazz",
  kde: "",
  url: "",
}, {
  noveId: () => "radar-test-1",
  tedIso: "2026-08-20T12:34:56.000Z",
});
assert(po.historie.length === 1, "D: přibyl jeden záznam historie");
const zaznam = po.historie[0];
assert(
  zaznam?.puvod === "RUCNE_NALEZENO" &&
    zaznam.datumOd === "2026-08-22" &&
    zaznam.cas === "" &&
    zaznam.nazev === "Jazz" &&
    zaznam.kde === "" &&
    zaznam.radarVstupId === "" &&
    zaznam.url === "" &&
    zaznam.rozhodnutoAt === "2026-08-20T12:34:56.000Z" &&
    zaznam.nalezenoAt === zaznam.rozhodnutoAt &&
    zaznam.id === "radar-test-1",
  "D: ruční nález má původ RUCNE_NALEZENO a nalezenoAt = rozhodnutoAt",
);
assert(po.pracovni.length === 0, "E: nevznikla pracovní stopa");
assert(po.smazatOtisky.length === 0, "E: nevznikl otisk Smazat");
assert(po.posledniBehAt === null, "E: posledniBehAt se nemění");

const poZachovani = pridatRucniNalezDoHistorie(dokumentSBudoucimiPoli, {
  datumOd: "2026-08-22",
  cas: "19:00",
  nazev: "Jazz",
  kde: "U Vodníka",
  url: "https://example.test/jazz",
}, {
  noveId: () => "radar-test-2",
  tedIso: "2026-08-20T12:34:56.000Z",
});
assert(
  poZachovani.pracovni.length === 1 &&
    poZachovani.pracovni[0]?.id === "stopa-1" &&
    poZachovani.smazatOtisky.length === 1 &&
    poZachovani.posledniBehAt === "2026-08-20T07:00:00.000Z" &&
    poZachovani.historie.length === 2 &&
    poZachovani.historie[0]?.id === "hist-pouzito" &&
    poZachovani.historie[1]?.puvod === "RUCNE_NALEZENO",
  "D: zápis historie nezahodí pracovni / smazatOtisky / posledniBehAt",
);

const zpet = parsovatRadarDokument(JSON.parse(JSON.stringify(poZachovani)));
assert(zpet !== null, "D: round-trip parsování po zápisu");
if (zpet) {
  assert(
    zpet.pracovni.length === 1 &&
      zpet.smazatOtisky.length === 1 &&
      zpet.historie.length === 2 &&
      zpet.posledniBehAt === dokumentSBudoucimiPoli.posledniBehAt,
    "D: parser zachová všechna RADAR pole",
  );
}

const prazdnyParse = parsovatRadarDokument({});
assert(
  prazdnyParse !== null &&
    prazdnyParse.pracovni.length === 0 &&
    prazdnyParse.historie.length === 0 &&
    prazdnyParse.posledniBehAt === null,
  "D: chybějící pole dokumentu → prázdné výchozí, ne pád",
);

// F. žádný zápis do Kalendáře (čistá funkce + izolace souborů)
assert(
  po.historie.length === 1 && po.pracovni.length === 0,
  "F: čistá funkce nevrací kalendářní událost",
);
const radarTs = cist("src/lib/brana/admin/radar.ts");
const radarUloziste = cist("src/lib/brana/admin/radar-uloziste.ts");
const radarAkce = cist("src/app/brana/admin/actions.ts");
const radarStranka = strankaText;
const radarFormular = cist(
  "src/components/brana/admin/BranaAdminRadarPridat.tsx",
);
const radarSeznam = cist(
  "src/components/brana/admin/BranaAdminRadarSeznam.tsx",
);
const noveRadarSoubory = [
  radarTs,
  radarUloziste,
  radarStranka,
  radarFormular,
  radarSeznam,
];
for (const zakaz of zakazaneImporty) {
  assert(
    noveRadarSoubory.every((t) => !t.includes(zakaz)),
    `F: nové RADAR soubory neimportují ${zakaz}`,
  );
}
const akceRadarCast = radarAkce.slice(radarAkce.indexOf("pridatRucniRadarNalezAkce"));
assert(
  akceRadarCast.includes('revalidatePath("/brana/admin/sprava/radar")') &&
    !akceRadarCast.includes("kalendar") &&
    !akceRadarCast.includes("pridatRucniKonkretniUdalost") &&
    akceRadarCast.includes("pouzitBranaRadarStopuAkce") &&
    akceRadarCast.includes("smazatBranaRadarStopuAkce"),
  "F: RADAR akce neinvaliduje Kalendář a nevolá ruční zápis",
);
assert(
  radarUloziste.includes('BRANA_RADAR_BLOB_CESTA = "data/brana-radar.json"') &&
    !radarUloziste.includes("brana-konkretni-udalosti") &&
    !radarUloziste.includes("brana-nezarazene") &&
    !radarUloziste.includes("brana-zdroje"),
  "F: RADAR píše jen do data/brana-radar.json",
);

// G. produkční scanovací cesty beze změny
let gitDiff = "";
try {
  gitDiff = execSync(
    "git diff --name-only -- src/lib/brana/admin/skenovat-zdroj.ts src/lib/brana/admin/zdroj-scan-parser.ts src/lib/brana/admin/scan-ceka-zapis.ts src/lib/brana/admin/zdroje-uloziste.ts src/lib/brana/admin/konkretni-udalosti-uloziste.ts src/app/api/brana/casovy-plan/route.ts vercel.json src/lib/brana/admin/skenovat-rychle-zdroje-automaticky.ts src/lib/brana/admin/skenovat-dlouhodobe-zdroje-automaticky.ts src/lib/brana/admin/skupinovy-scan-stav.ts src/lib/brana/admin/redakcni-poradi-uloziste.ts src/lib/brana/admin/redakcni-poradi-validace.ts src/lib/brana/admin/nezarazene-uloziste.ts src/lib/brana/admin/nezarazene.ts",
    { cwd: koren, encoding: "utf8" },
  ).trim();
} catch {
  gitDiff = "GIT_SELHALO";
}
assert(gitDiff === "", `G: zakázané produkční soubory beze změny (${gitDiff || "žádný diff"})`);
for (const soubor of zakazaneSoubory) {
  assert(existsSync(join(koren, soubor)), `G: ${soubor} existuje a nebyl smazán`);
}
assert(
  !existsSync(join(koren, "src/lib/brana/admin/radar-vstupy.ts")) &&
    !existsSync(join(koren, "src/lib/brana/admin/radar-scan.ts")),
  "G: nevznikl radar-vstupy.ts ani radar-scan.ts",
);

const typSekce: BranaAdminSpravaSekce = "radar";
assert(typSekce === "radar", "A: typ sekce zahrnuje radar");

const rucniPoPridani = pridatRucniNalezDoHistorie(vychoziRadarDokument(), {
  datumOd: "2026-08-22",
  cas: "",
  nazev: "Jazz",
  kde: "",
  url: "",
}, {
  noveId: () => "radar-test-rucne",
  tedIso: "2026-08-20T12:34:56.000Z",
});
assert(
  rucniPoPridani.historie[0]?.puvod === "RUCNE_NALEZENO" &&
    rucniPoPridani.pracovni.length === 0 &&
    rucniPoPridani.smazatOtisky.length === 0,
  "2A: RUCNE_NALEZENO stále bez pracovní stopy i otisku",
);

const neplatnaStopa = validovatPracovniRadarStopu({
  id: "x",
  radarVstupId: "",
  datumOd: "2026-08-22",
  cas: "",
  nazev: "Jazz",
  kde: "",
  url: "",
  nalezenoAt: "2026-08-20T12:00:00.000Z",
});
assert(neplatnaStopa.ok === false, "2B: pracovní stopa bez radarVstupId neprojde");
const platnaStopa = validovatPracovniRadarStopu(stopa);
assert(
  platnaStopa.ok && platnaStopa.ok === true,
  "2B: platná pracovní stopa projde",
);

const klicA = vytvoritRadarOtiskKlic({
  radarVstupId: " region-trebonsko ",
  datumOd: "2026-08-22",
  nazev: "  Jazz   na  terase ",
});
const klicB = vytvoritRadarOtiskKlic({
  radarVstupId: "region-trebonsko",
  datumOd: "2026-08-22",
  nazev: "Jazz Na Terase",
});
const klicCas = vytvoritRadarOtiskKlic({
  radarVstupId: "region-trebonsko",
  datumOd: "2026-08-22",
  nazev: "Jazz na terase",
});
assert(klicA === klicB && klicA === klicCas, "2C: fingerprint je stabilní");
assert(
  klicA === `region-trebonsko\x002026-08-22\x00jazz na terase`,
  "2C: fingerprint = vstup + datum + lowercase název, bez času",
);
assert(
  vytvoritRadarOtiskKlic({
    radarVstupId: "region-trebonsko",
    datumOd: "2026-08-22",
    nazev: "Žlutý domeček",
  }) === `region-trebonsko\x002026-08-22\x00žlutý domeček`,
  "2C: diakritika se neodstraňuje",
);

const docPouziti: BranaRadarDokument = {
  ...vychoziRadarDokument(),
  pracovni: [stopa],
  historie: [
    {
      id: "hist-rucne",
      puvod: "RUCNE_NALEZENO",
      datumOd: "2026-08-21",
      cas: "",
      nazev: "Ruční",
      kde: "",
      radarVstupId: "",
      url: "",
      rozhodnutoAt: "2026-08-20T10:00:00.000Z",
      nalezenoAt: "2026-08-20T10:00:00.000Z",
    },
  ],
};
const poPouziti = pouzitRadarStopu(docPouziti, "stopa-1", {
  tedIso: "2026-08-20T15:00:00.000Z",
});
assert(!("chyba" in poPouziti), "2D: Použít uspěje");
if (!("chyba" in poPouziti)) {
  const hist = poPouziti.historie[poPouziti.historie.length - 1];
  assert(poPouziti.pracovni.length === 0, "2D: Použít vyprázdní pracovni");
  assert(
    poPouziti.historie.length === 2 &&
      hist?.puvod === "RADAR_POUZITO" &&
      hist.datumOd === "2026-08-22" &&
      hist.cas === "19:00" &&
      hist.nazev === "Jazz na terase" &&
      hist.kde === "U Vodníka" &&
      hist.radarVstupId === "region-trebonsko" &&
      hist.url === "https://example.test/jazz" &&
      hist.nalezenoAt === "2026-08-20T12:00:00.000Z" &&
      hist.rozhodnutoAt === "2026-08-20T15:00:00.000Z",
    "2D: Použít zapíše RADAR_POUZITO se zachovanými poli",
  );
  assert(
    poPouziti.historie[0]?.puvod === "RUCNE_NALEZENO",
    "2D: starší ruční historie zůstává",
  );
  assert(
    poPouziti.smazatOtisky.length === 1 &&
      poPouziti.smazatOtisky[0]?.klic === klicCas &&
      poPouziti.smazatOtisky[0]?.datumOd === "2026-08-22",
    "2E: Použít vytvoří fingerprint",
  );
}

const docSmazat: BranaRadarDokument = {
  ...vychoziRadarDokument(),
  pracovni: [stopa],
  historie: docPouziti.historie.slice(),
};
const historiePredSmazanim = docSmazat.historie.length;
const poSmazani = smazatRadarStopu(docSmazat, "stopa-1");
assert(!("chyba" in poSmazani), "2F: Smazat uspěje");
if (!("chyba" in poSmazani)) {
  assert(poSmazani.pracovni.length === 0, "2F: Smazat vyprázdní pracovni");
  assert(
    poSmazani.historie.length === historiePredSmazanim &&
      poSmazani.historie.every((h) => h.puvod !== "RADAR_POUZITO"),
    "2F: Smazat nevytvoří historii",
  );
  assert(
    poSmazani.smazatOtisky.length === 1 &&
      poSmazani.smazatOtisky[0]?.klic === klicCas &&
      poSmazani.smazatOtisky[0]?.datumOd === "2026-08-22",
    "2G: Smazat vytvoří fingerprint",
  );
}

const serazene = seraditPracovniStopy([
  { ...stopa, id: "b", datumOd: "2026-08-23", cas: "10:00" },
  { ...stopa, id: "a", datumOd: "2026-08-22", cas: "" },
  { ...stopa, id: "c", datumOd: "2026-08-22", cas: "19:00" },
]);
assert(
  serazene.map((s) => s.id).join(",") === "a,c,b",
  "2B: řazení nejbližší datum, pak čas",
);

const docUklid: BranaRadarDokument = {
  verzeUloziste: 1,
  pracovni: [
    { ...stopa, id: "minula", datumOd: "2026-08-19" },
    { ...stopa, id: "dnes", datumOd: "2026-08-20" },
    { ...stopa, id: "zitra", datumOd: "2026-08-21" },
  ],
  smazatOtisky: [
    { klic: "stary", datumOd: "2026-08-19" },
    { klic: "dnesni", datumOd: "2026-08-20" },
  ],
  historie: [
    {
      id: "stara-hist",
      puvod: "RADAR_POUZITO",
      datumOd: "2026-07-01",
      cas: "",
      nazev: "Staré Použít",
      kde: "",
      radarVstupId: "region-trebonsko",
      url: "",
      rozhodnutoAt: "2026-06-01T00:00:00.000Z",
      nalezenoAt: "2026-06-01T00:00:00.000Z",
    },
  ],
  posledniBehAt: "2026-08-01T00:00:00.000Z",
};
const poUklidu = uklidRadarDokument(docUklid, "2026-08-20");
assert(
  poUklidu.pracovni.map((s) => s.id).join(",") === "dnes,zitra",
  "2H: prošlá pracovní stopa se odstraní, dnešek zůstane",
);
assert(
  poUklidu.smazatOtisky.map((o) => o.klic).join(",") === "dnesni",
  "2I: prošlý otisk se odstraní",
);
assert(
  poUklidu.historie.length === 1 &&
    poUklidu.historie[0]?.id === "stara-hist" &&
    poUklidu.posledniBehAt === docUklid.posledniBehAt,
  "2J: historie se stářím nemaže",
);

assert(
  !("chyba" in poPouziti) &&
    poPouziti.historie.some((h) => h.puvod === "RADAR_POUZITO") &&
    !radarTs.includes("pridatRucniKonkretniUdalost") &&
    !radarSeznam.includes("kalendar"),
  "2K: Použít/Smazat nezapisují do Kalendáře",
);

const formularText = cist(
  "src/components/brana/admin/BranaAdminRadarPridat.tsx",
);
assert(
  formularText.includes("Nález uložen pro budoucí analýzu.") &&
    seznamText.includes("Použít") &&
    seznamText.includes("Smazat") &&
    !formularText.includes("Použít"),
  "2A: + Přidat zůstává oddělené od pracovních akcí",
);

if (selhalo > 0) {
  console.error(`\nFAIL: ${selhalo} kontrol`);
  process.exit(1);
}

console.log("\nOK RADAR krok 1+2");
