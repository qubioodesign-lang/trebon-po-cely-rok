/**
 * Ověření připomínky asistovaných zdrojů (kotva − 3) a stáří v Kalendáři.
 * Spuštění: npx tsx scripts/verify-brana-asistovane-priprava.ts
 *
 * Bez Blob WRITE, bez skutečného push, bez scanu.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { textStariAsistovanychZdrojuZVytvoreno } from "../src/lib/brana/admin/asistovane-zdroje-stari";
import {
  isoDenPripravyAsistovanychZdroju,
  vyhodnotitBranaCasovyPlan,
} from "../src/lib/brana/admin/casovy-motor";
import { okamzikZPrahy } from "../src/lib/brana/cas";
import jktMezidokument from "../src/lib/brana/admin/divadlo-jk-tyla-itrebon.json";

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
const route = readFileSync(
  join(koren, "src/app/api/brana/casovy-plan/route.ts"),
  "utf8",
);
const kalendar = readFileSync(
  join(koren, "src/app/brana/admin/sprava/kalendar/page.tsx"),
  "utf8",
);
const rucni = readFileSync(
  join(
    koren,
    "src/components/brana/admin/BranaAdminKalendarRucniZapis.tsx",
  ),
  "utf8",
);
const dlouhodobyScan = readFileSync(
  join(
    koren,
    "src/lib/brana/admin/skenovat-dlouhodobe-zdroje-automaticky.ts",
  ),
  "utf8",
);
const asistovanePush = readFileSync(
  join(
    koren,
    "src/lib/brana/admin/odeslat-asistovane-upozorneni-automaticky.ts",
  ),
  "utf8",
);
const skenovatZdroj = readFileSync(
  join(koren, "src/lib/brana/admin/skenovat-zdroj.ts"),
  "utf8",
);

function praha(
  rok: number,
  mesic: number,
  den: number,
  hodina: number,
  minuta: number,
): Date {
  return okamzikZPrahy(rok, mesic, den, hodina, minuta);
}

function replicaDedup(
  posledniUpozorneniAsistovaneKotva: string | null,
  kotva: string,
): "preskocen" | "poslat" {
  return posledniUpozorneniAsistovaneKotva === kotva ? "preskocen" : "poslat";
}

const KOTVA_PO = "2026-08-24";
const PRIPOMINKA_PA = "2026-08-21";
const KOTVA_PO_2 = "2026-09-14";
const PRIPOMINKA_PA_2 = "2026-09-11";

// A. kotva pondělí → připomínka přesně o 3 kalendářní dny dříve
assert(
  isoDenPripravyAsistovanychZdroju(KOTVA_PO) === PRIPOMINKA_PA,
  "A: pondělí 2026-08-24 → pátek 2026-08-21",
);
const patek9 = vyhodnotitBranaCasovyPlan(
  praha(2026, 8, 21, 9, 0),
  KOTVA_PO,
);
assert(
  patek9.jeAsistovanyPripravnyTermin &&
    !patek9.jeDlouhodobyTermin &&
    !patek9.jeRychlyTermin &&
    patek9.datumVPraze === PRIPOMINKA_PA,
  "A: pátek 9:00 = přípravný termín, bez scanového flagu",
);
const patek8 = vyhodnotitBranaCasovyPlan(
  praha(2026, 8, 21, 8, 0),
  KOTVA_PO,
);
assert(
  !patek8.jeAsistovanyPripravnyTermin,
  "A: pátek 8:00 mimo slot 9:00",
);
const pondeliKotvy = vyhodnotitBranaCasovyPlan(
  praha(2026, 8, 24, 9, 0),
  KOTVA_PO,
);
assert(
  pondeliKotvy.jeDlouhodobyTermin &&
    !pondeliKotvy.jeAsistovanyPripravnyTermin,
  "A: pondělí kotvy není přípravný termín",
);

// B. změna budoucí kotvy posune připomínku
assert(
  isoDenPripravyAsistovanychZdroju(KOTVA_PO_2) === PRIPOMINKA_PA_2,
  "B: kotva 2026-09-14 → 2026-09-11",
);
const patek2 = vyhodnotitBranaCasovyPlan(
  praha(2026, 9, 11, 9, 0),
  KOTVA_PO_2,
);
assert(
  patek2.jeAsistovanyPripravnyTermin && patek2.datumVPraze === PRIPOMINKA_PA_2,
  "B: nová kotva zapne přípravu v nový pátek 9:00",
);
assert(
  !vyhodnotitBranaCasovyPlan(praha(2026, 8, 21, 9, 0), KOTVA_PO_2)
    .jeAsistovanyPripravnyTermin,
  "B: stará páteční kotva už po posunu neplatí",
);

// C. připomínka sama nespouští scan
const idxAsistovanePush = route.indexOf(
  "await vyhodnotitAOdeslatAsistovaneUpozorneniPredKotvou",
);
const idxDlouhodobyScanCall = route.indexOf(
  "dlouhodobyScan = await skenovatDlouhodobeZdrojeAutomaticky()",
);
const idxDlouhodobyIf = route.indexOf("if (jeDlouhodobyTermin)");
const idxEarly = route.indexOf("!jeRychlyTermin && !jeDlouhodobyTermin");
assert(
  idxAsistovanePush > 0 &&
    idxDlouhodobyScanCall > 0 &&
    idxAsistovanePush < idxEarly &&
    idxDlouhodobyScanCall > idxDlouhodobyIf &&
    idxDlouhodobyIf > idxEarly,
  "C: páteční push před early return; dlouhý scan jen v jeDlouhodobyTermin",
);
assert(
  !asistovanePush.includes("skenovatDlouhodobe") &&
    !asistovanePush.includes("skenovatRychle") &&
    !asistovanePush.includes("skenovat-zdroj"),
  "C: odesílač připomínky nevolá scan",
);

// D. dlouhý scan není vázaný na stáří asistovaných zdrojů
assert(
  !dlouhodobyScan.includes("asistovane-zdroje-stari") &&
    !dlouhodobyScan.includes("vytvoreno") &&
    !dlouhodobyScan.includes("textStariAsistovanych"),
  "D: dlouhý scan nečte stáří",
);
assert(
  !route.includes("asistovane-zdroje-stari") &&
    !route.includes("textStariAsistovanych") &&
    !/if\s*\([^)]*vytvoreno/.test(route),
  "D: casovy-plan neblokuje scan stáří",
);
assert(
  !skenovatZdroj.includes("asistovane-zdroje-stari") &&
    !skenovatZdroj.includes("textStariAsistovanych"),
  "D: skenovat-zdroj neblokuje stáří",
);

// E. dedup stejné kotvy (oba cron průchody)
assert(
  asistovanePush.includes(
    "dokument.posledniUpozorneniAsistovaneKotva === kotva",
  ) &&
    asistovanePush.includes('return { stav: "preskocen" }') &&
    asistovanePush.includes(
      "ulozitPosledniUpozorneniAsistovaneKotvuProScheduler(kotva)",
    ),
  "E: dedup podle kotvy, zápis kotvy po odeslání",
);
assert(
  replicaDedup(KOTVA_PO, KOTVA_PO) === "preskocen",
  "E: stejná kotva → přeskočeno",
);
assert(
  replicaDedup(null, KOTVA_PO) === "poslat",
  "E: prázdný záznam → poslat",
);
assert(
  replicaDedup(KOTVA_PO, KOTVA_PO_2) === "poslat",
  "E: nová kotva → znovu poslat",
);

// F. stáří z vytvoreno (Europe/Prague, nejstarší)
assert(
  typeof jktMezidokument.vytvoreno === "string" &&
    jktMezidokument.vytvoreno.length > 0,
  "F: JKT mezidokument má vytvoreno",
);
const dnesPoledne = praha(2026, 8, 18, 12, 0);
assert(
  textStariAsistovanychZdrojuZVytvoreno(
    [jktMezidokument.vytvoreno],
    dnesPoledne,
  ) === "Asistované zdroje aktualizovány dnes",
  "F: JKT vytvoreno v den 2026-08-18 → dnes",
);
assert(
  textStariAsistovanychZdrojuZVytvoreno(
    ["2026-08-17T10:00:00.000Z"],
    dnesPoledne,
  ) === "Asistované zdroje aktualizovány před 1 dnem",
  "F: včerejšek → před 1 dnem",
);
assert(
  textStariAsistovanychZdrojuZVytvoreno(
    ["2026-08-13T10:00:00.000Z"],
    dnesPoledne,
  ) === "Asistované zdroje aktualizovány před 5 dny",
  "F: 5 dní → před 5 dny",
);
assert(
  textStariAsistovanychZdrojuZVytvoreno(
    ["2026-08-18T08:00:00.000Z", "2026-08-10T08:00:00.000Z"],
    dnesPoledne,
  ) === "Asistované zdroje aktualizovány před 8 dny",
  "F: více zdrojů → nejstarší vytvoreno",
);
assert(
  textStariAsistovanychZdrojuZVytvoreno(
    ["2026-08-17T22:00:00.000Z"],
    dnesPoledne,
  ) === "Asistované zdroje aktualizovány dnes",
  "F: UTC večer 17. 8. = 18. 8. v Praze → dnes",
);

// G. trvalý údaj v Kalendáři i mimo Schválit kontrolu
const idxNadpis = kalendar.indexOf("Pracovní kalendář");
const idxAktualizuj = kalendar.indexOf(
  "Aktualizuj všechny asistované zdroje podle uloženého postupu.",
);
const idxCursor = kalendar.indexOf(
  "Vlož do Cursoru → projekt trebon-po-cely-rok",
);
const idxRucniKomponenta = kalendar.indexOf("<BranaAdminKalendarRucniZapis");
assert(
  idxNadpis > 0 &&
    idxAktualizuj > idxNadpis &&
    idxCursor > idxAktualizuj &&
    idxRucniKomponenta > idxCursor &&
    kalendar.includes("{textStariAsistovanych ?") &&
    kalendar.includes("textStariAsistovanychZdroju()") &&
    !kalendar.includes("idCekaKeSchvaleniKontroly.length > 0"),
  "G: stáří + pokyn nahoře v Kalendáři, mimo Schválit kontrolu",
);

// H. stará červená připomínka u Schválit kontrolu pryč
assert(
  !rucni.includes("Před schválením:") &&
    !rucni.includes("text-red-500") &&
    !rucni.includes("Aktualizuj všechny asistované zdroje"),
  "H: červená připomínka nad Schválit kontrolu odstraněna",
);

// I. Schválit kontrolu funkčně beze změny
assert(
  rucni.includes(
    "rucniZapisPovolen && idCekaKeSchvaleniKontroly.length > 0",
  ) && rucni.includes("onClick={schvalitKontrolu}"),
  "I: podmínka a onClick Schválit kontrolu beze změny",
);

if (selhalo > 0) {
  console.error(`\nSelhalo: ${selhalo}`);
  process.exit(1);
}
console.log("\nALL OK verify-brana-asistovane-priprava");
