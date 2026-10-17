/**
 * Geografické rozlišení návštěv BRÁNY. Jen syntetické vstupy.
 * Spuštění: npx tsx scripts/verify-brana-analytika-oblast.ts
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import {
  BRANA_ANALYTIKA_PRIJEM_ZAPNUT,
  aplikovatDavkuAnalytiky,
  isoDenZData,
  parsovatDokumentAnalytiky,
  prazdnyDenAnalytiky,
  prazdnyDokumentAnalytiky,
  validovatDavkuAnalytiky,
} from "../src/lib/brana/analytika/model";
import { dnesVPraze } from "../src/lib/brana/cas";
import { ORP_TREBON_KOD, klasifikovatOblast } from "../src/lib/brana/analytika/oblast";
import {
  HLAVICKA_VERCEL_DELKA,
  HLAVICKA_VERCEL_SIRKA,
  HLAVICKA_VERCEL_ZEME,
  klasifikovatOblastZHlavicek,
} from "../src/lib/brana/analytika/vercel-geo";
import hranice from "../src/lib/brana/analytika/orp-trebon-hranice.json";

const CAS = new Date("2026-10-16T10:00:00.000Z");
const DEN = isoDenZData(dnesVPraze(CAS));
const TREBON = { sirka: 49.0037, delka: 14.7706 };
const SUCHDOL = { sirka: 48.8934, delka: 14.8764 };
const PRAHA = { sirka: 50.0875, delka: 14.4213 };
const CESKE_BUDEJOVICE = { sirka: 48.9745, delka: 14.476 };
const VIDEN = { sirka: 48.2082, delka: 16.3738 };

let selhalo = 0;

function assert(ok: boolean, popis: string): void {
  if (ok) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhalo += 1;
  console.error(`FAIL ${popis}`);
}

function hlavicky(mapa: Record<string, string>): { get(name: string): string | null } {
  const povolene = new Set([
    HLAVICKA_VERCEL_ZEME,
    HLAVICKA_VERCEL_SIRKA,
    HLAVICKA_VERCEL_DELKA,
  ]);
  return {
    get(name: string) {
      if (!povolene.has(name)) {
        throw new Error(`Hlavička se nemá číst: ${name}`);
      }
      return mapa[name] ?? null;
    },
  };
}

function testHranice(): void {
  assert(hranice.kod === ORP_TREBON_KOD, "hranice je ORP s kódem RÚIAN 353");
  assert(hranice.nazev === "Třeboň", "hranice nese název ORP Třeboň");
  assert(hranice.okresKod === 3303, "nadřazený okres je uložen jen jako původ, ne jako oblast");
  assert(hranice.srs === "EPSG:4326", "hranice je ve WGS84");
  assert(hranice.vrcholu === 6864, "prsten má úplný počet vrcholů z RÚIAN");
  assert(hranice.prsten.length === 6864, "uložený prsten je úplný");
  assert(
    hranice.sluzba.includes("ObecSRozsirenouPusobnosti") ||
      hranice.sluzba.includes("/MapServer/14"),
    "zdroj je vrstva správních obvodů ORP",
  );
}

function testKlasifikace(): void {
  assert(
    klasifikovatOblast({
      zeme: "CZ",
      zemepisnaSirka: TREBON.sirka,
      zemepisnaDelka: TREBON.delka,
    }) === "trebonsko",
    "Třeboň uvnitř ORP je Třeboňsko",
  );
  assert(
    klasifikovatOblast({
      zeme: "CZ",
      zemepisnaSirka: SUCHDOL.sirka,
      zemepisnaDelka: SUCHDOL.delka,
    }) === "trebonsko",
    "Suchdol nad Lužnicí uvnitř ORP je Třeboňsko",
  );
  assert(
    klasifikovatOblast({
      zeme: "CZ",
      zemepisnaSirka: CESKE_BUDEJOVICE.sirka,
      zemepisnaDelka: CESKE_BUDEJOVICE.delka,
    }) === "mimo_trebonsko",
    "České Budějovice jsou mimo Třeboňsko",
  );
  assert(
    klasifikovatOblast({
      zeme: "CZ",
      zemepisnaSirka: PRAHA.sirka,
      zemepisnaDelka: PRAHA.delka,
    }) === "mimo_trebonsko",
    "Praha je mimo Třeboňsko",
  );
}

function testMezeryAZahranici(): void {
  assert(klasifikovatOblast({}) === "neurceno", "chybějící údaje jsou neurčené");
  assert(
    klasifikovatOblast({ zeme: "CZ" }) === "neurceno",
    "samotná česká země bez souřadnic je neurčená",
  );
  assert(
    klasifikovatOblast({ zeme: "CZ", zemepisnaSirka: 49.1 }) === "neurceno",
    "neúplné souřadnice jsou neurčené",
  );
  assert(
    klasifikovatOblast({
      zeme: "CZ",
      zemepisnaSirka: 99,
      zemepisnaDelka: 14.7,
    }) === "neurceno",
    "neplatné souřadnice jsou neurčené",
  );
  assert(
    klasifikovatOblast({
      zeme: "CZ",
      zemepisnaSirka: Number.NaN,
      zemepisnaDelka: 14.7,
    }) === "neurceno",
    "nečíselné souřadnice jsou neurčené",
  );
  assert(
    klasifikovatOblast({ zeme: "AT" }) === "neurceno",
    "zahraniční země bez souřadnic je neurčená",
  );
  assert(
    klasifikovatOblast({
      zeme: "AT",
      zemepisnaSirka: VIDEN.sirka,
      zemepisnaDelka: VIDEN.delka,
    }) === "mimo_trebonsko",
    "zahraniční připojení se souřadnicemi mimo ORP je mimo Třeboňsko",
  );
  assert(
    klasifikovatOblast({
      zeme: "AT",
      zemepisnaSirka: TREBON.sirka,
      zemepisnaDelka: TREBON.delka,
    }) === "neurceno",
    "cizí země na souřadnici uvnitř ORP je neurčená",
  );

  const jenKraj = hlavicky({
    [HLAVICKA_VERCEL_ZEME]: "CZ",
    "x-vercel-ip-country-region": "31",
    "x-vercel-ip-city": "Ceske%20Budejovice",
  });
  assert(
    klasifikovatOblastZHlavicek(jenKraj) === "neurceno",
    "kraj a město bez souřadnic nenahradí Třeboňsko",
  );

  const prahaHlavicky = hlavicky({
    [HLAVICKA_VERCEL_ZEME]: "cz",
    [HLAVICKA_VERCEL_SIRKA]: String(PRAHA.sirka),
    [HLAVICKA_VERCEL_DELKA]: String(PRAHA.delka),
    "x-forwarded-for": "203.0.113.10",
  });
  assert(
    klasifikovatOblastZHlavicek(prahaHlavicky) === "mimo_trebonsko",
    "hlavičky Vercelu se čtou bez IP adresy",
  );
  assert(
    klasifikovatOblastZHlavicek(hlavicky({})) === "neurceno",
    "prázdné hlavičky jsou neurčené",
  );
}

function testAgregace(): void {
  const bezOblasti = prazdnyDenAnalytiky() as Partial<ReturnType<typeof prazdnyDenAnalytiky>>;
  delete bezOblasti.oblast;
  const starsiDokument = parsovatDokumentAnalytiky({
    verze: 1,
    dny: { [DEN]: bezOblasti },
  });
  assert(starsiDokument !== null, "starší den bez oblasti zůstane čitelný");
  assert(
    starsiDokument?.dny[DEN].oblast.trebonsko === 0 &&
      starsiDokument.dny[DEN].oblast.mimo_trebonsko === 0 &&
      starsiDokument.dny[DEN].oblast.neurceno === 0,
    "chybějící oblast se doplní nulami",
  );

  const poStareUdalosti = aplikovatDavkuAnalytiky(
    starsiDokument ?? prazdnyDokumentAnalytiky(),
    [{ typ: "navsteva" }],
    CAS,
  );
  assert(poStareUdalosti.dny[DEN].navstevy === 1, "starší událost zvýší návštěvy");
  assert(
    poStareUdalosti.dny[DEN].oblast.neurceno === 0 &&
      poStareUdalosti.dny[DEN].oblast.trebonsko === 0 &&
      poStareUdalosti.dny[DEN].oblast.mimo_trebonsko === 0,
    "starší událost bez serverové oblasti geografie nemění",
  );

  const poNeurceni = aplikovatDavkuAnalytiky(
    poStareUdalosti,
    [{ typ: "navsteva" }, { typ: "navsteva", spusteni: "ikona" }],
    CAS,
    "neurceno",
  );
  const poMimo = aplikovatDavkuAnalytiky(
    poNeurceni,
    [{ typ: "navsteva", spusteni: "prohlizec" }],
    CAS,
    "mimo_trebonsko",
  );
  const poTrebon = aplikovatDavkuAnalytiky(
    poMimo,
    [{ typ: "navsteva" }],
    CAS,
    "trebonsko",
  );
  const den = poTrebon.dny[DEN];
  assert(den.navstevy === 5, "všechny návštěvy zůstanou v jednom dni");
  assert(den.oblast.neurceno === 2, "neurčené návštěvy se sečtou za den");
  assert(den.oblast.mimo_trebonsko === 1, "návštěvy mimo Třeboňsko se sečtou za den");
  assert(den.oblast.trebonsko === 1, "návštěvy z Třeboňska se sečtou za den");
  assert(
    den.oblast.trebonsko + den.oblast.mimo_trebonsko + den.oblast.neurceno === 4,
    "denní počty jsou součtem návštěv bez korekce",
  );
  assert(den.spusteni.ikona === 1 && den.spusteni.prohlizec === 1, "oblast nemění způsob spuštění");
  assert(
    JSON.stringify(den.oblast) ===
      JSON.stringify(parsovatDokumentAnalytiky(poTrebon)?.dny[DEN].oblast),
    "denní oblast projde zpětně parserem",
  );

  const poskozena = prazdnyDenAnalytiky();
  const dokument = {
    verze: 1,
    dny: {
      [DEN]: {
        ...poskozena,
        oblast: { trebonsko: 1, mimo_trebonsko: 0 },
      },
    },
  };
  assert(parsovatDokumentAnalytiky(dokument) === null, "neúplná oblast dokument zneplatní");

  assert(
    !validovatDavkuAnalytiky({
      udalosti: [{ typ: "navsteva", zemepisnaSirka: TREBON.sirka }],
    }).ok,
    "klient nesmí polohu poslat",
  );
  assert(
    !validovatDavkuAnalytiky({
      udalosti: [{ typ: "navsteva", oblast: "trebonsko" }],
    }).ok,
    "klient nesmí kategorii oblasti poslat",
  );
  assert(
    validovatDavkuAnalytiky({ udalosti: [{ typ: "navsteva" }] }).ok,
    "starší klientská návštěva zůstane platná",
  );
}

function vsechnySoubory(adresar: string): string[] {
  return readdirSync(adresar).flatMap((nazev) => {
    const cesta = join(adresar, nazev);
    if (statSync(cesta).isDirectory()) {
      return vsechnySoubory(cesta);
    }
    return [cesta];
  });
}

function testIzolace(): void {
  assert(BRANA_ANALYTIKA_PRIJEM_ZAPNUT === false, "veřejný příjem zůstává vypnutý");

  const route = readFileSync(join("src", "app", "api", "brana", "analytika", "route.ts"), "utf8");
  const post = route.slice(route.indexOf("export async function POST"));
  const brana = post.indexOf("odpovedOdmitnuti");
  const klasifikace = post.indexOf("klasifikovatOblastZHlavicek");
  const zapis = post.indexOf("zaznamenatBranaAnalytikuDoBlobu");
  assert(brana !== -1 && brana < klasifikace && klasifikace < zapis, "klasifikace běží až po bráně příjmu");
  assert(!route.includes("x-forwarded-for"), "endpoint IP adresu nečte");
  assert(!route.includes("console."), "endpoint geolokaci nezapisuje do logu");

  const vercel = readFileSync(join("src", "lib", "brana", "analytika", "vercel-geo.ts"), "utf8");
  assert(!vercel.includes("x-vercel-ip-city"), "město z hlavičky se nepoužívá");
  assert(!vercel.includes("x-vercel-ip-country-region"), "kraj z hlavičky se nepoužívá");
  assert(!vercel.includes("x-forwarded-for"), "čtení geografie nezná IP adresu");

  const verejne = [
    ...vsechnySoubory(join("src", "app", "brana")),
    ...vsechnySoubory(join("src", "components", "brana")),
  ];
  const napojeni = verejne.filter((soubor) => {
    const text = readFileSync(soubor, "utf8");
    return text.includes("analytika/oblast") || text.includes("analytika/vercel-geo");
  });
  assert(napojeni.length === 0, "veřejná BRÁNA geografii nepoužívá");
}

function main(): void {
  testHranice();
  testKlasifikace();
  testMezeryAZahranici();
  testAgregace();
  testIzolace();

  if (selhalo > 0) {
    console.error(`\nSelhalo kontrol: ${selhalo}`);
    process.exit(1);
  }
  console.log("\nGeografické rozlišení prošlo na syntetických vstupech.");
}

main();
