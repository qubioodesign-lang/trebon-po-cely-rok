import { dnesVPraze, pridatDny, type BranaDatum } from "@/lib/brana/cas";

/**
 * Soukromý souhrn analytiky BRÁNY.
 * Není součástí zálohy kalendáře ani veřejného úložiště galerie.
 */
export const BRANA_ANALYTIKA_BLOB_CESTA = "data/brana-analytika.json";

export const BRANA_ANALYTIKA_VERZE = 1;

/** Veřejný příjem je vypnutý, dokud nebude analytika vědomě napojená. */
export const BRANA_ANALYTIKA_PRIJEM_ZAPNUT = true;

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

export const BRANA_ANALYTIKA_RAZY_POHLEDU = ["prvni", "dalsi"] as const;

export const BRANA_ANALYTIKA_METRIKY_PROCHAZENI = ["delsi", "konec"] as const;

export const BRANA_ANALYTIKA_ZARIZENI = [
  "android",
  "ios",
  "pocitac",
  "ostatni",
] as const;

export const BRANA_ANALYTIKA_SPUSTENI = ["ikona", "prohlizec"] as const;

export const BRANA_ANALYTIKA_NAVSTEVNICI = ["novy", "vracejici"] as const;

/** Odhad sítě podle ORP Třeboň. Není to GPS ani uložená poloha. */
export const BRANA_ANALYTIKA_OBLASTI = [
  "trebonsko",
  "mimo_trebonsko",
  "neurceno",
] as const;

export type BranaAnalytikaZdroj = (typeof BRANA_ANALYTIKA_ZDROJE)[number];
export type BranaAnalytikaPohled = (typeof BRANA_ANALYTIKA_POHLEDY)[number];
export type BranaAnalytikaRazPohledu = (typeof BRANA_ANALYTIKA_RAZY_POHLEDU)[number];
export type BranaAnalytikaMetrikaProchazeni =
  (typeof BRANA_ANALYTIKA_METRIKY_PROCHAZENI)[number];
export type BranaAnalytikaZarizeni = (typeof BRANA_ANALYTIKA_ZARIZENI)[number];
export type BranaAnalytikaSpusteni = (typeof BRANA_ANALYTIKA_SPUSTENI)[number];
export type BranaAnalytikaNavstevnik = (typeof BRANA_ANALYTIKA_NAVSTEVNICI)[number];
export type BranaAnalytikaOblast = (typeof BRANA_ANALYTIKA_OBLASTI)[number];

export type BranaAnalytikaPohledPocty = {
  prvni: number;
  dalsi: number;
};

export type BranaAnalytikaProchazeniPocty = {
  delsi: number;
  konec: number;
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
  /** Delší seznam a dosažený konec pro každý pohled. Chybějící údaj staršího dne je nula. */
  prochazeni: Record<BranaAnalytikaPohled, BranaAnalytikaProchazeniPocty>;
  proklikTrebon: number;
  /** Desktopový QR. Chybějící údaj staršího dne je nula a je součástí zdrojů qr. */
  qrDesktop: number;
  hodiny: number[];
  zarizeni: Record<BranaAnalytikaZarizeni, number>;
  spusteni: {
    ikona: number;
    prohlizec: number;
  };
  oblast: Record<BranaAnalytikaOblast, number>;
};

export type BranaAnalytikaDokument = {
  verze: typeof BRANA_ANALYTIKA_VERZE;
  dny: Record<string, BranaAnalytikaDen>;
  /**
   * Pražský den, od kterého se při návštěvě počítá zařízení.
   * Chybí nebo je null, dokud nový kód nezapíše první návštěvu.
   * Jednou uložená hodnota se při dalších zápisech nemění.
   */
  zarizeniMereniOd?: string | null;
};

/**
 * Návštěva, otevření pohledu, procházení seznamu, stisk sdílení,
 * nebo kliknutí na odkaz Třeboň po celý rok v zápatí.
 * Ostatní typy se odmítnou. Starší dávka `{ typ: "navsteva" }` zůstává platná.
 * Způsob spuštění a druh návštěvníka jsou volitelné.
 * Sdílení je jen `{ typ: "sdileni" }` a přičítá denní počet stisků.
 * Proklik je jen `{ typ: "proklikTrebon" }` a přičítá denní počet kliknutí.
 */
export type BranaAnalytikaUdalostSdileni = {
  typ: "sdileni";
};
export type BranaAnalytikaUdalostProklikTrebon = {
  typ: "proklikTrebon";
};
export type BranaAnalytikaUdalostNavstevy = {
  typ: "navsteva";
  spusteni?: BranaAnalytikaSpusteni;
  navstevnik?: BranaAnalytikaNavstevnik;
  /** QR nebo příchod ze sdíleného odkazu. Jeden zdroj na návštěvu. */
  zdroj?: "qr" | "sdileni";
  /** Desktopový QR. Smí být jen spolu se zdrojem qr a není další návštěva. */
  qrDesktop?: true;
};

export type BranaAnalytikaUdalostPohledu = {
  typ: "pohled";
  pohled: BranaAnalytikaPohled;
  raz: BranaAnalytikaRazPohledu;
};

export type BranaAnalytikaUdalostProchazeni = {
  typ: "prochazeni";
  pohled: BranaAnalytikaPohled;
  metrika: BranaAnalytikaMetrikaProchazeni;
};

export type BranaAnalytikaUdalost =
  | BranaAnalytikaUdalostNavstevy
  | BranaAnalytikaUdalostPohledu
  | BranaAnalytikaUdalostProchazeni
  | BranaAnalytikaUdalostSdileni
  | BranaAnalytikaUdalostProklikTrebon;

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
  const prochazeni = {} as Record<BranaAnalytikaPohled, BranaAnalytikaProchazeniPocty>;
  for (const pohled of BRANA_ANALYTIKA_POHLEDY) {
    pohledy[pohled] = { prvni: 0, dalsi: 0 };
    prochazeni[pohled] = { delsi: 0, konec: 0 };
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
    prochazeni,
    proklikTrebon: 0,
    qrDesktop: 0,
    hodiny: Array.from({ length: 24 }, () => 0),
    zarizeni,
    spusteni: { ikona: 0, prohlizec: 0 },
    oblast: { trebonsko: 0, mimo_trebonsko: 0, neurceno: 0 },
  };
}

export function prazdnyDokumentAnalytiky(): BranaAnalytikaDokument {
  return { verze: BRANA_ANALYTIKA_VERZE, dny: {}, zarizeniMereniOd: null };
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
  if (den.qrDesktop !== undefined) {
    if (!jeNezaporneCeleCislo(den.qrDesktop)) {
      return null;
    }
    vysledek.qrDesktop = den.qrDesktop;
  }

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

  if (den.oblast !== undefined) {
    if (!den.oblast || typeof den.oblast !== "object" || Array.isArray(den.oblast)) {
      return null;
    }
    const klice = Object.keys(den.oblast);
    if (klice.length !== BRANA_ANALYTIKA_OBLASTI.length) {
      return null;
    }
    for (const oblast of BRANA_ANALYTIKA_OBLASTI) {
      const pocet = den.oblast[oblast];
      if (!jeNezaporneCeleCislo(pocet)) {
        return null;
      }
      vysledek.oblast[oblast] = pocet;
    }
  }

  if (den.prochazeni !== undefined) {
    if (
      !den.prochazeni ||
      typeof den.prochazeni !== "object" ||
      Array.isArray(den.prochazeni)
    ) {
      return null;
    }
    const klice = Object.keys(den.prochazeni);
    if (klice.length !== BRANA_ANALYTIKA_POHLEDY.length) {
      return null;
    }
    for (const pohled of BRANA_ANALYTIKA_POHLEDY) {
      const pocty = den.prochazeni[pohled];
      if (!pocty || typeof pocty !== "object" || Array.isArray(pocty)) {
        return null;
      }
      const klicePoctu = Object.keys(pocty);
      if (
        klicePoctu.length !== 2 ||
        !jeNezaporneCeleCislo(pocty.delsi) ||
        !jeNezaporneCeleCislo(pocty.konec)
      ) {
        return null;
      }
      vysledek.prochazeni[pohled] = { delsi: pocty.delsi, konec: pocty.konec };
    }
  }

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

  const zarizeniMereniOd = precistZacatekMereniZarizeni(dokument);
  if (zarizeniMereniOd === "neplatne") {
    return null;
  }

  return { verze: BRANA_ANALYTIKA_VERZE, dny, zarizeniMereniOd };
}

/**
 * Chybějící pole starého souboru znamená, že měření ještě nezačalo.
 * Neplatná hodnota soubor nezahodí tichým přepsáním data.
 */
function precistZacatekMereniZarizeni(
  dokument: object,
): string | null | "neplatne" {
  if (!Object.prototype.hasOwnProperty.call(dokument, "zarizeniMereniOd")) {
    return null;
  }
  const hodnota = (dokument as { zarizeniMereniOd?: unknown }).zarizeniMereniOd;
  if (hodnota === null) {
    return null;
  }
  return jeIsoDen(hodnota) ? hodnota : "neplatne";
}

function jeIsoDen(hodnota: unknown): hodnota is string {
  if (typeof hodnota !== "string" || !KLIC_DNE.test(hodnota)) {
    return false;
  }
  const rok = Number(hodnota.slice(0, 4));
  const mesic = Number(hodnota.slice(5, 7));
  const den = Number(hodnota.slice(8, 10));
  const datum = new Date(Date.UTC(rok, mesic - 1, den));
  return (
    datum.getUTCFullYear() === rok &&
    datum.getUTCMonth() === mesic - 1 &&
    datum.getUTCDate() === den
  );
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
    const cista = vycistitUdalost(udalost);
    if (!cista) {
      return { ok: false };
    }
    ciste.push(cista);
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

const POVOLENE_KLICE_NAVSTEVY = new Set([
  "typ",
  "spusteni",
  "navstevnik",
  "zdroj",
  "qrDesktop",
]);
const POVOLENE_KLICE_POHLEDU = new Set(["typ", "pohled", "raz"]);
const POVOLENE_KLICE_PROCHAZENI = new Set(["typ", "pohled", "metrika"]);
const POVOLENE_KLICE_SDILENI = new Set(["typ"]);
const POVOLENE_KLICE_PROKLIK_TREBON = new Set(["typ"]);

function jeSpusteni(hodnota: unknown): hodnota is BranaAnalytikaSpusteni {
  return (BRANA_ANALYTIKA_SPUSTENI as readonly string[]).includes(
    hodnota as string,
  );
}

function jeNavstevnik(hodnota: unknown): hodnota is BranaAnalytikaNavstevnik {
  return (BRANA_ANALYTIKA_NAVSTEVNICI as readonly string[]).includes(
    hodnota as string,
  );
}

function vycistitUdalost(raw: unknown): BranaAnalytikaUdalost | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const zaznam = raw as Record<string, unknown>;
  if (zaznam.typ === "pohled") {
    return vycistitUdalostPohledu(zaznam);
  }
  if (zaznam.typ === "prochazeni") {
    return vycistitUdalostProchazeni(zaznam);
  }
  if (zaznam.typ === "sdileni") {
    return vycistitUdalostSdileni(zaznam);
  }
  if (zaznam.typ === "proklikTrebon") {
    return vycistitUdalostProklikTrebon(zaznam);
  }
  return vycistitUdalostNavstevy(raw);
}

function vycistitUdalostProklikTrebon(
  zaznam: Record<string, unknown>,
): BranaAnalytikaUdalostProklikTrebon | null {
  for (const klic of Object.keys(zaznam)) {
    if (!POVOLENE_KLICE_PROKLIK_TREBON.has(klic)) {
      return null;
    }
  }
  if (zaznam.typ !== "proklikTrebon") {
    return null;
  }

  return { typ: "proklikTrebon" };
}

function vycistitUdalostSdileni(
  zaznam: Record<string, unknown>,
): BranaAnalytikaUdalostSdileni | null {
  for (const klic of Object.keys(zaznam)) {
    if (!POVOLENE_KLICE_SDILENI.has(klic)) {
      return null;
    }
  }
  if (zaznam.typ !== "sdileni") {
    return null;
  }

  return { typ: "sdileni" };
}

function vycistitUdalostProchazeni(
  zaznam: Record<string, unknown>,
): BranaAnalytikaUdalostProchazeni | null {
  for (const klic of Object.keys(zaznam)) {
    if (!POVOLENE_KLICE_PROCHAZENI.has(klic)) {
      return null;
    }
  }
  if (!jePohled(zaznam.pohled) || !jeMetrikaProchazeni(zaznam.metrika)) {
    return null;
  }

  return { typ: "prochazeni", pohled: zaznam.pohled, metrika: zaznam.metrika };
}

function vycistitUdalostPohledu(
  zaznam: Record<string, unknown>,
): BranaAnalytikaUdalostPohledu | null {
  for (const klic of Object.keys(zaznam)) {
    if (!POVOLENE_KLICE_POHLEDU.has(klic)) {
      return null;
    }
  }
  if (!jePohled(zaznam.pohled) || !jeRazPohledu(zaznam.raz)) {
    return null;
  }

  return { typ: "pohled", pohled: zaznam.pohled, raz: zaznam.raz };
}

/** Vrátí očištěnou návštěvu, nebo null když dávka obsahuje cizí údaj. */
function vycistitUdalostNavstevy(raw: unknown): BranaAnalytikaUdalostNavstevy | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const zaznam = raw as Record<string, unknown>;
  for (const klic of Object.keys(zaznam)) {
    if (!POVOLENE_KLICE_NAVSTEVY.has(klic)) {
      return null;
    }
  }
  if (zaznam.typ !== "navsteva") {
    return null;
  }

  const cista: BranaAnalytikaUdalostNavstevy = { typ: "navsteva" };
  if ("spusteni" in zaznam) {
    if (!jeSpusteni(zaznam.spusteni)) {
      return null;
    }
    cista.spusteni = zaznam.spusteni;
  }
  if ("navstevnik" in zaznam) {
    if (!jeNavstevnik(zaznam.navstevnik)) {
      return null;
    }
    cista.navstevnik = zaznam.navstevnik;
  }
  if ("zdroj" in zaznam || "qrDesktop" in zaznam) {
    if (zaznam.zdroj === "sdileni") {
      if ("qrDesktop" in zaznam) {
        return null;
      }
      cista.zdroj = "sdileni";
    } else if (zaznam.zdroj === "qr") {
      cista.zdroj = "qr";
      if ("qrDesktop" in zaznam) {
        if (zaznam.qrDesktop !== true) {
          return null;
        }
        cista.qrDesktop = true;
      }
    } else {
      return null;
    }
  }

  return cista;
}

function jePohled(hodnota: unknown): hodnota is BranaAnalytikaPohled {
  return (BRANA_ANALYTIKA_POHLEDY as readonly string[]).includes(hodnota as string);
}

function jeMetrikaProchazeni(
  hodnota: unknown,
): hodnota is BranaAnalytikaMetrikaProchazeni {
  return (BRANA_ANALYTIKA_METRIKY_PROCHAZENI as readonly string[]).includes(
    hodnota as string,
  );
}

function jeRazPohledu(hodnota: unknown): hodnota is BranaAnalytikaRazPohledu {
  return (BRANA_ANALYTIKA_RAZY_POHLEDU as readonly string[]).includes(
    hodnota as string,
  );
}

function jeOblast(hodnota: unknown): hodnota is BranaAnalytikaOblast {
  return (BRANA_ANALYTIKA_OBLASTI as readonly string[]).includes(hodnota as string);
}

function jeZarizeni(hodnota: unknown): hodnota is BranaAnalytikaZarizeni {
  return (BRANA_ANALYTIKA_ZARIZENI as readonly string[]).includes(hodnota as string);
}

function pricistProchazeni(
  den: BranaAnalytikaDen,
  udalost: BranaAnalytikaUdalostProchazeni,
): BranaAnalytikaDen {
  const pocty = { ...den.prochazeni[udalost.pohled] };
  pocty[udalost.metrika] += 1;
  if (!Number.isSafeInteger(pocty[udalost.metrika])) {
    throw new Error(
      "Počet procházení přesáhl bezpečný rozsah. Nic nebylo uloženo.",
    );
  }

  return {
    ...den,
    prochazeni: {
      ...den.prochazeni,
      [udalost.pohled]: pocty,
    },
  };
}

function pricistPohled(
  den: BranaAnalytikaDen,
  udalost: BranaAnalytikaUdalostPohledu,
): BranaAnalytikaDen {
  const pocty = { ...den.pohledy[udalost.pohled] };
  pocty[udalost.raz] += 1;
  if (!Number.isSafeInteger(pocty[udalost.raz])) {
    throw new Error(
      "Počet otevření pohledu přesáhl bezpečný rozsah. Nic nebylo uloženo.",
    );
  }

  return {
    ...den,
    pohledy: {
      ...den.pohledy,
      [udalost.pohled]: pocty,
    },
  };
}

function pricistSdileni(den: BranaAnalytikaDen): BranaAnalytikaDen {
  const sdileniKlik = den.sdileniKlik + 1;
  if (!Number.isSafeInteger(sdileniKlik)) {
    throw new Error("Počet sdílení přesáhl bezpečný rozsah. Nic nebylo uloženo.");
  }

  return { ...den, sdileniKlik };
}

function pricistProklikTrebon(den: BranaAnalytikaDen): BranaAnalytikaDen {
  const proklikTrebon = den.proklikTrebon + 1;
  if (!Number.isSafeInteger(proklikTrebon)) {
    throw new Error("Počet prokliků přesáhl bezpečný rozsah. Nic nebylo uloženo.");
  }

  return { ...den, proklikTrebon };
}

function pricistNavstevu(
  den: BranaAnalytikaDen,
  udalost: BranaAnalytikaUdalostNavstevy,
  oblast?: BranaAnalytikaOblast,
  zarizeni?: BranaAnalytikaZarizeni,
): BranaAnalytikaDen {
  const navstevy = den.navstevy + 1;
  const spusteni = { ...den.spusteni };
  if (udalost.spusteni) {
    spusteni[udalost.spusteni] += 1;
  }
  const novi = den.novi + (udalost.navstevnik === "novy" ? 1 : 0);
  const vracejici = den.vracejici + (udalost.navstevnik === "vracejici" ? 1 : 0);
  const poctyOblasti = { ...den.oblast };
  if (jeOblast(oblast)) {
    poctyOblasti[oblast] += 1;
  }
  const poctyZarizeni = { ...den.zarizeni };
  const kategorie = jeZarizeni(zarizeni) ? zarizeni : "ostatni";
  poctyZarizeni[kategorie] += 1;
  const zdroje = { ...den.zdroje };
  let qrDesktop = den.qrDesktop;
  if (udalost.zdroj === "qr") {
    zdroje.qr += 1;
    if (udalost.qrDesktop) {
      qrDesktop += 1;
    }
  } else if (udalost.zdroj === "sdileni") {
    zdroje.sdileni += 1;
  }
  const pocty = [
    navstevy,
    spusteni.ikona,
    spusteni.prohlizec,
    novi,
    vracejici,
    poctyOblasti.trebonsko,
    poctyOblasti.mimo_trebonsko,
    poctyOblasti.neurceno,
    poctyZarizeni.android,
    poctyZarizeni.ios,
    poctyZarizeni.pocitac,
    poctyZarizeni.ostatni,
    zdroje.qr,
    zdroje.sdileni,
    qrDesktop,
  ];

  if (pocty.some((hodnota) => !Number.isSafeInteger(hodnota))) {
    throw new Error("Počet návštěv přesáhl bezpečný rozsah. Nic nebylo uloženo.");
  }

  return {
    ...den,
    navstevy,
    novi,
    vracejici,
    spusteni,
    oblast: poctyOblasti,
    zarizeni: poctyZarizeni,
    zdroje,
    qrDesktop,
  };
}

/**
 * Přičte návštěvu, otevření pohledu, procházení seznamu, stisk sdílení,
 * nebo kliknutí na odkaz Třeboň po celý rok.
 * Oblast a zařízení jsou odhad serveru a přičítají se jen k návštěvě.
 * Jedna návštěva zvýší právě jedno počítadlo zařízení.
 * Stisk sdílení mění jen denní počet sdílení.
 * Proklik mění jen denní počet kliknutí na zápatí.
 * Starší pole konce obsahu u dvou pohledů se těmito událostmi nemění.
 * Začátek měření zařízení se zapíše při první návštěvě a dál se nemění.
 */
export function aplikovatDavkuAnalytiky(
  dokument: BranaAnalytikaDokument,
  udalosti: readonly BranaAnalytikaUdalost[],
  referencniCas: Date,
  oblast?: BranaAnalytikaOblast,
  zarizeni?: BranaAnalytikaZarizeni,
): BranaAnalytikaDokument {
  const denKlic = isoDenZData(dnesVPraze(referencniCas));
  const dny = orezatStareDny(dokument.dny, referencniCas);
  let den = dny[denKlic] ?? prazdnyDenAnalytiky();
  const maNavstevu = udalosti.some((udalost) => udalost.typ === "navsteva");
  const stavajici = dokument.zarizeniMereniOd;
  const zarizeniMereniOd =
    jeIsoDen(stavajici) ? stavajici : maNavstevu ? denKlic : (stavajici ?? null);

  for (const udalost of udalosti) {
    if (udalost.typ === "pohled") {
      den = pricistPohled(den, udalost);
    } else if (udalost.typ === "prochazeni") {
      den = pricistProchazeni(den, udalost);
    } else if (udalost.typ === "sdileni") {
      den = pricistSdileni(den);
    } else if (udalost.typ === "proklikTrebon") {
      den = pricistProklikTrebon(den);
    } else {
      den = pricistNavstevu(den, udalost, oblast, zarizeni);
    }
  }

  dny[denKlic] = den;
  return { verze: BRANA_ANALYTIKA_VERZE, dny, zarizeniMereniOd };
}
