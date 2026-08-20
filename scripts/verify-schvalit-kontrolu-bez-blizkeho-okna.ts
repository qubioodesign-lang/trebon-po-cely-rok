/**
 * Ověření: „Schválit kontrolu“ = pevný 14denní blok ∪ Výhled (bez blízkého okna).
 * Spuštění: npx tsx scripts/verify-schvalit-kontrolu-bez-blizkeho-okna.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { BRANA_DLOUHODOBY_INTERVAL_VYCHOZI } from "../src/lib/brana/admin/zdroj";
import {
  BRANA_KONTROLNI_BLOK_DNI,
  duvodZamitnutiUdalostiProSchvalitKontrolu,
  formatujRozsahKontrolnihoBloku,
  isoDnyBlizkehoOknaVPraze,
  jeZarovnanyDlouhodobyCheckpoint,
  pridejKalendarniDnyKIso,
  sestavIdProSchvalitKontrolu,
  sestavPevnyKontrolniBlok,
  textHraniceKonceKontrolnihoBloku,
  textHraniceSchvalenoDo,
  textHraniceZacatkuKontrolnihoBloku,
  textTlacitkaSchvalitKontrolniBlok,
} from "../src/lib/brana/admin/kontrolni-blok";
import type { BranaKonkretniUdalost } from "../src/lib/brana/admin/konkretni-udalost";

function jePondeliIso(iso: string): boolean {
  const rok = Number(iso.slice(0, 4));
  const mesic = Number(iso.slice(5, 7));
  const den = Number(iso.slice(8, 10));
  return new Date(Date.UTC(rok, mesic - 1, den)).getUTCDay() === 1;
}

function udalost(
  id: string,
  datumOd: string,
  stavSchvaleni: BranaKonkretniUdalost["stavSchvaleni"],
  redakcniPolozkaId: string | null,
  typZdroje?: "RYCHLY",
): BranaKonkretniUdalost {
  return {
    id,
    redakcniPolozkaId,
    datumOd,
    datumDo: datumOd,
    cas: "",
    mistoNeboTyp: "test",
    nazev: id,
    rucniPoziceVDni: redakcniPolozkaId === null ? 0 : null,
    stavSchvaleni,
    ...(typZdroje === "RYCHLY" ? { typZdroje } : {}),
  };
}

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
const akce = readFileSync(join(root, "src/app/brana/admin/actions.ts"), "utf8").replace(/\r\n/g, "\n");
const ui = readFileSync(
  join(root, "src/components/brana/admin/BranaAdminKalendarRucniZapis.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");
const css = readFileSync(
  join(root, "src/app/brana/admin/brana-admin-kalendar.css"),
  "utf8",
).replace(/\r\n/g, "\n");
const upozorneni = readFileSync(
  join(root, "src/lib/brana/admin/upozorneni-uloziste.ts"),
  "utf8",
).replace(/\r\n/g, "\n");
const kontrolniZdroj = readFileSync(
  join(root, "src/lib/brana/admin/kontrolni-blok.ts"),
  "utf8",
).replace(/\r\n/g, "\n");
const casovyMotor = readFileSync(
  join(root, "src/lib/brana/admin/casovy-motor.ts"),
  "utf8",
);
const casovyPlan = readFileSync(
  join(root, "src/app/api/brana/casovy-plan/route.ts"),
  "utf8",
);
const radar = readFileSync(
  join(root, "src/lib/brana/admin/radar.ts"),
  "utf8",
);
const radarScan = readFileSync(
  join(root, "src/lib/brana/admin/radar-scan.ts"),
  "utf8",
);

assert(
  BRANA_KONTROLNI_BLOK_DNI === 14 &&
    BRANA_DLOUHODOBY_INTERVAL_VYCHOZI === 14 &&
    BRANA_KONTROLNI_BLOK_DNI === BRANA_DLOUHODOBY_INTERVAL_VYCHOZI &&
    kontrolniZdroj.includes(
      "export const BRANA_KONTROLNI_BLOK_DNI = BRANA_DLOUHODOBY_INTERVAL_VYCHOZI",
    ) &&
    upozorneni.includes(
      "export const BRANA_UPOZORNENI_DLOUHODOBY_INTERVAL_DNI =\n  BRANA_DLOUHODOBY_INTERVAL_VYCHOZI",
    ),
  "jediná zdrojová pravda: 14 dní (blok i checkpoint aliasují VYCHOZI)",
);

const po31 = pridejKalendarniDnyKIso("2026-08-31", 14);
const po14 = pridejKalendarniDnyKIso("2026-09-14", 14);
assert(po31 === "2026-09-14", "A: 31. 8. + 14 = 14. 9.");
assert(po14 === "2026-09-28", "A: 14. 9. + 14 = 28. 9.");
assert(jePondeliIso("2026-08-31"), "A: 31. 8. 2026 je pondělí");
assert(jePondeliIso("2026-09-14"), "A: 14. 9. 2026 je pondělí");
assert(jePondeliIso("2026-09-28"), "A: 28. 9. 2026 je pondělí");

const kotva31 = {
  posledniDokoncenaDlouhodobaKontrola: "2026-08-31",
  pristiDlouhodobaKontrola: "2026-09-14",
};
const blok = sestavPevnyKontrolniBlok(kotva31);
assert(blok !== null, "B: zarovnaný checkpoint 31. 8. má blok");
assert(
  blok !== null &&
    blok.blokOdIso === "2026-09-14" &&
    blok.blokDoIso === "2026-09-27" &&
    blok.blokIsoDny.length === 14 &&
    blok.blokIsoDny[0] === "2026-09-14" &&
    blok.blokIsoDny[13] === "2026-09-27",
  "B: checkpoint 31. 8. → blok 14. 9. – 27. 9.",
);

const blok3zari = sestavPevnyKontrolniBlok(kotva31);
assert(
  blok3zari !== null &&
    blok !== null &&
    blok3zari.blokOdIso === blok.blokOdIso &&
    blok3zari.blokDoIso === blok.blokDoIso &&
    !kontrolniZdroj.includes("export function kontrolniBlokVPraze"),
  "C: stejný checkpoint 3. 9. → stále 14. 9. – 27. 9. (neklouže podle dneška)",
);

const staraKotva = {
  posledniDokoncenaDlouhodobaKontrola: "2026-08-10",
  pristiDlouhodobaKontrola: "2026-08-31",
};
assert(
  !jeZarovnanyDlouhodobyCheckpoint(staraKotva) &&
    sestavPevnyKontrolniBlok(staraKotva) === null,
  "D: starý 21denní stav 10. 8. / 31. 8. → žádný blok",
);

const kotva14 = {
  posledniDokoncenaDlouhodobaKontrola: "2026-09-14",
  pristiDlouhodobaKontrola: "2026-09-28",
};
const blokPo14 = sestavPevnyKontrolniBlok(kotva14);
assert(
  blokPo14 !== null &&
    blokPo14.blokOdIso === "2026-09-28" &&
    blokPo14.blokDoIso === "2026-10-11",
  "E: checkpoint 14. 9. → blok 28. 9. – 11. 10.",
);

assert(blok !== null && blok.rezervaIsoDny.length === 7, "8a: 7denní rezerva má 7 dnů");
assert(
  isoDnyBlizkehoOknaVPraze().length === 8,
  "8d: blízké okno = dnes + 7 dnů rezervy (výpočet nezměněn)",
);

if (!blok) {
  console.error("\nSelhalo: chybí pevný blok pro dávku");
  process.exit(1);
}

const denZaBlokem = pridejKalendarniDnyKIso(blok.blokDoIso, 1);
if (!denZaBlokem) {
  console.error("\nSelhalo: nelze spočítat den za blokem");
  process.exit(1);
}

const polozkaBezVyhledu = "polozka-bez-vyhledu";
const polozkaSVyhledem = "polozka-s-vyhledem";
const maVyhledAno = (id: string): boolean => id === polozkaSVyhledem;

const idMimoBlok = "ceka-mimo-blok";
const idBlokPrvni = "ceka-blok-prvni";
const idBlokPosledni = "ceka-blok-posledni";
const idVyhled = "ceka-vyhled";
const idRucni = "rucni-ceka";
const idSchvaleno = "auto-schvaleno";
const idVzdaleneSchvaleno = "vzdalene-schvaleno";

const persistovane: BranaKonkretniUdalost[] = [
  udalost(idMimoBlok, "2026-09-03", "CEKA_NA_SCHVALENI", polozkaBezVyhledu),
  udalost(idBlokPrvni, blok.blokOdIso, "CEKA_NA_SCHVALENI", polozkaBezVyhledu),
  udalost(
    idBlokPosledni,
    blok.blokDoIso,
    "CEKA_NA_SCHVALENI",
    polozkaBezVyhledu,
  ),
  udalost(idVyhled, denZaBlokem, "CEKA_NA_SCHVALENI", polozkaSVyhledem),
  udalost(idRucni, blok.blokOdIso, "CEKA_NA_SCHVALENI", null),
  udalost(idSchvaleno, blok.blokOdIso, "SCHVALENO", polozkaBezVyhledu),
  udalost(
    idVzdaleneSchvaleno,
    denZaBlokem,
    "SCHVALENO",
    polozkaSVyhledem,
  ),
];

const davka = new Set(sestavIdProSchvalitKontrolu(persistovane, maVyhledAno, blok));
const davkaBezBloku = sestavIdProSchvalitKontrolu(
  persistovane,
  maVyhledAno,
  null,
);

assert(davkaBezBloku.length === 0, "D2: bez zarovnaného bloku je dávka prázdná");
assert(!davka.has(idMimoBlok), "1: CEKA mimo pevný blok NENÍ v dávce");
assert(davka.has(idBlokPrvni), "3: CEKA první den 14denního bloku JE v dávce");
assert(
  davka.has(idBlokPosledni),
  "4: CEKA poslední den 14denního bloku JE v dávce",
);
assert(davka.has(idVyhled), "5: CEKA ve Výhledu JE v dávce");
assert(!davka.has(idRucni), "6: ruční událost NENÍ v dávce");
assert(!davka.has(idSchvaleno), "7: SCHVALENO událost NENÍ v dávce");
assert(
  !davka.has(idVzdaleneSchvaleno),
  "I: vzdálená SCHVALENO karta / Výhled NENÍ v dávce a nesestavuje schvalenoDoIso",
);

const idStaraBlok = "ceka-stara-blok";
const idRychlaPredLinii = "ceka-rychla-pred-linii";
const idRychlaBlok = "ceka-rychla-blok";
const idRychlaVyhled = "ceka-rychla-vyhled";

const rychleAStare: BranaKonkretniUdalost[] = [
  ...persistovane,
  udalost(idStaraBlok, blok.blokOdIso, "CEKA_NA_SCHVALENI", polozkaBezVyhledu),
  udalost(
    idRychlaPredLinii,
    "2026-09-10",
    "CEKA_NA_SCHVALENI",
    polozkaBezVyhledu,
    "RYCHLY",
  ),
  udalost(
    idRychlaBlok,
    blok.blokOdIso,
    "CEKA_NA_SCHVALENI",
    polozkaBezVyhledu,
    "RYCHLY",
  ),
  udalost(
    idRychlaVyhled,
    denZaBlokem,
    "CEKA_NA_SCHVALENI",
    polozkaSVyhledem,
    "RYCHLY",
  ),
];

const davkaRychla = new Set(
  sestavIdProSchvalitKontrolu(rychleAStare, maVyhledAno, blok),
);

assert(
  davkaRychla.has(idStaraBlok),
  "R1: stará CEKA bez snapshotu v 14denním bloku JE v dávce",
);
assert(
  !davkaRychla.has(idRychlaPredLinii),
  "H: RYCHLÁ CEKA před SCHVÁLENO DO NENÍ v hromadné dávce",
);
assert(
  !davkaRychla.has(idRychlaBlok),
  "R3: RYCHLÁ CEKA v pevném bloku STÁLE NENÍ v dávce",
);
assert(
  !davkaRychla.has(idRychlaVyhled),
  "R4: RYCHLÁ CEKA na kotvě Výhled = ANO mimo blok NENÍ v dávce",
);
assert(
  davkaRychla.has(idVyhled),
  "R4b: DLOUHODOBÁ CEKA ve Výhledu zůstává v dávce",
);

const rychlaProServer = rychleAStare.find((u) => u.id === idRychlaBlok)!;
const staraProServer = rychleAStare.find((u) => u.id === idStaraBlok)!;
assert(
  duvodZamitnutiUdalostiProSchvalitKontrolu(rychlaProServer) ===
    "Kontrolu nelze schválit: dávka obsahuje rychlou událost. Nic nebylo uloženo.",
  "R5: serverová cesta zamítne crafted ID RYCHLÉ CEKA před SCHVALENO",
);
assert(
  duvodZamitnutiUdalostiProSchvalitKontrolu(staraProServer) === null,
  "R5b: stará CEKA bez snapshotu serverová cesta nezamítá",
);

assert(
  formatujRozsahKontrolnihoBloku(blok) === "14. 9. – 27. 9.",
  "T1: rozsah tlačítka bere blokOdIso/blokDoIso téhož sestavPevnyKontrolniBlok",
);
assert(
  textTlacitkaSchvalitKontrolniBlok(blok) ===
    "Schválit kontrolní blok a publikovat 14. 9. – 27. 9.",
  "T2: popisek tlačítka je stejný blok + stejný rozsah",
);
assert(
  formatujRozsahKontrolnihoBloku({
    blokOdIso: "2026-12-24",
    blokDoIso: "2027-01-13",
  }) === "24. 12. 2026 – 13. 1. 2027",
  "T3: přechod roku v rozsahu s rokem",
);

assert(
  textHraniceZacatkuKontrolnihoBloku(blok) ===
    "ZAČÁTEK KONTROLNÍHO BLOKU · 14. 9.",
  "T4: ZAČÁTEK bere přesně blokOdIso téhož sestavPevnyKontrolniBlok",
);
assert(
  textHraniceKonceKontrolnihoBloku(blok) ===
    "KONEC KONTROLNÍHO BLOKU · 27. 9.",
  "T5: KONEC bere přesně blokDoIso téhož sestavPevnyKontrolniBlok",
);
assert(
  textHraniceSchvalenoDo("2026-09-27") === "SCHVÁLENO DO · 27. 9.",
  "T7: červená linie SCHVÁLENO DO jen z iso dne",
);
assert(
  textHraniceZacatkuKontrolnihoBloku({
    blokOdIso: "2026-12-24",
    blokDoIso: "2027-01-13",
  }) === "ZAČÁTEK KONTROLNÍHO BLOKU · 24. 12. 2026" &&
    textHraniceKonceKontrolnihoBloku({
      blokOdIso: "2026-12-24",
      blokDoIso: "2027-01-13",
    }) === "KONEC KONTROLNÍHO BLOKU · 13. 1. 2027",
  "T6: změna rozsahu bloku se projeví na hranicích i v tlačítku",
);

const idxSchvaleni = akce.indexOf(
  "const vysledek = await schvalitKontroluKonkretnichUdalosti",
);
const idxSchvalenoDo = akce.indexOf(
  "await ulozitSchvalenoDoIsoPoSchvaleniKontrolnihoBloku(blok.blokDoIso)",
);
const idxJednotlive = akce.indexOf("export async function schvalitKonkretniUdalostAkce");
const idxHromadne = akce.indexOf("export async function schvalitKontroluAkce");
const jednotliveFn = akce.slice(idxJednotlive, idxHromadne);
const hromadneFn = akce.slice(
  idxHromadne,
  akce.indexOf("export async function upravitAutomatickouCekaUdalostAkce"),
);

assert(
  idxSchvaleni > 0 &&
    idxSchvalenoDo > idxSchvaleni &&
    hromadneFn.includes("if (!blok)") &&
    hromadneFn.includes("Nic nebylo uloženo.") &&
    hromadneFn.includes("ulozitSchvalenoDoIsoPoSchvaleniKontrolnihoBloku(blok.blokDoIso)"),
  "F: hromadné schválení nejdřív karty, teprve při úspěchu schvalenoDoIso = blokDoIso",
);
assert(
  hromadneFn.includes("catch (error)") &&
    idxSchvalenoDo > idxSchvaleni,
  "G: selhání schválení (throw před zápisem schvalenoDoIso) pole neposune",
);
assert(
  !jednotliveFn.includes("ulozitSchvalenoDoIsoPoSchvaleniKontrolnihoBloku") &&
    jednotliveFn.includes("await schvalitKonkretniUdalost(id)"),
  "H2: jednotlivé Schválit schvalenoDoIso nemění",
);
assert(
  (akce.match(/ulozitSchvalenoDoIsoPoSchvaleniKontrolnihoBloku/g) ?? []).length ===
    2 &&
    upozorneni.includes("Nemění schvalenoDoIso") &&
    upozorneni.includes("schvalenoDoIso: schvalenoDo.hodnota") &&
    upozorneni.includes("schvalenoDoIso: null"),
  "I2: schvalenoDoIso zapisuje jen hromadné Schválit; scan/checkpoint/default ho nederivují",
);

assert(
  !ui.includes("ZÍTRA SE PUBLIKUJE") &&
    !ui.includes("SCHVÁLENO K PUBLIKACI") &&
    ui.includes('vyznam="schvaleno-do"') &&
    css.includes("brana-admin-kalendar-orientace-schvaleno-do"),
  "J: staré vizuální čáry nejsou vykreslené; červená SCHVÁLENO DO je",
);

assert(
  casovyMotor.includes("const jeRychlyTermin = veSlotu9 && (jePondeli || jeCtvrtek)") &&
    casovyMotor.includes("BRANA_CASOVY_MOTOR_SLOT_HODINA = 9") &&
    !casovyPlan.includes("schvalenoDoIso") &&
    !casovyPlan.includes("sestavPevnyKontrolniBlok"),
  "K: Rychlý scan Po/Čt · 9:00 a casovy-plan beze změny",
);

assert(
  !radar.includes("schvalenoDoIso") &&
    !radar.includes("sestavPevnyKontrolniBlok") &&
    !radarScan.includes("schvalenoDoIso") &&
    !radarScan.includes("sestavPevnyKontrolniBlok"),
  "L: RADAR beze změny",
);

if (selhalo > 0) {
  console.error(`\nSelhalo: ${selhalo}`);
  process.exit(1);
}

console.log("\nVšechny kontroly prošly.");
