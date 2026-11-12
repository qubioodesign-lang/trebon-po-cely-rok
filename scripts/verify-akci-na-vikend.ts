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
  chranitCteniSkrytiAkciNaVikend,
  isoDenPrahy,
  jeAkciNaVikendRucneSkryte,
  jeOknoAkciNaVikend,
  konecAktualnihoOknaAkciNaVikend,
  maSeZobrazitAkciNaVikend,
  nacteniSkrytiAkciNaVikendZDokumentu,
  parsovatDokumentSkrytiAkciNaVikend,
  pripojitVolitelnyPocet,
  uplatnitSkrytiAkciNaVikend,
  vetaParkuASdeleniSeNekryji,
  type NacteniSkrytiAkciNaVikend,
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
overit(
  !zdroj.includes("nactiSkrytiAkciNaVikend") &&
    !zdroj.includes("akci-na-vikend-uloziste"),
  "výpočet počtu nečte úložiště skrytí",
);

const konecPondeli = konecAktualnihoOknaAkciNaVikend(PONDĚLI);
const konecCtvrtka = konecAktualnihoOknaAkciNaVikend(CTVRTEK);
const dalsiPondeli = praha(2026, 8, 10, 10, 0);
if (!konecPondeli || !konecCtvrtka) {
  throw new Error("v okně je konec");
}
overit(
  konecPondeli.getTime() === PONDĚLI_UPOZORNENI.getTime(),
  "pondělní skrytí končí začátkem upozornění parku",
);
overit(
  konecCtvrtka.getTime() === CTVRTEK_UPOZORNENI.getTime(),
  "čtvrteční skrytí končí začátkem upozornění parku",
);
overit(konecAktualnihoOknaAkciNaVikend(UTERY) === null, "úterý skrytí dopředu nedovolí");
overit(
  konecAktualnihoOknaAkciNaVikend(PONDĚLI_PRED) === null,
  "před sedmou skrytí dopředu nedovolí",
);
overit(
  konecAktualnihoOknaAkciNaVikend(PONDĚLI_UPOZORNENI) === null,
  "v upozornění skrytí dopředu nedovolí",
);
overit(
  konecAktualnihoOknaAkciNaVikend(praha(2026, 8, 8, 10, 0)) === null,
  "sobota skrytí dopředu nedovolí",
);

const skrytiPondeli: NacteniSkrytiAkciNaVikend = {
  stav: "ok",
  skrytoDo: konecPondeli.toISOString(),
  oknoIso: "2026-08-03",
};
const skrytiCtvrtka: NacteniSkrytiAkciNaVikend = {
  stav: "ok",
  skrytoDo: konecCtvrtka.toISOString(),
  oknoIso: "2026-08-06",
};

overit(
  uplatnitSkrytiAkciNaVikend(PONDĚLI, 5, oknoPondeli, skrytiPondeli).pocet ===
    null,
  "pondělní skrytí větu vezme",
);
overit(
  jeAkciNaVikendRucneSkryte(
    praha(2026, 8, 3, 19, 14),
    skrytiPondeli.skrytoDo,
    skrytiPondeli.oknoIso,
  ),
  "těsně před koncem okna skrytí ještě platí",
);
overit(
  !jeAkciNaVikendRucneSkryte(
    PONDĚLI_UPOZORNENI,
    skrytiPondeli.skrytoDo,
    skrytiPondeli.oknoIso,
  ),
  "na hraně okna skrytí končí",
);
overit(
  uplatnitSkrytiAkciNaVikend(CTVRTEK, 5, isoDenPrahy(CTVRTEK), skrytiPondeli)
    .pocet === 5,
  "ve čtvrtek se pondělní skrytí nevrací",
);
overit(
  uplatnitSkrytiAkciNaVikend(CTVRTEK, 5, isoDenPrahy(CTVRTEK), skrytiCtvrtka)
    .pocet === null,
  "čtvrteční skrytí větu vezme",
);
overit(
  uplatnitSkrytiAkciNaVikend(
    dalsiPondeli,
    5,
    isoDenPrahy(dalsiPondeli),
    skrytiCtvrtka,
  ).pocet === 5,
  "v dalším pondělí se čtvrteční skrytí nevrací",
);
overit(
  !jeAkciNaVikendRucneSkryte(
    PONDĚLI,
    skrytiCtvrtka.skrytoDo,
    skrytiPondeli.oknoIso,
  ),
  "čas pozdějšího okna dnešek neskryje",
);
overit(
  !jeAkciNaVikendRucneSkryte(UTERY, skrytiCtvrtka.skrytoDo, skrytiCtvrtka.oknoIso),
  "mimo okno uložený čas budoucí sdělení neskryje",
);

const parkDoUt = praha(2026, 8, 4, 7, 0).toISOString();
const vetaPriUpozorneni = verejnaVetaZameckehoParku(PONDĚLI_UPOZORNENI, null);
overit(verejnaVetaZameckehoParku(PONDĚLI, parkDoUt) === null, "park má vlastní skrytí");
overit(
  uplatnitSkrytiAkciNaVikend(PONDĚLI, 5, oknoPondeli, { stav: "neni" }).pocet ===
    5,
  "skrytí parku sdělení akcí neskryje",
);
overit(vetaPriUpozorneni !== null, "park v upozornění mluví");
overit(
  verejnaVetaZameckehoParku(PONDĚLI_UPOZORNENI, null) === vetaPriUpozorneni,
  "skrytí akcí větu parku nemění",
);

const nulaPoSkryti = uplatnitSkrytiAkciNaVikend(PONDĚLI, 0, null, {
  stav: "neni",
});
overit(nulaPoSkryti.pocet === 0, "nula zůstane nulou, když skrytí chybí");
overit(
  !maSeZobrazitAkciNaVikend(PONDĚLI, nulaPoSkryti.pocet, nulaPoSkryti.oknoIso),
  "při nule se věta nezobrazí ani bez skrytí",
);
overit(sestava.pocet === 5, "skrytí nepřepíše spočítaný počet");

const chybejici = uplatnitSkrytiAkciNaVikend(PONDĚLI, 5, oknoPondeli, {
  stav: "neni",
});
overit(chybejici.pocet === 5 && chybejici.oknoIso === oknoPondeli, "chybějící úložiště větu nechá");

const poskozenyDokument = nacteniSkrytiAkciNaVikendZDokumentu({
  verze: 1,
  skrytoDo: "necas",
  oknoIso: "2026-08-03",
});
overit(poskozenyDokument.stav === "chyba", "poškozený dokument je chyba čtení");
overit(
  uplatnitSkrytiAkciNaVikend(PONDĚLI, 5, oknoPondeli, poskozenyDokument).pocet ===
    null,
  "poškozené úložiště větu neukáže",
);
overit(
  uplatnitSkrytiAkciNaVikend(PONDĚLI, 5, oknoPondeli, { stav: "chyba" }).pocet ===
    null,
  "chyba čtení větu neukáže",
);

const dokumentSPoctem = parsovatDokumentSkrytiAkciNaVikend({
  verze: 1,
  skrytoDo: skrytiPondeli.skrytoDo,
  oknoIso: skrytiPondeli.oknoIso,
  pocet: 7,
});
overit(
  dokumentSPoctem.ok === true && !("pocet" in dokumentSPoctem),
  "dokument skrytí počet neuchovává",
);
overit(
  parsovatDokumentSkrytiAkciNaVikend({ verze: 1, skrytoDo: null, oknoIso: null })
    .ok === true,
  "prázdné skrytí je platný dokument",
);
overit(
  parsovatDokumentSkrytiAkciNaVikend(null).ok === false,
  "prázdný obsah dokumentu je chyba",
);

function verejnaStrankaPriCteniSkryti(cist: () => NacteniSkrytiAkciNaVikend) {
  const pohledovaData = { znacka: "dnes" };
  const parkVeta = verejnaVetaZameckehoParku(PONDĚLI, null);
  const nacteni = chranitCteniSkrytiAkciNaVikend(cist);
  return {
    pohledovaData,
    parkVeta,
    ...uplatnitSkrytiAkciNaVikend(PONDĚLI, 5, oknoPondeli, nacteni),
  };
}

const priVyjimce = verejnaStrankaPriCteniSkryti(() => {
  throw new Error("úložiště skrytí selhalo");
});
overit(priVyjimce.pohledovaData.znacka === "dnes", "chyba skrytí nechá data DNES");
overit(priVyjimce.parkVeta === null, "chyba skrytí nechá stav parku");
overit(priVyjimce.pocet === null && priVyjimce.oknoIso === null, "výjimka čtení větu neukáže");
overit(
  chranitCteniSkrytiAkciNaVikend(() => ({ stav: "co" }) as never).stav ===
    "chyba",
  "neznámé čtení je chyba",
);

const uloziste = readFileSync(
  resolve(process.cwd(), "src/lib/brana/admin/akci-na-vikend-uloziste.ts"),
  "utf8",
);
overit(
  uloziste.includes('data/brana-akci-na-vikend.json'),
  "skrytí má vlastní soubor",
);
overit(uloziste.includes('stav: "neni"'), "chybějící soubor není chyba");
overit(uloziste.includes('stav: "chyba"'), "selhání čtení je chyba");
overit(!uloziste.includes("pocet"), "úložiště počet nezapisuje");
const akce = readFileSync(
  resolve(process.cwd(), "src/app/brana/admin/akci-na-vikend-akce.ts"),
  "utf8",
);
overit(
  akce.indexOf("if (!konec)") !== -1 &&
    akce.indexOf("if (!konec)") < akce.indexOf("await ulozitSkrytiAkciNaVikend"),
  "mimo okno se skrytí nezapíše",
);
overit(!akce.includes("pocet"), "akce počet neukládá");
const hlavniAkce = readFileSync(
  resolve(process.cwd(), "src/app/brana/admin/actions.ts"),
  "utf8",
);
overit(
  !hlavniAkce.includes("skrytAkciNaVikend") &&
    !hlavniAkce.includes("akci-na-vikend"),
  "nová akce není v hlavním actions.ts",
);
const verejnaStranka = readFileSync(
  resolve(process.cwd(), "src/components/brana/BranaVerejnaStranka.tsx"),
  "utf8",
);
overit(
  verejnaStranka.includes("nactiSkrytiZameckehoParku") &&
    verejnaStranka.includes("verejnaVetaZameckehoParku"),
  "veřejná stránka park dál čte po svém",
);
overit(
  verejnaStranka.indexOf("verejnaVetaZameckehoParku(okamzik") <
    verejnaStranka.indexOf("nactiSkrytiAkciNaVikend()"),
  "selhání skrytí akcí přijde až po větě parku",
);
overit(
  verejnaStranka.includes('stav: "chyba"'),
  "odmítnuté čtení skrytí veřejnou stránku neshodí",
);

console.log("Akcí na víkend: všechna ověření prošla.");
