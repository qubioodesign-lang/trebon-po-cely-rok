/**
 * Rotace viditelných prolnutí. Jen umělé položky a pevné časy.
 * Spuštění: npm run test:rotace-prolnuti
 */

import type { Polozka } from "../src/types";
import type { UlozisteDat } from "../src/lib/uloziste-dat";
import { jePlatnaPolozkaGalerie } from "../src/lib/polozka-soubory";
import { normalizovatUloziste } from "../src/lib/uloziste-normalizace";
import {
  DELKA_OKNA_ROTACE_MS,
  efektivniPoradiPolozek,
  idsViditelnychProlnuti,
  jePlatnyCasRotaceProlnuti,
  polozkyVerejneGalerie,
  posunRotaceProlnuti,
  vysledekPridaniProlnuti,
  vysledekPrepnutiViditelnosti,
  vysledekRucnihoPresunu,
  vysledekSmazaniPolozky,
  vysledekSpusteniRotace,
  vysledekUpravyPolozky,
  vysledekZmenyPoradi,
  type StavRotacePolozek,
} from "../src/lib/rotace-prolnuti";

const HODINA = 60 * 60 * 1000;
const DEN = DELKA_OKNA_ROTACE_MS;
const KOTVA = "2026-03-01T15:00:00.000Z";
const T0 = Date.parse(KOTVA);

let selhani = 0;

function overit(podminka: boolean, popis: string): void {
  if (podminka) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhani += 1;
  console.error(`FAIL  ${popis}`);
}

function foto(id: string, poradi: number, aktivni = true): Polozka {
  return {
    id,
    typ: "fotografie",
    soubor: `/uploads/${id}.jpg`,
    popis: id,
    datumPorizeni: null,
    datumPublikace: "2026-01-01T00:00:00.000Z",
    poradi,
    aktivni,
  };
}

function prolnuti(
  id: string,
  poradi: number,
  aktivni = true,
  snimky = 2
): Polozka {
  return {
    id,
    typ: "prolnuti",
    soubory: Array.from({ length: snimky }, (_, index) => `/uploads/${id}-${index}.jpg`),
    popis: id,
    datumPorizeni: null,
    datumPublikace: "2026-01-02T00:00:00.000Z",
    poradi,
    aktivni,
  };
}

function ids(polozky: Polozka[]): string {
  return polozky.map((polozka) => polozka.id).join(" ");
}

function jakoUlozene(
  vysledek: StavRotacePolozek | "odmitnuto" | "bezeZmeny" | "chybi" | "kraj"
): StavRotacePolozek | null {
  return typeof vysledek === "object" ? vysledek : null;
}

function rada(polozky: Polozka[]): string {
  return idsViditelnychProlnuti(polozky).join(" ");
}

function otisk(polozka: Polozka): string {
  return [
    polozka.id,
    polozka.typ,
    polozka.soubor ?? "",
    (polozka.soubory ?? []).join(","),
    polozka.popis,
    polozka.aktivni ? "1" : "0",
  ].join("|");
}

function galerie(): Polozka[] {
  return [foto("P1", 0), prolnuti("A", 1), foto("P2", 2), prolnuti("B", 3), prolnuti("C", 4)];
}

function verejneIds(polozky: Polozka[], cas: string | undefined, now: number): string {
  return ids(polozkyVerejneGalerie(polozky, cas, now));
}

function adminIds(polozky: Polozka[], cas: string | undefined, now: number): string {
  return ids(efektivniPoradiPolozek(polozky, cas, now));
}

const zaklad = galerie();

overit(
  efektivniPoradiPolozek(zaklad, undefined, T0 + 10 * DEN).every(
    (polozka, index) => polozka.id === zaklad[index].id
  ),
  "chybějící čas neotáčí uložené pořadí"
);
overit(
  posunRotaceProlnuti("", T0 + DEN, 3) === 0 &&
    posunRotaceProlnuti("včera", T0 + DEN, 3) === 0 &&
    posunRotaceProlnuti("2026-99-99", T0 + DEN, 3) === 0 &&
    !jePlatnyCasRotaceProlnuti(null),
  "neplatný čas znamená nulový posun"
);

overit(
  rada(efektivniPoradiPolozek([], KOTVA, T0 + 5 * DEN)).length === 0,
  "nula prolnutí"
);
overit(
  rada(
    efektivniPoradiPolozek([prolnuti("A", 0)], KOTVA, T0 + 9 * DEN)
  ) === "A",
  "jedno viditelné prolnutí se netočí ani po několika dnech"
);

overit(
  rada(efektivniPoradiPolozek(zaklad, KOTVA, T0 + DEN - 1)) === "A B C",
  "těsně před 24 hodinami zůstává A B C"
);
overit(
  rada(efektivniPoradiPolozek(zaklad, KOTVA, T0 + DEN)) === "B C A",
  "přesně po 24 hodinách je první na konci"
);
overit(
  ids(efektivniPoradiPolozek(zaklad, KOTVA, T0 + DEN)) === "P1 B P2 C A",
  "fotografie zůstávají ve svých místech"
);
overit(
  rada(efektivniPoradiPolozek(zaklad, KOTVA, T0 + 5 * DEN)) === "C A B",
  "po pěti dnech bez návštěvy je posun 5 mod 3"
);
overit(
  rada(efektivniPoradiPolozek(zaklad, KOTVA, T0 + 3 * DEN)) === "A B C",
  "celý cyklus tří prolnutí se po třech dnech vrací na začátek"
);
overit(
  rada(efektivniPoradiPolozek(zaklad, KOTVA, T0 + 4 * DEN)) === "B C A",
  "další den po celém cyklu začíná nové kolo"
);

const sIdentitou = efektivniPoradiPolozek(zaklad, KOTVA, T0 + DEN);
overit(
  zaklad.map(otisk).sort().join("\n") === sIdentitou.map(otisk).sort().join("\n"),
  "rotace nemění identitu, snímky, popis ani viditelnost"
);

const seSkrytym = [foto("P1", 0), prolnuti("H", 1, false), prolnuti("A", 2), prolnuti("B", 3)];
overit(
  adminIds(seSkrytym, KOTVA, T0 + DEN) === "P1 H B A" &&
    verejneIds(seSkrytym, KOTVA, T0 + DEN) === "P1 B A",
  "skryté prolnutí zůstává na místě a do veřejné galerie nevstupuje"
);
overit(
  ids(
    efektivniPoradiPolozek(seSkrytym, KOTVA, T0 + DEN).filter(jePlatnaPolozkaGalerie)
  ) === verejneIds(seSkrytym, KOTVA, T0 + DEN),
  "administrace a veřejná galerie mají stejné viditelné pořadí"
);

const pridaneSkryte = vysledekPridaniProlnuti(
  zaklad,
  KOTVA,
  prolnuti("N", -1, false),
  T0 + 10 * HODINA
);
overit(
  pridaneSkryte.rotaceOd === KOTVA &&
    rada(
      efektivniPoradiPolozek(pridaneSkryte.polozky, pridaneSkryte.rotaceOd, T0 + 10 * HODINA)
    ) === "A B C",
  "přidání skrytého prolnutí nemění viditelnou řadu ani čas"
);

const odkrytiPrvni = vysledekPrepnutiViditelnosti(
  seSkrytym,
  KOTVA,
  "H",
  true,
  T0 + 10 * HODINA
);
overit(
  odkrytiPrvni !== null &&
    odkrytiPrvni.rotaceOd === new Date(T0 + 10 * HODINA).toISOString() &&
    rada(odkrytiPrvni.polozky) === "H A B",
  "odkrytí na první pozici začíná nových 24 hodin a H je první"
);

const mezi = [prolnuti("A", 0), prolnuti("H", 1, false), prolnuti("B", 2)];
const odkrytiMimo = vysledekPrepnutiViditelnosti(mezi, KOTVA, "H", true, T0 + 10 * HODINA);
overit(
  odkrytiMimo !== null &&
    odkrytiMimo.rotaceOd === KOTVA &&
    rada(odkrytiMimo.polozky) === "A H B",
  "odkrytí mimo první pozici nechává A první a zachovává čas"
);

const poDni = efektivniPoradiPolozek(zaklad, KOTVA, T0 + DEN + 6 * HODINA);
const skrytiPrvniho = vysledekPrepnutiViditelnosti(
  zaklad,
  KOTVA,
  poDni.find((polozka) => polozka.typ === "prolnuti" && polozka.aktivni)!.id,
  false,
  T0 + DEN + 6 * HODINA
);
overit(
  skrytiPrvniho !== null &&
    skrytiPrvniho.rotaceOd === new Date(T0 + DEN + 6 * HODINA).toISOString() &&
    rada(skrytiPrvniho.polozky) === "C A",
  "skrytí právě zobrazeného prvního prolnutí nastaví nové první a nové okno"
);

const skrytiJineho = vysledekPrepnutiViditelnosti(
  zaklad,
  KOTVA,
  "C",
  false,
  T0 + DEN + 6 * HODINA
);
overit(
  skrytiJineho !== null &&
    skrytiJineho.rotaceOd === new Date(T0 + DEN).toISOString() &&
    rada(skrytiJineho.polozky) === "B A" &&
    rada(
      efektivniPoradiPolozek(
        skrytiJineho.polozky,
        skrytiJineho.rotaceOd,
        T0 + DEN + 6 * HODINA
      )
    ) === "B A",
  "skrytí jiného prolnutí neskáče na jiné první a nechá zbytek okna"
);

const zobrazeno = efektivniPoradiPolozek(zaklad, KOTVA, T0 + 10 * HODINA);
const naPrvni = jakoUlozene(
  vysledekZmenyPoradi(
    zaklad,
    KOTVA,
    presunoutNaZacatek(zobrazeno, "C"),
    T0 + 10 * HODINA
  )
);
overit(
  naPrvni !== null &&
    naPrvni.rotaceOd === new Date(T0 + 10 * HODINA).toISOString() &&
    idPrvni(naPrvni.polozky) === "C",
  "ruční přesun jiného prolnutí na první místo spouští nové okno"
);

const mimoPrvni = jakoUlozene(
  vysledekZmenyPoradi(
    zaklad,
    KOTVA,
    vymenitPosledniDveViditelne(zobrazeno),
    T0 + 10 * HODINA
  )
);
overit(
  mimoPrvni !== null &&
    mimoPrvni.rotaceOd === KOTVA &&
    idPrvni(mimoPrvni.polozky) === "A" &&
    rada(
      efektivniPoradiPolozek(mimoPrvni.polozky, mimoPrvni.rotaceOd, T0 + DEN - 1)
    ) === "A C B" &&
    rada(
      efektivniPoradiPolozek(mimoPrvni.polozky, mimoPrvni.rotaceOd, T0 + DEN)
    ) === "C B A",
  "změna mimo první pozici zachová zbývajících 14 hodin"
);

const ulozeniOtoceneho = vysledekZmenyPoradi(
  zaklad,
  KOTVA,
  efektivniPoradiPolozek(zaklad, KOTVA, T0 + DEN).map((polozka) => polozka.id),
  T0 + DEN
);
overit(
  ulozeniOtoceneho === "bezeZmeny" &&
    rada(efektivniPoradiPolozek(zaklad, KOTVA, T0 + DEN)) === "B C A",
  "uložení už otočeného pořadí ho neotočí podruhé"
);

const starePoSipce = ["P1", "P2", "A", "B", "C"];
const starePripnuti = ["A", "P1", "P2", "B", "C"];
overit(
  vysledekZmenyPoradi(zaklad, KOTVA, starePoSipce, T0 + DEN) === "odmitnuto" &&
    vysledekZmenyPoradi(zaklad, KOTVA, starePripnuti, T0 + DEN) === "odmitnuto" &&
    rada(efektivniPoradiPolozek(zaklad, KOTVA, T0 + DEN)) === "B C A",
  "starý seznam z administrace po rotaci nepřepíše aktuální pořadí"
);

const sipkaPoRotaci = vysledekRucnihoPresunu(zaklad, KOTVA, "B", "dolu", T0 + DEN);
overit(
  typeof sipkaPoRotaci === "object" &&
    ids(sipkaPoRotaci.polozky) === "P1 P2 B C A" &&
    rada(sipkaPoRotaci.polozky) === "B C A" &&
    sipkaPoRotaci.rotaceOd === new Date(T0 + DEN).toISOString(),
  "šipka po rotaci posune jen aktuální položku"
);

const pripnutiPoRotaci = vysledekRucnihoPresunu(
  zaklad,
  KOTVA,
  "C",
  "pripnout",
  T0 + DEN
);
overit(
  typeof pripnutiPoRotaci === "object" &&
    ids(pripnutiPoRotaci.polozky) === "C P1 B P2 A" &&
    rada(pripnutiPoRotaci.polozky) === "C B A",
  "připnutí po rotaci vychází z aktuálního pořadí"
);

overit(
  vysledekRucnihoPresunu(zaklad, KOTVA, "A", "dolu", T0 + DEN) === "kraj",
  "šipka, která už v aktuálním pořadí nemá kam, se odmítne"
);

const sousedni = [prolnuti("A", 0), prolnuti("B", 1), prolnuti("C", 2)];
const sipkaMeniPrvni = vysledekRucnihoPresunu(
  sousedni,
  KOTVA,
  "A",
  "dolu",
  T0 + 3 * HODINA
);
const sipkaMimoPrvni = vysledekRucnihoPresunu(
  sousedni,
  KOTVA,
  "C",
  "nahoru",
  T0 + 3 * HODINA
);
overit(
  typeof sipkaMeniPrvni === "object" &&
    sipkaMeniPrvni.rotaceOd === new Date(T0 + 3 * HODINA).toISOString() &&
    rada(sipkaMeniPrvni.polozky) === "B A C" &&
    typeof sipkaMimoPrvni === "object" &&
    sipkaMimoPrvni.rotaceOd === KOTVA &&
    rada(sipkaMimoPrvni.polozky) === "A C B",
  "šipka mění okno jen při změně prvního prolnutí"
);

const text = vysledekUpravyPolozky(zaklad, KOTVA, "A", { popis: "nový text" }, T0 + 30 * HODINA);
overit(
  text !== null &&
    text.rotaceOd === KOTVA &&
    text.polozky.find((polozka) => polozka.id === "A")?.popis === "nový text" &&
    rada(efektivniPoradiPolozek(text.polozky, text.rotaceOd, T0 + 30 * HODINA)) ===
      "B C A",
  "úprava textu nemění první prolnutí ani okno"
);

const fotoSkryta = vysledekPrepnutiViditelnosti(zaklad, KOTVA, "P2", false, T0 + 30 * HODINA);
overit(
  fotoSkryta !== null &&
    fotoSkryta.rotaceOd === KOTVA &&
    ids(fotoSkryta.polozky) === ids(zaklad) &&
    rada(
      efektivniPoradiPolozek(fotoSkryta.polozky, fotoSkryta.rotaceOd, T0 + 30 * HODINA)
    ) === "B C A",
  "skrytí samostatné fotografie nemění řadu prolnutí"
);

const smazanaFotografie = vysledekSmazaniPolozky(zaklad, KOTVA, "P2", T0 + 30 * HODINA);
overit(
  smazanaFotografie !== null &&
    smazanaFotografie.rotaceOd === KOTVA &&
    !smazanaFotografie.polozky.some((polozka) => polozka.id === "P2") &&
    rada(smazanaFotografie.polozky) === "A B C",
  "smazání fotografie neukládá otočené pořadí místo základu"
);

const jenDve = [prolnuti("A", 0), prolnuti("B", 1)];
const poPridaniTretiho = vysledekPridaniProlnuti(
  jenDve,
  KOTVA,
  prolnuti("C", 2, true),
  T0 + 10 * DEN + 2 * HODINA
);
overit(
  poPridaniTretiho.rotaceOd === new Date(T0 + 10 * DEN + 2 * HODINA).toISOString() &&
    rada(poPridaniTretiho.polozky) === "C A B",
  "nové viditelné prolnutí na začátku neskáče podle starého počtu"
);

const bezCasu = jakoUlozene(
  vysledekZmenyPoradi(zaklad, undefined, ["P1", "A", "P2", "C", "B"], T0)
);
overit(
  bezCasu !== null &&
    bezCasu.rotaceOd === undefined &&
    rada(bezCasu.polozky) === "A C B",
  "ruční změna bez spuštěné rotace hodiny sama nezapne, pokud první zůstane"
);
const bezCasuPrvni = jakoUlozene(
  vysledekZmenyPoradi(zaklad, undefined, ["C", "P1", "A", "P2", "B"], T0)
);
overit(
  bezCasuPrvni !== null &&
    bezCasuPrvni.rotaceOd === new Date(T0).toISOString() &&
    idPrvni(bezCasuPrvni.polozky) === "C",
  "první změna prvního prolnutí hodiny zapne, ale galerii navíc neotočí"
);

const spusteni = vysledekSpusteniRotace(undefined, T0);
const druhe = vysledekSpusteniRotace(spusteni.rotaceOd, T0 + DEN);
overit(
  spusteni.spusteno &&
    spusteni.rotaceOd === new Date(T0).toISOString() &&
    !druhe.spusteno &&
    druhe.rotaceOd === spusteni.rotaceOd,
  "explicitní spuštění nastaví čas jednou a podruhé okno neresetuje"
);
overit(
  ids(efektivniPoradiPolozek(zaklad, spusteni.rotaceOd, T0)) === ids(zaklad) &&
    rada(efektivniPoradiPolozek(zaklad, spusteni.rotaceOd, T0 + DEN)) ===
      "B C A",
  "spuštění samo pořadí nezmění a první posun přijde až za 24 hodin"
);

const letniZacatek = Date.parse("2026-03-28T23:30:00.000Z");
overit(
  posunRotaceProlnuti(new Date(letniZacatek).toISOString(), letniZacatek + DEN - 1, 2) === 0 &&
    posunRotaceProlnuti(new Date(letniZacatek).toISOString(), letniZacatek + DEN, 2) === 1,
  "přechod na letní čas otočí až po 24 skutečných hodinách"
);
const zimniZacatek = Date.parse("2026-10-24T22:30:00.000Z");
overit(
  posunRotaceProlnuti(new Date(zimniZacatek).toISOString(), zimniZacatek + 23 * HODINA, 2) === 0 &&
    posunRotaceProlnuti(new Date(zimniZacatek).toISOString(), zimniZacatek + DEN, 2) === 1,
  "přechod na zimní čas neotáčí podle místní půlnoci"
);

const prazdneUloziste = {
  polozky: zaklad,
  metriky: [],
  pushOdbery: [],
  geografieNavstev: { merenoOd: "2026-01-01", dny: { "2026-01-01": { trebonsko: 1 } } },
  rotaceProlnutiOd: " 2026-06-01T12:00:00.000Z ",
} as unknown as UlozisteDat;
const udrzene = normalizovatUloziste(prazdneUloziste);
overit(
  udrzene.rotaceProlnutiOd === "2026-06-01T12:00:00.000Z" &&
    udrzene.geografieNavstev?.dny["2026-01-01"]?.trebonsko === 1 &&
    udrzene.polozky.length === zaklad.length,
  "normalizace zachová platný čas rotace i ostatní data úložiště"
);
const bezRotace = normalizovatUloziste({
  ...prazdneUloziste,
  rotaceProlnutiOd: "neplatne",
});
overit(
  bezRotace.rotaceProlnutiOd === undefined && bezRotace.geografieNavstev !== undefined,
  "normalizace zahodí neplatný čas a ostatní data nechá"
);

function idPrvni(polozky: Polozka[]): string | null {
  return idsViditelnychProlnuti(polozky)[0] ?? null;
}

function presunoutNaZacatek(polozky: Polozka[], id: string): string[] {
  const vysledek = polozky.map((polozka) => polozka.id).filter((polozkaId) => polozkaId !== id);
  vysledek.unshift(id);
  return vysledek;
}

function vymenitPosledniDveViditelne(polozky: Polozka[]): string[] {
  const vysledek = polozky.map((polozka) => polozka.id);
  const viditelne = polozky.filter((polozka) => polozka.typ === "prolnuti" && polozka.aktivni);
  const posledni = viditelne[viditelne.length - 1];
  const predposledni = viditelne[viditelne.length - 2];
  const indexPosledni = vysledek.indexOf(posledni.id);
  const indexPred = vysledek.indexOf(predposledni.id);
  vysledek[indexPosledni] = predposledni.id;
  vysledek[indexPred] = posledni.id;
  return vysledek;
}

if (selhani > 0) {
  console.error(`Selhalo ${selhani} kontrol.`);
  process.exit(1);
}

console.log("Všechny kontroly rotace prošly.");
