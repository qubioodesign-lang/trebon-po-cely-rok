/**
 * Akcí na víkend: okno, počet z už načtených dat, beze změny projekce.
 * Spuštění: npx tsx scripts/verify-akci-na-vikend.ts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { okamzikZPrahy } from "../src/lib/brana/cas";
import type { BranaKonkretniUdalost } from "../src/lib/brana/admin/konkretni-udalost";
import type { BranaRedakcniPolozkaStav } from "../src/lib/brana/admin/redakcni-kostra";
import {
  isoDenPrahy,
  jeOknoAkciNaVikend,
  maSeZobrazitAkciNaVikend,
  pripojitVolitelnyPocet,
  vetaParkuASdeleniSeNekryji,
} from "../src/lib/brana/sdileni-akci-na-vikend";
import { verejnaVetaZameckehoParku } from "../src/lib/brana/zamecky-park";
import {
  projektujSchvaleneDoVerejnehoPohledu,
  sestavVerejnaCasovaOkna,
  sestavitDnesSPoctemAkciNaVikend,
} from "../src/lib/brana/verejne-schvalene-pohledy";

function praha(
  rok: number,
  mesic: number,
  den: number,
  hodina: number,
  minuta: number,
): Date {
  return okamzikZPrahy(rok, mesic, den, hodina, minuta);
}

function overit(podminka: boolean, popis: string): void {
  if (!podminka) {
    throw new Error(popis);
  }
}

function polozka(
  id: string,
  pouzivat: "ANO" | "NE",
): BranaRedakcniPolozkaStav {
  return {
    id,
    polozka: id,
    pouzivat,
    priorita: 1,
    subpriorita: 1,
    vyhled: "NE",
    vyhledSerie: true,
    poznamka: "",
    mimoKostru: false,
    jazykVerejny: null,
  };
}

function udalost(
  id: string,
  od: string,
  dok: string,
  doplnek: Partial<BranaKonkretniUdalost> = {},
): BranaKonkretniUdalost {
  return {
    id,
    redakcniPolozkaId: null,
    datumOd: od,
    datumDo: dok,
    cas: "18:00",
    mistoNeboTyp: "Místo",
    nazev: id,
    rucniPoziceVDni: 0,
    stavSchvaleni: "SCHVALENO",
    ...doplnek,
  };
}

const PONDĚLI = praha(2026, 8, 3, 10, 0);
const PONDĚLI_PRED = praha(2026, 8, 3, 6, 59);
const PONDĚLI_SEDMA = praha(2026, 8, 3, 7, 0);
const PONDĚLI_UPOZORNENI = praha(2026, 8, 3, 19, 15);
const PONDĚLI_ZAVRENO = praha(2026, 8, 3, 22, 0);
const UTERY = praha(2026, 8, 4, 10, 0);
const CTVRTEK = praha(2026, 8, 6, 10, 0);
const CTVRTEK_UPOZORNENI = praha(2026, 8, 6, 19, 15);

const udalosti: BranaKonkretniUdalost[] = [
  udalost("sobota", "2026-08-08", "2026-08-08"),
  udalost("nedele", "2026-08-09", "2026-08-09"),
  udalost("oba-dny", "2026-08-08", "2026-08-09"),
  udalost("ceka", "2026-08-08", "2026-08-08", {
    stavSchvaleni: "CEKA_NA_SCHVALENI",
  }),
  udalost("ukazka-sobota", "2026-08-08", "2026-08-08"),
  udalost("jen-dnes", "2026-08-08", "2026-08-08", { pouzeDnes: true }),
  udalost("mimo", "2026-08-08", "2026-08-08", {
    redakcniPolozkaId: "mimo",
    rucniPoziceVDni: null,
  }),
  udalost("v-poradi", "2026-08-08", "2026-08-08", {
    redakcniPolozkaId: "kino",
    rucniPoziceVDni: null,
  }),
  udalost("dnesni", "2026-08-03", "2026-08-03"),
];

const polozky = [polozka("mimo", "NE"), polozka("kino", "ANO")];

function projekce(
  stranka: "dnes" | "vikend",
  okamzik: Date,
) {
  return projektujSchvaleneDoVerejnehoPohledu({
    stranka,
    udalosti,
    redakcniPolozky: polozky,
    okna: sestavVerejnaCasovaOkna(okamzik),
  });
}

overit(jeOknoAkciNaVikend(PONDĚLI_SEDMA), "pondělí 7:00 je okno");
overit(jeOknoAkciNaVikend(PONDĚLI), "pondělí dopoledne je okno");
overit(jeOknoAkciNaVikend(CTVRTEK), "čtvrtek dopoledne je okno");
overit(!jeOknoAkciNaVikend(PONDĚLI_PRED), "6:59 okno není");
overit(!jeOknoAkciNaVikend(PONDĚLI_UPOZORNENI), "začátek upozornění okno není");
overit(!jeOknoAkciNaVikend(CTVRTEK_UPOZORNENI), "čtvrteční upozornění okno není");
overit(!jeOknoAkciNaVikend(PONDĚLI_ZAVRENO), "zavřený park okno není");
overit(!jeOknoAkciNaVikend(UTERY), "úterý okno není");
overit(!jeOknoAkciNaVikend(praha(2026, 8, 8, 10, 0)), "sobota okno není");

const dnesPrimo = projekce("dnes", PONDĚLI);
const vikendPrimo = projekce("vikend", PONDĚLI);
const sestava = sestavitDnesSPoctemAkciNaVikend({
  udalosti,
  redakcniPolozky: polozky,
  okamzik: PONDĚLI,
});

overit(
  JSON.stringify(sestava.data) === JSON.stringify(dnesPrimo),
  "projekce DNES zůstala stejná",
);
overit(dnesPrimo.bloky?.[0]?.length === 1, "DNES má jen dnešní akci");
overit(dnesPrimo.akce[0]?.nazev === "dnesni", "DNES ukazuje dnešní akci");

const sobota = vikendPrimo.bloky?.[0]?.length ?? -1;
const nedele = vikendPrimo.bloky?.[1]?.length ?? -1;
overit(sobota === 3, `sobota má 3 řádky, ne ${sobota}`);
overit(nedele === 2, `neděle má 2 řádky, ne ${nedele}`);
overit(
  sestava.pocet === sobota + nedele,
  "počet je součet víkendových řádků a vícedenní akce je dvakrát",
);
overit(sestava.pocet === 5, "očekávaný součet je 5");
overit(sestava.oknoIso === "2026-08-03", "okno nese pražské pondělí");

const vikendZnovu = projekce("vikend", PONDĚLI);
overit(
  JSON.stringify(vikendZnovu) === JSON.stringify(vikendPrimo),
  "projekce VÍKEND je při stejném vstupu stejná",
);

const nula = sestavitDnesSPoctemAkciNaVikend({
  udalosti: [],
  redakcniPolozky: [],
  okamzik: PONDĚLI,
});
overit(nula.pocet === 0, "prázdný víkend je nula, ne chyba");
overit(nula.oknoIso === null, "nula nemá okno pro větu");
overit(
  !maSeZobrazitAkciNaVikend(PONDĚLI, nula.pocet, nula.oknoIso),
  "při nule se věta nezobrazí",
);

const mimo = sestavitDnesSPoctemAkciNaVikend({
  udalosti,
  redakcniPolozky: polozky,
  okamzik: UTERY,
});
overit(mimo.pocet === null, "mimo okno se počet nepočítá");
overit(
  JSON.stringify(mimo.data) ===
    JSON.stringify(projekce("dnes", UTERY)),
  "mimo okno zůstává původní DNES",
);

const puvodni = { znacka: "dnes-data" };
const poChybe = pripojitVolitelnyPocet(puvodni, () => {
  throw new Error("výpočet počtu selhal");
});
overit(poChybe.data === puvodni, "chyba počtu nechá původní data");
overit(poChybe.pocet === null && poChybe.oknoIso === null, "chyba počtu nedá číslo");

const oknoPondeli = isoDenPrahy(PONDĚLI);
overit(
  maSeZobrazitAkciNaVikend(PONDĚLI, 5, oknoPondeli),
  "v okně se kladný počet zobrazí",
);
overit(
  !maSeZobrazitAkciNaVikend(PONDĚLI_UPOZORNENI, 5, oknoPondeli),
  "v upozornění parku věta zmizí",
);
overit(
  verejnaVetaZameckehoParku(PONDĚLI_UPOZORNENI, null) !== null,
  "v upozornění park svou větu má",
);
overit(
  !maSeZobrazitAkciNaVikend(CTVRTEK, 5, oknoPondeli),
  "staré pondělní číslo ve čtvrtek nezůstane",
);
overit(
  maSeZobrazitAkciNaVikend(CTVRTEK, 5, isoDenPrahy(CTVRTEK)),
  "čtvrtek ukáže jen číslo ze čtvrtka",
);

const casy = [
  PONDĚLI_PRED,
  PONDĚLI_SEDMA,
  PONDĚLI,
  PONDĚLI_UPOZORNENI,
  PONDĚLI_ZAVRENO,
  UTERY,
  CTVRTEK,
  CTVRTEK_UPOZORNENI,
];
const skrytyPark = praha(2026, 8, 4, 7, 0).toISOString();
for (const cas of casy) {
  overit(
    vetaParkuASdeleniSeNekryji(cas, 5, oknoPondeli, null),
    "park a sdělení se nekryjí",
  );
  overit(
    vetaParkuASdeleniSeNekryji(cas, 5, oknoPondeli, skrytyPark),
    "ruční skrytí parku sdělení nepřidá",
  );
}
overit(
  !maSeZobrazitAkciNaVikend(PONDĚLI_ZAVRENO, 5, oknoPondeli),
  "skrytý zavřený park okno nerozšíří",
);

const zdroj = readFileSync(
  resolve(process.cwd(), "src/lib/brana/verejne-schvalene-pohledy.ts"),
  "utf8",
);
const teloNacteni = zdroj.slice(
  zdroj.indexOf("export async function nactiVerejnaDataDnesSPoctemAkciNaVikend"),
  zdroj.indexOf("export function prazdnaVerejnaPohledovaDataPriChybe"),
);
overit(
  teloNacteni.includes("nacistPodkladyVerejneProjekce()"),
  "DNES s počtem používá společné načtení",
);
overit(
  !teloNacteni.includes("nacistKonkretniUdalostiProVerejnouProjekci"),
  "počet nepřidává druhé čtení událostí",
);
overit(
  !teloNacteni.includes("nacistRedakcniPoradiProScheduler"),
  "počet nepřidává druhé čtení redakce",
);
const teloPodkladu = zdroj.slice(
  zdroj.indexOf("async function nacistPodkladyVerejneProjekce"),
  zdroj.indexOf("export async function nactiVerejneSchvalenePohledovaData"),
);
overit(
  teloPodkladu.split("Promise.all").length === 2,
  "podklady mají jediné souběžné načtení",
);

console.log("Akcí na víkend: všechna ověření prošla.");
