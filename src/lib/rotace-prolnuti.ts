import type { Polozka } from "@/types";
import { jePlatnaPolozkaGalerie } from "./polozka-soubory";

/** Skutečných 24 hodin. Nezávislé na půlnoci i na letním a zimním čase. */
export const DELKA_OKNA_ROTACE_MS = 24 * 60 * 60 * 1000;

export interface StavRotacePolozek {
  polozky: Polozka[];
  /** Chybí, dokud rotace nebyla spuštěna autorem. */
  rotaceOd?: string;
}

export function jePlatnyCasRotaceProlnuti(
  hodnota: unknown
): hodnota is string {
  if (typeof hodnota !== "string") return false;
  const text = hodnota.trim();
  if (!text) return false;
  return Number.isFinite(Date.parse(text));
}

function casRotaceMs(hodnota: string): number {
  return Date.parse(hodnota.trim());
}

function zachovatCas(
  rotaceOd: string | null | undefined
): string | undefined {
  if (!jePlatnyCasRotaceProlnuti(rotaceOd)) return undefined;
  return rotaceOd.trim();
}

function srovnatPolozky(a: Polozka, b: Polozka): number {
  return a.poradi - b.poradi || a.datumPublikace.localeCompare(b.datumPublikace);
}

/** Viditelné prolnutí, které smí vstoupit do rotace i do veřejné galerie. */
export function jeViditelneProlnuti(polozka: Polozka): boolean {
  return polozka.typ === "prolnuti" && jePlatnaPolozkaGalerie(polozka);
}

export function idsViditelnychProlnuti(polozky: Polozka[]): string[] {
  return polozky.filter(jeViditelneProlnuti).map((polozka) => polozka.id);
}

export function idPrvnihoViditelnehoProlnuti(
  polozky: Polozka[]
): string | null {
  return idsViditelnychProlnuti(polozky)[0] ?? null;
}

/**
 * Kolik míst se má řada viditelných prolnutí posunout.
 * 0 = žádná rotace (chybí čas, málo položek, nebo ještě neuběhlo 24 hodin).
 */
export function posunRotaceProlnuti(
  rotaceOd: string | null | undefined,
  nowMs: number,
  pocet: number
): number {
  if (pocet < 2) return 0;
  if (!jePlatnyCasRotaceProlnuti(rotaceOd)) return 0;
  if (!Number.isFinite(nowMs)) return 0;
  const uplynulo = nowMs - casRotaceMs(rotaceOd);
  if (uplynulo < DELKA_OKNA_ROTACE_MS) return 0;
  return Math.floor(uplynulo / DELKA_OKNA_ROTACE_MS) % pocet;
}

/**
 * Pořadí, které se má právě zobrazit.
 * Viditelná prolnutí se točí ve svých místech. Fotografie a skrytá prolnutí zůstávají.
 * Nezapisuje nic a nemění předané objekty.
 */
export function efektivniPoradiPolozek(
  polozky: Polozka[],
  rotaceOd: string | null | undefined,
  nowMs: number
): Polozka[] {
  const serazene = [...polozky].sort(srovnatPolozky);
  const indexy: number[] = [];
  serazene.forEach((polozka, index) => {
    if (jeViditelneProlnuti(polozka)) indexy.push(index);
  });

  const posun = posunRotaceProlnuti(rotaceOd, nowMs, indexy.length);
  const vysledek = serazene.slice();
  if (posun > 0) {
    const viditelna = indexy.map((index) => serazene[index]);
    indexy.forEach((indexRadku, poradiVRade) => {
      vysledek[indexRadku] = viditelna[(poradiVRade + posun) % viditelna.length];
    });
  }

  return vysledek.map((polozka, index) => ({ ...polozka, poradi: index }));
}

/** Veřejná galerie je efektivní pořadí bez skrytých a neplatných položek. */
export function polozkyVerejneGalerie(
  polozky: Polozka[],
  rotaceOd: string | null | undefined,
  nowMs: number
): Polozka[] {
  return efektivniPoradiPolozek(polozky, rotaceOd, nowMs).filter(
    jePlatnaPolozkaGalerie
  );
}

function stejneViditelneProlnuti(pred: Polozka[], po: Polozka[]): boolean {
  const predIds = idsViditelnychProlnuti(pred);
  const poIds = idsViditelnychProlnuti(po);
  return (
    predIds.length === poIds.length &&
    predIds.every((id, index) => id === poIds[index])
  );
}

/**
 * Uloží právě zobrazené pořadí jako nový základ.
 * Nových 24 hodin začne jen tehdy, když vzniklo jiné první viditelné prolnutí.
 * Jinak zůstane zbytek už běžícího okna. Chybějící čas se sám od sebe nespustí.
 */
export function uzavritAutorskyZasah(
  predEfektivni: Polozka[],
  poEfektivni: Polozka[],
  rotaceOd: string | null | undefined,
  nowMs: number
): StavRotacePolozek {
  const polozky = poEfektivni.map((polozka, index) => ({
    ...polozka,
    poradi: index,
  }));
  const predPrvni = idPrvnihoViditelnehoProlnuti(predEfektivni);
  const poPrvni = idPrvnihoViditelnehoProlnuti(poEfektivni);
  const vznikloNovePrvni = poPrvni !== null && predPrvni !== poPrvni;

  if (!jePlatnyCasRotaceProlnuti(rotaceOd)) {
    if (vznikloNovePrvni) {
      return { polozky, rotaceOd: new Date(nowMs).toISOString() };
    }
    return { polozky };
  }

  if (vznikloNovePrvni) {
    return { polozky, rotaceOd: new Date(nowMs).toISOString() };
  }

  const kotva = casRotaceMs(rotaceOd);
  const uplynulo = nowMs - kotva;
  const celaOkna =
    uplynulo >= 0 ? Math.floor(uplynulo / DELKA_OKNA_ROTACE_MS) : 0;
  return {
    polozky,
    rotaceOd: new Date(kotva + celaOkna * DELKA_OKNA_ROTACE_MS).toISOString(),
  };
}

function jeKompletniSeznam(pred: Polozka[], ids: string[]): boolean {
  if (ids.length !== pred.length) return false;
  const zname = new Set(pred.map((polozka) => polozka.id));
  if (new Set(ids).size !== ids.length) return false;
  return ids.every((id) => zname.has(id));
}

export type SmerRucnihoPresunu = "nahoru" | "dolu" | "pripnout";

export type VysledekRucnihoPresunu = StavRotacePolozek | "chybi" | "kraj";

export type VysledekZmenyPoradi = StavRotacePolozek | "odmitnuto" | "bezeZmeny";

function presunoutVEffektivnimPoradi(
  pred: Polozka[],
  index: number,
  smer: SmerRucnihoPresunu
): Polozka[] | "kraj" {
  if (smer === "nahoru" && index === 0) return "kraj";
  if (smer === "dolu" && index === pred.length - 1) return "kraj";
  if (smer === "pripnout" && index === 0) return "kraj";

  const po = pred.slice();
  if (smer === "pripnout") {
    const [polozka] = po.splice(index, 1);
    po.unshift(polozka);
    return po;
  }

  const cil = smer === "nahoru" ? index - 1 : index + 1;
  [po[index], po[cil]] = [po[cil], po[index]];
  return po;
}

/**
 * Šipka nebo připnutí jedné položky v pořadí, které platí v okamžiku zápisu.
 * Neobnovuje seznam, který měla otevřená administrace v paměti.
 */
export function vysledekRucnihoPresunu(
  ulozene: Polozka[],
  rotaceOd: string | null | undefined,
  id: string,
  smer: SmerRucnihoPresunu,
  nowMs: number
): VysledekRucnihoPresunu {
  const pred = efektivniPoradiPolozek(ulozene, rotaceOd, nowMs);
  const index = pred.findIndex((polozka) => polozka.id === id);
  if (index < 0) return "chybi";

  const po = presunoutVEffektivnimPoradi(pred, index, smer);
  if (po === "kraj") return "kraj";
  return uzavritAutorskyZasah(pred, po, rotaceOd, nowMs);
}

/**
 * Celý seznam ID se přijme jen jako jeden sousední přesun nebo připnutí
 * vůči aktuálnímu pořadí. Jiný seznam, třeba ze staré administrace, se odmítne.
 */
export function vysledekZmenyPoradi(
  ulozene: Polozka[],
  rotaceOd: string | null | undefined,
  ids: string[],
  nowMs: number
): VysledekZmenyPoradi {
  if (ids.length === 0) return "bezeZmeny";

  const pred = efektivniPoradiPolozek(ulozene, rotaceOd, nowMs);
  if (!jeKompletniSeznam(pred, ids)) return "odmitnuto";

  const predIds = pred.map((polozka) => polozka.id);
  const rozdil = rozdilRucnihoPoradi(predIds, ids);
  if (rozdil === "jiny") return "odmitnuto";
  if (rozdil === "stejny") return "bezeZmeny";

  const mapa = new Map(pred.map((polozka) => [polozka.id, polozka]));
  const po = ids.map((id) => mapa.get(id)!);
  return uzavritAutorskyZasah(pred, po, rotaceOd, nowMs);
}

function rozdilRucnihoPoradi(
  predIds: string[],
  noveIds: string[]
): "stejny" | "soused" | "pripnout" | "jiny" {
  if (predIds.length !== noveIds.length) return "jiny";
  if (predIds.every((id, index) => id === noveIds[index])) return "stejny";

  const bezPresouvane = predIds.filter((id) => id !== noveIds[0]);
  const zbytek = noveIds.slice(1);
  if (
    predIds.indexOf(noveIds[0]) > 0 &&
    bezPresouvane.length === zbytek.length &&
    bezPresouvane.every((id, index) => id === zbytek[index])
  ) {
    return "pripnout";
  }

  const rozdily: number[] = [];
  predIds.forEach((id, index) => {
    if (id !== noveIds[index]) rozdily.push(index);
  });
  if (
    rozdily.length === 2 &&
    rozdily[1] === rozdily[0] + 1 &&
    predIds[rozdily[0]] === noveIds[rozdily[1]] &&
    predIds[rozdily[1]] === noveIds[rozdily[0]]
  ) {
    return "soused";
  }

  return "jiny";
}

export function vysledekPrepnutiViditelnosti(
  ulozene: Polozka[],
  rotaceOd: string | null | undefined,
  id: string,
  aktivni: boolean,
  nowMs: number
): StavRotacePolozek | null {
  if (!ulozene.some((polozka) => polozka.id === id)) return null;
  const pred = efektivniPoradiPolozek(ulozene, rotaceOd, nowMs);
  const po = pred.map((polozka) =>
    polozka.id === id ? { ...polozka, aktivni } : polozka
  );
  if (stejneViditelneProlnuti(pred, po)) {
    return {
      polozky: ulozene.map((polozka) =>
        polozka.id === id ? { ...polozka, aktivni } : polozka
      ),
      rotaceOd: zachovatCas(rotaceOd),
    };
  }
  return uzavritAutorskyZasah(pred, po, rotaceOd, nowMs);
}

export function vysledekSmazaniPolozky(
  ulozene: Polozka[],
  rotaceOd: string | null | undefined,
  id: string,
  nowMs: number
): StavRotacePolozek | null {
  if (!ulozene.some((polozka) => polozka.id === id)) return null;
  const pred = efektivniPoradiPolozek(ulozene, rotaceOd, nowMs);
  const po = pred.filter((polozka) => polozka.id !== id);
  if (stejneViditelneProlnuti(pred, po)) {
    return {
      polozky: ulozene.filter((polozka) => polozka.id !== id),
      rotaceOd: zachovatCas(rotaceOd),
    };
  }
  return uzavritAutorskyZasah(pred, po, rotaceOd, nowMs);
}

/**
 * Nové prolnutí. Skryté se jen vloží a hodiny se nemění.
 * Viditelné vzniká na začátku právě zobrazeného seznamu.
 */
export function vysledekPridaniProlnuti(
  ulozene: Polozka[],
  rotaceOd: string | null | undefined,
  nova: Polozka,
  nowMs: number
): StavRotacePolozek {
  if (!jeViditelneProlnuti(nova)) {
    return {
      polozky: [...ulozene, nova],
      rotaceOd: zachovatCas(rotaceOd),
    };
  }
  const pred = efektivniPoradiPolozek(ulozene, rotaceOd, nowMs);
  return uzavritAutorskyZasah(pred, [nova, ...pred], rotaceOd, nowMs);
}

/** Text, datum a viditelnost. Samotný text hodiny ani pořadí neotáčí. */
export function vysledekUpravyPolozky(
  ulozene: Polozka[],
  rotaceOd: string | null | undefined,
  id: string,
  zmena: {
    popis?: string;
    datumPorizeni?: string | null;
    aktivni?: boolean;
  },
  nowMs: number
): StavRotacePolozek | null {
  const ulozena = ulozene.find((polozka) => polozka.id === id);
  if (!ulozena) return null;

  const upravena: Polozka = {
    ...ulozena,
    ...(zmena.popis !== undefined ? { popis: zmena.popis } : {}),
    ...(zmena.datumPorizeni !== undefined
      ? { datumPorizeni: zmena.datumPorizeni }
      : {}),
    ...(zmena.aktivni !== undefined ? { aktivni: zmena.aktivni } : {}),
  };
  const pred = efektivniPoradiPolozek(ulozene, rotaceOd, nowMs);
  const po = pred.map((polozka) =>
    polozka.id === id ? { ...upravena, poradi: polozka.poradi } : polozka
  );
  if (stejneViditelneProlnuti(pred, po)) {
    return {
      polozky: ulozene.map((polozka) => (polozka.id === id ? upravena : polozka)),
      rotaceOd: zachovatCas(rotaceOd),
    };
  }
  return uzavritAutorskyZasah(pred, po, rotaceOd, nowMs);
}

/** Jednorázové spuštění. Už běžící okno neresetuje a pořadí nemění. */
export function vysledekSpusteniRotace(
  rotaceOd: string | null | undefined,
  nowMs: number
): { spusteno: boolean; rotaceOd: string } {
  if (jePlatnyCasRotaceProlnuti(rotaceOd)) {
    return { spusteno: false, rotaceOd: rotaceOd.trim() };
  }
  return { spusteno: true, rotaceOd: new Date(nowMs).toISOString() };
}
