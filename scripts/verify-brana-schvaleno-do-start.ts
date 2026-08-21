/**
 * Ověření dočasného jednorázového startu SCHVÁLENO DO.
 * Spuštění: npx tsx scripts/verify-brana-schvaleno-do-start.ts
 * Bez Blob WRITE, bez spuštění action.
 */

import { readFileSync } from "fs";
import { join } from "path";
import {
  BRANA_START_PRISTI_KONTROLA_ISO,
  BRANA_START_SCHVALENO_DO_ISO,
  jsonBezSchvalenoDo,
  navrhnoutDokumentSeSchvalenoDo,
  parsovatSchvalenoDoVstup,
  rozhodnoutRollbackSchvalenoDoStartu,
  rozhodnoutZapisSchvalenoDoStartu,
} from "../src/lib/brana/admin/schvaleno-do-start";

let selhalo = 0;

function assert(podminka: boolean, popis: string): void {
  if (podminka) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhalo += 1;
  console.error(`FAIL ${popis}`);
}

const root = join(__dirname, "..");
const akce = readFileSync(
  join(root, "src/app/brana/admin/actions.ts"),
  "utf8",
).replace(/\r\n/g, "\n");
const uloziste = readFileSync(
  join(root, "src/lib/brana/admin/upozorneni-uloziste.ts"),
  "utf8",
).replace(/\r\n/g, "\n");
const kalendarUi = readFileSync(
  join(root, "src/components/brana/admin/BranaAdminKalendarRucniZapis.tsx"),
  "utf8",
);
const upozorneniUi = readFileSync(
  join(root, "src/components/brana/admin/BranaAdminUpozorneniFormulare.tsx"),
  "utf8",
);

const scan = {
  dokoncenoAt: "2026-08-20T07:00:00.000Z",
  chybneZdroje: 0,
  chybneZdrojeNazvy: [] as string[],
};

const zaklad = {
  telefon: "",
  upozorneniAktivni: false,
  pushSubscription: null as null,
  pristiDlouhodobaKontrola: BRANA_START_PRISTI_KONTROLA_ISO,
  posledniDokoncenaDlouhodobaKontrola: "2026-08-10",
  posledniUpozorneniRychle: null as null,
  posledniUpozorneniDlouhodobe: null as null,
  posledniUpozorneniAsistovaneKotva: null as null,
  posledniDlouhySkupinovyScan: scan,
  posledniRychlySkupinovyScan: {
    ...scan,
    dokoncenoAt: "2026-08-21T07:00:00.000Z",
  },
  schvalenoDoIso: null as string | null,
};

const zapisA = rozhodnoutZapisSchvalenoDoStartu(zaklad);
assert(zapisA.typ === "zapsat", "A: správná kotva + null → zapsat");
assert(
  zapisA.typ === "zapsat" &&
    zapisA.puvodniSchvalenoDoIso === null &&
    zapisA.cilSchvalenoDoIso === "2026-09-13",
  "A: původní null, cíl 2026-09-13",
);
const navrhA = navrhnoutDokumentSeSchvalenoDo(zaklad, "2026-09-13");
assert(
  navrhA.schvalenoDoIso === "2026-09-13" &&
    jsonBezSchvalenoDo(navrhA) === jsonBezSchvalenoDo(zaklad),
  "A/F: návrh mění jen schvalenoDoIso",
);

const zapisB = rozhodnoutZapisSchvalenoDoStartu({
  ...zaklad,
  pristiDlouhodobaKontrola: "2026-09-14",
});
assert(zapisB.typ === "stop", "B: jiná kotva → fail-closed");

const zapisC = rozhodnoutZapisSchvalenoDoStartu({
  ...zaklad,
  schvalenoDoIso: "2026-09-27",
});
assert(zapisC.typ === "stop", "C: jiné neprázdné schvalenoDoIso → fail-closed");

const zapisD = rozhodnoutZapisSchvalenoDoStartu({
  ...zaklad,
  schvalenoDoIso: BRANA_START_SCHVALENO_DO_ISO,
});
assert(zapisD.typ === "uz-nastaveno", "D: už 2026-09-13 → žádný write");

const poZapisu = navrhnoutDokumentSeSchvalenoDo(zaklad, "2026-09-13");
const rollbackE = rozhodnoutRollbackSchvalenoDoStartu(poZapisu, null);
assert(
  rollbackE.typ === "zapsat" && rollbackE.cilSchvalenoDoIso === null,
  "E: rollback na null",
);
const navrhE = navrhnoutDokumentSeSchvalenoDo(
  poZapisu,
  rollbackE.typ === "zapsat" ? rollbackE.cilSchvalenoDoIso : "CHYBA",
);
assert(
  navrhE.schvalenoDoIso === null &&
    jsonBezSchvalenoDo(navrhE) === jsonBezSchvalenoDo(poZapisu) &&
    jsonBezSchvalenoDo(navrhE) === jsonBezSchvalenoDo(zaklad),
  "E/F: rollback na null nemění ostatní pole",
);

assert(
  parsovatSchvalenoDoVstup(null).ok &&
    parsovatSchvalenoDoVstup(null).ok &&
    (parsovatSchvalenoDoVstup(null) as { ok: true; hodnota: string | null })
      .hodnota === null,
  "E: vstup null je platný",
);

assert(
  akce.includes("export async function jednorazoveNastavitSchvalenoDoProStartRytmuAkce") &&
    akce.includes(
      "export async function rollbackJednorazovehoSchvalenoDoProStartRytmuAkce",
    ),
  "action i rollback jsou exportované",
);
assert(
  uloziste.includes("jednorazoveNastavitSchvalenoDoProStartRytmu") &&
    uloziste.includes("rollbackJednorazovehoSchvalenoDoProStartRytmu"),
  "uloziste má dočasný writer i rollback",
);
assert(
  !kalendarUi.includes("jednorazoveNastavitSchvalenoDoProStartRytmuAkce") &&
    !upozorneniUi.includes("jednorazoveNastavitSchvalenoDoProStartRytmuAkce"),
  "žádné trvalé UI tlačítko",
);
assert(
  akce.includes("await ulozitSchvalenoDoIsoPoSchvaleniKontrolnihoBloku(blok.blokDoIso)"),
  "hromadné Schválit kontrolu beze změny writeru na blok.blokDoIso",
);

if (selhalo > 0) {
  console.error(`\nSelhalo: ${selhalo}`);
  process.exit(1);
}
console.log("\nOK verify-brana-schvaleno-do-start");
