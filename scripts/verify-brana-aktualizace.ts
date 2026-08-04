/**
 * Ověření logiky textu aktualizace BRÁNY – dnes / včera / datum
 * a přepínání 00:00 / 6:00 / 15:30 v Europe/Prague.
 * Spuštění: npx tsx scripts/verify-brana-aktualizace.ts
 */

import {
  dalsiZmenaAktualizaceVPraze,
  formatTextAktualizace,
  textAktualizaceVPraze,
  zdrojCasuAktualizace,
} from "../src/lib/brana/aktualizace";
import { okamzikVPraze, okamzikZPrahy } from "../src/lib/brana/cas";

function praha(
  rok: number,
  mesic: number,
  den: number,
  hodina: number,
  minuta: number,
): Date {
  return okamzikZPrahy(rok, mesic, den, hodina, minuta);
}

function stejnePraha(
  a: Date,
  rok: number,
  mesic: number,
  den: number,
  hodina: number,
  minuta: number,
): boolean {
  const p = okamzikVPraze(a);
  return (
    p.rok === rok &&
    p.mesic === mesic &&
    p.den === den &&
    p.hodina === hodina &&
    p.minuta === minuta
  );
}

type Pripad = {
  popis: string;
  okamzik: Date;
  ocekavanyText: string;
  publikace: {
    rok: number;
    mesic: number;
    den: number;
    hodina: number;
    minuta: number;
  };
};

const pripady: Pripad[] = [
  {
    popis: "05:59 → včera 15:30",
    okamzik: praha(2026, 8, 1, 5, 59),
    ocekavanyText: "Aktualizováno včera v 15:30",
    publikace: { rok: 2026, mesic: 7, den: 31, hodina: 15, minuta: 30 },
  },
  {
    popis: "06:00 → dnes 6:00",
    okamzik: praha(2026, 8, 1, 6, 0),
    ocekavanyText: "Aktualizováno dnes v 6:00",
    publikace: { rok: 2026, mesic: 8, den: 1, hodina: 6, minuta: 0 },
  },
  {
    popis: "15:29 → dnes 6:00",
    okamzik: praha(2026, 8, 1, 15, 29),
    ocekavanyText: "Aktualizováno dnes v 6:00",
    publikace: { rok: 2026, mesic: 8, den: 1, hodina: 6, minuta: 0 },
  },
  {
    popis: "15:30 → dnes 15:30",
    okamzik: praha(2026, 8, 1, 15, 30),
    ocekavanyText: "Aktualizováno dnes v 15:30",
    publikace: { rok: 2026, mesic: 8, den: 1, hodina: 15, minuta: 30 },
  },
  {
    popis: "23:59 → dnes 15:30",
    okamzik: praha(2026, 8, 1, 23, 59),
    ocekavanyText: "Aktualizováno dnes v 15:30",
    publikace: { rok: 2026, mesic: 8, den: 1, hodina: 15, minuta: 30 },
  },
  {
    popis: "00:00 následujícího dne → včera 15:30",
    okamzik: praha(2026, 8, 2, 0, 0),
    ocekavanyText: "Aktualizováno včera v 15:30",
    publikace: { rok: 2026, mesic: 8, den: 1, hodina: 15, minuta: 30 },
  },
  {
    popis: "Po půlnoci (02:00) → včera 15:30",
    okamzik: praha(2026, 8, 2, 2, 0),
    ocekavanyText: "Aktualizováno včera v 15:30",
    publikace: { rok: 2026, mesic: 8, den: 1, hodina: 15, minuta: 30 },
  },
];

let chyby = 0;

function assert(ok: boolean, popis: string, detail?: string) {
  if (ok) {
    console.log(`OK  ${popis}`);
    return;
  }
  chyby++;
  console.error(`CHYBA ${popis}`);
  if (detail) {
    console.error(`  ${detail}`);
  }
}

for (const pripad of pripady) {
  const text = textAktualizaceVPraze(pripad.okamzik);
  const publikace = zdrojCasuAktualizace(pripad.okamzik);
  const publikaceOk = stejnePraha(
    publikace,
    pripad.publikace.rok,
    pripad.publikace.mesic,
    pripad.publikace.den,
    pripad.publikace.hodina,
    pripad.publikace.minuta,
  );

  assert(
    text === pripad.ocekavanyText && publikaceOk,
    `${pripad.popis} → ${text}`,
    `očekáváno ${pripad.ocekavanyText}; vráceno ${text}; publikace ${okamzikVPraze(publikace).rok}-${okamzikVPraze(publikace).mesic}-${okamzikVPraze(publikace).den} ${okamzikVPraze(publikace).hodina}:${String(okamzikVPraze(publikace).minuta).padStart(2, "0")}`,
  );
}

// Přechody bez reloadu: další změna + text na hranici
const prechody = [
  {
    popis: "23:59 → 00:00",
    pred: praha(2026, 8, 1, 23, 59),
    textPred: "Aktualizováno dnes v 15:30",
    textPo: "Aktualizováno včera v 15:30",
    dalsi: { rok: 2026, mesic: 8, den: 2, hodina: 0, minuta: 0 },
  },
  {
    popis: "05:59 → 06:00",
    pred: praha(2026, 8, 1, 5, 59),
    textPred: "Aktualizováno včera v 15:30",
    textPo: "Aktualizováno dnes v 6:00",
    dalsi: { rok: 2026, mesic: 8, den: 1, hodina: 6, minuta: 0 },
  },
  {
    popis: "15:29 → 15:30",
    pred: praha(2026, 8, 1, 15, 29),
    textPred: "Aktualizováno dnes v 6:00",
    textPo: "Aktualizováno dnes v 15:30",
    dalsi: { rok: 2026, mesic: 8, den: 1, hodina: 15, minuta: 30 },
  },
] as const;

for (const prechod of prechody) {
  const naplanovano = dalsiZmenaAktualizaceVPraze(prechod.pred);
  const naplanovanoOk = stejnePraha(
    naplanovano,
    prechod.dalsi.rok,
    prechod.dalsi.mesic,
    prechod.dalsi.den,
    prechod.dalsi.hodina,
    prechod.dalsi.minuta,
  );
  const textPred = textAktualizaceVPraze(prechod.pred);
  const textPo = textAktualizaceVPraze(naplanovano);

  assert(
    naplanovanoOk &&
      textPred === prechod.textPred &&
      textPo === prechod.textPo,
    `Přechod ${prechod.popis}: ${textPred} → ${textPo}`,
    `naplánováno ${okamzikVPraze(naplanovano).hodina}:${String(okamzikVPraze(naplanovano).minuta).padStart(2, "0")} ${okamzikVPraze(naplanovano).den}.${okamzikVPraze(naplanovano).mesic}.`,
  );
}

// Starší timestamp → konkrétní datum (obecné formátování, nezávislé na rytmu)
const stari = praha(2026, 7, 30, 15, 30);
const ted = praha(2026, 8, 1, 12, 0);
assert(
  formatTextAktualizace(stari, ted) === "Aktualizováno 30. 7. v 15:30",
  'Starší timestamp → "Aktualizováno 30. 7. v 15:30"',
  `vráceno ${formatTextAktualizace(stari, ted)}`,
);

// Nezávislost na UTC reprezentaci: stejný pražský okamžik = stejný text
const utcReprezentace = new Date("2026-08-01T03:59:00.000Z"); // 05:59 CEST
assert(
  textAktualizaceVPraze(utcReprezentace) === "Aktualizováno včera v 15:30",
  "UTC reprezentace 05:59 CEST → včera 15:30",
  `vráceno ${textAktualizaceVPraze(utcReprezentace)}`,
);

if (chyby > 0) {
  console.error(`\n${chyby} chyb`);
  process.exit(1);
}

console.log(`\nVšechny kontroly prošly.`);
