import { dnesVPraze, okamzikVPraze, okamzikZPrahy, pridatDny } from "./cas";

/** Čas poslední aktualizace obsahu – později nahradit hodnotou z redakce. */
export type BranaCasAktualizace = {
  hodina: number;
  minuta: number;
};

const RANO = { hodina: 6, minuta: 0 } as const;
const ODPOLEDNE = { hodina: 15, minuta: 30 } as const;

function minutyOdPulnoci(hodina: number, minuta: number): number {
  return hodina * 60 + minuta;
}

/**
 * Dočasný zdroj času aktualizace podle pravidel 6:00 / 15:30 v Europe/Prague.
 * Později nahradit časem posledního uložení z redakčního systému.
 */
export function zdrojCasuAktualizace(
  okamzik: Date = new Date(),
): BranaCasAktualizace {
  const { hodina, minuta } = okamzikVPraze(okamzik);
  const minuty = minutyOdPulnoci(hodina, minuta);
  const rano = minutyOdPulnoci(RANO.hodina, RANO.minuta);
  const odpoledne = minutyOdPulnoci(ODPOLEDNE.hodina, ODPOLEDNE.minuta);

  if (minuty >= rano && minuty < odpoledne) {
    return RANO;
  }

  return ODPOLEDNE;
}

/** Formátovaný text „Aktualizováno dnes v …“ pro zadaný zdroj času. */
export function formatTextAktualizace(cas: BranaCasAktualizace): string {
  const hodina = cas.hodina;
  const minuta = String(cas.minuta).padStart(2, "0");
  return `Aktualizováno dnes v ${hodina}:${minuta}`;
}

/** Text aktualizace pro aktuální okamžik v Europe/Prague. */
export function textAktualizaceVPraze(okamzik: Date = new Date()): string {
  return formatTextAktualizace(zdrojCasuAktualizace(okamzik));
}

/** Okamžik další změny zobrazeného času aktualizace (pro plánování na klientu). */
export function dalsiZmenaAktualizaceVPraze(
  okamzik: Date = new Date(),
): Date {
  const { hodina, minuta } = okamzikVPraze(okamzik);
  const minuty = minutyOdPulnoci(hodina, minuta);
  const rano = minutyOdPulnoci(RANO.hodina, RANO.minuta);
  const odpoledne = minutyOdPulnoci(ODPOLEDNE.hodina, ODPOLEDNE.minuta);
  const datum = dnesVPraze(okamzik);

  if (minuty >= rano && minuty < odpoledne) {
    return okamzikZPrahy(
      datum.rok,
      datum.mesic,
      datum.den,
      ODPOLEDNE.hodina,
      ODPOLEDNE.minuta,
    );
  }

  if (minuty >= odpoledne) {
    const zitra = pridatDny(datum, 1);
    return okamzikZPrahy(
      zitra.rok,
      zitra.mesic,
      zitra.den,
      RANO.hodina,
      RANO.minuta,
    );
  }

  return okamzikZPrahy(
    datum.rok,
    datum.mesic,
    datum.den,
    RANO.hodina,
    RANO.minuta,
  );
}
