/**
 * Regrese: zdrojIdentita + CEKA in-place update (bez Blob).
 * Spuštění: npx tsx scripts/verify-brana-scan-zdroj-identita.ts
 */

import {
  aplikovatScanKandidatyNaUdalosti,
  type BranaScanAutomatickaUdalostVstup,
} from "../src/lib/brana/admin/scan-ceka-zapis";
import {
  dnesIsoVPraze,
  jeUdalostCelaMinula,
  vytvoritScanKlicAutomatickeUdalosti,
  type BranaKonkretniUdalost,
} from "../src/lib/brana/admin/konkretni-udalost";
import { parsovatUdalostiZeZdroje } from "../src/lib/brana/admin/zdroj-scan-parser";
import { sestavRozmberskaNocZapisPoSparovani } from "../src/lib/brana/admin/rozmberska-noc";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) fail(msg);
}

const DNES = "2026-06-01";

function ceka(partial: {
  id: string;
  datumOd: string;
  datumDo?: string;
  nazev: string;
  cas?: string;
  zdrojIdentita?: string;
  stavSchvaleni?: BranaKonkretniUdalost["stavSchvaleni"];
  scanKlic?: string;
}): BranaKonkretniUdalost {
  const datumDo = partial.datumDo ?? partial.datumOd;
  const cas = partial.cas ?? "";
  const scanKlic =
    partial.scanKlic ??
    vytvoritScanKlicAutomatickeUdalosti({
      redakcniPolozkaId: "trhy",
      datumOd: partial.datumOd,
      cas,
      nazev: partial.nazev,
    });
  return {
    id: partial.id,
    redakcniPolozkaId: "trhy",
    datumOd: partial.datumOd,
    datumDo,
    cas,
    mistoNeboTyp: partial.nazev,
    nazev: partial.nazev,
    rucniPoziceVDni: null,
    stavSchvaleni: partial.stavSchvaleni ?? "CEKA_NA_SCHVALENI",
    scanKlic,
    ...(partial.zdrojIdentita
      ? { zdrojIdentita: partial.zdrojIdentita }
      : {}),
  };
}

function kandidat(
  partial: Partial<BranaScanAutomatickaUdalostVstup> & {
    nazev: string;
    datumOd: string;
  },
): BranaScanAutomatickaUdalostVstup {
  return {
    redakcniPolozkaId: "trhy",
    datumOd: partial.datumOd,
    datumDo: partial.datumDo ?? partial.datumOd,
    cas: partial.cas ?? "",
    mistoNeboTyp: partial.mistoNeboTyp ?? partial.nazev,
    nazev: partial.nazev,
    ...(partial.zdrojIdentita
      ? { zdrojIdentita: partial.zdrojIdentita }
      : {}),
    ...(partial.verejneCo !== undefined
      ? {
          verejneCo: partial.verejneCo,
          verejneRozliseni: partial.verejneRozliseni ?? null,
        }
      : {}),
  };
}

const MINT_ID = "mintmarket|/trh/trebon-12";

// A: datum 20.6 → 21.6 = 1 CEKA, aktualizované datum
{
  const pred = [
    ceka({
      id: "auto-a",
      datumOd: "2026-06-20",
      nazev: "MINT Market",
      zdrojIdentita: MINT_ID,
    }),
  ];
  const { udalosti, vysledek } = aplikovatScanKandidatyNaUdalosti(
    pred,
    [kandidat({ nazev: "MINT Market", datumOd: "2026-06-21", zdrojIdentita: MINT_ID })],
    DNES,
    jeUdalostCelaMinula,
  );
  assert(vysledek.pridano === 0, "A pridano=0");
  assert(vysledek.aktualizovano === 1, "A aktualizovano=1");
  assert(udalosti.length === 1, "A stále 1");
  assert(udalosti[0].id === "auto-a", "A stejné id");
  assert(udalosti[0].datumOd === "2026-06-21", "A nové datum");
  assert(udalosti[0].stavSchvaleni === "CEKA_NA_SCHVALENI", "A CEKA");
  assert(udalosti[0].zdrojIdentita === MINT_ID, "A identita");
  console.log("OK A: datum update in-place");
}

// B: změna názvu = 1 CEKA
{
  const pred = [
    ceka({
      id: "auto-b",
      datumOd: "2026-06-20",
      nazev: "MINT Market Třeboň",
      zdrojIdentita: MINT_ID,
    }),
  ];
  const { udalosti, vysledek } = aplikovatScanKandidatyNaUdalosti(
    pred,
    [
      kandidat({
        nazev: "MINT Market",
        datumOd: "2026-06-20",
        zdrojIdentita: MINT_ID,
      }),
    ],
    DNES,
    jeUdalostCelaMinula,
  );
  assert(vysledek.aktualizovano === 1, "B aktualizovano");
  assert(udalosti.length === 1 && udalosti[0].nazev === "MINT Market", "B název");
  console.log("OK B: název update in-place");
}

// C: 27–28.6 → 28–29.6
{
  const pred = [
    ceka({
      id: "auto-c",
      datumOd: "2026-06-27",
      datumDo: "2026-06-28",
      nazev: "MINT Market",
      zdrojIdentita: MINT_ID,
    }),
  ];
  const { udalosti, vysledek } = aplikovatScanKandidatyNaUdalosti(
    pred,
    [
      kandidat({
        nazev: "MINT Market",
        datumOd: "2026-06-28",
        datumDo: "2026-06-29",
        zdrojIdentita: MINT_ID,
      }),
    ],
    DNES,
    jeUdalostCelaMinula,
  );
  assert(vysledek.aktualizovano === 1, "C aktualizovano");
  assert(udalosti.length === 1, "C 1 záznam");
  assert(udalosti[0].datumOd === "2026-06-28", "C Od");
  assert(udalosti[0].datumDo === "2026-06-29", "C Do");
  console.log("OK C: vícedenní OD–DO update");
}

// D: identický obsah = Již existuje
{
  const pred = [
    ceka({
      id: "auto-d",
      datumOd: "2026-06-20",
      nazev: "MINT Market",
      zdrojIdentita: MINT_ID,
    }),
  ];
  const { udalosti, vysledek, zmena } = aplikovatScanKandidatyNaUdalosti(
    pred,
    [
      kandidat({
        nazev: "MINT Market",
        datumOd: "2026-06-20",
        zdrojIdentita: MINT_ID,
      }),
    ],
    DNES,
    jeUdalostCelaMinula,
  );
  assert(vysledek.jizExistuje === 1, "D jizExistuje");
  assert(vysledek.pridano === 0 && vysledek.aktualizovano === 0, "D no write");
  assert(!zmena, "D bez změny");
  assert(udalosti[0].id === "auto-d", "D id");
  console.log("OK D: identický = Již existuje");
}

// E: SCHVALENO = bez silent overwrite, bez druhé CEKA
{
  const pred = [
    ceka({
      id: "auto-e",
      datumOd: "2026-06-20",
      nazev: "MINT Market",
      zdrojIdentita: MINT_ID,
      stavSchvaleni: "SCHVALENO",
    }),
  ];
  const { udalosti, vysledek, zmena } = aplikovatScanKandidatyNaUdalosti(
    pred,
    [
      kandidat({
        nazev: "MINT Market",
        datumOd: "2026-06-21",
        zdrojIdentita: MINT_ID,
      }),
    ],
    DNES,
    jeUdalostCelaMinula,
  );
  assert(vysledek.pridano === 0 && vysledek.aktualizovano === 0, "E žádný zápis");
  assert(vysledek.jizExistuje === 1, "E blokováno jako jizExistuje");
  assert(!zmena, "E bez změny dokumentu");
  assert(udalosti.length === 1, "E stále 1");
  assert(udalosti[0].datumOd === "2026-06-20", "E datum beze změny");
  assert(udalosti[0].stavSchvaleni === "SCHVALENO", "E SCHVALENO");
  console.log("OK E: SCHVALENO bez overwrite");
}

// F: dvě různé identity u stejné kotvy = dvě CEKA
{
  const { udalosti, vysledek } = aplikovatScanKandidatyNaUdalosti(
    [],
    [
      kandidat({
        nazev: "MINT Market",
        datumOd: "2026-06-27",
        zdrojIdentita: "mintmarket|/trh/trebon-12",
      }),
      kandidat({
        nazev: "Vinobraní",
        datumOd: "2026-09-05",
        zdrojIdentita: "trebonsko-trhy|vinobrani|2026|1",
      }),
    ],
    DNES,
    jeUdalostCelaMinula,
  );
  assert(vysledek.pridano === 2, "F pridano=2");
  assert(udalosti.length === 2, "F 2 CEKA");
  assert(
    udalosti[0].zdrojIdentita !== udalosti[1].zdrojIdentita,
    "F různé identity",
  );
  console.log("OK F: různé eventy se nesloučí");
}

// G: starý záznam bez identity → scanKlic fallback
{
  const pred = [
    ceka({
      id: "auto-g",
      datumOd: "2026-06-20",
      nazev: "MINT Market",
      // bez zdrojIdentita
    }),
  ];
  const { udalosti, vysledek, zmena } = aplikovatScanKandidatyNaUdalosti(
    pred,
    [
      kandidat({
        nazev: "MINT Market",
        datumOd: "2026-06-20",
        zdrojIdentita: MINT_ID,
      }),
    ],
    DNES,
    jeUdalostCelaMinula,
  );
  assert(vysledek.jizExistuje === 1, "G jizExistuje přes scanKlic");
  assert(vysledek.pridano === 0, "G bez nové CEKA");
  assert(udalosti.length === 1, "G 1");
  assert(udalosti[0].zdrojIdentita === MINT_ID, "G doplněná identita");
  assert(zmena, "G backfill identity = zmena");
  console.log("OK G: scanKlic fallback + backfill identity");
}

// VYRAZENO: neobnovovat
{
  const pred = [
    ceka({
      id: "auto-v",
      datumOd: "2026-06-20",
      nazev: "MINT Market",
      zdrojIdentita: MINT_ID,
      stavSchvaleni: "VYRAZENO",
    }),
  ];
  const { udalosti, vysledek } = aplikovatScanKandidatyNaUdalosti(
    pred,
    [
      kandidat({
        nazev: "MINT Market",
        datumOd: "2026-06-21",
        zdrojIdentita: MINT_ID,
      }),
    ],
    DNES,
    jeUdalostCelaMinula,
  );
  assert(vysledek.pridano === 0 && vysledek.aktualizovano === 0, "V žádný zápis");
  assert(udalosti[0].stavSchvaleni === "VYRAZENO", "V zůstává VYRAZENO");
  console.log("OK VYRAZENO: bez obnovení");
}

// Parser: MINT listing emituje zdrojIdentita se slugem
{
  const html = `<html><body>mintmarket.cz
<link rel="canonical" href="https://www.mintmarket.cz/"/>
<a href="/cs/trh/trebon-12"><span>MINT Market Třeboň</span><small>27.06.26 - 28.06.26</small></a>
</body></html>`;
  // listing detektor: bez section-market (detail šablona)
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(k.length === 1, "parser MINT count");
  assert(
    k[0].zdrojIdentita === "mintmarket|/trh/trebon-12",
    `parser MINT identita=${k[0].zdrojIdentita}`,
  );
  console.log("OK parser MINT zdrojIdentita");
}

function cityEventListingHtml(inputs: string[]): string {
  const checkboxy = inputs
    .map(
      (v) =>
        `<input type="checkbox" name="festivaly[]" value="${v}" />`,
    )
    .join("\n");
  return `<html><body>cityevent.cz Přehled festivalů
<link rel="canonical" href="https://www.cityevent.cz/pro-ucastniky/"/>
${checkboxy}
</body></html>`;
}

function trebonskoHtml(radky: string[]): string {
  const lis = radky.map((r) => `<li>${r}</li>`).join("\n");
  return `<html><body>trebonsko.cz
<link rel="canonical" href="https://www.trebonsko.cz/remeslne-trhy-trebon"/>
<h1>Řemeslné trhy v Třeboni v roce 2026</h1>
<ul>
${lis}
</ul>
kalendář trhů
</body></html>`;
}

const CITY_BASE = [
  "Street Food Festival Brno – 1.5.2026",
  "Jarní Street Food Festival Třeboň – 9.5.2026",
  "BEER &amp; FOOD FEST Třeboň – 4.7.2026",
  "Letní Street Food Festival Třeboň – 15.8.2026",
];

const ID_JARNI = "cityevent|trhy|jarni-street-food-festival-trebon|2026";
const ID_BEER = "cityevent|trhy|beer-food-fest-trebon|2026";
const ID_LETNI = "cityevent|trhy|letni-street-food-festival-trebon|2026";

function cityTrebonIdentityMap(html: string): Map<string, string> {
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  const m = new Map<string, string>();
  for (const x of k) {
    assert(x.zdrojIdentita, `chybí identita ${x.nazev} ${x.datumOd}`);
    m.set(`${x.nazev}|${x.datumOd}`, x.zdrojIdentita);
  }
  return m;
}

// Stabilita A: nesouvisející položka nahoře → identity beze změny
{
  const pred = cityTrebonIdentityMap(cityEventListingHtml(CITY_BASE));
  const po = cityTrebonIdentityMap(
    cityEventListingHtml([
      "Street Food Festival Praha – 20.4.2026",
      ...CITY_BASE,
    ]),
  );
  assert(pred.get("Street Food Festival|2026-05-09") === ID_JARNI, "A jarni pred");
  assert(po.get("Street Food Festival|2026-05-09") === ID_JARNI, "A jarni po");
  assert(pred.get("Beer & Food Fest|2026-07-04") === ID_BEER, "A beer pred");
  assert(po.get("Beer & Food Fest|2026-07-04") === ID_BEER, "A beer po");
  assert(pred.get("Street Food Festival|2026-08-15") === ID_LETNI, "A letni pred");
  assert(po.get("Street Food Festival|2026-08-15") === ID_LETNI, "A letni po");
  console.log("OK stabilita A: nesouvisející nahoře");
}

// Stabilita B: přeskupení City Event → identity beze změny
{
  const pred = cityTrebonIdentityMap(cityEventListingHtml(CITY_BASE));
  const po = cityTrebonIdentityMap(
    cityEventListingHtml([
      "Letní Street Food Festival Třeboň – 15.8.2026",
      "BEER &amp; FOOD FEST Třeboň – 4.7.2026",
      "Jarní Street Food Festival Třeboň – 9.5.2026",
      "Street Food Festival Brno – 1.5.2026",
    ]),
  );
  assert(po.get("Street Food Festival|2026-05-09") === ID_JARNI, "B jarni");
  assert(po.get("Beer & Food Fest|2026-07-04") === ID_BEER, "B beer");
  assert(po.get("Street Food Festival|2026-08-15") === ID_LETNI, "B letni");
  assert(
    pred.get("Street Food Festival|2026-05-09") ===
      po.get("Street Food Festival|2026-05-09"),
    "B jarni stejná",
  );
  console.log("OK stabilita B: přeskupení City Event");
}

// Stabilita C: změna data → stejná identita
{
  const pred = cityTrebonIdentityMap(cityEventListingHtml(CITY_BASE));
  const po = cityTrebonIdentityMap(
    cityEventListingHtml([
      "Street Food Festival Brno – 1.5.2026",
      "Jarní Street Food Festival Třeboň – 16.5.2026",
      "BEER &amp; FOOD FEST Třeboň – 4.7.2026",
      "Letní Street Food Festival Třeboň – 15.8.2026",
    ]),
  );
  assert(pred.get("Street Food Festival|2026-05-09") === ID_JARNI, "C pred");
  assert(po.get("Street Food Festival|2026-05-16") === ID_JARNI, "C po datum");
  console.log("OK stabilita C: změna data stejná identita");
}

// Stabilita D: zmizení jiné položky → identity beze změny
{
  const pred = cityTrebonIdentityMap(cityEventListingHtml(CITY_BASE));
  const po = cityTrebonIdentityMap(
    cityEventListingHtml([
      "Jarní Street Food Festival Třeboň – 9.5.2026",
      "BEER &amp; FOOD FEST Třeboň – 4.7.2026",
      "Letní Street Food Festival Třeboň – 15.8.2026",
    ]),
  );
  assert(po.get("Street Food Festival|2026-05-09") === ID_JARNI, "D jarni");
  assert(po.get("Beer & Food Fest|2026-07-04") === ID_BEER, "D beer");
  assert(po.get("Street Food Festival|2026-08-15") === ID_LETNI, "D letni");
  assert(
    pred.get("Beer & Food Fest|2026-07-04") ===
      po.get("Beer & Food Fest|2026-07-04"),
    "D beer stejná",
  );
  console.log("OK stabilita D: zmizení jiné položky");
}

// Stabilita E: dva Adventní → dvě různé identity
{
  const k = parsovatUdalostiZeZdroje(
    trebonskoHtml(["12. 12. Adventní trh", "19. 12. Adventní trh"]),
    "text/html",
  );
  assert(k.length === 2, "E adventní 2");
  assert(
    k[0].zdrojIdentita === "trebonsko-trhy|adventni|2026|1",
    `E adv1=${k[0].zdrojIdentita}`,
  );
  assert(
    k[1].zdrojIdentita === "trebonsko-trhy|adventni|2026|2",
    `E adv2=${k[1].zdrojIdentita}`,
  );
  assert(
    (k[0].zdrojIdentita as string) !== (k[1].zdrojIdentita as string),
    "E různé",
  );
  console.log("OK stabilita E: dva Adventní");
}

// Stabilita F: unikátní Třeboňsko trh → bez pořadí
{
  const k = parsovatUdalostiZeZdroje(
    trebonskoHtml([
      "5. 9. Vinobraní s trhem",
      "12. 12. Adventní trh",
      "19. 12. Adventní trh",
    ]),
    "text/html",
  );
  const vino = k.find((x) => x.nazev === "Vinobraní");
  assert(vino, "F Vinobraní");
  assert(
    vino.zdrojIdentita === "trebonsko-trhy|vinobrani|2026",
    `F vino=${vino.zdrojIdentita}`,
  );
  assert(!vino.zdrojIdentita?.endsWith("|1"), "F bez |1");
  console.log("OK stabilita F: unikátní bez pořadí");
}

// Matiné: Třeboňsko matine|datum nesmí založit druhou kartu vedle Okolo.
{
  const MATINE_KOTVA = "trebonska-lazenska-matine";
  const exist: BranaKonkretniUdalost = {
    id: "auto-okolo-m",
    redakcniPolozkaId: MATINE_KOTVA,
    datumOd: "2026-09-20",
    datumDo: "2026-09-20",
    cas: "11:00",
    mistoNeboTyp: "Lázeňské matiné Altán u lázeňského domu Berta",
    nazev: "Třeboňská lázeňská matiné: Cimbál",
    rucniPoziceVDni: null,
    stavSchvaleni: "SCHVALENO",
    scanKlic: vytvoritScanKlicAutomatickeUdalosti({
      redakcniPolozkaId: MATINE_KOTVA,
      datumOd: "2026-09-20",
      cas: "11:00",
      nazev: "Třeboňská lázeňská matiné: Cimbál",
    }),
    zdrojIdentita:
      "okolo|2026-09-20|11:00|trebonska-lazenska-matine-cimbal",
  };
  const { udalosti, vysledek } = aplikovatScanKandidatyNaUdalosti(
    [exist],
    [
      {
        redakcniPolozkaId: MATINE_KOTVA,
        datumOd: "2026-09-20",
        datumDo: "2026-09-20",
        cas: "11:00",
        mistoNeboTyp: "Lázeňské matiné Altán u lázeňského domu Berta",
        nazev: "Cimbálová muzika - pocta vínu",
        zdrojIdentita: "matine|2026-09-20",
      },
    ],
    DNES,
    jeUdalostCelaMinula,
  );
  assert(vysledek.pridano === 0, "matiné alias pridano=0");
  assert(udalosti.length === 1, "matiné alias 1 karta");
  assert(udalosti[0].id === "auto-okolo-m", "matiné alias stejné id");
  console.log("OK matiné alias: Okolo SCHVALENO + Třeboňsko = 1");
}

{
  const html = `<!DOCTYPE html><html><body>
<div class="event">
  <h1>TŘEBOŇ: Rožmberská noc – VYPRODÁNO</h1>
  <p>10. 9. 2026 – 12. 9. 2026</p>
  <p>18.00 – 19.00, 19.15 – 20.15, 20.30 – 21.30</p>
  <div class="post-text"></div>
</div>
</body></html>`;
  const k = parsovatUdalostiZeZdroje(html, "text/html");
  assert(k.length === 3, `RN parser 3, bylo ${k.length}`);
  assert(
    k[0].zdrojIdentita === "rozmberska-noc|2026-09-10",
    `RN identita 10.9. ${k[0].zdrojIdentita}`,
  );
  assert(
    k[1].zdrojIdentita === "rozmberska-noc|2026-09-11",
    "RN identita 11.9.",
  );
  assert(
    k[2].zdrojIdentita === "rozmberska-noc|2026-09-12",
    "RN identita 12.9.",
  );
  assert(k.every((x) => x.cas === ""), "RN cas prázdný");
  const vstupy = k.map((x) => {
    const zapis = sestavRozmberskaNocZapisPoSparovani({
      verejneRozliseni: x.mistoNeboTyp,
    });
    return kandidat({
      nazev: zapis.nazev,
      datumOd: x.datumOd,
      cas: x.cas,
      mistoNeboTyp: zapis.mistoNeboTyp,
      verejneCo: zapis.verejneCo,
      verejneRozliseni: zapis.verejneRozliseni,
      zdrojIdentita: x.zdrojIdentita,
    });
  });
  const prvni = aplikovatScanKandidatyNaUdalosti(
    [],
    vstupy,
    DNES,
    jeUdalostCelaMinula,
  );
  assert(prvni.vysledek.pridano === 3, "RN první 3");
  const druhy = aplikovatScanKandidatyNaUdalosti(
    prvni.udalosti,
    vstupy,
    DNES,
    jeUdalostCelaMinula,
  );
  assert(druhy.vysledek.pridano === 0, "RN opakovaně 0");
  assert(druhy.vysledek.jizExistuje === 3, "RN 3× Již existuje");
  console.log("OK Rožmberská noc: identita den, 0 nových / 3× Již existuje");
}

void dnesIsoVPraze;
console.log("VŠE OK — zdrojIdentita CEKA in-place");
