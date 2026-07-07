import type { UlozisteDat } from "./uloziste-dat";

/** Sjednocená normalizace JSON úložiště – zachová všechna agregovaná pole */
export function normalizovatUloziste(data: UlozisteDat): UlozisteDat {
  return {
    polozky: data.polozky ?? [],
    metriky: data.metriky ?? [],
    metrikyAgregovane: data.metrikyAgregovane,
    analyticsAgregovane: data.analyticsAgregovane,
    komunitaNavstevnici: data.komunitaNavstevnici,
    vzkazyTreboni: data.vzkazyTreboni ?? [],
    pushOdbery: data.pushOdbery ?? [],
    prolnutiCasovani: data.prolnutiCasovani,
    desktopPozvankaFotografie: data.desktopPozvankaFotografie ?? null,
    chovaniNavstevnikuAgregovane: data.chovaniNavstevnikuAgregovane,
    verzeUloziste: data.verzeUloziste,
  };
}
