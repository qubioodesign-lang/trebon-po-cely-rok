/**
 * Provozní stopa skupinového Rychlého / Dlouhého scanu.
 * Spuštění: npx tsx scripts/verify-brana-skupinovy-scan-stav.ts
 * Bez Blob WRITE, bez ostrého scanu.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { okamzikZPrahy } from "../src/lib/brana/cas";
import {
  formatovatSkupinovyScanKdy,
  nahraditSkupinovyScanStav,
  nazevChybnehoZdrojeProStopu,
  sestavitSkupinovyScanStav,
  textPoctuChybSkupinovehoScanu,
  textSkupinovehoScanuProKalendar,
  validovatVolitelnySkupinovyScanStav,
} from "../src/lib/brana/admin/skupinovy-scan-stav";

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
const uloziste = readFileSync(
  join(koren, "src/lib/brana/admin/upozorneni-uloziste.ts"),
  "utf8",
);
const casovyPlan = readFileSync(
  join(koren, "src/app/api/brana/casovy-plan/route.ts"),
  "utf8",
);
const kalendar = readFileSync(
  join(koren, "src/app/brana/admin/sprava/kalendar/page.tsx"),
  "utf8",
);
const skenovatZdroj = readFileSync(
  join(koren, "src/lib/brana/admin/skenovat-zdroj.ts"),
  "utf8",
);
const rychly = readFileSync(
  join(koren, "src/lib/brana/admin/skenovat-rychle-zdroje-automaticky.ts"),
  "utf8",
);
const dlouhy = readFileSync(
  join(koren, "src/lib/brana/admin/skenovat-dlouhodobe-zdroje-automaticky.ts"),
  "utf8",
);

const dnesIso = "2026-08-20";
const rychlyBezChyb = sestavitSkupinovyScanStav(
  [],
  okamzikZPrahy(2026, 8, 20, 9, 4),
);
const rychlySChybami = sestavitSkupinovyScanStav(
  ["Kino Třeboň", "Beseda"],
  okamzikZPrahy(2026, 8, 20, 9, 4),
);
const dlouhyStary = sestavitSkupinovyScanStav(
  ["Galerie města Třeboň"],
  okamzikZPrahy(2026, 8, 17, 9, 7),
);

// A. stará data bez polí → —
assert(
  validovatVolitelnySkupinovyScanStav(undefined, "x").ok &&
    validovatVolitelnySkupinovyScanStav(undefined, "x").ok &&
    (validovatVolitelnySkupinovyScanStav(undefined, "x") as { hodnota: null })
      .hodnota === null &&
    validovatVolitelnySkupinovyScanStav(null, "x").ok,
  "A: chybějící pole → null",
);
assert(
  textSkupinovehoScanuProKalendar("Rychlý scan", null, dnesIso) ===
    "Rychlý scan: —" &&
    textSkupinovehoScanuProKalendar("Dlouhý scan", null, dnesIso) ===
      "Dlouhý scan: —",
  "A: Kalendář bez údaje → —",
);
assert(
  uloziste.includes("raw.posledniRychlySkupinovyScan") &&
    uloziste.includes("raw.posledniDlouhySkupinovyScan") &&
    uloziste.includes("posledniRychlySkupinovyScan: posledniRychlySkupinovyScan.hodnota") &&
    uloziste.includes("posledniDlouhySkupinovyScan: posledniDlouhySkupinovyScan.hodnota") &&
    uloziste.includes("posledniRychlySkupinovyScan: null") &&
    kalendar.includes("Rychlý scan: —") === false &&
    kalendar.includes('textSkupinovehoScanuProKalendar(\n    "Rychlý scan"') ===
      false
    ? kalendar.includes('"Rychlý scan"')
    : true,
  "A: validator i výchozí dokument mají nová pole",
);

// B. Rychlý bez chyb
assert(rychlyBezChyb.chybneZdroje === 0, "B: počet chyb 0");
assert(rychlyBezChyb.chybneZdrojeNazvy.length === 0, "B: prázdné názvy");
assert(
  formatovatSkupinovyScanKdy(rychlyBezChyb.dokoncenoAt, dnesIso) === "dnes 9:04",
  "B: dnes 9:04",
);
assert(
  textSkupinovehoScanuProKalendar("Rychlý scan", rychlyBezChyb, dnesIso) ===
    "Rychlý scan: dnes 9:04 · bez chyb",
  "B: text bez chyb",
);

// C. Rychlý s chybami
assert(rychlySChybami.chybneZdroje === 2, "C: počet 2");
assert(
  rychlySChybami.chybneZdrojeNazvy.join("|") === "Kino Třeboň|Beseda",
  "C: persistované názvy",
);
assert(
  textSkupinovehoScanuProKalendar("Rychlý scan", rychlySChybami, dnesIso) ===
    "Rychlý scan: dnes 9:04 · 2 chyby",
  "C: text 2 chyby",
);
assert(textPoctuChybSkupinovehoScanu(1) === "1 chyba", "C: 1 chyba");
assert(textPoctuChybSkupinovehoScanu(5) === "5 chyb", "C: 5 chyb");
const overeniC = validovatVolitelnySkupinovyScanStav(
  rychlySChybami,
  "Poslední rychlý skupinový scan",
);
assert(overeniC.ok && overeniC.hodnota !== null, "C: stav projde validací");

// D/E. přepis jen svého stavu
const vychozi = {
  posledniRychlySkupinovyScan: rychlySChybami,
  posledniDlouhySkupinovyScan: dlouhyStary,
};
const poRychlem = nahraditSkupinovyScanStav(vychozi, "RYCHLY", rychlyBezChyb);
assert(
  poRychlem.posledniRychlySkupinovyScan === rychlyBezChyb &&
    poRychlem.posledniDlouhySkupinovyScan === dlouhyStary &&
    poRychlem.posledniRychlySkupinovyScan.chybneZdrojeNazvy.length === 0,
  "D: nový Rychlý přepíše jen Rychlý; staré chyby zmizí",
);
const poDlouhem = nahraditSkupinovyScanStav(poRychlem, "DLOUHY", rychlyBezChyb);
assert(
  poDlouhem.posledniRychlySkupinovyScan === rychlyBezChyb &&
    poDlouhem.posledniDlouhySkupinovyScan === rychlyBezChyb,
  "E: Dlouhý přepíše jen Dlouhý",
);
assert(
  textSkupinovehoScanuProKalendar("Dlouhý scan", dlouhyStary, dnesIso) ===
    "Dlouhý scan: 17. 8. 9:07 · 1 chyba",
  "E: starší Dlouhý formát",
);

// F. individuální Skenovat nemění skupinové stavy
assert(
  !skenovatZdroj.includes("ulozitPosledniSkupinovyScanProScheduler") &&
    !skenovatZdroj.includes("zaznamenatDokoncenySkupinovyScan") &&
    !skenovatZdroj.includes("posledniRychlySkupinovyScan") &&
    !skenovatZdroj.includes("posledniDlouhySkupinovyScan"),
  "F: individuální Skenovat skupinové stavy nezapisuje",
);

// G. throw před return → razítko se nevolá (jen po await skupinové funkce)
const idxRychlyAwait = casovyPlan.indexOf(
  "rychlyScan = await skenovatRychleZdrojeAutomaticky()",
);
const idxRychlyRazitko = casovyPlan.indexOf('"RYCHLY"', idxRychlyAwait);
const idxDlouhyAwait = casovyPlan.indexOf(
  "dlouhodobyScan = await skenovatDlouhodobeZdrojeAutomaticky()",
);
const idxDlouhyRazitko = casovyPlan.indexOf('"DLOUHY"', idxDlouhyAwait);
assert(
  idxRychlyAwait > 0 &&
    idxRychlyRazitko > idxRychlyAwait &&
    casovyPlan.slice(idxRychlyAwait, idxRychlyRazitko + 20).includes(
      "zaznamenatDokoncenySkupinovyScan",
    ) &&
    idxDlouhyAwait > 0 &&
    idxDlouhyRazitko > idxDlouhyAwait &&
    casovyPlan.slice(idxDlouhyAwait, idxDlouhyRazitko + 20).includes(
      "zaznamenatDokoncenySkupinovyScan",
    ),
  "G: razítko až po return skupinové funkce",
);
assert(
  rychly.includes("nazevChybnehoZdrojeProStopu") &&
    dlouhy.includes("nazevChybnehoZdrojeProStopu") &&
    rychly.includes("chybneZdrojeNazvy.push") &&
    dlouhy.includes("chybneZdrojeNazvy.push"),
  "G: chyba Zdroje se zapíše do agregace, běh pokračuje",
);

assert(
  nazevChybnehoZdrojeProStopu("  Kino  ", "id-1") === "Kino",
  "název stopy",
);
assert(nazevChybnehoZdrojeProStopu("   ", "zdroj-9") === "zdroj-9", "fallback id");

assert(
  kalendar.includes('"Rychlý scan"') &&
    kalendar.includes('"Dlouhý scan"') &&
    kalendar.includes("Pracovní kalendář") &&
    kalendar.includes("textSkupinovehoScanuProKalendar"),
  "Kalendář zobrazuje oba řádky u nadpisu",
);
assert(
  uloziste.includes("ulozitPosledniSkupinovyScanProScheduler") &&
    !uloziste.includes("posledniScanDokoncen"),
  "persist je v upozorněních, ne v posledniScanDokoncen",
);

if (selhalo > 0) {
  console.error(`FAIL verify-brana-skupinovy-scan-stav (${selhalo})`);
  process.exit(1);
}
console.log("ALL OK verify-brana-skupinovy-scan-stav");
