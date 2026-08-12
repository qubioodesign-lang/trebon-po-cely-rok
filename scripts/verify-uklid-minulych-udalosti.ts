/**
 * Ověření kroku 3: expirace + ochrana scanu + cyklus smazat→znovu nepřidat.
 * Spuštění: npx tsx scripts/verify-uklid-minulych-udalosti.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { pridatDny } from "../src/lib/brana/cas";
import {
  dnesIsoVPraze,
  jeUdalostCelaMinula,
  posledniPlatnyDenUdalosti,
  type BranaKonkretniUdalost,
  type BranaStavSchvaleni,
} from "../src/lib/brana/admin/konkretni-udalost";

function isoNa(iso: string) {
  return {
    rok: Number(iso.slice(0, 4)),
    mesic: Number(iso.slice(5, 7)),
    den: Number(iso.slice(8, 10)),
  };
}

function isoZ(d: { rok: number; mesic: number; den: number }): string {
  return `${d.rok}-${String(d.mesic).padStart(2, "0")}-${String(d.den).padStart(2, "0")}`;
}

function udalost(
  id: string,
  datumOd: string,
  datumDo: string,
  stav: BranaStavSchvaleni = "SCHVALENO",
  redakcniPolozkaId: string | null = "pol-1",
): BranaKonkretniUdalost {
  return {
    id,
    redakcniPolozkaId,
    datumOd,
    datumDo,
    cas: "",
    mistoNeboTyp: "t",
    nazev: id,
    rucniPoziceVDni: redakcniPolozkaId === null ? 0 : null,
    stavSchvaleni: stav,
    ...(redakcniPolozkaId !== null ? { scanKlic: `klic-${id}` } : {}),
  };
}

/** Zrcadlo denního úklidu (čistá filtrace). */
function filtrujMinule(
  seznam: readonly BranaKonkretniUdalost[],
  dnesIso: string,
): BranaKonkretniUdalost[] {
  return seznam.filter((u) => !jeUdalostCelaMinula(u, dnesIso));
}

/** Zrcadlo ochrany scanu před matchingem. */
function scanKandidatiPoOchrane(
  kandidati: readonly { datumOd: string; datumDo: string; nazev: string }[],
  dnesIso: string,
): typeof kandidati {
  return kandidati.filter((k) => !jeUdalostCelaMinula(k, dnesIso));
}

let selhalo = 0;
function assert(ok: boolean, popis: string): void {
  if (ok) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhalo += 1;
  console.error(`FAIL ${popis}`);
}

const dnesIso = dnesIsoVPraze();
const vcera = isoZ(pridatDny(isoNa(dnesIso), -1));
const zitra = isoZ(pridatDny(isoNa(dnesIso), 1));
const pred14 = isoZ(pridatDny(isoNa(dnesIso), -14));
const za7 = isoZ(pridatDny(isoNa(dnesIso), 7));
const za60 = isoZ(pridatDny(isoNa(dnesIso), 60));

assert(posledniPlatnyDenUdalosti({ datumOd: "2026-08-14", datumDo: "2026-08-20" }) === "2026-08-20", "C: vícedenní poslední den = datumDo");
assert(posledniPlatnyDenUdalosti({ datumOd: "2026-08-14", datumDo: "" }) === "2026-08-14", "C: prázdné datumDo → datumOd");
assert(posledniPlatnyDenUdalosti({ datumOd: "2026-08-14", datumDo: null }) === "2026-08-14", "C: null datumDo → datumOd");

assert(!jeUdalostCelaMinula({ datumOd: dnesIso, datumDo: dnesIso }, dnesIso), "jednodenní končící dnes ZŮSTÁVÁ");
assert(jeUdalostCelaMinula({ datumOd: vcera, datumDo: vcera }, dnesIso), "jednodenní končící včera je minulá");
assert(!jeUdalostCelaMinula({ datumOd: pred14, datumDo: dnesIso }, dnesIso), "dlouhodobá končící dnes ZŮSTÁVÁ");
assert(jeUdalostCelaMinula({ datumOd: pred14, datumDo: vcera }, dnesIso), "dlouhodobá končící včera je minulá");
assert(!jeUdalostCelaMinula({ datumOd: pred14, datumDo: za60 }, dnesIso), "dlouhodobá probíhající (start minulost, konec budoucnost) ZŮSTÁVÁ");
assert(!jeUdalostCelaMinula({ datumOd: zitra, datumDo: za7 }, dnesIso), "budoucí vícedenní ZŮSTÁVÁ");

const pred = [
  udalost("stara-schvaleno", vcera, vcera, "SCHVALENO"),
  udalost("stara-ceka", vcera, vcera, "CEKA_NA_SCHVALENI"),
  udalost("stara-vyrazeno", vcera, vcera, "VYRAZENO"),
  udalost("stara-rucni", vcera, vcera, "SCHVALENO", null),
  udalost("dnesni", dnesIso, dnesIso, "SCHVALENO"),
  udalost("probihajici", pred14, za7, "SCHVALENO"),
  udalost("budouci", zitra, zitra, "CEKA_NA_SCHVALENI"),
];

const poUklidu = filtrujMinule(pred, dnesIso);
assert(!poUklidu.some((u) => u.id.startsWith("stara-")), "úklid: všechny včerejší stavy pryč");
assert(poUklidu.some((u) => u.id === "dnesni"), "úklid: dnešek zůstává");
assert(poUklidu.some((u) => u.id === "probihajici"), "úklid: probíhající zůstává");
assert(poUklidu.some((u) => u.id === "budouci"), "úklid: budoucí zůstává");
assert(filtrujMinule(poUklidu, dnesIso).length === poUklidu.length, "úklid: idempotentní druhý běh");

const skoncenyKandidat = {
  nazev: "stara-schvaleno",
  datumOd: vcera,
  datumDo: vcera,
};
const znovuZeScanu = scanKandidatiPoOchrane(
  [skoncenyKandidat, { nazev: "dnesni", datumOd: dnesIso, datumDo: dnesIso }],
  dnesIso,
);
assert(
  !znovuZeScanu.some((k) => k.nazev === "stara-schvaleno"),
  "cyklus: skončený kandidát scan IGNORUJE",
);
assert(
  znovuZeScanu.some((k) => k.nazev === "dnesni"),
  "cyklus: dnešní kandidát scan přijme",
);

const poCyklu = [
  ...poUklidu,
  ...znovuZeScanu
    .filter((k) => k.nazev === "stara-schvaleno")
    .map((k) => udalost("znovu", k.datumOd, k.datumDo, "CEKA_NA_SCHVALENI")),
];
assert(
  !poCyklu.some((u) => u.id === "znovu" || u.id === "stara-schvaleno"),
  "cyklus: do udalosti[] se skončená znovu NEPŘIDÁ",
);

const root = join(__dirname, "..");
const scan = readFileSync(join(root, "src/lib/brana/admin/skenovat-zdroj.ts"), "utf8");
const uloziste = readFileSync(
  join(root, "src/lib/brana/admin/konkretni-udalosti-uloziste.ts"),
  "utf8",
);
const route = readFileSync(
  join(root, "src/app/api/brana/casovy-plan/route.ts"),
  "utf8",
);

assert(
  scan.includes("jeUdalostCelaMinula(kandidat") &&
    scan.includes("dnesIsoVPraze()") &&
    /Skončená událost: ignorovat/.test(scan),
  "scan: filtr minulých před matchingem",
);
assert(
  uloziste.includes("uklidMinulychKonkretnichUdalostiProScheduler") &&
    uloziste.includes("jeUdalostCelaMinula"),
  "úklid: funkce v ulozisti",
);
assert(
  route.includes("uklidMinulychKonkretnichUdalostiProScheduler") &&
    route.indexOf("uklidMinulych") < route.indexOf("!jeRychlyTermin && !jeDlouhodobyTermin"),
  "casovy-plan: úklid před early return",
);

if (selhalo > 0) {
  console.error(`\nSelhalo: ${selhalo}`);
  process.exit(1);
}
console.log("\nVšechny kontroly kroku 3 prošly.");
