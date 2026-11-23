/**
 * Sekundární deduplikace Třeboňské nocturny. Jen paměť, bez scanu a bez Blobu.
 * Spuštění: npx tsx scripts/verify-brana-nocturna-dedup.ts
 */

import {
  jeUdalostCelaMinula,
  vytvoritScanKlicAutomatickeUdalosti,
  type BranaKonkretniUdalost,
  type BranaStavSchvaleni,
} from "../src/lib/brana/admin/konkretni-udalost";
import {
  aplikovatScanKandidatyNaUdalosti,
  type BranaScanAutomatickaUdalostVstup,
} from "../src/lib/brana/admin/scan-ceka-zapis";

const NOCTURNA = "trebonska-nocturna";
const KINO = "kino-svetozor";
const DNES = "2026-11-23";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    fail(msg);
  }
}

function zaznam(args: {
  id: string;
  polozka: string;
  datum: string;
  cas: string;
  nazev: string;
  identita: string;
  stav: BranaStavSchvaleni;
}): BranaKonkretniUdalost {
  return {
    id: args.id,
    redakcniPolozkaId: args.polozka,
    datumOd: args.datum,
    datumDo: args.datum,
    cas: args.cas,
    mistoNeboTyp: "Divadlo J. K. Tyla",
    nazev: args.nazev,
    rucniPoziceVDni: null,
    stavSchvaleni: args.stav,
    scanKlic: vytvoritScanKlicAutomatickeUdalosti({
      redakcniPolozkaId: args.polozka,
      datumOd: args.datum,
      cas: args.cas,
      nazev: args.nazev,
    }),
    zdrojIdentita: args.identita,
  };
}

function kandidat(args: {
  polozka: string;
  datum: string;
  cas: string;
  nazev: string;
  identita: string;
}): BranaScanAutomatickaUdalostVstup {
  return {
    redakcniPolozkaId: args.polozka,
    datumOd: args.datum,
    datumDo: args.datum,
    cas: args.cas,
    mistoNeboTyp: "Konírna, Zámek Třeboň",
    nazev: args.nazev,
    zdrojIdentita: args.identita,
  };
}

function pouzit(
  existujici: readonly BranaKonkretniUdalost[],
  kandidati: readonly BranaScanAutomatickaUdalostVstup[],
  dnesIso = DNES,
) {
  return aplikovatScanKandidatyNaUdalosti(
    existujici,
    kandidati,
    dnesIso,
    jeUdalostCelaMinula,
  );
}

function overStavBezeZmeny(stav: BranaStavSchvaleni): void {
  const puvodni = zaznam({
    id: `zima-${stav}`,
    polozka: NOCTURNA,
    datum: "2027-01-21",
    cas: "19:00",
    nazev: "Dvořákovo klavírní kvarteto",
    identita: "nocturna|/koncert/4-abonentni-koncert-2",
    stav,
  });
  const pred = JSON.stringify(puvodni);
  const vysledek = pouzit(
    [puvodni],
    [
      kandidat({
        polozka: NOCTURNA,
        datum: "2027-01-21",
        cas: "19:00",
        nazev: "Dvořákovo klavírní kvarteto a Miroslav Táborský",
        identita: "nocturna|/dvorakovo-klavirni-kvarteto-a-miroslav-taborsky",
      }),
    ],
  );
  assert(vysledek.vysledek.pridano === 0, `${stav}: přidáno ${vysledek.vysledek.pridano}`);
  assert(vysledek.vysledek.aktualizovano === 0, `${stav}: aktualizováno`);
  assert(vysledek.zmena === false, `${stav}: zápis se změnil`);
  assert(vysledek.udalosti.length === 1, `${stav}: počet záznamů`);
  assert(JSON.stringify(vysledek.udalosti[0]) === pred, `${stav}: záznam se změnil`);
  console.log(`OK ${stav}: jiná URL a název, stejný den a čas, záznam beze změny`);
}

function overPetLetnich(): void {
  const dny = ["06", "07", "08", "09", "10"];
  const vysledek = pouzit(
    [],
    dny.map((den, i) =>
      kandidat({
        polozka: NOCTURNA,
        datum: `2027-07-${den}`,
        cas: "19:30",
        nazev: `Léto ${i + 1}`,
        identita: `nocturna|/leto-${den}`,
      }),
    ),
  );
  assert(vysledek.vysledek.pridano === 5, `léto přidáno ${vysledek.vysledek.pridano}`);
  assert(vysledek.udalosti.length === 5, "léto: 5 záznamů");
  assert(
    vysledek.udalosti.every((u) => u.stavSchvaleni === "CEKA_NA_SCHVALENI"),
    "léto: vše CEKA",
  );
  assert(
    vysledek.udalosti.map((u) => u.datumOd).join(",") ===
      "2027-07-06,2027-07-07,2027-07-08,2027-07-09,2027-07-10",
    "léto: data",
  );
  console.log("OK léto 6.–10. 7. 2027: 5 nových CEKA");
}

function overMinuly(): void {
  const vysledek = pouzit(
    [],
    [
      kandidat({
        polozka: NOCTURNA,
        datum: "2026-10-15",
        cas: "19:00",
        nazev: "Minulý koncert",
        identita: "nocturna|/minuly",
      }),
    ],
  );
  assert(vysledek.vysledek.pridano === 0, `minulý přidáno ${vysledek.vysledek.pridano}`);
  assert(vysledek.udalosti.length === 0, "minulý: žádný záznam");
  assert(vysledek.zmena === false, "minulý: zápis");
  console.log("OK minulý koncert: 0 nových");
}

function overJinyZdroj(): void {
  const kino = zaznam({
    id: "kino-1",
    polozka: KINO,
    datum: "2027-01-21",
    cas: "19:00",
    nazev: "Film leden",
    identita: "kino|/stary-film",
    stav: "SCHVALENO",
  });
  const pred = JSON.stringify(kino);
  const vysledek = pouzit(
    [kino],
    [
      kandidat({
        polozka: KINO,
        datum: "2027-01-21",
        cas: "19:00",
        nazev: "Film leden nový název",
        identita: "kino|/novy-film",
      }),
    ],
  );
  assert(vysledek.vysledek.pridano === 1, `kino přidáno ${vysledek.vysledek.pridano}`);
  assert(vysledek.udalosti.length === 2, "kino: původní a nová karta");
  assert(JSON.stringify(vysledek.udalosti[0]) === pred, "kino: původní záznam se změnil");
  assert(
    vysledek.udalosti[1].stavSchvaleni === "CEKA_NA_SCHVALENI",
    "kino: nová karta je CEKA",
  );
  console.log("OK jiný zdroj: stejný den a čas založí novou kartu jako dnes");
}

function overDvaStejnySlot(): void {
  const vysledek = pouzit(
    [],
    [
      kandidat({
        polozka: NOCTURNA,
        datum: "2027-07-06",
        cas: "19:30",
        nazev: "Zahájení",
        identita: "nocturna|/zahajeni",
      }),
      kandidat({
        polozka: NOCTURNA,
        datum: "2027-07-06",
        cas: "19:30",
        nazev: "Jiný koncert stejného večera",
        identita: "nocturna|/jiny-vecer",
      }),
    ],
  );
  assert(vysledek.vysledek.pridano === 1, `dvojice přidáno ${vysledek.vysledek.pridano}`);
  assert(vysledek.vysledek.jizExistuje === 1, "dvojice: druhý je existující");
  assert(vysledek.udalosti.length === 1, "dvojice: jeden záznam");
  assert(vysledek.udalosti[0].nazev === "Zahájení", "dvojice: zůstane první kandidát");
  assert(
    vysledek.udalosti[0].zdrojIdentita === "nocturna|/zahajeni",
    "dvojice: identita prvního",
  );
  console.log("OK dva koncerty Nocturny ve stejný den a čas: druhý se nezaloží");
}

overStavBezeZmeny("CEKA_NA_SCHVALENI");
overStavBezeZmeny("SCHVALENO");
overStavBezeZmeny("VYRAZENO");
overPetLetnich();
overMinuly();
overJinyZdroj();
overDvaStejnySlot();
console.log("VŠE OK — nocturna sekundární deduplikace");
