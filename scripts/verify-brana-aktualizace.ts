/**
 * Ověření logiky textu aktualizace BRÁNY – přepínání 6:00 / 15:30 v Europe/Prague.
 * Spuštění: npx tsx scripts/verify-brana-aktualizace.ts
 */

import {
  textAktualizaceVPraze,
  zdrojCasuAktualizace,
} from "../src/lib/brana/aktualizace";
import { okamzikZPrahy } from "../src/lib/brana/cas";

type Pripad = {
  popis: string;
  okamzik: Date;
  ocekavanyText: string;
  ocekavanaHodina: number;
  ocekavanaMinuta: number;
};

function praha(
  rok: number,
  mesic: number,
  den: number,
  hodina: number,
  minuta: number,
): Date {
  return okamzikZPrahy(rok, mesic, den, hodina, minuta);
}

const pripady: Pripad[] = [
  {
    popis: "Před ranní aktualizací",
    okamzik: praha(2026, 8, 1, 5, 59),
    ocekavanyText: "Aktualizováno dnes v 15:30",
    ocekavanaHodina: 15,
    ocekavanaMinuta: 30,
  },
  {
    popis: "Ranní aktualizace",
    okamzik: praha(2026, 8, 1, 6, 0),
    ocekavanyText: "Aktualizováno dnes v 6:00",
    ocekavanaHodina: 6,
    ocekavanaMinuta: 0,
  },
  {
    popis: "Dopoledne",
    okamzik: praha(2026, 8, 1, 10, 0),
    ocekavanyText: "Aktualizováno dnes v 6:00",
    ocekavanaHodina: 6,
    ocekavanaMinuta: 0,
  },
  {
    popis: "Těsně před odpolední aktualizací",
    okamzik: praha(2026, 8, 1, 15, 29),
    ocekavanyText: "Aktualizováno dnes v 6:00",
    ocekavanaHodina: 6,
    ocekavanaMinuta: 0,
  },
  {
    popis: "Odpolední aktualizace",
    okamzik: praha(2026, 8, 1, 15, 30),
    ocekavanyText: "Aktualizováno dnes v 15:30",
    ocekavanaHodina: 15,
    ocekavanaMinuta: 30,
  },
  {
    popis: "Večer",
    okamzik: praha(2026, 8, 1, 22, 0),
    ocekavanyText: "Aktualizováno dnes v 15:30",
    ocekavanaHodina: 15,
    ocekavanaMinuta: 30,
  },
  {
    popis: "Po půlnoci",
    okamzik: praha(2026, 8, 2, 2, 0),
    ocekavanyText: "Aktualizováno dnes v 15:30",
    ocekavanaHodina: 15,
    ocekavanaMinuta: 30,
  },
];

let chyby = 0;

for (const pripad of pripady) {
  const text = textAktualizaceVPraze(pripad.okamzik);
  const cas = zdrojCasuAktualizace(pripad.okamzik);
  const textOk = text === pripad.ocekavanyText;
  const casOk =
    cas.hodina === pripad.ocekavanaHodina &&
    cas.minuta === pripad.ocekavanaMinuta;

  if (textOk && casOk) {
    console.log(`OK  ${pripad.popis} → ${text}`);
    continue;
  }

  chyby++;
  console.error(`CHYBA ${pripad.popis}`);
  console.error(`  očekáváno ${pripad.ocekavanyText}`);
  console.error(`  vráceno  ${text}`);
}

if (chyby > 0) {
  console.error(`\n${chyby} chyb`);
  process.exit(1);
}

console.log(`\nVšechny ${pripady.length} hraniční situace prošly.`);
