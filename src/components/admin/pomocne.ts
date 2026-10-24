import type {
  AnalyticsFotografieRadek,
  AnalyticsSouhrn,
  Polozka,
  TypObsahu,
} from "@/types";

export function popisekTypu(typ: TypObsahu): string {
  switch (typ) {
    case "prolnuti":
      return "prolnutí";
    case "video":
      return "video";
    default:
      return "fotografie";
  }
}

export function formatovatDatumPolozky(datum: string | null): string {
  if (!datum) return "—";
  const parsed = new Date(datum);
  if (Number.isNaN(parsed.getTime())) return datum;
  return parsed.toLocaleDateString("cs-CZ");
}

export function soucetSdileni(analytics: AnalyticsSouhrn | null): number {
  if (!analytics) return 0;
  return analytics.fotografie.reduce((soucet, radek) => soucet + radek.sdileni, 0);
}

export function mapaMetrikPolozek(analytics: AnalyticsSouhrn | null) {
  const mapa = new Map<
    string,
    { zobrazeni: number; sdileni: number; replay: number }
  >();
  if (!analytics) return mapa;
  for (const radek of analytics.fotografie) {
    mapa.set(radek.polozkaId, {
      zobrazeni: radek.zobrazeni,
      sdileni: radek.sdileni,
      replay: radek.replay,
    });
  }
  return mapa;
}

/** Přesný poměr replay/zobrazení. Nula zobrazení poměr nemá. */
function pomerReplay(radek: AnalyticsFotografieRadek): number | null {
  if (radek.zobrazeni === 0) return null;
  return radek.replay / radek.zobrazeni;
}

/**
 * Žebříček jen pro tabulku TOP 10. Nemění pořadí souhrnu.
 * Sestupně podle přesného poměru, pak víc zobrazení, víc sdílení, název.
 * Nula zobrazení je až za každým vypočitatelným poměrem, včetně 0 %.
 */
function porovnatPodlePomeruReplay(
  a: AnalyticsFotografieRadek,
  b: AnalyticsFotografieRadek,
): number {
  const pomerA = pomerReplay(a);
  const pomerB = pomerReplay(b);
  if (pomerA === null && pomerB !== null) return 1;
  if (pomerA !== null && pomerB === null) return -1;
  if (pomerA !== null && pomerB !== null && pomerA !== pomerB) {
    return pomerB - pomerA;
  }
  if (b.zobrazeni !== a.zobrazeni) return b.zobrazeni - a.zobrazeni;
  if (b.sdileni !== a.sdileni) return b.sdileni - a.sdileni;
  return a.popis.localeCompare(b.popis, "cs");
}

/** Jedno desetinné místo, čárka. Nad 100 % se neořezává. */
export function textProcentaReplay(zobrazeni: number, replay: number): string {
  if (zobrazeni === 0) return "—";
  const procenta = (replay / zobrazeni) * 100;
  return `${procenta.toFixed(1).replace(".", ",")} %`;
}

export function topPolozky(analytics: AnalyticsSouhrn | null, limit = 10) {
  if (!analytics) return [];
  return [...analytics.fotografie]
    .sort(porovnatPodlePomeruReplay)
    .slice(0, limit);
}
