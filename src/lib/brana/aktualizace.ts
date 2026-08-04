import {
  dnesVPraze,
  okamzikVPraze,
  okamzikZPrahy,
  pridatDny,
  type BranaDatum,
} from "./cas";

const RANO = { hodina: 6, minuta: 0 } as const;
const ODPOLEDNE = { hodina: 15, minuta: 30 } as const;

function minutyOdPulnoci(hodina: number, minuta: number): number {
  return hodina * 60 + minuta;
}

function stejneKalendarniDatum(a: BranaDatum, b: BranaDatum): boolean {
  return a.rok === b.rok && a.mesic === b.mesic && a.den === b.den;
}

function formatCasAktualizace(hodina: number, minuta: number): string {
  return `${hodina}:${String(minuta).padStart(2, "0")}`;
}

/**
 * Dočasný zdroj timestampu poslední publikace podle rytmu 6:00 / 15:30
 * v Europe/Prague. Později nahradit skutečným timestampem z redakce.
 */
export function zdrojCasuAktualizace(okamzik: Date = new Date()): Date {
  const { hodina, minuta } = okamzikVPraze(okamzik);
  const minuty = minutyOdPulnoci(hodina, minuta);
  const rano = minutyOdPulnoci(RANO.hodina, RANO.minuta);
  const odpoledne = minutyOdPulnoci(ODPOLEDNE.hodina, ODPOLEDNE.minuta);
  const dnes = dnesVPraze(okamzik);

  if (minuty >= rano && minuty < odpoledne) {
    return okamzikZPrahy(
      dnes.rok,
      dnes.mesic,
      dnes.den,
      RANO.hodina,
      RANO.minuta,
    );
  }

  if (minuty >= odpoledne) {
    return okamzikZPrahy(
      dnes.rok,
      dnes.mesic,
      dnes.den,
      ODPOLEDNE.hodina,
      ODPOLEDNE.minuta,
    );
  }

  const vcera = pridatDny(dnes, -1);
  return okamzikZPrahy(
    vcera.rok,
    vcera.mesic,
    vcera.den,
    ODPOLEDNE.hodina,
    ODPOLEDNE.minuta,
  );
}

/**
 * Obecné formátování textu aktualizace z timestampu publikace
 * vůči aktuálnímu okamžiku – obojí v Europe/Prague.
 */
export function formatTextAktualizace(
  publikace: Date,
  ted: Date = new Date(),
): string {
  const pub = okamzikVPraze(publikace);
  const nyni = okamzikVPraze(ted);
  const cas = formatCasAktualizace(pub.hodina, pub.minuta);
  const denPublikace: BranaDatum = {
    rok: pub.rok,
    mesic: pub.mesic,
    den: pub.den,
  };
  const denTed: BranaDatum = {
    rok: nyni.rok,
    mesic: nyni.mesic,
    den: nyni.den,
  };

  if (stejneKalendarniDatum(denPublikace, denTed)) {
    return `Aktualizováno dnes v ${cas}`;
  }

  if (stejneKalendarniDatum(denPublikace, pridatDny(denTed, -1))) {
    return `Aktualizováno včera v ${cas}`;
  }

  return `Aktualizováno ${pub.den}. ${pub.mesic}. v ${cas}`;
}

/** Text aktualizace pro aktuální okamžik v Europe/Prague. */
export function textAktualizaceVPraze(okamzik: Date = new Date()): string {
  return formatTextAktualizace(zdrojCasuAktualizace(okamzik), okamzik);
}

/**
 * Okamžik další změny zobrazeného textu aktualizace (pro plánování na klientu).
 * Hranice: 00:00, 6:00 a 15:30 v Europe/Prague.
 */
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
    return okamzikZPrahy(zitra.rok, zitra.mesic, zitra.den, 0, 0);
  }

  return okamzikZPrahy(
    datum.rok,
    datum.mesic,
    datum.den,
    RANO.hodina,
    RANO.minuta,
  );
}
