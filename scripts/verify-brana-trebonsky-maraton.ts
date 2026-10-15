/**
 * Třeboňský maraton: jen budoucí datum z hero data-datum.
 * Spuštění: npx tsx scripts/verify-brana-trebonsky-maraton.ts
 */

import { jeUdalostCelaMinula } from "../src/lib/brana/admin/konkretni-udalost";
import { sestavJazykBranyPoSparovani } from "../src/lib/brana/admin/jazyk-brany-po-sparovani";
import { vytvoritVychoziRedakcniPoradi } from "../src/lib/brana/admin/redakcni-kostra";
import { aplikovatScanKandidatyNaUdalosti } from "../src/lib/brana/admin/scan-ceka-zapis";
import {
  BRANA_TREBONSKY_MARATON_REDAKCNI_POLOZKA_ID,
  jeTrebonskyMaratonZdrojUrl,
  parsovatTrebonskyMaratonOdpocty,
} from "../src/lib/brana/admin/trebonsky-maraton";
import { sparovatVlastnictvimHlidaneKotvy } from "../src/lib/brana/admin/zdroj-scan-sparovani";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) fail(msg);
}

const REF = new Date("2026-10-15T12:00:00+02:00");

function stranka(dataDatum: string | null, navic = ""): string {
  const hero =
    dataDatum == null
      ? `<div class="hero__counter js-hero-counter"></div>`
      : `<div class="hero__counter js-hero-counter" data-datum="${dataDatum}"></div>`;
  return `<html><body>${hero}
    <p>Třeboňský maraton 3. 10. 2026, start 10:45. Fotky z roku 2026.</p>
    ${navic}
  </body></html>`;
}

assert(jeTrebonskyMaratonZdrojUrl("https://naturemarathon.cz/"), "homepage");
assert(jeTrebonskyMaratonZdrojUrl("https://www.naturemarathon.cz"), "www");
assert(
  !jeTrebonskyMaratonZdrojUrl("https://naturemarathon.cz/propozice-a-program/"),
  "podstránka",
);
assert(!jeTrebonskyMaratonZdrojUrl("https://example.com/"), "cizí host");

const platny = parsovatTrebonskyMaratonOdpocty(
  stranka("2027-10-09T10:45:00.0100"),
  REF,
);
assert(platny.length === 1, `platný termín, je ${platny.length}`);
const karta = platny[0];
assert(karta.nazev === "Třeboňský maraton", "název");
assert(karta.datumOd === "2027-10-09", "datum");
assert(karta.datumDo === "2027-10-09", "datum do");
assert(karta.cas === "", "čas prázdný");
assert(!karta.cas.includes("10:45"), "bez 10:45");
assert(karta.mistoNeboTyp === "Třeboň", "místo");
assert(karta.zdrojIdentita === "trebonsky-maraton|2027", "identita ročníku");
console.log("OK platný termín 2027 bez času");

const rok2026 = parsovatTrebonskyMaratonOdpocty(
  stranka("2026-10-03T10:45:00.0100"),
  REF,
);
assert(rok2026.length === 0, "rok 2026 ignorován");
console.log("OK ignorování roku 2026");

assert(
  parsovatTrebonskyMaratonOdpocty(stranka(null), REF).length === 0,
  "chybějící datum",
);
assert(
  parsovatTrebonskyMaratonOdpocty("<p>9. října 2027</p>", REF).length === 0,
  "text bez odpočtu",
);
assert(
  parsovatTrebonskyMaratonOdpocty(stranka("2027-02-31T10:45:00"), REF).length ===
    0,
  "neplatné datum",
);
assert(
  parsovatTrebonskyMaratonOdpocty(
    stranka(
      "2027-10-09T10:45:00",
      `<div class="hero__counter" data-datum="2028-10-07T10:00:00"></div>`,
    ),
    REF,
  ).length === 0,
  "dva odpočty",
);
console.log("OK chybějící, neplatné a nejednoznačné datum");

const poradi = vytvoritVychoziRedakcniPoradi();
const kotva = poradi.find((p) => p.id === BRANA_TREBONSKY_MARATON_REDAKCNI_POLOZKA_ID);
assert(kotva, "kotva v katalogu");
assert(kotva.polozka === "Třeboňský maraton", "název kotvy");
assert(kotva.pouzivat === "ANO", "Používat ANO");
assert(kotva.vyhled === "NE", "Výhled NE");
assert(kotva.jazykVerejny?.co.rezim === "PEVNE", "CO pevně");
assert(kotva.jazykVerejny?.co.rezim === "PEVNE" && kotva.jazykVerejny.co.text === "Třeboňský maraton", "CO text");
assert(
  kotva.jazykVerejny?.rozliseni.rezim === "PEVNE" &&
    kotva.jazykVerejny.rozliseni.text === "Třeboň",
  "KDE text",
);

const jazyk = sestavJazykBranyPoSparovani({
  polozka: kotva.polozka,
  kandidatMisto: karta.mistoNeboTyp,
  zdrojNazev: "Třeboňský maraton",
  jazykVerejny: kotva.jazykVerejny,
});
assert(jazyk.verejneCo === "Třeboňský maraton", "veřejné CO");
assert(jazyk.verejneRozliseni === "Třeboň", "veřejné KDE");
console.log("OK kotva a veřejný jazyk");

const vlastnictvi = sparovatVlastnictvimHlidaneKotvy(
  poradi,
  [BRANA_TREBONSKY_MARATON_REDAKCNI_POLOZKA_ID],
  BRANA_TREBONSKY_MARATON_REDAKCNI_POLOZKA_ID,
);
assert(vlastnictvi.ok && vlastnictvi.redakcniPolozkaId === "trebonsky-maraton", "hlídaná kotva");
const bezSeznamu = sparovatVlastnictvimHlidaneKotvy(poradi, [], "trebonsky-maraton");
assert(!bezSeznamu.ok, "prázdný seznam kotvu nepřiřadí");

const vstup = {
  redakcniPolozkaId: "trebonsky-maraton",
  datumOd: karta.datumOd,
  datumDo: karta.datumDo,
  cas: karta.cas,
  mistoNeboTyp: jazyk.mistoNeboTyp,
  nazev: karta.nazev,
  verejneCo: jazyk.verejneCo,
  verejneRozliseni: jazyk.verejneRozliseni,
  zdrojIdentita: karta.zdrojIdentita,
};

const prvni = aplikovatScanKandidatyNaUdalosti(
  [],
  [vstup],
  "2026-10-15",
  jeUdalostCelaMinula,
);
assert(prvni.vysledek.pridano === 1, "první zápis");
assert(prvni.udalosti.length === 1, "jedna karta");
assert(prvni.udalosti[0].stavSchvaleni === "CEKA_NA_SCHVALENI", "čeká na schválení");
assert(prvni.udalosti[0].cas === "", "uložený čas prázdný");
assert(prvni.udalosti[0].zdrojIdentita === "trebonsky-maraton|2027", "uložená identita");

const druhy = aplikovatScanKandidatyNaUdalosti(
  prvni.udalosti,
  [vstup],
  "2026-10-15",
  jeUdalostCelaMinula,
);
assert(druhy.udalosti.length === 1, "bez druhé karty");
assert(druhy.vysledek.pridano === 0, "opakovaný nález nepřidá");
assert(druhy.vysledek.jizExistuje === 1, "opakovaný nález už existuje");
console.log("OK opakovaný nález bez duplicity");

const schvalena = {
  ...prvni.udalosti[0],
  stavSchvaleni: "SCHVALENO" as const,
};
const poSchvaleni = aplikovatScanKandidatyNaUdalosti(
  [schvalena],
  [vstup],
  "2026-10-15",
  jeUdalostCelaMinula,
);
assert(poSchvaleni.udalosti.length === 1, "schválená zůstává jediná");
assert(poSchvaleni.udalosti[0].stavSchvaleni === "SCHVALENO", "scan neschvaluje znovu");
assert(poSchvaleni.vysledek.pridano === 0, "ke schválené nevznikne druhá čekající");
console.log("OK schválená karta se nepřepisuje");

console.log("VŠE OK — Třeboňský maraton");
