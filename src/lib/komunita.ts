import type { KomunitaSouhrn } from "@/types";
import type { UlozisteDat } from "./uloziste-dat";
import { zajistitMetrikyAgregovane } from "./metriky";

/** Záznam návštěvníka pro metriku komunity – per anonymní ID */
export interface KomunitaNavstevnik {
  pocetNavstev: number;
  /** První zaznamenaná návštěva – chybí u dat migrovaných ze starého počítadla */
  prvniNavsteva?: string;
  /** Poslední zaznamenaná návštěva */
  posledniNavsteva?: string;
}

export type KomunitaNavstevnici = Record<string, KomunitaNavstevnik>;

export function prazdnySouhrnKomunity(): KomunitaSouhrn {
  return {
    celkem: {
      noviNavstevnici: 0,
      vracejiciSeNavstevnici: 0,
      podilVracejicichSe: 0,
    },
    poslednich7Dni: {
      noviNavstevnici: 0,
      vracejiciSeNavstevnici: 0,
      podilVracejicichSe: 0,
    },
  };
}

function vypocitatPodilVracejicichSe(vracejici: number, novi: number): number {
  const celkem = novi + vracejici;
  if (celkem === 0) {
    return 0;
  }
  return Math.round((vracejici / celkem) * 1000) / 10;
}

function hranice7DniZpet(referencniCas: Date): string {
  const hranice = new Date(referencniCas);
  hranice.setUTCDate(hranice.getUTCDate() - 7);
  return hranice.toISOString();
}

function sloucitZaznamNavstevnika(
  komunita?: KomunitaNavstevnik,
  legacyPocet = 0
): KomunitaNavstevnik {
  const pocetNavstev = Math.max(komunita?.pocetNavstev ?? 0, legacyPocet);

  return {
    pocetNavstev,
    prvniNavsteva: komunita?.prvniNavsteva,
    posledniNavsteva: komunita?.posledniNavsteva,
  };
}

/**
 * Sloučí komunitaNavstevnici s historickým navstevyPodleNavstevnika.
 * Počet návštěv bere maximum z obou zdrojů – komunita nesmí přepsat starší historii.
 */
function sestavitPohledNavstevnici(uloziste: UlozisteDat): KomunitaNavstevnici {
  const agregovane = zajistitMetrikyAgregovane(uloziste);
  const komunita = uloziste.komunitaNavstevnici ?? {};
  const legacy = agregovane.navstevyPodleNavstevnika;
  const vsechnaId = new Set([
    ...Object.keys(komunita),
    ...Object.keys(legacy),
  ]);

  const pohled: KomunitaNavstevnici = {};

  for (const navstevnikId of vsechnaId) {
    pohled[navstevnikId] = sloucitZaznamNavstevnika(
      komunita[navstevnikId],
      legacy[navstevnikId] ?? 0
    );
  }

  return pohled;
}

/** Zajistí mapu návštěvníků komunity při zápisu – jednorázově převezme historická data */
export function zajistitKomunitaNavstevnici(uloziste: UlozisteDat): KomunitaNavstevnici {
  if (!uloziste.komunitaNavstevnici) {
    uloziste.komunitaNavstevnici = {};
  }

  const agregovane = zajistitMetrikyAgregovane(uloziste);
  const legacy = agregovane.navstevyPodleNavstevnika;

  for (const [navstevnikId, legacyPocet] of Object.entries(legacy)) {
    const existujici = uloziste.komunitaNavstevnici[navstevnikId];
    if (existujici) {
      existujici.pocetNavstev = Math.max(existujici.pocetNavstev, legacyPocet);
      continue;
    }

    uloziste.komunitaNavstevnici[navstevnikId] = { pocetNavstev: legacyPocet };
  }

  return uloziste.komunitaNavstevnici;
}

/** Zaznamená návštěvu do komunity – volá se jen u události typu navsteva */
export function aplikovatKomunitaNavstevu(
  uloziste: UlozisteDat,
  navstevnikId: string
): void {
  const navstevnici = zajistitKomunitaNavstevnici(uloziste);
  const nyni = new Date().toISOString();
  const existujici = navstevnici[navstevnikId];

  if (existujici) {
    if (!existujici.prvniNavsteva || !existujici.posledniNavsteva) {
      existujici.prvniNavsteva = existujici.prvniNavsteva ?? nyni;
      existujici.posledniNavsteva = nyni;
      existujici.pocetNavstev += 1;
      return;
    }

    existujici.pocetNavstev += 1;
    existujici.posledniNavsteva = nyni;
    return;
  }

  navstevnici[navstevnikId] = {
    pocetNavstev: 1,
    prvniNavsteva: nyni,
    posledniNavsteva: nyni,
  };
}

/** Celkem od začátku – všichni návštěvníci bez časového omezení */
function spocitatCelkem(navstevnici: KomunitaNavstevnici): {
  novi: number;
  vracejici: number;
} {
  let novi = 0;
  let vracejici = 0;

  for (const navstevnik of Object.values(navstevnici)) {
    if (navstevnik.pocetNavstev <= 1) {
      novi += 1;
    } else {
      vracejici += 1;
    }
  }

  return { novi, vracejici };
}

/**
 * Posledních 7 dní – jen návštěvníci aktivní v okně (posledniNavsteva v okně).
 * Nový vyžaduje prvniNavsteva v okně; vracející se stačí posledniNavsteva v okně.
 */
function spocitatPoslednich7Dni(
  navstevnici: KomunitaNavstevnici,
  hranice7d: string
): {
  novi: number;
  vracejici: number;
} {
  let novi = 0;
  let vracejici = 0;

  for (const navstevnik of Object.values(navstevnici)) {
    const { prvniNavsteva, posledniNavsteva, pocetNavstev } = navstevnik;

    if (!posledniNavsteva || posledniNavsteva < hranice7d) {
      continue;
    }

    if (pocetNavstev >= 2) {
      vracejici += 1;
      continue;
    }

    if (prvniNavsteva && prvniNavsteva >= hranice7d && pocetNavstev <= 1) {
      novi += 1;
    }
  }

  return { novi, vracejici };
}

/**
 * Souhrn komunity pro administraci.
 *
 * Celkem: nový = jedna návštěva celkem, vracející se = alespoň dvě návštěvy.
 * 7 dní: jen aktivní návštěvníci; nový = první návštěva v okně, vracející se = návštěva v okně a alespoň dvě návštěvy celkem.
 */
export function spocitatSouhrnKomunity(
  uloziste: UlozisteDat,
  referencniCas: Date = new Date()
): KomunitaSouhrn {
  const navstevnici = sestavitPohledNavstevnici(uloziste);
  const hranice7d = hranice7DniZpet(referencniCas);
  const celkem = spocitatCelkem(navstevnici);
  const poslednich7Dni = spocitatPoslednich7Dni(navstevnici, hranice7d);

  return {
    celkem: {
      noviNavstevnici: celkem.novi,
      vracejiciSeNavstevnici: celkem.vracejici,
      podilVracejicichSe: vypocitatPodilVracejicichSe(celkem.vracejici, celkem.novi),
    },
    poslednich7Dni: {
      noviNavstevnici: poslednich7Dni.novi,
      vracejiciSeNavstevnici: poslednich7Dni.vracejici,
      podilVracejicichSe: vypocitatPodilVracejicichSe(
        poslednich7Dni.vracejici,
        poslednich7Dni.novi
      ),
    },
  };
}
