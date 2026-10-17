/**
 * Zobrazení osmi grafů v administraci BRÁNY. Bez produkčního Blob zápisu.
 * Spuštění: npx tsx scripts/verify-brana-analytika-zobrazeni.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { okamzikZPrahy } from "../src/lib/brana/cas";
import {
  indexZPozice,
  indexyPopiskuOsy,
  podilyDvou,
  popisekBodu,
  popisekOkna,
  posunVyber,
  RASTR_GRAFU,
  souradniceBodu,
  stropOsy,
  textProchazeniBodu,
  textProchazeniObdobi,
  textZmeny,
  usekyHodnot,
} from "../src/lib/brana/admin/analytika-zobrazeni";
import { BRANA_ANALYTIKA_PRIJEM_ZAPNUT, prazdnyDenAnalytiky } from "../src/lib/brana/analytika/model";
import { sestavitPodkladyGrafu } from "../src/lib/brana/analytika/grafy";

let selhalo = 0;

function assert(ok: boolean, popis: string): void {
  if (ok) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhalo += 1;
  console.error(`FAIL ${popis}`);
}

function testVyberBodu(): void {
  const pocet = 7;
  const prvni = indexZPozice(RASTR_GRAFU.levy + 1, pocet);
  const posledni = indexZPozice(RASTR_GRAFU.sirka - RASTR_GRAFU.pravy - 1, pocet);
  const mimoVlevo = indexZPozice(0, pocet);
  const mimoVpravo = indexZPozice(RASTR_GRAFU.sirka, pocet);
  assert(prvni === 0 && mimoVlevo === 0, "dotyk na začátku vybere první den");
  assert(posledni === pocet - 1 && mimoVpravo === pocet - 1, "dotyk na konci vybere poslední den");
  assert(posunVyber(0, -1, pocet) === 0 && posunVyber(pocet - 1, 1, pocet) === pocet - 1, "šipky drží výběr uvnitř období");
  assert(posunVyber(2, 1, pocet) === 3, "šipka vpravo posune vybraný bod");

  const plot = RASTR_GRAFU.sirka - RASTR_GRAFU.levy - RASTR_GRAFU.pravy;
  const slot = plot / 30;
  const den12 = indexZPozice(RASTR_GRAFU.levy + slot * 12 + slot / 2, 30);
  assert(den12 === 12, "výběr myší trefí den podle polohy, ne podle tenké čáry");
}

function testKrivkyAProcenta(): void {
  assert(
    JSON.stringify(usekyHodnot([1, null, 0, 2])) === JSON.stringify([[0], [2, 3]]),
    "nedostupný den přeruší čáru a nula zůstane na čáře",
  );
  assert(usekyHodnot([null, null]).length === 0, "samé nedostupné hodnoty nevytvoří nulovou čáru");
  const dole = souradniceBodu(0, 1, 0, stropOsy(0));
  const nahore = souradniceBodu(0, 1, 100, 100);
  assert(dole.y > nahore.y, "nula leží níž než maximální hodnota");
  assert(stropOsy(0) === 1 && stropOsy(4) === 5, "osa má čitelný strop i při nule");

  const podily = podilyDvou(2, 3);
  assert(podily.prvni === 40 && podily.druhy === 60, "podíl spuštění je ze součtu období");
  assert(podilyDvou(0, 0).prvni === null, "nulový základ podílu není 0 %");
  assert(textZmeny(null, true) === "Změnu proti předchozímu období nelze spočítat.", "chybějící změna se neukáže jako nula");
  assert(textZmeny(50, false) === null, "rok nemá text změny proti předchozímu období");
  assert(
    textProchazeniObdobi("Dnes", { delsi: 4, konec: 1, procento: 25 }) === "Dnes: 25 % (konec 1 z 4)",
    "součet procházení ukazuje poměr součtů",
  );
  assert(
    textProchazeniBodu({
      od: "2026-01-15",
      do: "2026-01-15",
      rok: 2026,
      mesic: 1,
      den: 15,
      pocetDnu: 1,
      nedostupnychDnu: 0,
      delsi: 0,
      konec: 0,
      procento: null,
    }) === "není údaj",
    "bod bez delšího seznamu není 0 %",
  );
}

function testObdobiNaStrance(): void {
  const ted = okamzikZPrahy(2026, 1, 15, 12, 0);
  const den = prazdnyDenAnalytiky();
  den.navstevy = 4;
  const mesic = sestavitPodkladyGrafu({ verze: 1, dny: { "2026-01-15": den } }, ted, 30);
  const rok = sestavitPodkladyGrafu({ verze: 1, dny: { "2026-01-15": den } }, ted, 365);
  assert(mesic.rozliseni === "den" && mesic.navstevnost.aktualni.length === 30, "třicet dní zůstává denní řada");
  assert(mesic.navstevnost.predchozi?.length === 30, "návštěvnost má předchozí období");
  assert(
    rok.rozliseni === "mesic" && rok.navstevnost.predchozi === null && rok.navstevnost.aktualni.length === 13,
    "rok je měsíční a bez předchozího roku",
  );
  const prvni = rok.navstevnost.aktualni[0];
  assert(
    prvni !== undefined &&
      prvni.pocetDnu === 16 &&
      popisekBodu(prvni).includes("16 dní"),
    "neúplný měsíc ukáže svůj skutečný rozsah",
  );
  assert(popisekOkna(mesic.okno, "den").includes("Po dnech"), "denní okno má denní popisek");
  assert(popisekOkna(rok.okno, "mesic").includes("Po kalendářních měsících"), "roční okno má měsíční popisek");
  assert(indexyPopiskuOsy(90).length === 3, "hustá denní osa má jen krajní a prostřední popisek");
}

function testZapojeni(): void {
  const stranka = readFileSync(join("src", "app", "brana", "admin", "analytika", "page.tsx"), "utf8");
  const grafy = readFileSync(join("src", "components", "brana", "admin", "BranaAdminAnalytikaGrafy.tsx"), "utf8");
  const vylouceni = readFileSync(
    join("src", "components", "brana", "admin", "BranaAdminVylouceniZarizeni.tsx"),
    "utf8",
  );
  const obal = readFileSync(join("src", "components", "brana", "admin", "BranaAdminObal.tsx"), "utf8");

  assert(BRANA_ANALYTIKA_PRIJEM_ZAPNUT === false, "příjem analytiky zůstává vypnutý");
  assert(
    stranka.includes("if (!(await jeAdminPrihlasen()))") &&
      stranka.includes("nacistPodkladyGrafuProAdministraci") &&
      stranka.indexOf("jeAdminPrihlasen") < stranka.indexOf("nacistPodkladyGrafuProAdministraci"),
    "stránka ověří administrátora před čtením",
  );
  assert(stranka.includes("<BranaAdminVylouceniZarizeni />"), "přepínač vyloučení zařízení zůstává na stránce");
  assert(
    !stranka.includes("sestavitPodkladyGrafu") &&
      !grafy.includes("sestavitPodkladyGrafu") &&
      !grafy.includes("pridatDny") &&
      !grafy.includes("window.location"),
    "klient období znovu nepočítá",
  );
  assert(
    grafy.includes('useState<BranaAnalytikaGrafObdobi>(30)') &&
      grafy.includes("7 dní") &&
      grafy.includes("30 dní") &&
      grafy.includes("90 dní") &&
      grafy.includes("Rok"),
    "přepínač začíná na 30 dnech a má čtyři období",
  );
  for (const nadpis of ["Návštěvnost", "Návratovost", "Způsob spuštění", "Geografie", "Kalendář", "Procházení Kalendáře", "Sdílení", "QR"]) {
    assert(grafy.includes(`nadpis="${nadpis}"`) || grafy.includes(`"${nadpis}"`), `graf ${nadpis} je na stránce`);
  }
  assert(
    grafy.includes("onPointerDown") &&
      grafy.includes("onPointerMove") &&
      !grafy.includes("onMouseEnter") &&
      grafy.includes("aria-live"),
    "hodnoty se vybírají dotykem i myší a zůstanou čitelné",
  );
  assert(
    grafy.includes("max-w-full") && grafy.includes("min-w-0") && grafy.includes("w-full"),
    "grafy zůstávají v šířce administrace",
  );
  assert(
    !grafy.includes("etag") && !grafy.includes("BLOB") && !stranka.includes("token"),
    "do zobrazení nejde token ani etag",
  );
  assert(vylouceni.includes("nastavitBranaVylouceniAnalytiky"), "přepínač vyloučení dál zapisuje jen místní značku");
  assert(obal.includes('aria-label="Hlavní části administrace"'), "navigace administrace zůstala");
  assert(
    stranka.includes("Toto není nulová návštěvnost") &&
      stranka.includes("nebyla přepsána"),
    "chyba čtení se neukazuje jako nulová návštěvnost",
  );
}

function main(): void {
  testVyberBodu();
  testKrivkyAProcenta();
  testObdobiNaStrance();
  testZapojeni();

  if (selhalo > 0) {
    console.error(`Zobrazení grafů: ${selhalo} selhalo.`);
    process.exit(1);
  }
  console.log("Zobrazení grafů BRÁNY: všechno sedí.");
}

main();
