/**
 * Ověření: „Schválit kontrolu“ = 21denní blok ∪ Výhled (bez blízkého okna).
 * Spuštění: npx tsx scripts/verify-schvalit-kontrolu-bez-blizkeho-okna.ts
 */

import { dnesVPraze, pridatDny } from "../src/lib/brana/cas";
import {
  BRANA_KONTROLNI_BLOK_DNI,
  duvodZamitnutiUdalostiProSchvalitKontrolu,
  isoDnyBlizkehoOknaVPraze,
  kontrolniBlokVPraze,
  patriUdalostDoBlizkehoOkna,
  sestavIdProSchvalitKontrolu,
} from "../src/lib/brana/admin/kontrolni-blok";
import type { BranaKonkretniUdalost } from "../src/lib/brana/admin/konkretni-udalost";

function isoZBranaDatumu(d: { rok: number; mesic: number; den: number }): string {
  return `${d.rok}-${String(d.mesic).padStart(2, "0")}-${String(d.den).padStart(2, "0")}`;
}

function isoNaBranaDatum(iso: string): { rok: number; mesic: number; den: number } {
  return {
    rok: Number(iso.slice(0, 4)),
    mesic: Number(iso.slice(5, 7)),
    den: Number(iso.slice(8, 10)),
  };
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

const blok = kontrolniBlokVPraze();
const blizke = isoDnyBlizkehoOknaVPraze();
const dnesIso = isoZBranaDatumu(dnesVPraze());

assert(blok.rezervaIsoDny.length === 7, "8a: 7denní rezerva má 7 dnů");
assert(
  blok.blokIsoDny.length === BRANA_KONTROLNI_BLOK_DNI &&
    BRANA_KONTROLNI_BLOK_DNI === 21,
  "8b: 21denní blok má 21 dnů",
);

const posledniRezerva = blok.rezervaIsoDny[blok.rezervaIsoDny.length - 1];
const denPoRezerve = isoZBranaDatumu(pridatDny(isoNaBranaDatum(posledniRezerva), 1));
assert(
  denPoRezerve === blok.blokOdIso,
  `8c: 21denní blok navazuje za rezervou bez mezery (${denPoRezerve} === ${blok.blokOdIso})`,
);
assert(
  blizke.length === 8 && blizke[0] === dnesIso,
  "8d: blízké okno = dnes + 7 dnů rezervy (výpočet nezměněn)",
);

const denZaBlokem = isoZBranaDatumu(pridatDny(isoNaBranaDatum(blok.blokDoIso), 1));

const polozkaBezVyhledu = "polozka-bez-vyhledu";
const polozkaSVyhledem = "polozka-s-vyhledem";
const maVyhledAno = (id: string): boolean => id === polozkaSVyhledem;

const idDnes = "ceka-pouze-dnes";
const idRezerva = "ceka-pouze-rezerva";
const idBlokPrvni = "ceka-blok-prvni";
const idBlokPosledni = "ceka-blok-posledni";
const idVyhled = "ceka-vyhled";
const idRucni = "rucni-ceka";
const idSchvaleno = "auto-schvaleno";

const persistovane: BranaKonkretniUdalost[] = [
  udalost(idDnes, dnesIso, "CEKA_NA_SCHVALENI", polozkaBezVyhledu),
  udalost(
    idRezerva,
    blok.rezervaIsoDny[0],
    "CEKA_NA_SCHVALENI",
    polozkaBezVyhledu,
  ),
  udalost(
    idBlokPrvni,
    blok.blokOdIso,
    "CEKA_NA_SCHVALENI",
    polozkaBezVyhledu,
  ),
  udalost(
    idBlokPosledni,
    blok.blokDoIso,
    "CEKA_NA_SCHVALENI",
    polozkaBezVyhledu,
  ),
  udalost(idVyhled, denZaBlokem, "CEKA_NA_SCHVALENI", polozkaSVyhledem),
  udalost(idRucni, blok.blokOdIso, "CEKA_NA_SCHVALENI", null),
  udalost(idSchvaleno, blok.blokOdIso, "SCHVALENO", polozkaBezVyhledu),
];

assert(
  patriUdalostDoBlizkehoOkna(persistovane.find((u) => u.id === idDnes)!, blizke),
  "predpoklad: dnes je v blízkém okně",
);
assert(
  patriUdalostDoBlizkehoOkna(
    persistovane.find((u) => u.id === idRezerva)!,
    blizke,
  ),
  "predpoklad: rezerva je v blízkém okně",
);

const davka = new Set(sestavIdProSchvalitKontrolu(persistovane, maVyhledAno));

assert(!davka.has(idDnes), "1: CEKA pouze dnes NENÍ v dávce");
assert(!davka.has(idRezerva), "2: CEKA pouze v 7denní rezervě NENÍ v dávce");
assert(davka.has(idBlokPrvni), "3: CEKA první den 21denního bloku JE v dávce");
assert(
  davka.has(idBlokPosledni),
  "4: CEKA poslední den 21denního bloku JE v dávce",
);
assert(davka.has(idVyhled), "5: CEKA ve Výhledu JE v dávce");
assert(!davka.has(idRucni), "6: ruční událost NENÍ v dávce");
assert(!davka.has(idSchvaleno), "7: SCHVALENO událost NENÍ v dávce");

const idStaraBlok = "ceka-stara-blok";
const idRychlaRezerva = "ceka-rychla-rezerva";
const idRychlaBlok = "ceka-rychla-blok";
const idRychlaVyhled = "ceka-rychla-vyhled";

const rychleAStare: BranaKonkretniUdalost[] = [
  ...persistovane,
  udalost(idStaraBlok, blok.blokOdIso, "CEKA_NA_SCHVALENI", polozkaBezVyhledu),
  udalost(
    idRychlaRezerva,
    blok.rezervaIsoDny[0],
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
  sestavIdProSchvalitKontrolu(rychleAStare, maVyhledAno),
);

assert(
  davkaRychla.has(idStaraBlok),
  "R1: stará CEKA bez snapshotu v 21denním bloku JE v dávce",
);
assert(
  !davkaRychla.has(idRychlaRezerva),
  "R2: RYCHLÁ CEKA v 7denní rezervě NENÍ v dávce",
);
assert(
  !davkaRychla.has(idRychlaBlok),
  "R3: RYCHLÁ CEKA posunutá do 21denního bloku STÁLE NENÍ v dávce",
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

if (selhalo > 0) {
  console.error(`\nSelhalo: ${selhalo}`);
  process.exit(1);
}

console.log("\nVšechny kontroly prošly.");
