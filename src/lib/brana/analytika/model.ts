import { dnesVPraze, pridatDny, type BranaDatum } from "@/lib/brana/cas";

/**
 * Soukromý souhrn analytiky BRÁNY.
 * Není součástí zálohy kalendáře ani veřejného úložiště galerie.
 */
export const BRANA_ANALYTIKA_BLOB_CESTA = "data/brana-analytika.json";

export const BRANA_ANALYTIKA_VERZE = 1;

/** Veřejný příjem je vypnutý, dokud nebude analytika vědomě napojená. */
export const BRANA_ANALYTIKA_PRIJEM_ZAPNUT = false;

export const BRANA_ANALYTIKA_MAX_UDALOSTI = 20;

export const BRANA_ANALYTIKA_MAX_TELA_BAJTU = 4096;

/** Denní koše, které dokument smí držet. Starší se při úspěšném zápisu ořežou. */
export const BRANA_ANALYTIKA_MAX_DNU = 400;

export const BRANA_ANALYTIKA_ZDROJE = [
  "qr",
  "whatsapp",
  "sdileni",
  "ostatni",
  "nerozpoznano",
] as const;

export const BRANA_ANALYTIKA_POHLEDY = [
  "dnes",
  "zitra",
  "vikend",
  "7-dni",
  "vyhled",
] as const;

export const BRANA_ANALYTIKA_ZARIZENI = [
  "android",
  "ios",
  "pocitac",
  "ostatni",
] as const;

export type BranaAnalytikaZdroj = (typeof BRANA_ANALYTIKA_ZDROJE)[number];
export type BranaAnalytikaPohled = (typeof BRANA_ANALYTIKA_POHLEDY)[number];
export type BranaAnalytikaZarizeni = (typeof BRANA_ANALYTIKA_ZARIZENI)[number];

export type BranaAnalytikaPohledPocty = {
  prvni: number;
  dalsi: number;
};

export type BranaAnalytikaDen = {
  navstevy: number;
  novi: number;
  vracejici: number;
  dobaZobrazeniSoucetMs: number;
  dobaZobrazeniPocet: number;
  sdileniKlik: number;
  zdroje: Record<BranaAnalytikaZdroj, number>;
  pohledy: Record<BranaAnalytikaPohled, BranaAnalytikaPohledPocty>;
  konecObsahu: {
    vikend: number;
    "7-dni": number;
  };
  proklikTrebon: number;
  hodiny: number[];
  zarizeni: Record<BranaAnalytikaZarizeni, number>;
  spusteni: {
    ikona: number;
    prohlizec: number;
  };
};

export type BranaAnalytikaDokument = {
  verze: typeof BRANA_ANALYTIKA_VERZE;
  dny: Record<string, BranaAnalytikaDen>;
};

/** Jediná událost, kterou základ umí přičíst. Ostatní typy se odmítnou. */
export type BranaAnalytikaUdalost = {
  typ: "navsteva";
};

export type VysledekBranaAnalytiky =
  | { ok: true }
  | { ok: false; duvod: "neplatna-davka" };

const KLIC_DNE = /^\d{4}-\d{2}-\d{2}$/;

export function isoDenZData(datum: BranaDatum): string {
  const mesic = String(datum.mesic).padStart(2, "0");
  const den = String(datum.den).padStart(2, "0");
  return `${datum.rok}-${mesic}-${den}`;
}

export function prazdnyDenAnalytiky(): BranaAnalytikaDen {
  const pohledy = {} as Record<BranaAnalytikaPohled, BranaAnalytikaPohledPocty>;
  for (const pohled of BRANA_ANALYTIKA_POHLEDY) {
    pohledy[pohled] = { prvni: 0, dalsi: 0 };
  }

  const zdroje = {} as Record<BranaAnalytikaZdroj, number>;
  for (const zdroj of BRANA_ANALYTIKA_ZDROJE) {
    zdroje[zdroj] = 0;
  }

  const zarizeni = {} as Record<BranaAnalytikaZarizeni, number>;
  for (const typ of BRANA_ANALYTIKA_ZARIZENI) {
    zarizeni[typ] = 0;
  }

  return {
    navstevy: 0,
    novi: 0,
    vracejici: 0,
    dobaZobrazeniSoucetMs: 0,
    dobaZobrazeniPocet: 0,
    sdileniKlik: 0,
    zdroje,
    pohledy,
    konecObsahu: { vikend: 0, "7-dni": 0 },
    proklikTrebon: 0,
    hodiny: Array.from({ length: 24 }, () => 0),
    zarizeni,
    spusteni: { ikona: 0, prohlizec: 0 },
  };
}

export function prazdnyDokumentAnalytiky(): BranaAnalytikaDokument {
  return { verze: BRANA_ANALYTIKA_VERZE, dny: {} };
}

function jeNezaporneCeleCislo(hodnota: unknown): hodnota is number {
  return (
    typeof hodnota === "number" &&
    Number.isSafeInteger(hodnota) &&
    hodnota >= 0
  );
}

function parsovatDen(raw: unknown): BranaAnalytikaDen | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const den = raw as Partial<BranaAnalytikaDen>;
  const vysledek = prazdnyDenAnalytiky();

  if (
    !jeNezaporneCeleCislo(den.navstevy) ||
    !jeNezaporneCeleCislo(den.novi) ||
    !jeNezaporneCeleCislo(den.vracejici) ||
    !jeNezaporneCeleCislo(den.dobaZobrazeniSoucetMs) ||
    !jeNezaporneCeleCislo(den.dobaZobrazeniPocet) ||
    !jeNezaporneCeleCislo(den.sdileniKlik) ||
    !jeNezaporneCeleCislo(den.proklikTrebon)
  ) {
    return null;
  }

  vysledek.navstevy = den.navstevy;
  vysledek.novi = den.novi;
  vysledek.vracejici = den.vracejici;
  vysledek.dobaZobrazeniSoucetMs = den.dobaZobrazeniSoucetMs;
  vysledek.dobaZobrazeniPocet = den.dobaZobrazeniPocet;
  vysledek.sdileniKlik = den.sdileniKlik;
  vysledek.proklikTrebon = den.proklikTrebon;

  if (!den.zdroje || typeof den.zdroje !== "object") {
    return null;
  }
  for (const zdroj of BRANA_ANALYTIKA_ZDROJE) {
    const pocet = den.zdroje[zdroj];
    if (!jeNezaporneCeleCislo(pocet)) {
      return null;
    }
    vysledek.zdroje[zdroj] = pocet;
  }

  if (!den.pohledy || typeof den.pohledy !== "object") {
    return null;
  }
  for (const pohled of BRANA_ANALYTIKA_POHLEDY) {
    const pocty = den.pohledy[pohled];
    if (
      !pocty ||
      !jeNezaporneCeleCislo(pocty.prvni) ||
      !jeNezaporneCeleCislo(pocty.dalsi)
    ) {
      return null;
    }
    vysledek.pohledy[pohled] = { prvni: pocty.prvni, dalsi: pocty.dalsi };
  }

  if (
    !den.konecObsahu ||
    !jeNezaporneCeleCislo(den.konecObsahu.vikend) ||
    !jeNezaporneCeleCislo(den.konecObsahu["7-dni"])
  ) {
    return null;
  }
  vysledek.konecObsahu = {
    vikend: den.konecObsahu.vikend,
    "7-dni": den.konecObsahu["7-dni"],
  };

  if (!Array.isArray(den.hodiny) || den.hodiny.length !== 24) {
    return null;
  }
  for (let index = 0; index < 24; index += 1) {
    const hodina = den.hodiny[index];
    if (!jeNezaporneCeleCislo(hodina)) {
      return null;
    }
    vysledek.hodiny[index] = hodina;
  }

  if (!den.zarizeni || typeof den.zarizeni !== "object") {
    return null;
  }
  for (const typ of BRANA_ANALYTIKA_ZARIZENI) {
    const pocet = den.zarizeni[typ];
    if (!jeNezaporneCeleCislo(pocet)) {
      return null;
    }
    vysledek.zarizeni[typ] = pocet;
  }

  if (
    !den.spusteni ||
    !jeNezaporneCeleCislo(den.spusteni.ikona) ||
    !jeNezaporneCeleCislo(den.spusteni.prohlizec)
  ) {
    return null;
  }
  vysledek.spusteni = {
    ikona: den.spusteni.ikona,
    prohlizec: den.spusteni.prohlizec,
  };

  return vysledek;
}

/** Vrátí dokument, nebo null když uložený JSON neodpovídá struktuře. */
export function parsovatDokumentAnalytiky(
  raw: unknown,
): BranaAnalytikaDokument | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const dokument = raw as Partial<BranaAnalytikaDokument>;
  if (dokument.verze !== BRANA_ANALYTIKA_VERZE || !dokument.dny) {
    return null;
  }
  if (typeof dokument.dny !== "object" || Array.isArray(dokument.dny)) {
    return null;
  }

  const dny: Record<string, BranaAnalytikaDen> = {};
  for (const [klic, hodnota] of Object.entries(dokument.dny)) {
    if (!KLIC_DNE.test(klic)) {
      return null;
    }
    const den = parsovatDen(hodnota);
    if (!den) {
      return null;
    }
    dny[klic] = den;
  }

  return { verze: BRANA_ANALYTIKA_VERZE, dny };
}

export function validovatDavkuAnalytiky(
  telo: unknown,
): { ok: true; udalosti: BranaAnalytikaUdalost[] } | { ok: false } {
  if (!telo || typeof telo !== "object" || Array.isArray(telo)) {
    return { ok: false };
  }

  const udalosti = (telo as { udalosti?: unknown }).udalosti;
  if (!Array.isArray(udalosti) || udalosti.length === 0) {
    return { ok: false };
  }
  if (udalosti.length > BRANA_ANALYTIKA_MAX_UDALOSTI) {
    return { ok: false };
  }

  const ciste: BranaAnalytikaUdalost[] = [];
  for (const udalost of udalosti) {
    if (!udalost || typeof udalost !== "object" || Array.isArray(udalost)) {
      return { ok: false };
    }
    const klice = Object.keys(udalost);
    if (klice.length !== 1 || klice[0] !== "typ") {
      return { ok: false };
    }
    if ((udalost as { typ?: unknown }).typ !== "navsteva") {
      return { ok: false };
    }
    ciste.push({ typ: "navsteva" });
  }

  return { ok: true, udalosti: ciste };
}

export function orezatStareDny(
  dny: Record<string, BranaAnalytikaDen>,
  referencniCas: Date,
): Record<string, BranaAnalytikaDen> {
  const dnes = isoDenZData(dnesVPraze(referencniCas));
  const hranice = isoDenZData(
    pridatDny(dnesVPraze(referencniCas), -(BRANA_ANALYTIKA_MAX_DNU - 1)),
  );
  const vysledek: Record<string, BranaAnalytikaDen> = {};

  for (const [klic, den] of Object.entries(dny)) {
    if (klic >= hranice && klic <= dnes) {
      vysledek[klic] = den;
    }
  }

  return vysledek;
}

/** Přičte platné návštěvy do denního koše. Ostatní připravené čítače nemění. */
export function aplikovatDavkuAnalytiky(
  dokument: BranaAnalytikaDokument,
  udalosti: readonly BranaAnalytikaUdalost[],
  referencniCas: Date,
): BranaAnalytikaDokument {
  const denKlic = isoDenZData(dnesVPraze(referencniCas));
  const dny = orezatStareDny(dokument.dny, referencniCas);
  const den = dny[denKlic] ?? prazdnyDenAnalytiky();
  const navstevy = den.navstevy + udalosti.length;

  if (!Number.isSafeInteger(navstevy)) {
    throw new Error("Počet návštěv přesáhl bezpečný rozsah. Nic nebylo uloženo.");
  }

  dny[denKlic] = { ...den, navstevy };
  return { verze: BRANA_ANALYTIKA_VERZE, dny };
}
