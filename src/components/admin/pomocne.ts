import type { AnalyticsSouhrn, Polozka, TypObsahu } from "@/types";

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

export function topPolozky(analytics: AnalyticsSouhrn | null, limit = 10) {
  if (!analytics) return [];
  return analytics.fotografie.slice(0, limit);
}
