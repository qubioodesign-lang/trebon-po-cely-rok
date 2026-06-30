import type { KomunitaSouhrn } from "@/types";
import type { UlozisteDat } from "./uloziste-dat";

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

/** Doplní pohled o historická počítadla – jen pro čtení, bez zápisu do úložiště */
function sestavitPohledNavstevnici(uloziste: UlozisteDat): KomunitaNavstevnici {
  const pohled: KomunitaNavstevnici = {
    ...(uloziste.komunitaNavstevnici ?? {}),
  };

  const legacy = uloziste.metrikyAgregovane?.navstevyPodleNavstevnika;
  if (!legacy) {
    return pohled;
  }

  for (const [navstevnikId, pocetNavstev] of Object.entries(legacy)) {
    if (pohled[navstevnikId]) {
      continue;
    }

    pohled[navstevnikId] = { pocetNavstev };
  }

  return pohled;
}

/** Zajistí mapu návštěvníků komunity při zápisu – jednorázově převezme historická data */
export function zajistitKomunitaNavstevnici(uloziste: UlozisteDat): KomunitaNavstevnici {
  if (!uloziste.komunitaNavstevnici) {
    uloziste.komunitaNavstevnici = {};
  }

  const legacy = uloziste.metrikyAgregovane?.navstevyPodleNavstevnika;
  if (legacy) {
    for (const [navstevnikId, pocetNavstev] of Object.entries(legacy)) {
      if (uloziste.komunitaNavstevnici[navstevnikId]) {
        continue;
      }

      uloziste.komunitaNavstevnici[navstevnikId] = { pocetNavstev };
    }
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

function spocitatObdobi(
  navstevnici: KomunitaNavstevnici,
  hranice7d: string | null
): {
  novi: number;
  vracejici: number;
} {
  let novi = 0;
  let vracejici = 0;

  for (const navstevnik of Object.values(navstevnici)) {
    if (hranice7d === null) {
      if (navstevnik.pocetNavstev <= 1) {
        novi += 1;
      } else {
        vracejici += 1;
      }
      continue;
    }

    const { prvniNavsteva, posledniNavsteva } = navstevnik;
    if (!prvniNavsteva || !posledniNavsteva) {
      continue;
    }

    if (prvniNavsteva >= hranice7d) {
      novi += 1;
    }

    if (posledniNavsteva >= hranice7d && prvniNavsteva < hranice7d) {
      vracejici += 1;
    }
  }

  return { novi, vracejici };
}

/**
 * Souhrn komunity pro administraci.
 *
 * Celkem: nový = jedna návštěva celkem, vracející se = alespoň dvě návštěvy.
 * 7 dní: nový = první návštěva v okně, vracející se = návštěva v okně, první návštěva dříve.
 */
export function spocitatSouhrnKomunity(
  uloziste: UlozisteDat,
  referencniCas: Date = new Date()
): KomunitaSouhrn {
  const navstevnici = sestavitPohledNavstevnici(uloziste);
  const hranice7d = hranice7DniZpet(referencniCas);
  const celkem = spocitatObdobi(navstevnici, null);
  const poslednich7Dni = spocitatObdobi(navstevnici, hranice7d);

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
