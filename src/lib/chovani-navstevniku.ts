import "server-only";

import type { ChovaniNavstevnikuSouhrn, KategorieOdchoduNavstevy } from "@/types";
import type { UlozisteDat } from "./uloziste-dat";

export interface ChovaniNavstevObdobiAgregace {
  pocetNavstev: number;
  soucetDelkaMs: number;
  odchodPribeh: number;
  odchodChciSeVracet: number;
  odchodOstatni: number;
}

export interface ChovaniNavstevZaznam {
  cas: string;
  delkaMs: number;
  odchod: KategorieOdchoduNavstevy;
}

export interface ChovaniNavstevnikuAgregovane {
  celkem: ChovaniNavstevObdobiAgregace;
  zaznamyPoslednich7Dni: ChovaniNavstevZaznam[];
}

function prazdneObdobi(): ChovaniNavstevObdobiAgregace {
  return {
    pocetNavstev: 0,
    soucetDelkaMs: 0,
    odchodPribeh: 0,
    odchodChciSeVracet: 0,
    odchodOstatni: 0,
  };
}

export function prazdneChovaniNavstevnikuAgregovane(): ChovaniNavstevnikuAgregovane {
  return {
    celkem: prazdneObdobi(),
    zaznamyPoslednich7Dni: [],
  };
}

function hranice7DniZpet(referencniCas: Date): string {
  const hranice = new Date(referencniCas);
  hranice.setUTCDate(hranice.getUTCDate() - 7);
  return hranice.toISOString();
}

function inkrementovatOdchod(
  obdobi: ChovaniNavstevObdobiAgregace,
  odchod: KategorieOdchoduNavstevy,
  delkaMs: number
): void {
  obdobi.pocetNavstev += 1;
  obdobi.soucetDelkaMs += delkaMs;

  switch (odchod) {
    case "pribeh":
      obdobi.odchodPribeh += 1;
      break;
    case "chci_se_vracet":
      obdobi.odchodChciSeVracet += 1;
      break;
    default:
      obdobi.odchodOstatni += 1;
      break;
  }
}

function odfiltrovatZaznamy7Dni(
  zaznamy: ChovaniNavstevZaznam[],
  hranice7d: string
): ChovaniNavstevZaznam[] {
  return zaznamy.filter((zaznam) => zaznam.cas >= hranice7d);
}

export function zajistitChovaniNavstevnikuAgregovane(
  uloziste: UlozisteDat
): ChovaniNavstevnikuAgregovane {
  if (!uloziste.chovaniNavstevnikuAgregovane) {
    uloziste.chovaniNavstevnikuAgregovane = prazdneChovaniNavstevnikuAgregovane();
  }

  uloziste.chovaniNavstevnikuAgregovane.celkem ??= prazdneObdobi();
  uloziste.chovaniNavstevnikuAgregovane.zaznamyPoslednich7Dni ??= [];

  return uloziste.chovaniNavstevnikuAgregovane;
}

export function aplikovatOdchodNavstevy(
  uloziste: UlozisteDat,
  delkaMs: number,
  odchod: KategorieOdchoduNavstevy,
  referencniCas: Date = new Date()
): void {
  const agregovane = zajistitChovaniNavstevnikuAgregovane(uloziste);
  const hranice7d = hranice7DniZpet(referencniCas);
  const cas = referencniCas.toISOString();

  inkrementovatOdchod(agregovane.celkem, odchod, delkaMs);

  agregovane.zaznamyPoslednich7Dni = odfiltrovatZaznamy7Dni(
    [...agregovane.zaznamyPoslednich7Dni, { cas, delkaMs, odchod }],
    hranice7d
  );
}

function souhrnZObdobi(obdobi: ChovaniNavstevObdobiAgregace) {
  const prumerDelkaMs =
    obdobi.pocetNavstev > 0
      ? Math.round(obdobi.soucetDelkaMs / obdobi.pocetNavstev)
      : 0;

  return {
    pocetNavstev: obdobi.pocetNavstev,
    prumerDelkaMs,
    odchodPribeh: obdobi.odchodPribeh,
    odchodChciSeVracet: obdobi.odchodChciSeVracet,
    odchodOstatni: obdobi.odchodOstatni,
  };
}

function spocitatPoslednich7Dni(
  zaznamy: ChovaniNavstevZaznam[],
  hranice7d: string
): ChovaniNavstevObdobiAgregace {
  const obdobi = prazdneObdobi();

  for (const zaznam of zaznamy) {
    if (zaznam.cas < hranice7d) {
      continue;
    }
    inkrementovatOdchod(obdobi, zaznam.odchod, zaznam.delkaMs);
  }

  return obdobi;
}

export function spocitatSouhrnChovaniNavstevniku(
  uloziste: UlozisteDat,
  referencniCas: Date = new Date()
): ChovaniNavstevnikuSouhrn {
  const agregovane = zajistitChovaniNavstevnikuAgregovane(uloziste);
  const hranice7d = hranice7DniZpet(referencniCas);
  const zaznamy7d = odfiltrovatZaznamy7Dni(
    agregovane.zaznamyPoslednich7Dni,
    hranice7d
  );

  return {
    celkem: souhrnZObdobi(agregovane.celkem),
    poslednich7Dni: souhrnZObdobi(spocitatPoslednich7Dni(zaznamy7d, hranice7d)),
  };
}

export function prazdnySouhrnChovaniNavstevniku(): ChovaniNavstevnikuSouhrn {
  const prazdne = souhrnZObdobi(prazdneObdobi());
  return {
    celkem: prazdne,
    poslednich7Dni: prazdne,
  };
}
