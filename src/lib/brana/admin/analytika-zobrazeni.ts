import type { BodPoctuGrafu, BodProchazeniGrafu, SoucetProchazeniGrafu } from "@/lib/brana/analytika/grafy";

/** Společný rastr SVG. Souřadnice zůstávají v viewBoxu, šířka na stránce je 100 %. */
export const RASTR_GRAFU = {
  sirka: 360,
  vyska: 188,
  levy: 48,
  pravy: 8,
  horni: 12,
  dolni: 28,
} as const;

const MESICE = [
  "leden",
  "únor",
  "březen",
  "duben",
  "květen",
  "červen",
  "červenec",
  "srpen",
  "září",
  "říjen",
  "listopad",
  "prosinec",
] as const;

const MESICE_KRATKE = ["led", "úno", "bře", "dub", "kvě", "čvn", "čvc", "srp", "zář", "říj", "lis", "pro"] as const;

const formatCislo = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 });

export function textCisla(hodnota: number): string {
  return formatCislo.format(hodnota);
}

export function textPoctu(hodnota: number | null): string {
  return hodnota === null ? "nedostupné" : textCisla(hodnota);
}

export function textProcenta(hodnota: number | null): string {
  return hodnota === null ? "není údaj" : `${textCisla(hodnota)} %`;
}

function formatData(iso: string): string {
  const [rok, mesic, den] = iso.split("-");
  return `${Number(den)}. ${Number(mesic)}. ${rok}`;
}

function formatKratke(iso: string): string {
  const [, mesic, den] = iso.split("-");
  return `${Number(den)}. ${Number(mesic)}.`;
}

/** Plné datum dne, u měsíce i skutečný rozsah dní v okně. */
export function popisekBodu(bod: Pick<BodPoctuGrafu, "od" | "do" | "den" | "rok" | "mesic" | "pocetDnu">): string {
  if (bod.den !== null) {
    return formatData(bod.od);
  }
  const nazev = `${MESICE[bod.mesic - 1] ?? ""} ${bod.rok}`.trim();
  if (bod.od === bod.do) {
    return nazev;
  }
  return `${nazev} (${formatKratke(bod.od)}–${formatKratke(bod.do)}, ${bod.pocetDnu} ${bod.pocetDnu === 1 ? "den" : "dní"})`;
}

export function popisekOkna(
  okno: { od: string; do: string },
  rozliseni: "den" | "mesic",
): string {
  const rozsah = okno.od === okno.do ? formatData(okno.od) : `${formatData(okno.od)} – ${formatData(okno.do)}`;
  return rozliseni === "mesic" ? `${rozsah}. Po kalendářních měsících.` : `${rozsah}. Po dnech.`;
}

export function popisekOsy(bod: Pick<BodPoctuGrafu, "den" | "mesic">): string {
  if (bod.den !== null) {
    return `${bod.den}. ${bod.mesic}.`;
  }
  return MESICE_KRATKE[bod.mesic - 1] ?? "";
}

/** Horní hranice osy. Nula zůstává dole, prázdné maximum neselhává dělením. */
export function stropOsy(maximum: number): number {
  if (!Number.isFinite(maximum) || maximum <= 0) {
    return 1;
  }
  const rad = 10 ** Math.floor(Math.log10(maximum));
  const nasobek = maximum / rad;
  const hezky = nasobek <= 1 ? 1 : nasobek <= 2 ? 2 : nasobek <= 5 ? 5 : 10;
  return hezky * rad;
}

export function indexZPozice(xVeViewBoxu: number, pocet: number): number {
  if (pocet <= 1) {
    return 0;
  }
  const plot = RASTR_GRAFU.sirka - RASTR_GRAFU.levy - RASTR_GRAFU.pravy;
  const relativni = Math.min(plot, Math.max(0, xVeViewBoxu - RASTR_GRAFU.levy));
  const slot = plot / pocet;
  return Math.min(pocet - 1, Math.floor(relativni / slot));
}

export function posunVyber(index: number, smer: -1 | 1, pocet: number): number {
  if (pocet <= 0) {
    return 0;
  }
  return Math.min(pocet - 1, Math.max(0, index + smer));
}

/** Souvislé úseky. Null čáru přeruší a nesmí se dokreslit jako nula. */
export function usekyHodnot(hodnoty: readonly (number | null)[]): number[][] {
  const useky: number[][] = [];
  let aktualni: number[] = [];
  for (let index = 0; index < hodnoty.length; index += 1) {
    if (hodnoty[index] === null) {
      if (aktualni.length > 0) {
        useky.push(aktualni);
      }
      aktualni = [];
      continue;
    }
    aktualni.push(index);
  }
  if (aktualni.length > 0) {
    useky.push(aktualni);
  }
  return useky;
}

export function souradniceBodu(
  index: number,
  pocet: number,
  hodnota: number,
  strop: number,
): { x: number; y: number } {
  const plotW = RASTR_GRAFU.sirka - RASTR_GRAFU.levy - RASTR_GRAFU.pravy;
  const plotH = RASTR_GRAFU.vyska - RASTR_GRAFU.horni - RASTR_GRAFU.dolni;
  const slot = pocet > 0 ? plotW / pocet : plotW;
  const x = RASTR_GRAFU.levy + slot * index + slot / 2;
  const pomer = strop > 0 ? Math.min(1, Math.max(0, hodnota / strop)) : 0;
  const y = RASTR_GRAFU.horni + plotH - pomer * plotH;
  return { x, y };
}

export function indexyPopiskuOsy(pocet: number): number[] {
  if (pocet <= 0) {
    return [];
  }
  if (pocet === 1) {
    return [0];
  }
  const stred = Math.floor((pocet - 1) / 2);
  return [...new Set([0, stred, pocet - 1])];
}

/** Podíly dvou součtů. Nulový základ není 0 %. */
export function podilyDvou(
  prvni: number | null,
  druhy: number | null,
): { prvni: number | null; druhy: number | null } {
  if (prvni === null || druhy === null) {
    return { prvni: null, druhy: null };
  }
  const soucet = prvni + druhy;
  if (soucet === 0) {
    return { prvni: null, druhy: null };
  }
  return { prvni: (100 * prvni) / soucet, druhy: (100 * druhy) / soucet };
}

export function textZmeny(zmena: number | null, maPredchozi: boolean): string | null {
  if (!maPredchozi) {
    return null;
  }
  if (zmena === null) {
    return "Změnu proti předchozímu období nelze spočítat.";
  }
  const znamenko = zmena > 0 ? "+" : "";
  return `Změna proti předchozímu období: ${znamenko}${textCisla(zmena)} %.`;
}

export function textProchazeniObdobi(nazev: string, soucet: SoucetProchazeniGrafu): string {
  if (soucet.procento === null || soucet.delsi === null || soucet.konec === null) {
    return `${nazev}: není údaj`;
  }
  return `${nazev}: ${textCisla(soucet.procento)} % (konec ${textCisla(soucet.konec)} z ${textCisla(soucet.delsi)})`;
}

export function textProchazeniBodu(bod: BodProchazeniGrafu): string {
  if (bod.procento === null) {
    return "není údaj";
  }
  const pocet =
    bod.konec === null || bod.delsi === null
      ? ""
      : ` (konec ${textCisla(bod.konec)} z ${textCisla(bod.delsi)})`;
  return `${textCisla(bod.procento)} %${pocet}`;
}

export function maximumHodnot(rady: readonly (readonly (number | null)[])[]): number {
  let maximum = 0;
  for (const rada of rady) {
    for (const hodnota of rada) {
      if (hodnota !== null && hodnota > maximum) {
        maximum = hodnota;
      }
    }
  }
  return maximum;
}
