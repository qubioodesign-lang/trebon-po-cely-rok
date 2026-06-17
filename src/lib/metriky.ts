import type { MetrikySouhrn, PayloadMetriky } from "@/types";
import type { ZaznamMetriky } from "./uloziste-dat";
import { nacistData, upravitData } from "./uloziste-dat";

/** Prázdný souhrn metrik – výchozí stav administrace */
export function prazdnySouhrnMetrik(): MetrikySouhrn {
  return {
    pocetNavstev: 0,
    pocetVracejicichSeNavstevniku: 0,
    pocetZobrazeniFotografii: 0,
    pocetPosunuVpred: 0,
    pocetNavratuZpet: 0,
    procentoNavratu: 0,
    pocetKliknutiChciSeVracet: 0,
    pocetPovolenychUpozorneni: 0,
  };
}

/** Zaznamená událost do metrik */
export async function zaznamenatMetriku(
  payload: PayloadMetriky,
  oidcZHeaderu?: string | null
): Promise<void> {
  await upravitData((uloziste) => {
    uloziste.metriky.push({
      id: crypto.randomUUID(),
      typ: payload.typ,
      polozkaId: payload.polozkaId,
      navstevnikId: payload.navstevnikId,
      vytvoreno: new Date().toISOString(),
    });
  }, oidcZHeaderu);
}

/** Agreguje surové záznamy metrik do souhrnu pro administraci */
export function agregovatSouhrnMetrik(metriky: ZaznamMetriky[]): MetrikySouhrn {
  const pocetNavstev = metriky.filter((m) => m.typ === "navsteva").length;

  const navstevyPodleNavstevnika = new Map<string, number>();
  for (const m of metriky) {
    if (m.typ === "navsteva" && m.navstevnikId) {
      navstevyPodleNavstevnika.set(
        m.navstevnikId,
        (navstevyPodleNavstevnika.get(m.navstevnikId) ?? 0) + 1
      );
    }
  }
  const pocetVracejicichSeNavstevniku = [...navstevyPodleNavstevnika.values()].filter(
    (pocet) => pocet > 1
  ).length;

  const pocetZobrazeniFotografii = metriky.filter(
    (m) => m.typ === "zobrazeni_fotografie"
  ).length;

  const pocetPosunuVpred = metriky.filter((m) => m.typ === "posun_vpred").length;
  const pocetNavratuZpet = metriky.filter((m) => m.typ === "navrat_zpet").length;

  const celkemPosunu = pocetPosunuVpred + pocetNavratuZpet;
  const procentoNavratu =
    celkemPosunu > 0
      ? Math.round((pocetNavratuZpet / celkemPosunu) * 1000) / 10
      : 0;

  const pocetKliknutiChciSeVracet = metriky.filter(
    (m) => m.typ === "klik_chci_se_vracet"
  ).length;

  const pocetPovolenychUpozorneni = metriky.filter(
    (m) => m.typ === "povoleno_upozorneni"
  ).length;

  return {
    pocetNavstev,
    pocetVracejicichSeNavstevniku,
    pocetZobrazeniFotografii,
    pocetPosunuVpred,
    pocetNavratuZpet,
    procentoNavratu,
    pocetKliknutiChciSeVracet,
    pocetPovolenychUpozorneni,
  };
}

/** Vrátí agregovaný souhrn všech metrik */
export async function ziskatSouhrnMetrik(
  oidcZHeaderu?: string | null
): Promise<MetrikySouhrn> {
  const { metriky } = await nacistData(oidcZHeaderu);
  return agregovatSouhrnMetrik(metriky);
}

/** Uloží push subscription pro budoucí notifikace */
export async function ulozitPushOdber(
  data: {
    endpoint: string;
    klicP256dh: string;
    klicAuth: string;
  },
  oidcZHeaderu?: string | null
): Promise<void> {
  await upravitData((uloziste) => {
    const existujici = uloziste.pushOdbery.findIndex(
      (o) => o.endpoint === data.endpoint
    );

    const zaznam = {
      endpoint: data.endpoint,
      klicP256dh: data.klicP256dh,
      klicAuth: data.klicAuth,
      vytvoreno: new Date().toISOString(),
    };

    if (existujici >= 0) {
      uloziste.pushOdbery[existujici] = zaznam;
    } else {
      uloziste.pushOdbery.push(zaznam);
    }
  }, oidcZHeaderu);
}
