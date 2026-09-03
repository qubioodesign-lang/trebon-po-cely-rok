/**
 * RADAR krok 1–4: úložiště, ruční + Přidat, Použít/Smazat, sběr, zápis, fail-soft cron.
 * Spuštění: npx tsx scripts/verify-brana-radar-krok-1.ts
 * Bez produkčního Blob WRITE, bez ostrého cronu.
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
  obalitRadarBehFailSoft,
  seraditPracovniStopy,
  smazatRadarStopu,
  uklidRadarDokument,
  validovatPracovniRadarStopu,
  validovatRucniRadarNalezVstup,
  vytvoritRadarOtiskKlic,
  vychoziRadarDokument,
  zapsatRadarScanDoDokumentu,
  type BranaRadarDokument,
  type BranaRadarPracovniStopa,
  type BranaRadarScanKandidatVstup,
} from "../src/lib/brana/admin/radar";
import {
  jeRadarPovolenaGeografie,
  jeZjevneUzVBrane,
  jeZjevnySumProvoz,
  spustitRadarScanReadOnly,
} from "../src/lib/brana/admin/radar-scan";
import { BRANA_RADAR_VSTUPY } from "../src/lib/brana/admin/radar-vstupy";
import { vytahnoutRadarTrebonskoNalezy } from "../src/lib/brana/admin/radar-trebonsko";
import { vytahnoutRadarZamekNalezZDetailu } from "../src/lib/brana/admin/radar-zamek";

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
const radarVstupyText = cist("src/lib/brana/admin/radar-vstupy.ts");
const radarScanText = cist("src/lib/brana/admin/radar-scan.ts");
const radarTrebonskoText = cist("src/lib/brana/admin/radar-trebonsko.ts");
const radarZamekText = cist("src/lib/brana/admin/radar-zamek.ts");
const radarKphText = cist("src/lib/brana/admin/radar-kultura-pod-hvezdami.ts");
const radarTlsText = cist("src/lib/brana/admin/radar-letni-setkavani.ts");
const radarHtmlText = cist("src/lib/brana/admin/radar-html.ts");
const radarBehText = cist("src/lib/brana/admin/radar-beh.ts");
const casovyPlanText = cist("src/app/api/brana/casovy-plan/route.ts");
const rychlyScanText = cist(
  "src/lib/brana/admin/skenovat-rychle-zdroje-automaticky.ts",
);
const dlouhyScanText = cist(
  "src/lib/brana/admin/skenovat-dlouhodobe-zdroje-automaticky.ts",
);
const noveRadarSoubory = [
  radarTs,
  radarUloziste,
  radarStranka,
  radarFormular,
  radarSeznam,
  radarVstupyText,
  radarScanText,
  radarTrebonskoText,
  radarZamekText,
  radarKphText,
  radarTlsText,
  radarHtmlText,
  radarBehText,
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
    akceRadarCast.includes("smazatBranaRadarStopuAkce") &&
    akceRadarCast.includes("pridatPolozkuDoUceni(") &&
    akceRadarCast.includes("pridatPolozkuDoUceniBestEffort"),
  "F: RADAR akce neinvaliduje Kalendář; + Přidat primární Učení, Použít best-effort",
);
assert(
  !radarUloziste.includes("pridatRucniNalezDoHistorie") &&
    radarTs.includes("historie: dokument.historie.slice()") &&
    radarTs.includes("pridatRucniNalezDoHistorie"),
  "F: provozní + Přidat/Použít neappendují historii; schema historie zůstává",
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
    "git diff --name-only -- src/lib/brana/admin/skenovat-zdroj.ts src/lib/brana/admin/zdroj-scan-parser.ts src/lib/brana/admin/scan-ceka-zapis.ts src/lib/brana/admin/zdroje-uloziste.ts src/lib/brana/admin/konkretni-udalosti-uloziste.ts vercel.json src/lib/brana/admin/skenovat-rychle-zdroje-automaticky.ts src/lib/brana/admin/skenovat-dlouhodobe-zdroje-automaticky.ts src/lib/brana/admin/skupinovy-scan-stav.ts src/lib/brana/admin/redakcni-poradi-uloziste.ts src/lib/brana/admin/redakcni-poradi-validace.ts src/lib/brana/admin/nezarazene-uloziste.ts src/lib/brana/admin/nezarazene.ts",
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
  existsSync(join(koren, "src/lib/brana/admin/radar-vstupy.ts")) &&
    existsSync(join(koren, "src/lib/brana/admin/radar-scan.ts")) &&
    existsSync(join(koren, "src/lib/brana/admin/radar-beh.ts")),
  "G: radar-vstupy.ts, radar-scan.ts a radar-beh.ts existují",
);
assert(
  !radarScanText.includes("ulozitRadarDokument") &&
    !radarScanText.includes("radar-uloziste") &&
    !radarVstupyText.includes("ulozitRadarDokument") &&
    !radarTrebonskoText.includes("zdroj-scan-parser") &&
    !radarZamekText.includes("rozmberska-noc") &&
    !radarScanText.includes("skenovat-zdroj") &&
    !radarScanText.includes("casovy-plan"),
  "G: scan nevolá Blob WRITE ani produkční parsery",
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
  assert(poPouziti.pracovni.length === 0, "2D: Použít vyprázdní pracovni");
  assert(
    poPouziti.historie.length === 1 &&
      poPouziti.historie[0]?.puvod === "RUCNE_NALEZENO" &&
      poPouziti.historie[0]?.id === "hist-rucne" &&
      !poPouziti.historie.some((h) => h.puvod === "RADAR_POUZITO"),
    "2D: Použít nepřidává historii, starší historie zůstává",
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
    poPouziti.smazatOtisky.length === 1 &&
    !poPouziti.historie.some((h) => h.puvod === "RADAR_POUZITO") &&
    !radarTs.includes("pridatRucniKonkretniUdalost") &&
    !radarSeznam.includes("kalendar"),
  "2K: Použít/Smazat nezapisují do Kalendáře; Použít jen otisk",
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

assert(
  BRANA_RADAR_VSTUPY.length === 4 &&
    BRANA_RADAR_VSTUPY.every((v) => v.id && v.url.startsWith("https://")),
  "3A: čtyři veřejné vstupy",
);
assert(
    jeRadarPovolenaGeografie("Chinaski Open air Třeboň") &&
    jeRadarPovolenaGeografie("Zahrada Cep koncert") &&
    jeRadarPovolenaGeografie("Pergola u sv. Víta koncert") &&
    jeRadarPovolenaGeografie("Bratři z růže na zámku Třeboň") &&
    jeRadarPovolenaGeografie("Třeboňská pouť") &&
    !jeRadarPovolenaGeografie(
      "Monkey Business Pátek před Valdaufem https://www.trebonsko.cz/patek-pred-valdaufem",
    ) &&
    !jeRadarPovolenaGeografie(
      "Festival dechových hudeb Karel Vadlauf https://www.trebonsko.cz/festival-dechovych-hudeb-karel-vadlauf",
    ) &&
    !jeRadarPovolenaGeografie(
      "Veselská ozvěna https://www.trebonsko.cz/veselska-ozvena-program-koncertu",
    ) &&
    !jeRadarPovolenaGeografie(
      "Folklorní festival U Zlaté stoky https://www.trebonsko.cz/folklorni-festival-u-zlate-stoky-v-lomnici-n.-l.",
    ) &&
    !jeRadarPovolenaGeografie("Veteránem kolem Světa v Chlumu u Třeboně") &&
    !jeRadarPovolenaGeografie(
      "Vilém Veverka ve Schwarzenberské hrobce https://www.trebonsko.cz/koncert-ve-schwarzenberske-hrobce-festival-okolo-trebone",
    ),
  "3B: geografie fail-closed Třeboň + Cep, okolí ven",
);
assert(
  jeZjevneUzVBrane({
    nazev: "Řemeslné trhy - léto v Třeboni",
    url: "https://www.trebonsko.cz/remeslne-trhy-leto-v-treboni",
  }) &&
    jeZjevneUzVBrane({
      nazev: "O jídle, pití a stolování",
      url: "https://www.zameckalekarnatrebon.cz/",
    }) &&
    !jeZjevneUzVBrane({
      nazev: "Chinaski Open air léto",
      url: "https://www.trebonsko.cz/chinaski-koncert-v-treboni",
    }),
  "3C: zjevné produkční větve se odečtou, Chinaski ne",
);
assert(
  jeZjevnySumProvoz({
    nazev: "Výstava Leonardo",
    datumOd: "2026-04-01",
    datumDo: "2026-09-30",
    cas: "",
    kde: "Třeboň",
    url: "https://www.trebonsko.cz/leonardo",
  }) &&
    !jeZjevnySumProvoz({
      nazev: "Soirée princezny Terezie",
      datumOd: "2026-08-22",
      datumDo: "2026-08-22",
      cas: "18:00",
      kde: "Zámek",
      url: "https://www.zamek-trebon.cz/cs/akce/105130-x",
    }),
  "3D: dlouhodobá výstava je šum, soirée ne",
);

const trebonskoHtml = `<html><body>trebonsko.cz
<li><span>29.08.2026 -</span> <a class="bold" href="/chinaski-koncert-v-treboni">CHINASKI v Třeboni</a></li>
<li><span>20.08.2026 -</span> <a class="bold" href="/martina-partlova-borovany">Martina Pártlová s kapelou na letní scéně Borovany</a></li>
<li><span>21.08.2026 - 22.08.2026 -</span> <a class="bold" href="/remeslne-trhy-leto-v-treboni">Řemeslné trhy - léto v Třeboni</a></li>
<li><span>20.08.2026 -</span> <a class="bold" href="/bila-pani">Bílá paní na vdávání - komedie na zámku</a></li>
<li><span>22.08.2026 - 23.08.2026 -</span> <a class="bold" href="/regata">Mezinárodní třeboňská regata</a></li>
<li><span>20.08.2026 -</span> <a class="bold" href="https://www.zameckalekarnatrebon.cz/c-1">O jídle, pití a stolování - hraná prohlídka v ZL</a></li>
<li><span>01.04.2026 - 30.09.2026 -</span> <a class="bold" href="/leonardo">Výstava Leonardo</a></li>
</body></html>`;
const trebonskoNalezy = vytahnoutRadarTrebonskoNalezy(
  trebonskoHtml,
  "https://www.trebonsko.cz/prehled-akci-trebonsko",
);
assert(
  trebonskoNalezy.some((n) => n.nazev.includes("CHINASKI")) &&
    trebonskoNalezy.some((n) => n.nazev.includes("Bílá paní")),
  "3E: trebonsko extractor čte datované řádky",
);

const zamekDetail = vytahnoutRadarZamekNalezZDetailu(
  `<html><body><h1>TŘEBOŇ: komedie Bílá paní na vdávání</h1>
<div class="event">Státní zámek Třeboň – zámecký park
20. 8. 2026 – 21. 8. 2026
19.00 – 21.00</div><div class="post-text">text</div></body></html>`,
  "https://www.zamek-trebon.cz/cs/akce/105460-trebon-komedie-bila-pani-na-vdavani",
  "Bílá paní na vdávání",
);
assert(
  zamekDetail?.datumOd === "2026-08-20" &&
    zamekDetail.datumDo === "2026-08-21" &&
    zamekDetail.cas === "19:00" &&
    zamekDetail.kde === "Zámecký park",
  "3F: zámek detail má datum, čas a místo ze zdroje",
);

const chinaskiKandidat: BranaRadarScanKandidatVstup = {
  radarVstupId: "trebonsko-prehled",
  datumOd: "2026-08-29",
  cas: "",
  nazev: "CHINASKI v Třeboni",
  kde: "",
  url: "https://www.trebonsko.cz/chinaski-koncert-v-treboni",
};
const soireeKandidat: BranaRadarScanKandidatVstup = {
  radarVstupId: "trebonsko-prehled",
  datumOd: "2026-08-22",
  cas: "",
  nazev: "Soirée princezny Terezie",
  kde: "",
  url: "https://www.trebonsko.cz/hradozamecka-noc-trebon",
};

const historiePredZapisem = pridatRucniNalezDoHistorie(
  vychoziRadarDokument(),
  {
    datumOd: "2026-08-22",
    cas: "",
    nazev: "Jazz",
    kde: "",
    url: "",
  },
  {
    noveId: () => "radar-hist-pred",
    tedIso: "2026-08-20T08:00:00.000Z",
  },
);
const poNovemKandidatovi = zapsatRadarScanDoDokumentu(
  historiePredZapisem,
  [chinaskiKandidat],
  {
    tedIso: "2026-08-20T09:10:00.000Z",
    noveId: () => "radar-auto-1",
    dnesIso: "2026-08-20",
    behDokoncen: true,
  },
);
assert(
  poNovemKandidatovi.pracovni.length === 1 &&
    poNovemKandidatovi.pracovni[0]?.id === "radar-auto-1" &&
    poNovemKandidatovi.pracovni[0]?.nazev === "CHINASKI v Třeboni" &&
    poNovemKandidatovi.pracovni[0]?.radarVstupId === "trebonsko-prehled",
  "4A: nový kandidát se přidá do pracovni",
);

const poDruhemStejnem = zapsatRadarScanDoDokumentu(
  poNovemKandidatovi,
  [chinaskiKandidat],
  {
    tedIso: "2026-08-20T09:20:00.000Z",
    noveId: () => "radar-auto-2",
    dnesIso: "2026-08-20",
    behDokoncen: true,
  },
);
assert(
  poDruhemStejnem.pracovni.length === 1 &&
    poDruhemStejnem.pracovni[0]?.id === "radar-auto-1",
  "4B: stejný fingerprint se podruhé neduplikuje",
);

const poPouzitiOtisku = pouzitRadarStopu(
  poNovemKandidatovi,
  "radar-auto-1",
  { tedIso: "2026-08-20T10:00:00.000Z" },
);
assert(!("chyba" in poPouzitiOtisku), "4C: Použít nad zapsanou stopou projde");
if ("chyba" in poPouzitiOtisku) {
  throw new Error(poPouzitiOtisku.chyba);
}
const poNavratuPouzite = zapsatRadarScanDoDokumentu(
  poPouzitiOtisku,
  [chinaskiKandidat],
  {
    tedIso: "2026-08-20T11:00:00.000Z",
    noveId: () => "radar-auto-3",
    dnesIso: "2026-08-20",
    behDokoncen: true,
  },
);
assert(
  poNavratuPouzite.pracovni.length === 0 &&
    poNavratuPouzite.smazatOtisky.some(
      (o) => o.klic === vytvoritRadarOtiskKlic(chinaskiKandidat),
    ),
  "4C: fingerprint po Použít brání návratu",
);

const predSmazanim = zapsatRadarScanDoDokumentu(
  vychoziRadarDokument(),
  [soireeKandidat],
  {
    tedIso: "2026-08-20T09:10:00.000Z",
    noveId: () => "radar-auto-smazat",
    dnesIso: "2026-08-20",
    behDokoncen: true,
  },
);
const poSmazaniOtisku = smazatRadarStopu(predSmazanim, "radar-auto-smazat");
assert(!("chyba" in poSmazaniOtisku), "4D: Smazat nad zapsanou stopou projde");
if ("chyba" in poSmazaniOtisku) {
  throw new Error(poSmazaniOtisku.chyba);
}
const poNavratuSmazane = zapsatRadarScanDoDokumentu(
  poSmazaniOtisku,
  [soireeKandidat],
  {
    tedIso: "2026-08-20T11:00:00.000Z",
    noveId: () => "radar-auto-4",
    dnesIso: "2026-08-20",
    behDokoncen: true,
  },
);
assert(
  poNavratuSmazane.pracovni.length === 0 &&
    poNavratuSmazane.historie.length === 0,
  "4D: fingerprint po Smazat brání návratu",
);

assert(
  poNovemKandidatovi.historie.length === 1 &&
    poNovemKandidatovi.historie[0]?.id === "radar-hist-pred" &&
    poNovemKandidatovi.historie[0]?.puvod === "RUCNE_NALEZENO" &&
    poDruhemStejnem.historie[0]?.id === "radar-hist-pred",
  "4E: historie zůstává zachovaná",
);

const docSProslou: BranaRadarDokument = {
  ...vychoziRadarDokument(),
  pracovni: [
    {
      id: "stara",
      radarVstupId: "trebonsko-prehled",
      datumOd: "2026-08-01",
      cas: "",
      nazev: "Stará",
      kde: "",
      url: "",
      nalezenoAt: "2026-08-01T00:00:00.000Z",
    },
  ],
  smazatOtisky: [{ klic: "proslý", datumOd: "2026-08-01" }],
  historie: historiePredZapisem.historie.slice(),
  posledniBehAt: "2026-08-01T00:00:00.000Z",
};
const poUkliduZapisu = zapsatRadarScanDoDokumentu(
  docSProslou,
  [chinaskiKandidat],
  {
    tedIso: "2026-08-20T09:10:00.000Z",
    noveId: () => "radar-auto-uklid",
    dnesIso: "2026-08-20",
    behDokoncen: true,
  },
);
assert(
  poUkliduZapisu.pracovni.map((s) => s.id).join(",") === "radar-auto-uklid" &&
    poUkliduZapisu.smazatOtisky.length === 0 &&
    poUkliduZapisu.historie[0]?.id === "radar-hist-pred",
  "4F: prošlé stopy/otisky se uklidí",
);

const bezDokonceni = zapsatRadarScanDoDokumentu(
  historiePredZapisem,
  [chinaskiKandidat],
  {
    tedIso: "2026-08-20T09:10:00.000Z",
    noveId: () => "radar-auto-nedokonceno",
    dnesIso: "2026-08-20",
    behDokoncen: false,
  },
);
assert(
  bezDokonceni.posledniBehAt === null &&
    poNovemKandidatovi.posledniBehAt === "2026-08-20T09:10:00.000Z" &&
    poPouzitiOtisku.posledniBehAt === poNovemKandidatovi.posledniBehAt,
  "4G: posledniBehAt se mění jen po dokončeném RADAR běhu",
);

const idxRadarHook = casovyPlanText.lastIndexOf(
  "spustitRadarPoProdukcnimCronuFailSoft",
);
const idxRazitkoDlouhy = casovyPlanText.lastIndexOf(
  "zaznamenatDokoncenySkupinovyScan",
);
const idxRychlyPush = casovyPlanText.indexOf(
  "vyhodnotitAOdeslatRychleUpozorneniPoScanu",
);
const idxCronReturn = casovyPlanText.lastIndexOf("return NextResponse.json");
assert(
  idxRadarHook > idxRazitkoDlouhy &&
    idxRadarHook > idxRychlyPush &&
    idxRadarHook > 0 &&
    idxRadarHook < idxCronReturn &&
    !casovyPlanText.slice(idxRadarHook).includes("chybneZdrojeNazvy.push") &&
    !casovyPlanText.slice(idxRadarHook).includes("chybneZdroje +") &&
    !casovyPlanText.includes("radarScan") &&
    radarBehText.includes("obalitRadarBehFailSoft") &&
    radarBehText.includes("BRANA_RADAR_WALL_MS = 12_000") &&
    radarBehText.includes("BRANA_RADAR_FETCH_TIMEOUT_MS = 8_000") &&
    !radarBehText.includes("skenovat-zdroj") &&
    !radarBehText.includes("chybneZdrojeNazvy") &&
    !rychlyScanText.includes("radar-beh") &&
    !rychlyScanText.includes("brana-radar") &&
    !dlouhyScanText.includes("radar-beh") &&
    !dlouhyScanText.includes("brana-radar") &&
    radarUloziste.includes("zapsatRadarScanProScheduler") &&
    radarUloziste.includes('BRANA_RADAR_BLOB_CESTA = "data/brana-radar.json"'),
  "4I: RADAR až po razítku; Rychlý/Dlouhý počet chyb se nemění",
);

const poPridaniPoScanu = pridatRucniNalezDoHistorie(
  poNovemKandidatovi,
  {
    datumOd: "2026-08-30",
    cas: "20:00",
    nazev: "Ruční jazz",
    kde: "",
    url: "",
  },
  {
    noveId: () => "radar-rucne-po-scanu",
    tedIso: "2026-08-20T12:00:00.000Z",
  },
);
assert(
  poPridaniPoScanu.pracovni.length === 1 &&
    poPridaniPoScanu.historie.some((h) => h.puvod === "RUCNE_NALEZENO") &&
    poPridaniPoScanu.smazatOtisky.length === 0 &&
    !("chyba" in poPouzitiOtisku) &&
    poPouzitiOtisku.smazatOtisky.length === 1 &&
    !poPouzitiOtisku.historie.some((h) => h.puvod === "RADAR_POUZITO") &&
    poPouzitiOtisku.historie[0]?.id === "radar-hist-pred" &&
    poSmazaniOtisku.historie.length === 0,
  "4J: legacy helper historie / Použít otisk bez historie / Smazat dál fungují",
);

const htmlMapa: Record<string, string> = {
  "https://www.trebonsko.cz/prehled-akci-trebonsko": trebonskoHtml,
  "https://www.zamek-trebon.cz/cs/akce": `<html><body>
<a class="events-filter-month-selector" data-year="2026" data-month="8">srpen</a>
<a href="/cs/akce/105460-trebon-komedie-bila-pani-na-vdavani" class="events__item-title">TŘEBOŇ: komedie Bílá paní na vdávání</a>
<a href="/cs/akce/102057-trebon-rozmberska-noc" class="events__item-title">TŘEBOŇ: Rožmberská noc</a>
</body></html>`,
  "https://www.zamek-trebon.cz/cs/akce/105460-trebon-komedie-bila-pani-na-vdavani":
    `<html><body><h1>TŘEBOŇ: komedie Bílá paní na vdávání</h1>
<div class="event">Státní zámek Třeboň – zámecký park
20. 8. 2026 – 21. 8. 2026
19.00</div><div class="post-text">x</div></body></html>`,
  "https://www.zamek-trebon.cz/cs/akce/102057-trebon-rozmberska-noc":
    `<html><body><h1>TŘEBOŇ: Rožmberská noc</h1>
<div class="event">Zámek
10. 9. 2026 – 12. 9. 2026
18.00</div><div class="post-text">x</div></body></html>`,
  "https://www.kulturapodhvezdami.cz/":
    `<html><body>kulturapodhvezdami
<a href="/cs/kleopatra-17-8-2026-19-30-trebon">Kleopatra / 17. 8. 2026 19:30 / Třeboň</a>
</body></html>`,
  "https://www.trebon-kurzy.cz/":
    `<html>trebon-kurzy<body>14. ročník proběhne v termínu 11. - 16. 8. 2026.</body></html>`,
};

void (async () => {
  const fixtureScan = await spustitRadarScanReadOnly({
    ted: new Date("2026-08-20T08:00:00.000Z"),
    stahnoutHtml: async (url) => {
      const klic = url.split("?")[0] ?? url;
      const html = htmlMapa[klic];
      if (!html) {
        throw new Error(`neočekávané URL ${url}`);
      }
      return html;
    },
  });
  assert(fixtureScan.oknoOd === "2026-08-20", "3G: okno od dnes v Praze");
  assert(fixtureScan.oknoDo === "2026-09-03", "3G: okno +14 dní");
  assert(
    fixtureScan.kandidati.some(
      (k) => k.nazev.includes("Bílá paní") && k.datumOd === "2026-08-20",
    ) &&
      fixtureScan.kandidati.some(
        (k) => k.nazev.includes("Bílá paní") && k.datumOd === "2026-08-21",
      ) &&
      fixtureScan.kandidati.some((k) => /chinaski/i.test(k.nazev)) &&
      fixtureScan.kandidati.some((k) => /regata/i.test(k.nazev)),
    "3H: fixture ponechá Bílou paní, Chinaski a regatu",
  );
  assert(
    !fixtureScan.kandidati.some((k) => /pártlová|partlova/i.test(k.nazev)) &&
      !fixtureScan.kandidati.some((k) => /řemeslné trhy|remeslne trhy/i.test(k.nazev)) &&
      !fixtureScan.kandidati.some((k) => /leonardo/i.test(k.nazev)) &&
      !fixtureScan.kandidati.some((k) => /rožmberská noc|rozmberska noc/i.test(k.nazev)),
    "3I: fixture vyřadí Borovany, trhy, výstavu a Rožmberskou noc",
  );
  assert(
    fixtureScan.oziveni.length === 0 &&
      fixtureScan.podleVstupu.find((p) => p.radarVstupId === "kultura-pod-hvezdami")
        ?.pocet === 0,
    "3J: KPH mimo sezonu v okně je 0 bez oživení",
  );
  assert(
    !radarScanText.includes("ulozitRadarDokument") &&
      fixtureScan.kandidati.every(
        (k) => k.radarVstupId && k.datumOd && k.nazev && typeof k.cas === "string",
      ),
    "3K: kandidát má radarVstupId, datum, název; scan nezapisuje",
  );

  const scanSChybouZamku = await spustitRadarScanReadOnly({
    ted: new Date("2026-08-20T08:00:00.000Z"),
    stahnoutHtml: async (url) => {
      if (url.includes("zamek-trebon.cz")) {
        throw new Error("HTTP 500");
      }
      const klic = url.split("?")[0] ?? url;
      const html = htmlMapa[klic];
      if (!html) {
        throw new Error(`neočekávané URL ${url}`);
      }
      return html;
    },
  });
  assert(
    scanSChybouZamku.chyby.some((c) => c.radarVstupId === "zamek-trebon") &&
      scanSChybouZamku.kandidati.some((k) => /chinaski/i.test(k.nazev)),
    "4H: chyba RADAR vstupu je fail-soft, ostatní pokračují",
  );
  await obalitRadarBehFailSoft(async () => {
    throw new Error("radar boom");
  });
  assert(true, "4H: neočekávaná chyba RADARU nepropadne ven");

  if (selhalo > 0) {
    console.error(`\nFAIL: ${selhalo} kontrol`);
    process.exit(1);
  }
  console.log("\nOK RADAR krok 1+2+3+4");
})().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
