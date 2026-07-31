/**
 * Ověření denní/noční režimu BRÁNY podle východu a západu slunce v Třeboni.
 * Spuštění: npm run test:brana-denni-doba
 */

import {
  dalsiZmenaDenniDobyVPraze,
  jeNocniRezimVPraze,
  okamzikVPraze,
  okamzikZPrahy,
  prepnutiDenniDobyVPraze,
} from "../src/lib/brana/cas";
import { BRANA_CASOVA_KONFIGURACE } from "../src/lib/brana/cas/konfigurace";

function praha(
  rok: number,
  mesic: number,
  den: number,
  hodina: number,
  minuta: number,
): Date {
  return okamzikZPrahy(rok, mesic, den, hodina, minuta);
}

function formatCas(okamzik: Date): string {
  const { hodina, minuta } = okamzikVPraze(okamzik);
  return `${String(hodina).padStart(2, "0")}:${String(minuta).padStart(2, "0")}`;
}

type Pripad = {
  popis: string;
  okamzik: Date;
  ocekavanoNoc: boolean;
};

const pripady: Pripad[] = [
  {
    popis: "Letní den – uprostřed dne",
    okamzik: praha(2026, 7, 31, 12, 0),
    ocekavanoNoc: false,
  },
  {
    popis: "Letní den – těsně před ranním přepnutím",
    okamzik: new Date(
      prepnutiDenniDobyVPraze({ rok: 2026, mesic: 7, den: 31 }).ranniPrepnuti.getTime() -
        60_000,
    ),
    ocekavanoNoc: true,
  },
  {
    popis: "Letní den – v okamžiku ranního přepnutí",
    okamzik: prepnutiDenniDobyVPraze({ rok: 2026, mesic: 7, den: 31 }).ranniPrepnuti,
    ocekavanoNoc: false,
  },
  {
    popis: "Letní den – těsně před večerním přepnutím",
    okamzik: new Date(
      prepnutiDenniDobyVPraze({ rok: 2026, mesic: 7, den: 31 }).vecerniPrepnuti.getTime() -
        60_000,
    ),
    ocekavanoNoc: false,
  },
  {
    popis: "Letní den – v okamžiku večerního přepnutí",
    okamzik: prepnutiDenniDobyVPraze({ rok: 2026, mesic: 7, den: 31 }).vecerniPrepnuti,
    ocekavanoNoc: true,
  },
  {
    popis: "Zimní den – uprostřed dne",
    okamzik: praha(2026, 1, 15, 12, 0),
    ocekavanoNoc: false,
  },
  {
    popis: "Přechod na letní čas – noc před ranním přepnutím",
    okamzik: new Date(
      prepnutiDenniDobyVPraze({ rok: 2026, mesic: 3, den: 29 }).ranniPrepnuti.getTime() -
        60_000,
    ),
    ocekavanoNoc: true,
  },
  {
    popis: "Přechod na letní čas – den po ranním přepnutí",
    okamzik: prepnutiDenniDobyVPraze({ rok: 2026, mesic: 3, den: 29 }).ranniPrepnuti,
    ocekavanoNoc: false,
  },
  {
    popis: "Přechod na zimní čas – večer po přepnutí",
    okamzik: prepnutiDenniDobyVPraze({ rok: 2026, mesic: 10, den: 25 }).vecerniPrepnuti,
    ocekavanoNoc: true,
  },
];

let chyby = 0;

for (const pripad of pripady) {
  const vysledek = jeNocniRezimVPraze(pripad.okamzik);

  if (vysledek === pripad.ocekavanoNoc) {
    console.log(`OK  ${pripad.popis}`);
    continue;
  }

  chyby++;
  console.error(`CHYBA ${pripad.popis}`);
  console.error(`  očekáváno noc=${pripad.ocekavanoNoc}, vráceno noc=${vysledek}`);
}

const letniPrepnuti = prepnutiDenniDobyVPraze({ rok: 2026, mesic: 7, den: 31 });
console.log(
  `\nLetní přepnutí 31. 7. 2026: ráno ${formatCas(letniPrepnuti.ranniPrepnuti)}, večer ${formatCas(letniPrepnuti.vecerniPrepnuti)}`,
);

const predVecernim = new Date(letniPrepnuti.vecerniPrepnuti.getTime() - 60_000);
const dalsi = dalsiZmenaDenniDobyVPraze(predVecernim);

if (dalsi.getTime() === letniPrepnuti.vecerniPrepnuti.getTime()) {
  console.log("OK  Další změna před večerním přepnutím míří na večerní okamžik");
} else {
  chyby++;
  console.error("CHYBA Další změna před večerním přepnutím");
  console.error(`  očekáváno ${formatCas(letniPrepnuti.vecerniPrepnuti)}, vráceno ${formatCas(dalsi)}`);
}

const poVecernim = new Date(letniPrepnuti.vecerniPrepnuti.getTime() + 60_000);
const dalsiRano = dalsiZmenaDenniDobyVPraze(poVecernim);
const zitraRano = prepnutiDenniDobyVPraze({ rok: 2026, mesic: 8, den: 1 }).ranniPrepnuti;

if (dalsiRano.getTime() === zitraRano.getTime()) {
  console.log("OK  Další změna po večerním přepnutí míří na zítřejší ranní okamžik");
} else {
  chyby++;
  console.error("CHYBA Další změna po večerním přepnutím");
  console.error(`  očekáváno ${formatCas(zitraRano)}, vráceno ${formatCas(dalsiRano)}`);
}

const { fallback } = BRANA_CASOVA_KONFIGURACE.denniDoba;
const fallbackPredSest = praha(2026, 7, 31, fallback.zacatekDne.hodina, 0);
const fallbackPoSest = new Date(fallbackPredSest.getTime() + 60_000);
const fallbackPredOsmnact = praha(2026, 7, 31, fallback.zacatekNoci.hodina, 0);
const fallbackPoOsmnact = new Date(fallbackPredOsmnact.getTime() + 60_000);

function jeNocPodleFallbacku(okamzik: Date): boolean {
  const { hodina, minuta } = okamzikVPraze(okamzik);
  const minuty = hodina * 60 + minuta;
  const ranni = fallback.zacatekDne.hodina * 60 + fallback.zacatekDne.minuta;
  const vecerni = fallback.zacatekNoci.hodina * 60 + fallback.zacatekNoci.minuta;

  return minuty < ranni || minuty >= vecerni;
}

if (
  jeNocPodleFallbacku(new Date(fallbackPredSest.getTime() - 60_000)) &&
  !jeNocPodleFallbacku(fallbackPoSest) &&
  !jeNocPodleFallbacku(new Date(fallbackPredOsmnact.getTime() - 60_000)) &&
  jeNocPodleFallbacku(fallbackPoOsmnact)
) {
  console.log("OK  Záložní logika 06:00 / 20:00 v Europe/Prague");
} else {
  chyby++;
  console.error("CHYBA Záložní logika 06:00 / 20:00");
}

if (chyby > 0) {
  console.error(`\n${chyby} chyb`);
  process.exit(1);
}

console.log(`\nVšechny ${pripady.length + 3} hraniční situace prošly.`);
