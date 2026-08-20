/**
 * Časová logika pravidelné redakční kontroly:
 * pevný 14denní kontrolní blok odvozený od dokončeného Dlouhého checkpointu.
 * Veřejná 7denní rezerva zůstává jen jako blízké okno, ne jako posun bloku.
 */

import { dnesVPraze, pridatDny } from "@/lib/brana/cas";
import { BRANA_DLOUHODOBY_INTERVAL_VYCHOZI } from "@/lib/brana/admin/zdroj";
import { isoDnyObdobi7DniVPraze } from "@/lib/brana/admin/obdobi-7-dni";
import {
  jeRychlyTypZdrojeUdalosti,
  posledniPlatnyDenUdalosti,
  projektujVyhledPodleRoku,
  type BranaKalendarDen,
  type BranaKonkretniUdalost,
} from "@/lib/brana/admin/konkretni-udalost";

function branaDatumNaIso(rok: number, mesic: number, den: number): string {
  return `${rok}-${String(mesic).padStart(2, "0")}-${String(den).padStart(2, "0")}`;
}

function parsujIsoNaBranaDatum(iso: string): {
  rok: number;
  mesic: number;
  den: number;
} | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return null;
  }
  return {
    rok: Number(iso.slice(0, 4)),
    mesic: Number(iso.slice(5, 7)),
    den: Number(iso.slice(8, 10)),
  };
}

/** Přičte kalendářní dny k ISO YYYY-MM-DD. Neplatné ISO → null. */
export function pridejKalendarniDnyKIso(
  iso: string,
  dny: number,
): string | null {
  const datum = parsujIsoNaBranaDatum(iso);
  if (!datum) {
    return null;
  }
  const vysledek = pridatDny(datum, dny);
  return branaDatumNaIso(vysledek.rok, vysledek.mesic, vysledek.den);
}

/** Délka kontrolního bloku – totéž číslo jako dlouhodobý cyklus. */
export const BRANA_KONTROLNI_BLOK_DNI = BRANA_DLOUHODOBY_INTERVAL_VYCHOZI;

export type BranaKontrolniBlok = {
  /** ISO dny veřejné 7denní rezervy (informační, neposouvá blok) */
  rezervaIsoDny: string[];
  /** První den pevného kontrolního bloku (YYYY-MM-DD) */
  blokOdIso: string;
  /** Poslední den pevného kontrolního bloku (YYYY-MM-DD), inclusive */
  blokDoIso: string;
  /** Všech ISO dnů bloku */
  blokIsoDny: string[];
};

export type BranaKotvaKontrolnihoBloku = {
  posledniDokoncenaDlouhodobaKontrola: string | null;
  pristiDlouhodobaKontrola: string | null;
};

/**
 * Fail-closed: blok existuje jen když dokončená kotva + interval === příští kotva.
 * Tím se starý 21denní stav (např. 10. 8. / 31. 8.) nepromění ve falešný 14denní blok.
 */
export function jeZarovnanyDlouhodobyCheckpoint(
  kotva: BranaKotvaKontrolnihoBloku,
): boolean {
  const dokoncena = kotva.posledniDokoncenaDlouhodobaKontrola;
  const pristi = kotva.pristiDlouhodobaKontrola;
  if (!dokoncena || !pristi) {
    return false;
  }
  return pridejKalendarniDnyKIso(dokoncena, BRANA_KONTROLNI_BLOK_DNI) === pristi;
}

/**
 * Pevný kontrolní blok: OD = dokončená kotva + 14 dní, DO = OD + 13 dní.
 * Nezávisí na dnešku. Bez zarovnání → null.
 */
export function sestavPevnyKontrolniBlok(
  kotva: BranaKotvaKontrolnihoBloku,
): BranaKontrolniBlok | null {
  if (!jeZarovnanyDlouhodobyCheckpoint(kotva)) {
    return null;
  }
  const dokoncena = kotva.posledniDokoncenaDlouhodobaKontrola;
  if (!dokoncena) {
    return null;
  }
  const blokOdIso = pridejKalendarniDnyKIso(dokoncena, BRANA_KONTROLNI_BLOK_DNI);
  if (!blokOdIso) {
    return null;
  }
  const blokIsoDny = Array.from(
    { length: BRANA_KONTROLNI_BLOK_DNI },
    (_, index) => pridejKalendarniDnyKIso(blokOdIso, index),
  );
  if (blokIsoDny.some((den) => den === null)) {
    return null;
  }
  const jisteDny = blokIsoDny as string[];

  return {
    rezervaIsoDny: isoDnyObdobi7DniVPraze(),
    blokOdIso: jisteDny[0],
    blokDoIso: jisteDny[jisteDny.length - 1],
    blokIsoDny: jisteDny,
  };
}

function formatujDenMesicCesky(iso: string, sRokem: boolean): string {
  const den = Number(iso.slice(8, 10));
  const mesic = Number(iso.slice(5, 7));
  const rok = iso.slice(0, 4);
  return sRokem ? `${den}. ${mesic}. ${rok}` : `${den}. ${mesic}.`;
}

function maRozsahKontrolnihoBlokuRok(
  blok: Pick<BranaKontrolniBlok, "blokOdIso" | "blokDoIso">,
): boolean {
  return blok.blokOdIso.slice(0, 4) !== blok.blokDoIso.slice(0, 4);
}

/** Lidský rozsah OD–DO ze skutečného kontrolního bloku. Bez druhého výpočtu délky. */
export function formatujRozsahKontrolnihoBloku(
  blok: Pick<BranaKontrolniBlok, "blokOdIso" | "blokDoIso">,
): string {
  const sRokem = maRozsahKontrolnihoBlokuRok(blok);
  return `${formatujDenMesicCesky(blok.blokOdIso, sRokem)} – ${formatujDenMesicCesky(blok.blokDoIso, sRokem)}`;
}

export function textTlacitkaSchvalitKontrolniBlok(
  blok: Pick<BranaKontrolniBlok, "blokOdIso" | "blokDoIso">,
): string {
  return `Schválit kontrolní blok a publikovat ${formatujRozsahKontrolnihoBloku(blok)}`;
}

export function textHraniceZacatkuKontrolnihoBloku(
  blok: Pick<BranaKontrolniBlok, "blokOdIso" | "blokDoIso">,
): string {
  return `ZAČÁTEK KONTROLNÍHO BLOKU · ${formatujDenMesicCesky(blok.blokOdIso, maRozsahKontrolnihoBlokuRok(blok))}`;
}

export function textHraniceKonceKontrolnihoBloku(
  blok: Pick<BranaKontrolniBlok, "blokOdIso" | "blokDoIso">,
): string {
  return `KONEC KONTROLNÍHO BLOKU · ${formatujDenMesicCesky(blok.blokDoIso, maRozsahKontrolnihoBlokuRok(blok))}`;
}

export function textHraniceSchvalenoDo(isoDen: string): string {
  return `SCHVÁLENO DO · ${formatujDenMesicCesky(isoDen, false)}`;
}

function normalizujRozsahUdalosti(udalost: {
  datumOd: string;
  datumDo?: string | null;
}): { od: string; do: string } {
  const od = udalost.datumOd.trim();
  // Stejná normalizace konce jako posledniPlatnyDenUdalosti (jedna datumová logika).
  return { od, do: posledniPlatnyDenUdalosti(udalost) };
}

/**
 * Událost patří do kontrolního bloku, pokud má alespoň jeden den společný
 * s rozsahem bloku (průnik intervalů datumOd–datumDo × blokOd–blokDo).
 */
export function patriUdalostDoKontrolnihoBloku(
  udalost: Pick<BranaKonkretniUdalost, "datumOd" | "datumDo"> | {
    datumOd: string;
    datumDo?: string | null;
  },
  blok: Pick<BranaKontrolniBlok, "blokOdIso" | "blokDoIso">,
): boolean {
  const { od, do: doDne } = normalizujRozsahUdalosti(udalost);
  return od <= blok.blokDoIso && doDne >= blok.blokOdIso;
}

/**
 * Blízké okno = dnes (Europe/Prague) + veřejná 7denní rezerva.
 * Contiguous ISO dny od dnes do posledního dne rezervy.
 */
export function isoDnyBlizkehoOknaVPraze(): string[] {
  const dnes = dnesVPraze();
  const dnesIso = branaDatumNaIso(dnes.rok, dnes.mesic, dnes.den);
  return [dnesIso, ...isoDnyObdobi7DniVPraze()];
}

/**
 * Průnik rozsahu události s blízkým oknem (dnes + veřejných 7 dní).
 */
export function patriUdalostDoBlizkehoOkna(
  udalost: Pick<BranaKonkretniUdalost, "datumOd" | "datumDo"> | {
    datumOd: string;
    datumDo?: string | null;
  },
  oknoIsoDny: readonly string[] = isoDnyBlizkehoOknaVPraze(),
): boolean {
  if (oknoIsoDny.length === 0) {
    return false;
  }
  let oknoOd = oknoIsoDny[0];
  let oknoDo = oknoIsoDny[0];
  for (const den of oknoIsoDny) {
    if (den < oknoOd) {
      oknoOd = den;
    }
    if (den > oknoDo) {
      oknoDo = den;
    }
  }
  const { od, do: doDne } = normalizujRozsahUdalosti(udalost);
  return od <= oknoDo && doDne >= oknoOd;
}

/**
 * Serverová i výběrová ochrana hromadného „Schválit kontrolu“.
 * RYCHLÁ CEKA (snapshot typZdroje) do dávky nepatří.
 * Význam Výhledu / 14denního bloku se zde neřeší — jen zamítnutí konkrétní karty.
 */
export function duvodZamitnutiUdalostiProSchvalitKontrolu(
  udalost: BranaKonkretniUdalost,
): string | null {
  if (udalost.redakcniPolozkaId === null) {
    return "Kontrolu nelze schválit: dávka obsahuje ruční událost. Nic nebylo uloženo.";
  }
  if (udalost.stavSchvaleni !== "CEKA_NA_SCHVALENI") {
    return "Kontrolu nelze schválit: dávka obsahuje položku, která už není čekající. Nic nebylo uloženo.";
  }
  if (jeRychlyTypZdrojeUdalosti(udalost)) {
    return "Kontrolu nelze schválit: dávka obsahuje rychlou událost. Nic nebylo uloženo.";
  }
  return null;
}

/**
 * Explicitní unikátní ID pro „Schválit kontrolu“:
 * auto CEKA s průnikem pevného kontrolního bloku ∪ auto CEKA z Admin Výhledu.
 * Bez zarovnaného bloku je dávka prázdná.
 * RYCHLÁ CEKA (snapshot) se do dávky nezařazuje — ani v bloku, ani ve Výhledu.
 * Vstup musí být jen skutečné PRIVATE (persistované) události – bez ukázek.
 */
export function sestavIdProSchvalitKontrolu(
  persistovaneUdalosti: readonly BranaKonkretniUdalost[],
  maVyhledAno: (redakcniPolozkaId: string) => boolean,
  blok: BranaKontrolniBlok | null,
): string[] {
  if (!blok) {
    return [];
  }
  const idSet = new Set<string>();

  for (const udalost of persistovaneUdalosti) {
    if (udalost.redakcniPolozkaId === null) {
      continue;
    }
    if (udalost.stavSchvaleni !== "CEKA_NA_SCHVALENI") {
      continue;
    }
    if (jeRychlyTypZdrojeUdalosti(udalost)) {
      continue;
    }
    if (patriUdalostDoKontrolnihoBloku(udalost, blok)) {
      idSet.add(udalost.id);
    }
  }

  const vyhledSkupiny = projektujVyhledPodleRoku(
    persistovaneUdalosti,
    maVyhledAno,
  );
  for (const skupina of vyhledSkupiny) {
    for (const udalost of skupina.udalosti) {
      if (udalost.stavSchvaleni !== "CEKA_NA_SCHVALENI") {
        continue;
      }
      if (jeRychlyTypZdrojeUdalosti(udalost)) {
        continue;
      }
      idSet.add(udalost.id);
    }
  }

  return [...idSet];
}

/** Inclusive: událost pokrývá ISO den (prázdné datumDo = datumOd). */
export function udalostPokryvaIsoDen(
  udalost: Pick<BranaKonkretniUdalost, "datumOd" | "datumDo"> | {
    datumOd: string;
    datumDo?: string | null;
  },
  isoDen: string,
): boolean {
  const { od, do: doDne } = normalizujRozsahUdalosti(udalost);
  return od <= isoDen && isoDen <= doDne;
}

/**
 * Počet skutečných persistovaných událostí pokrývajících den
 * pro redakční kontrolu prázdných dnů pevného kontrolního bloku.
 * SCHVALENO (vč. ručních) + auto CEKA z aktuální dávky Schválit kontrolu.
 */
export function pocetRelevantnihoPokrytiDne(
  isoDen: string,
  persistovaneUdalosti: readonly BranaKonkretniUdalost[],
  idDavkySchvalitKontrolu: ReadonlySet<string>,
): number {
  let pocet = 0;
  for (const udalost of persistovaneUdalosti) {
    if (udalost.stavSchvaleni === "VYRAZENO") {
      continue;
    }
    if (!udalostPokryvaIsoDen(udalost, isoDen)) {
      continue;
    }
    if (udalost.stavSchvaleni === "SCHVALENO") {
      pocet += 1;
      continue;
    }
    if (
      udalost.stavSchvaleni === "CEKA_NA_SCHVALENI" &&
      udalost.redakcniPolozkaId !== null &&
      idDavkySchvalitKontrolu.has(udalost.id)
    ) {
      pocet += 1;
    }
  }
  return pocet;
}

/**
 * ISO dny pevného kontrolního bloku s nulovým relevantním pokrytím.
 */
export function spocitejPrazdneDnyKontrolnihoBloku(
  persistovaneUdalosti: readonly BranaKonkretniUdalost[],
  idDavkySchvalitKontrolu: readonly string[],
  blok: BranaKontrolniBlok | null,
): { prazdneIsoDny: string[]; pocet: number } {
  if (!blok) {
    return { prazdneIsoDny: [], pocet: 0 };
  }
  const davka = new Set(idDavkySchvalitKontrolu);
  const prazdneIsoDny: string[] = [];

  for (const isoDen of blok.blokIsoDny) {
    if (
      pocetRelevantnihoPokrytiDne(isoDen, persistovaneUdalosti, davka) === 0
    ) {
      prazdneIsoDny.push(isoDen);
    }
  }

  return { prazdneIsoDny, pocet: prazdneIsoDny.length };
}

/**
 * Doplní do projekce Kalendáře prázdné dny pevného kontrolního bloku (bez událostí)
 * a označí dny s nulovým relevantním pokrytím.
 * Nevytváří persistované události.
 */
export function doplnPrazdneDnyDoKalendare(
  dny: readonly BranaKalendarDen[],
  prazdneIsoDny: readonly string[],
  formatujDen: (isoDen: string) => string,
): BranaKalendarDen[] {
  const prazdne = new Set(prazdneIsoDny);
  const podleDne = new Map(
    dny.map((den) => [
      den.isoDen,
      {
        ...den,
        jePrazdnyKontrolniDen: prazdne.has(den.isoDen),
      },
    ]),
  );

  for (const isoDen of prazdneIsoDny) {
    if (!podleDne.has(isoDen)) {
      podleDne.set(isoDen, {
        isoDen,
        datumLabel: formatujDen(isoDen),
        udalosti: [],
        jePrazdnyKontrolniDen: true,
      });
    }
  }

  return [...podleDne.keys()]
    .sort()
    .map((isoDen) => podleDne.get(isoDen)!);
}

/**
 * Zajistí den pro červenou hranici SCHVÁLENO DO, pokud v projekci chybí.
 * Nevytváří persistovanou událost. Nemění prázdné dny kontrolního bloku.
 */
export function doplnDenProHraniciSchvalenoDo(
  dny: readonly BranaKalendarDen[],
  schvalenoDoIso: string | null,
  formatujDen: (isoDen: string) => string,
): BranaKalendarDen[] {
  if (!schvalenoDoIso || !/^\d{4}-\d{2}-\d{2}$/.test(schvalenoDoIso)) {
    return [...dny];
  }
  if (dny.some((den) => den.isoDen === schvalenoDoIso)) {
    return [...dny];
  }
  return [...dny, {
    isoDen: schvalenoDoIso,
    datumLabel: formatujDen(schvalenoDoIso),
    udalosti: [],
    jePrazdnyKontrolniDen: false,
  }].sort((a, b) => a.isoDen.localeCompare(b.isoDen));
}

/** Text souhrnného neblokujícího upozornění. */
export function textUpozorneniPrazdnychDni(pocet: number): string {
  if (pocet === 1) {
    return "Kontrolní období obsahuje 1 prázdný den.";
  }
  if (pocet >= 2 && pocet <= 4) {
    return `Kontrolní období obsahuje ${pocet} prázdné dny.`;
  }
  return `Kontrolní období obsahuje ${pocet} prázdných dnů.`;
}
