import type { UlozisteDat } from "./uloziste-dat";

/** Sjednocená normalizace JSON úložiště – zachová všechna agregovaná pole */
export function normalizovatUloziste(data: UlozisteDat): UlozisteDat {
  return {
    polozky: data.polozky ?? [],
    metriky: data.metriky ?? [],
    metrikyAgregovane: data.metrikyAgregovane,
    analyticsAgregovane: data.analyticsAgregovane,
    pushOdbery: data.pushOdbery ?? [],
    prolnutiCasovani: data.prolnutiCasovani,
    desktopPozvankaFotografie: data.desktopPozvankaFotografie ?? null,
    verzeUloziste: data.verzeUloziste,
  };
}
