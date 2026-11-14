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
  dalsiKontrolaAkciNaVikend,
  jeOknoAkciNaVikend,
  jeUdalostTrhem,
  konecAktualnihoOknaAkciNaVikend,
  maSePripravitPocetAkciNaVikend,
  maSeZobrazitAkciNaVikend,
  nacteniSkrytiAkciNaVikendZDokumentu,
  parsovatDokumentSkrytiAkciNaVikend,
  pripojitVolitelnyPocet,
  uplatnitSkrytiAkciNaVikend,
  vetaParkuASdeleniSeNekryji,
  vetaParkuVedleAkciNaVikend,
  type NacteniSkrytiAkciNaVikend,
} from "../src/lib/brana/sdileni-akci-na-vikend";
import {
  verejnaVetaZameckehoParku,
  VETA_ZAMECKY_PARK_BRZY,
  VETA_ZAMECKY_PARK_ZAVRENO,
} from "../src/lib/brana/zamecky-park";
import {
  jsouTrhyVeSchvalenychVikendovychDnech,
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
const PONDĚLI_PRED_UPOZORNENIM = praha(2026, 8, 3, 19, 14);
const PONDĚLI_UPOZORNENI = praha(2026, 8, 3, 19, 15);
const PONDĚLI_ZAVRENI = praha(2026, 8, 3, 20, 0);
const PONDĚLI_ZAVRENO = praha(2026, 8, 3, 22, 0);
const UTERY_PULNOC = praha(2026, 8, 4, 0, 0);
const UTERY = praha(2026, 8, 4, 10, 0);
const STREDA = praha(2026, 8, 5, 10, 0);
const PATEK = praha(2026, 8, 7, 10, 0);
const SOBOTA = praha(2026, 8, 8, 10, 0);
const NEDELE = praha(2026, 8, 9, 22, 0);
const CTVRTEK_PRED = praha(2026, 8, 6, 6, 59);
const CTVRTEK_SEDMA = praha(2026, 8, 6, 7, 0);
const CTVRTEK = praha(2026, 8, 6, 10, 0);
const CTVRTEK_PRED_UPOZORNENIM = praha(2026, 8, 6, 19, 14);
const CTVRTEK_UPOZORNENI = praha(2026, 8, 6, 19, 15);
const CTVRTEK_ZAVRENI = praha(2026, 8, 6, 20, 0);
const CTVRTEK_ZAVRENO = praha(2026, 8, 6, 22, 0);
const PATEK_PULNOC = praha(2026, 8, 7, 0, 0);

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
overit(jeOknoAkciNaVikend(PONDĚLI_PRED_UPOZORNENIM), "minutu před upozorněním okno je");
overit(!jeOknoAkciNaVikend(PONDĚLI_UPOZORNENI), "začátek upozornění okno není");
overit(!jeOknoAkciNaVikend(CTVRTEK_UPOZORNENI), "čtvrteční upozornění okno není");
overit(jeOknoAkciNaVikend(PONDĚLI_ZAVRENI), "okamžik zavření parku okno je");
overit(jeOknoAkciNaVikend(PONDĚLI_ZAVRENO), "večer po zavření se okno vrací");
overit(!jeOknoAkciNaVikend(UTERY_PULNOC), "úterý o půlnoci okno není");
overit(!jeOknoAkciNaVikend(UTERY), "úterý okno není");
overit(!jeOknoAkciNaVikend(SOBOTA), "sobota okno není");

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
overit(sestava.jsouTrhy === false, "víkend bez trhů říká, že trhy nejsou");
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
overit(nula.jsouTrhy === null, "nula nepřidá větu o trzích");
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
overit(mimo.jsouTrhy === null, "mimo okno se trhy nehodnotí");
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
  maSeZobrazitAkciNaVikend(PONDĚLI_ZAVRENO, 5, oknoPondeli),
  "po zavření parku se víkendové sdělení vrací",
);
overit(
  vetaParkuVedleAkciNaVikend(PONDĚLI_ZAVRENO, 5, oknoPondeli, null) === null,
  "večer vedle sdělení nezbývá zavřený park",
);
overit(
  verejnaVetaZameckehoParku(PONDĚLI_ZAVRENO, null) === VETA_ZAMECKY_PARK_ZAVRENO,
  "samotná věta zavřeného parku zůstala",
);
overit(
  !maSeZobrazitAkciNaVikend(UTERY, 5, isoDenPrahy(UTERY)),
  "úterý okno nerozšíří",
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
  konecPondeli.getTime() === UTERY_PULNOC.getTime(),
  "pondělní skrytí vydrží do půlnoci",
);
overit(
  konecCtvrtka.getTime() === PATEK_PULNOC.getTime(),
  "čtvrteční skrytí vydrží do půlnoci",
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
  jeAkciNaVikendRucneSkryte(
    PONDĚLI_UPOZORNENI,
    skrytiPondeli.skrytoDo,
    skrytiPondeli.oknoIso,
  ),
  "v upozornění skrytí ještě drží večer",
);
overit(
  jeAkciNaVikendRucneSkryte(
    PONDĚLI_ZAVRENO,
    skrytiPondeli.skrytoDo,
    skrytiPondeli.oknoIso,
  ),
  "večer po skrytí se sdělení nevrací",
);
overit(
  uplatnitSkrytiAkciNaVikend(PONDĚLI_ZAVRENO, 5, oknoPondeli, skrytiPondeli)
    .pocet === null,
  "večerní načtení skryté sdělení neukáže",
);
overit(
  !jeAkciNaVikendRucneSkryte(
    UTERY_PULNOC,
    skrytiPondeli.skrytoDo,
    skrytiPondeli.oknoIso,
  ),
  "po půlnoci pondělní skrytí nepokračuje",
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

function vetaASdeleniSeNekryji(
  cas: Date,
  pocet: number | null,
  okno: string | null,
): void {
  const sdeleni = maSeZobrazitAkciNaVikend(cas, pocet, okno);
  const park = vetaParkuVedleAkciNaVikend(cas, pocet, okno, null);
  overit(!(sdeleni && park !== null), "dvě konkurenční věty se nekryjí");
  if (!sdeleni) {
    overit(
      park === verejnaVetaZameckehoParku(cas, null),
      "bez víkendové věty zůstává dosavadní park",
    );
  }
}

const oknoCtvrtka = isoDenPrahy(CTVRTEK);
const casySdeleni = [
  [PONDĚLI_PRED, false],
  [PONDĚLI_SEDMA, true],
  [PONDĚLI_PRED_UPOZORNENIM, true],
  [PONDĚLI_UPOZORNENI, false],
  [PONDĚLI_ZAVRENI, true],
  [PONDĚLI_ZAVRENO, true],
  [UTERY_PULNOC, false],
  [CTVRTEK_PRED, false],
  [CTVRTEK_SEDMA, true],
  [CTVRTEK_PRED_UPOZORNENIM, true],
  [CTVRTEK_UPOZORNENI, false],
  [CTVRTEK_ZAVRENI, true],
  [CTVRTEK_ZAVRENO, true],
  [PATEK_PULNOC, false],
] as const;
for (const [cas, maSvetit] of casySdeleni) {
  const okno = isoDenPrahy(cas) === "2026-08-06" ? oknoCtvrtka : oknoPondeli;
  overit(maSeZobrazitAkciNaVikend(cas, 5, okno) === maSvetit, "okno víkendového sdělení");
  overit(!maSeZobrazitAkciNaVikend(cas, 0, null), "při nule sdělení nesvítí");
  vetaASdeleniSeNekryji(cas, 5, okno);
  vetaASdeleniSeNekryji(cas, null, null);
}
overit(
  verejnaVetaZameckehoParku(PONDĚLI_UPOZORNENI, null) === VETA_ZAMECKY_PARK_BRZY,
  "upozornění parku má svou větu",
);
overit(
  vetaParkuVedleAkciNaVikend(PONDĚLI_ZAVRENO, null, null, null) ===
    VETA_ZAMECKY_PARK_ZAVRENO,
  "při nule zůstává večer zavřený park",
);
overit(
  dalsiKontrolaAkciNaVikend(PONDĚLI).getTime() === PONDĚLI_UPOZORNENI.getTime(),
  "dopoledne sdělení končí začátkem upozornění",
);
overit(
  dalsiKontrolaAkciNaVikend(PONDĚLI_UPOZORNENI).getTime() ===
    PONDĚLI_ZAVRENI.getTime(),
  "upozornění končí zavřením parku",
);
overit(
  dalsiKontrolaAkciNaVikend(PONDĚLI_ZAVRENO).getTime() === UTERY_PULNOC.getTime(),
  "večerní sdělení končí půlnocí",
);
overit(
  dalsiKontrolaAkciNaVikend(praha(2026, 8, 4, 22, 0)).getTime() ===
    praha(2026, 8, 5, 7, 0).getTime(),
  "úterní večer dál čeká na otevření parku",
);

const bezZmeny = [STREDA, PATEK, SOBOTA, NEDELE, praha(2026, 8, 4, 22, 0), praha(2026, 8, 8, 22, 0)];
for (const cas of bezZmeny) {
  overit(!jeOknoAkciNaVikend(cas), "ostatní dny okno nemají");
  overit(
    vetaParkuVedleAkciNaVikend(cas, 5, oknoPondeli, null) ===
      verejnaVetaZameckehoParku(cas, null),
    "ostatní dny nechávají park beze změny",
  );
}

const listopadPred = praha(2026, 11, 2, 6, 59);
const listopadSedma = praha(2026, 11, 2, 7, 0);
const listopadPredUpo = praha(2026, 11, 2, 16, 14);
const listopadUpo = praha(2026, 11, 2, 16, 15);
const listopadZavreni = praha(2026, 11, 2, 17, 0);
const listopadVecer = praha(2026, 11, 2, 22, 0);
const listopadPulnoc = praha(2026, 11, 3, 0, 0);
const oknoListopad = isoDenPrahy(listopadSedma);
overit(!jeOknoAkciNaVikend(listopadPred), "listopadové ráno okno není");
overit(jeOknoAkciNaVikend(listopadSedma), "listopadová sedmá okno je");
overit(jeOknoAkciNaVikend(listopadPredUpo), "listopad minutu před upozorněním okno je");
overit(!jeOknoAkciNaVikend(listopadUpo), "listopadové upozornění okno není");
overit(jeOknoAkciNaVikend(listopadZavreni), "listopadové zavření okno je");
overit(jeOknoAkciNaVikend(listopadVecer), "listopadový večer okno je");
overit(!jeOknoAkciNaVikend(listopadPulnoc), "listopadová půlnoc okno není");
overit(
  verejnaVetaZameckehoParku(listopadUpo, null) === VETA_ZAMECKY_PARK_BRZY,
  "listopadové upozornění má větu parku",
);
overit(
  vetaParkuVedleAkciNaVikend(listopadVecer, 5, oknoListopad, null) === null,
  "listopadový večer vedle sdělení park nesvítí",
);
overit(
  konecAktualnihoOknaAkciNaVikend(listopadSedma)?.getTime() ===
    listopadPulnoc.getTime(),
  "listopadové skrytí vydrží do půlnoci",
);

overit(
  jeAkciNaVikendRucneSkryte(CTVRTEK_ZAVRENO, skrytiCtvrtka.skrytoDo, skrytiCtvrtka.oknoIso),
  "čtvrteční skrytí drží i večer",
);
overit(
  !jeAkciNaVikendRucneSkryte(PATEK_PULNOC, skrytiCtvrtka.skrytoDo, skrytiCtvrtka.oknoIso),
  "po čtvrteční půlnoci skrytí nepokračuje",
);
overit(
  !maSeZobrazitAkciNaVikend(CTVRTEK_ZAVRENO, 5, oknoCtvrtka) ||
    vetaParkuVedleAkciNaVikend(CTVRTEK_ZAVRENO, 5, oknoCtvrtka, null) === null,
  "čtvrteční večer nenechá obě věty",
);

const vikendDny = ["2026-08-08", "2026-08-09"];
function jsouTrhy(seznam: BranaKonkretniUdalost[], redakce = polozky) {
  return jsouTrhyVeSchvalenychVikendovychDnech({
    udalosti: seznam,
    redakcniPolozky: redakce,
    vikendIsoDny: vikendDny,
  });
}
function rucniTrh(
  nazev: string,
  doplnek: Partial<BranaKonkretniUdalost> = {},
): boolean {
  return jeUdalostTrhem({
    redakcniPolozkaId: doplnek.redakcniPolozkaId ?? null,
    nazev,
    mistoNeboTyp: doplnek.mistoNeboTyp ?? "náměstí",
    verejneCo: doplnek.verejneCo,
    verejneRozliseni: doplnek.verejneRozliseni,
  });
}

overit(rucniTrh("Adventní zámecké trhy"), "ruční trhy v názvu");
overit(rucniTrh("Regionální trh a dětské dílničky"), "ruční trh jako samostatné slovo");
overit(rucniTrh("Na trhu"), "tvar trhu");
overit(rucniTrh("jde trhem"), "tvar trhem");
overit(rucniTrh("velké TRHY"), "tvar trhy bez ohledu na velikost");
overit(rucniTrh("bez trhů"), "tvar trhů");
overit(rucniTrh("na trzích"), "tvar trzích");
overit(rucniTrh("Květinový jarmark"), "jarmark");
overit(rucniTrh("Dílničky", { verejneCo: "Trh" }), "veřejné označení Trh");
overit(rucniTrh("Dílničky", { verejneRozliseni: "jarmark" }), "veřejné rozlišení jarmark");
overit(!rucniTrh("Koncert na náměstí"), "obyčejná akce není trh");
overit(!rucniTrh("trhat dřevo"), "trhat není samostatné slovo trh");
overit(!rucniTrh("trhnutí"), "trhnutí není trh");
overit(!rucniTrh("jarmarku"), "jarmarku není celé slovo jarmark");
overit(!rucniTrh("Netrh"), "Netrh není samostatné slovo");
overit(!rucniTrh("tržiště"), "tržiště není tvar trh");
overit(!rucniTrh("Street Food Festival"), "ruční festival bez slova trh není trh");
overit(
  jeUdalostTrhem({
    redakcniPolozkaId: "trhy",
    nazev: "Beer & Food Fest",
    mistoNeboTyp: "náměstí",
  }),
  "Beer & Food Fest pod položkou trhy",
);
overit(
  jeUdalostTrhem({
    redakcniPolozkaId: "trhy",
    nazev: "Street Food Festival",
    mistoNeboTyp: "náměstí",
  }),
  "Street Food Festival pod položkou trhy",
);
overit(
  !jeUdalostTrhem({
    redakcniPolozkaId: "kino",
    nazev: "Letní trh",
    mistoNeboTyp: "kino",
  }),
  "jiná redakční položka se slovem trh nestačí",
);

const redakceTrhu = [...polozky, polozka("trhy", "ANO")];
const automaticke = sestavitDnesSPoctemAkciNaVikend({
  udalosti: [
    ...udalosti,
    udalost("advent", "2026-08-08", "2026-08-08", {
      redakcniPolozkaId: "trhy",
      nazev: "Adventní",
      rucniPoziceVDni: null,
    }),
  ],
  redakcniPolozky: redakceTrhu,
  okamzik: PONDĚLI,
});
overit(automaticke.pocet === 6, "automatický trh je v počtu jen jednou");
overit(automaticke.jsouTrhy === true, "automatické trhy");

const beer = sestavitDnesSPoctemAkciNaVikend({
  udalosti: [
    ...udalosti,
    udalost("beer", "2026-08-08", "2026-08-09", {
      redakcniPolozkaId: "trhy",
      nazev: "Beer & Food Fest",
      rucniPoziceVDni: null,
    }),
  ],
  redakcniPolozky: redakceTrhu,
  okamzik: PONDĚLI,
});
overit(beer.pocet === 7, "vícedenní trh se v počtu počítá v sobotu i v neděli");
overit(beer.jsouTrhy === true, "vícedenní Beer & Food Fest je trh");

const rucni = sestavitDnesSPoctemAkciNaVikend({
  udalosti: [
    ...udalosti,
    udalost("rucni-trh", "2026-08-09", "2026-08-09", {
      nazev: "Adventní zámecké trhy",
    }),
  ],
  redakcniPolozky: polozky,
  okamzik: PONDĚLI,
});
overit(rucni.pocet === 6, "ruční trh nepřidá počet navíc");
overit(rucni.jsouTrhy === true, "ruční schválené trhy");

const neschvalene = sestavitDnesSPoctemAkciNaVikend({
  udalosti: [
    ...udalosti,
    udalost("ceka-trh", "2026-08-08", "2026-08-08", {
      stavSchvaleni: "CEKA_NA_SCHVALENI",
      redakcniPolozkaId: "trhy",
      nazev: "Trh",
      rucniPoziceVDni: null,
    }),
  ],
  redakcniPolozky: redakceTrhu,
  okamzik: PONDĚLI,
});
overit(neschvalene.pocet === 5, "neschválený trh počet nemění");
overit(neschvalene.jsouTrhy === false, "neschválený trh se nepočítá");

const jenDnesTrh = jsouTrhy([
  udalost("sobota", "2026-08-08", "2026-08-08"),
  udalost("jen-trh", "2026-08-08", "2026-08-08", {
    pouzeDnes: true,
    nazev: "Sobotní trh",
  }),
]);
overit(jenDnesTrh === false, "trh pouze pro DNES ve víkendu není");

const vypnute = jsouTrhy(
  [
    udalost("sobota", "2026-08-08", "2026-08-08"),
    udalost("vypnute", "2026-08-08", "2026-08-08", {
      redakcniPolozkaId: "trhy",
      nazev: "Trh",
      rucniPoziceVDni: null,
    }),
  ],
  [polozka("trhy", "NE")],
);
overit(vypnute === false, "vypnutá položka trhy se nepočítá");

function prvniVykresleni(
  cas: Date,
  pocet: number | null,
  okno: string | null,
  jsouTrhyVety: boolean | null,
): boolean {
  return (
    jsouTrhyVety != null && maSeZobrazitAkciNaVikend(cas, pocet, okno)
  );
}

const behemUpozorneni = sestavitDnesSPoctemAkciNaVikend({
  udalosti,
  redakcniPolozky: polozky,
  okamzik: PONDĚLI_UPOZORNENI,
});
const behemCtvrtka = sestavitDnesSPoctemAkciNaVikend({
  udalosti,
  redakcniPolozky: polozky,
  okamzik: CTVRTEK_UPOZORNENI,
});
const predSedmou = sestavitDnesSPoctemAkciNaVikend({
  udalosti,
  redakcniPolozky: polozky,
  okamzik: PONDĚLI_PRED,
});
overit(predSedmou.pocet === null, "před sedmou se počet nepřipravuje");
overit(
  behemUpozorneni.pocet === sestava.pocet && behemUpozorneni.pocet === 5,
  "během upozornění je připravený stejný počet",
);
overit(
  behemUpozorneni.jsouTrhy === sestava.jsouTrhy,
  "během upozornění se trhy hodnotí stejně",
);
overit(
  behemUpozorneni.oknoIso === oknoPondeli,
  "počet z upozornění patří k pondělí",
);
overit(
  !prvniVykresleni(
    PONDĚLI_UPOZORNENI,
    behemUpozorneni.pocet,
    behemUpozorneni.oknoIso,
    behemUpozorneni.jsouTrhy,
  ),
  "při otevření během upozornění věta ještě nesvítí",
);
overit(
  verejnaVetaZameckehoParku(PONDĚLI_UPOZORNENI, null) === VETA_ZAMECKY_PARK_BRZY,
  "při otevření během upozornění mluví park",
);
overit(
  maSeZobrazitAkciNaVikend(
    PONDĚLI_ZAVRENI,
    behemUpozorneni.pocet,
    behemUpozorneni.oknoIso,
  ),
  "stránka otevřená během upozornění ukáže větu po zavření",
);
overit(
  vetaParkuVedleAkciNaVikend(
    PONDĚLI_ZAVRENI,
    behemUpozorneni.pocet,
    behemUpozorneni.oknoIso,
    null,
  ) === null,
  "po zavření se k návratu věty nepřidá zavřený park",
);
overit(
  behemCtvrtka.pocet === 5 &&
    maSeZobrazitAkciNaVikend(
      CTVRTEK_ZAVRENI,
      behemCtvrtka.pocet,
      behemCtvrtka.oknoIso,
    ) &&
    !prvniVykresleni(
      CTVRTEK_UPOZORNENI,
      behemCtvrtka.pocet,
      behemCtvrtka.oknoIso,
      behemCtvrtka.jsouTrhy,
    ),
  "čtvrteční upozornění také vrátí větu po zavření",
);
const skryteUpozorneni = uplatnitSkrytiAkciNaVikend(
  PONDĚLI_UPOZORNENI,
  behemUpozorneni.pocet,
  behemUpozorneni.oknoIso,
  skrytiPondeli,
);
overit(skryteUpozorneni.pocet === null, "ruční skrytí vezme i počet z upozornění");
overit(
  !maSeZobrazitAkciNaVikend(
    PONDĚLI_ZAVRENI,
    skryteUpozorneni.pocet,
    skryteUpozorneni.oknoIso,
  ),
  "skrytá stránka z upozornění se po zavření nevrátí",
);
overit(maSePripravitPocetAkciNaVikend(PONDĚLI_UPOZORNENI), "upozornění počet připraví");
overit(!maSePripravitPocetAkciNaVikend(PONDĚLI_PRED), "ráno se počet nepřipravuje");
overit(!maSePripravitPocetAkciNaVikend(UTERY), "úterý se počet nepřipravuje");

const vetaKomponenta = readFileSync(
  resolve(process.cwd(), "src/components/brana/BranaAkciNaVikend.tsx"),
  "utf8",
);
const teloVety = vetaKomponenta.slice(vetaKomponenta.indexOf("return ("));
overit(
  teloVety.includes(`className="brana-akce-typ">{POPISEK_AKCI_NA_VIKEND}`),
  "popisek má původní barvu",
);
overit(
  teloVety.includes("style={{ marginLeft: 9 }}>{pocet}") &&
    !teloVety.includes('className="brana-akce-typ" style={{ marginLeft: 9 }}'),
  "číslo zůstává jediný bílý akcent",
);
overit(
  /className="brana-akce-typ">\s*\{jsouTrhy \? DODATEK_TRHY_JSOU : DODATEK_TRHY_NEJSOU\}/.test(
    teloVety,
  ),
  "dodatek o trzích má barvu popisku",
);

const ukazka = jsouTrhy(
  [
    udalost("ukazka-trh", "2026-08-08", "2026-08-08", {
      redakcniPolozkaId: "trhy",
      nazev: "Trh",
      rucniPoziceVDni: null,
    }),
  ],
  redakceTrhu,
);
overit(ukazka === false, "ukázkový trh se nepočítá");

console.log("Akcí na víkend: všechna ověření prošla.");
