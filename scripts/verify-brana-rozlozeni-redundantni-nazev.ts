/**
 * Regrese: strukturované rozložení bez redundantního názvu.
 * Spuštění: npx tsx scripts/verify-brana-rozlozeni-redundantni-nazev.ts
 */

import { rozlozAkci } from "../src/lib/brana/admin/akce-rozlozeni";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    fail(msg);
  }
}

function radek(
  typ: string,
  misto: string,
  nazev: string,
  oddelovac = " ",
): string {
  const primarni = misto.trim()
    ? `${typ}${oddelovac}${misto}`
    : typ;
  return nazev.trim() ? `${primarni}\n${nazev}` : primarni;
}

function overVylovRozmberk(): void {
  const v = rozlozAkci({
    mistoNeboTyp: "Výlov Rožmberk",
    nazev: "Výlov Rožmberk",
    cas: "",
    verejneCo: "Výlov",
    verejneRozliseni: "Rožmberk",
  });
  assert(v.typ === "Výlov", `výlov typ: ${v.typ}`);
  assert(v.misto === "Rožmberk", `výlov misto: ${v.misto}`);
  assert(v.nazev === "", `výlov nazev musí být prázdný: „${v.nazev}“`);
  assert(v.oddelovacPredMistem === " ", "výlov oddělovač mezera");
  assert(
    radek(v.typ, v.misto, v.nazev, v.oddelovacPredMistem) === "Výlov Rožmberk",
    `výlov radek: ${radek(v.typ, v.misto, v.nazev, v.oddelovacPredMistem)}`,
  );
}

function overTrhOddelovacARedundance(): void {
  const v = rozlozAkci({
    mistoNeboTyp: "Trh Otevíráme Třeboň",
    nazev: "Otevíráme Třeboň",
    cas: "",
    verejneCo: "Trh",
    verejneRozliseni: "Otevíráme Třeboň",
  });
  assert(v.typ === "Trh", "trh typ");
  assert(v.misto === "Otevíráme Třeboň", "trh rozlišení");
  assert(v.nazev === "", "trh nazev redundantní skryt");
  assert(v.oddelovacPredMistem === " · ", "trh oddělovač ·");
  assert(
    radek(v.typ, v.misto, v.nazev, v.oddelovacPredMistem) ===
      "Trh · Otevíráme Třeboň",
    "trh veřejný zápis",
  );
  assert(!/náměstí/i.test(radek(v.typ, v.misto, v.nazev, v.oddelovacPredMistem)), "bez Náměstí");
}

function overKinoFilmZustava(): void {
  const v = rozlozAkci({
    mistoNeboTyp: "Kino Aurora",
    nazev: "Třetí člověk",
    cas: "19:30",
    verejneCo: "Kino",
    verejneRozliseni: "Aurora",
  });
  assert(v.typ === "Kino" && v.misto === "Aurora", "kino CO/KDE");
  assert(v.nazev === "Třetí člověk", `kino film zmizel: „${v.nazev}“`);
}

function overDivadloProgramZustava(): void {
  const v = rozlozAkci({
    mistoNeboTyp: "Divadlo J. K. Tyla",
    nazev: "Maryša",
    cas: "19:00",
    verejneCo: "Divadlo",
    verejneRozliseni: "J. K. Tyla",
  });
  assert(v.typ === "Divadlo" && v.misto === "J. K. Tyla", "divadlo CO/KDE");
  assert(v.nazev === "Maryša", `divadlo program zmizel: „${v.nazev}“`);
}

function overGalerie105(): void {
  const v = rozlozAkci({
    mistoNeboTyp: "Výstava Galerie 105",
    nazev: "Současné krajiny",
    cas: "",
    verejneCo: "Výstava",
    verejneRozliseni: "Galerie 105",
  });
  assert(v.typ === "Výstava" && v.misto === "Galerie 105", "galerie CO/KDE");
  assert(v.nazev === "Současné krajiny", "galerie název zůstává");
}

function overZameckaLekarna(): void {
  const v = rozlozAkci({
    mistoNeboTyp: "Francouzské dny Zámecká lékárna",
    nazev: "Degustace vín",
    cas: "17:00",
    verejneCo: "Francouzské dny",
    verejneRozliseni: "Zámecká lékárna",
  });
  assert(v.typ === "Francouzské dny", "lékárna CO");
  assert(v.misto === "Zámecká lékárna", "lékárna KDE");
  assert(v.nazev === "Degustace vín", "lékárna program zůstává");
}

function overNocturna(): void {
  const v = rozlozAkci({
    mistoNeboTyp: "Třeboňská nocturna",
    nazev: "Abonentní koncert",
    cas: "19:30",
    verejneCo: "Třeboňská nocturna",
    verejneRozliseni: null,
  });
  assert(v.typ === "Třeboňská nocturna", "nocturna CO");
  assert(v.misto === "", "nocturna bez KDE");
  assert(v.nazev === "Abonentní koncert", "nocturna název zůstává");
}

function overDsn(): void {
  const v = rozlozAkci({
    mistoNeboTyp: "Výstava Dům Štěpánka Netolického",
    nazev: "Třeboňská krajina",
    cas: "",
    verejneCo: "Výstava",
    verejneRozliseni: "Dům Štěpánka Netolického",
  });
  assert(v.typ === "Výstava", "DSN CO");
  assert(v.misto === "Dům Štěpánka Netolického", "DSN KDE");
  assert(v.nazev === "Třeboňská krajina", "DSN název zůstává");
}

function overLegacyBezeZmeny(): void {
  const kino = rozlozAkci({
    mistoNeboTyp: "Kino Aurora",
    nazev: "Třetí člověk",
    cas: "19:30",
  });
  assert(kino.typ === "Kino" && kino.misto === "Aurora", "legacy kino");
  assert(kino.nazev === "Třetí člověk", "legacy kino film");

  const vylov = rozlozAkci({
    mistoNeboTyp: "Výlov Rožmberk",
    nazev: "Výlov Rožmberk",
    cas: "",
  });
  assert(vylov.typ === "Výlov Rožmberk", "legacy výlov typ");
  assert(vylov.misto === "Výlov Rožmberk", "legacy výlov misto (= nazev)");
  assert(vylov.nazev === "", "legacy výlov nazev prázdný");
}

function main(): void {
  overVylovRozmberk();
  overTrhOddelovacARedundance();
  overKinoFilmZustava();
  overDivadloProgramZustava();
  overGalerie105();
  overZameckaLekarna();
  overNocturna();
  overDsn();
  overLegacyBezeZmeny();
  console.log("OK: rozlozeni redundantni nazev");
}

main();
