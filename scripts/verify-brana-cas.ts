/**
 * Ověření centrální časové logiky BRÁNY – víkend, pásmo Europe/Prague.
 * Spuštění: npm run test:brana-cas
 */

import {
  aktualniVikendVPraze,
  formatDatumKratce,
  okamzikZPrahy,
  type BranaDatum,
} from "../src/lib/brana/cas";

type OcekavanyVikend = {
  popis: string;
  okamzik: Date;
  sobota: BranaDatum;
  nedele: BranaDatum;
};

function stejneDatum(a: BranaDatum, b: BranaDatum): boolean {
  return a.rok === b.rok && a.mesic === b.mesic && a.den === b.den;
}

function datum(rok: number, mesic: number, den: number): BranaDatum {
  return { rok, mesic, den };
}

function praha(
  rok: number,
  mesic: number,
  den: number,
  hodina: number,
  minuta: number,
): Date {
  return okamzikZPrahy(rok, mesic, den, hodina, minuta);
}

const pripady: OcekavanyVikend[] = [
  {
    popis: "Pondělí během dne",
    okamzik: praha(2026, 8, 3, 10, 0),
    sobota: datum(2026, 8, 8),
    nedele: datum(2026, 8, 9),
  },
  {
    popis: "Pátek během dne",
    okamzik: praha(2026, 8, 7, 15, 30),
    sobota: datum(2026, 8, 8),
    nedele: datum(2026, 8, 9),
  },
  {
    popis: "Sobota během dne",
    okamzik: praha(2026, 8, 8, 12, 0),
    sobota: datum(2026, 8, 8),
    nedele: datum(2026, 8, 9),
  },
  {
    popis: "Neděle 21:59",
    okamzik: praha(2026, 8, 9, 21, 59),
    sobota: datum(2026, 8, 8),
    nedele: datum(2026, 8, 9),
  },
  {
    popis: "Neděle 22:00",
    okamzik: praha(2026, 8, 9, 22, 0),
    sobota: datum(2026, 8, 15),
    nedele: datum(2026, 8, 16),
  },
  {
    popis: "Neděle 22:01",
    okamzik: praha(2026, 8, 9, 22, 1),
    sobota: datum(2026, 8, 15),
    nedele: datum(2026, 8, 16),
  },
  {
    popis: "Přechod na letní čas – neděle 21:59",
    okamzik: praha(2026, 3, 29, 21, 59),
    sobota: datum(2026, 3, 28),
    nedele: datum(2026, 3, 29),
  },
  {
    popis: "Přechod na letní čas – neděle 22:00",
    okamzik: praha(2026, 3, 29, 22, 0),
    sobota: datum(2026, 4, 4),
    nedele: datum(2026, 4, 5),
  },
  {
    popis: "Přechod na zimní čas – neděle 21:59",
    okamzik: praha(2026, 10, 25, 21, 59),
    sobota: datum(2026, 10, 24),
    nedele: datum(2026, 10, 25),
  },
  {
    popis: "Přechod na zimní čas – neděle 22:00",
    okamzik: praha(2026, 10, 25, 22, 0),
    sobota: datum(2026, 10, 31),
    nedele: datum(2026, 11, 1),
  },
  {
    popis: "Přechod mezi roky – neděle 21:59",
    okamzik: praha(2025, 12, 28, 21, 59),
    sobota: datum(2025, 12, 27),
    nedele: datum(2025, 12, 28),
  },
  {
    popis: "Přechod mezi roky – neděle 22:00",
    okamzik: praha(2025, 12, 28, 22, 0),
    sobota: datum(2026, 1, 3),
    nedele: datum(2026, 1, 4),
  },
];

let chyby = 0;

for (const pripad of pripady) {
  const vikend = aktualniVikendVPraze(pripad.okamzik);
  const sobotaOk = stejneDatum(vikend.sobota, pripad.sobota);
  const nedeleOk = stejneDatum(vikend.nedele, pripad.nedele);

  if (sobotaOk && nedeleOk) {
    console.log(`OK  ${pripad.popis}`);
    continue;
  }

  chyby++;
  console.error(`CHYBA ${pripad.popis}`);
  console.error(
    `  očekáváno So ${formatDatumKratce(pripad.sobota)}, Ne ${formatDatumKratce(pripad.nedele)}`,
  );
  console.error(
    `  vráceno  So ${formatDatumKratce(vikend.sobota)}, Ne ${formatDatumKratce(vikend.nedele)}`,
  );
}

if (chyby > 0) {
  console.error(`\n${chyby} chyb`);
  process.exit(1);
}

console.log(`\nVšechny ${pripady.length} hraniční situace prošly.`);
