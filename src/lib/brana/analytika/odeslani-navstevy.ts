import {
  validovatDavkuAnalytiky,
  type BranaAnalytikaNavstevnik,
  type BranaAnalytikaPohled,
  type BranaAnalytikaSpusteni,
  type BranaAnalytikaUdalost,
  type BranaAnalytikaUdalostNavstevy,
  type BranaAnalytikaUdalostProchazeni,
} from "./model";
import {
  nacistDruhNavstevnika,
  oznacitPrvniPrijatouNavstevu,
  rozhodnoutOtevreniPohledu,
  rozhodnoutZacatekNavstevy,
  type BranaNavstevaUloziste,
  type BranaNavstevaVstup,
} from "./navsteva-klient";
import { smazatZnackyProchazeni } from "./prochazeni-obsahu";
import { jeBranaAnalytikaVyloucena } from "./vylouceni-zarizeni";

/** Stejná cesta, kterou už přijímá vypnutý endpoint BRÁNY. */
export const BRANA_ANALYTIKA_ODESLANI_CESTA = "/api/brana/analytika";

export type BranaAnalytikaPozadavek = {
  method: "POST";
  headers: { "Content-Type": "application/json" };
  body: string;
  credentials: "omit";
  keepalive: true;
};

export type BranaAnalytikaOdpoved = {
  ok?: boolean;
  status?: number;
};

export type BranaAnalytikaOdesilac = (
  url: string,
  pozadavek: BranaAnalytikaPozadavek,
) => Promise<BranaAnalytikaOdpoved | void>;

export type BranaOdeslaniVysledek = {
  pokusu: 0 | 1;
  odeslano: boolean;
};

/**
 * Sestaví jednu dávku návštěvy. Cizí údaje do těla nepatří.
 * Bez způsobu spuštění se požadavek nesestaví.
 */
export function sestavitPozadavekNavstevy(
  udalost: BranaAnalytikaUdalost,
): BranaAnalytikaPozadavek | null {
  if (udalost.typ !== "navsteva" || !jeSpusteni(udalost.spusteni)) {
    return null;
  }

  const cista: BranaAnalytikaUdalostNavstevy = {
    typ: "navsteva",
    spusteni: udalost.spusteni,
  };
  if (jeNavstevnik(udalost.navstevnik)) {
    cista.navstevnik = udalost.navstevnik;
  }
  prepsatQr(cista, udalost);

  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ udalosti: [cista] }),
    credentials: "omit",
    keepalive: true,
  };
}

/** Společná brána pro návštěvu i každý budoucí typ události. */
export function jeOdeslaniBranaAnalytikyPovoleno(): boolean {
  try {
    return !jeBranaAnalytikaVyloucena();
  } catch {
    return true;
  }
}

function sestavitPozadavekDavky(
  udalosti: readonly BranaAnalytikaUdalost[],
): BranaAnalytikaPozadavek | null {
  const davka = validovatDavkuAnalytiky({ udalosti: [...udalosti] });
  if (!davka.ok) {
    return null;
  }

  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ udalosti: davka.udalosti }),
    credentials: "omit",
    keepalive: true,
  };
}

/** Jeden pokus. Neúspěch se neopakuje a fronta se nezakládá. */
async function odeslatPripravenyPozadavek(
  pozadavek: BranaAnalytikaPozadavek | null,
  odeslat: BranaAnalytikaOdesilac,
): Promise<BranaOdeslaniVysledek> {
  if (!pozadavek || !jeOdeslaniBranaAnalytikyPovoleno()) {
    return { pokusu: 0, odeslano: false };
  }

  try {
    const odpoved = await odeslat(BRANA_ANALYTIKA_ODESLANI_CESTA, pozadavek);
    return { pokusu: 1, odeslano: odpoved?.ok === true };
  } catch {
    return { pokusu: 1, odeslano: false };
  }
}

/** Jedno kliknutí na odkaz Třeboň po celý rok. Neúspěch se neopakuje a fronta se nezakládá. */
export async function odeslatKlikNaTrebon(
  odeslat: BranaAnalytikaOdesilac,
): Promise<BranaOdeslaniVysledek> {
  if (!jeOdeslaniBranaAnalytikyPovoleno()) {
    return { pokusu: 0, odeslano: false };
  }

  return odeslatPripravenyPozadavek(
    sestavitPozadavekDavky([{ typ: "proklikTrebon" }]),
    odeslat,
  );
}

/** Jeden stisk sdílení. Neúspěch se neopakuje a fronta se nezakládá. */
export async function odeslatKlikSdileni(
  odeslat: BranaAnalytikaOdesilac,
): Promise<BranaOdeslaniVysledek> {
  if (!jeOdeslaniBranaAnalytikyPovoleno()) {
    return { pokusu: 0, odeslano: false };
  }

  return odeslatPripravenyPozadavek(
    sestavitPozadavekDavky([{ typ: "sdileni" }]),
    odeslat,
  );
}

/** Jeden pokus. Neúspěch se neopakuje a fronta se nezakládá. */
export async function odeslatUdalostiProchazeni(
  udalosti: readonly BranaAnalytikaUdalostProchazeni[],
  odeslat: BranaAnalytikaOdesilac,
): Promise<BranaOdeslaniVysledek> {
  if (!jeOdeslaniBranaAnalytikyPovoleno() || udalosti.length === 0) {
    return { pokusu: 0, odeslano: false };
  }

  return odeslatPripravenyPozadavek(sestavitPozadavekDavky(udalosti), odeslat);
}

/** Jeden pokus. Neúspěch se neopakuje a fronta se nezakládá. */
export async function odeslatJednuNavstevu(
  udalost: BranaAnalytikaUdalost,
  odeslat: BranaAnalytikaOdesilac,
): Promise<BranaOdeslaniVysledek> {
  if (!jeOdeslaniBranaAnalytikyPovoleno()) {
    return { pokusu: 0, odeslano: false };
  }

  return odeslatPripravenyPozadavek(sestavitPozadavekNavstevy(udalost), odeslat);
}

/**
 * Odešle jen nově rozpoznanou návštěvu.
 * Samo se nespouští a při chybě neblokuje volajícího výjimkou.
 */
export async function odeslatRozpoznanouNavstevu(
  vstup: BranaNavstevaVstup,
  odeslat: BranaAnalytikaOdesilac,
  trvaleUloziste?: BranaNavstevaUloziste | null,
  pohled?: BranaAnalytikaPohled,
): Promise<BranaOdeslaniVysledek> {
  try {
    if (!jeOdeslaniBranaAnalytikyPovoleno()) {
      return { pokusu: 0, odeslano: false };
    }
    const rozhodnuti = rozhodnoutZacatekNavstevy(vstup);
    if (!rozhodnuti.zaznamenat && rozhodnuti.duvod === "uloziste-nedostupne") {
      return { pokusu: 0, odeslano: false };
    }

    const otevreni =
      pohled === undefined
        ? null
        : rozhodnoutOtevreniPohledu(
            vstup.uloziste,
            pohled,
            rozhodnuti.zaznamenat,
          );

    if (rozhodnuti.zaznamenat) {
      smazatZnackyProchazeni(vstup.uloziste);
      const udalost = doplnitDruhNavstevnika(rozhodnuti.udalost, trvaleUloziste);
      const vysledek = otevreni
        ? await odeslatPripravenyPozadavek(
            sestavitPozadavekDavky([udalost, otevreni]),
            odeslat,
          )
        : await odeslatJednuNavstevu(udalost, odeslat);
      if (vysledek.odeslano && udalost.navstevnik === "novy" && trvaleUloziste) {
        oznacitPrvniPrijatouNavstevu(trvaleUloziste);
      }
      return vysledek;
    }

    if (otevreni) {
      return odeslatPripravenyPozadavek(sestavitPozadavekDavky([otevreni]), odeslat);
    }
    return { pokusu: 0, odeslano: false };
  } catch {
    return { pokusu: 0, odeslano: false };
  }
}

function doplnitDruhNavstevnika(
  udalost: BranaAnalytikaUdalostNavstevy,
  trvaleUloziste: BranaNavstevaUloziste | null | undefined,
): BranaAnalytikaUdalostNavstevy {
  if (trvaleUloziste === undefined) {
    return udalost;
  }

  const druh = nacistDruhNavstevnika(trvaleUloziste);
  const cista: BranaAnalytikaUdalostNavstevy = {
    typ: "navsteva",
    spusteni: udalost.spusteni,
  };
  if (druh) {
    cista.navstevnik = druh;
  }
  prepsatQr(cista, udalost);
  return cista;
}

function prepsatQr(
  cil: BranaAnalytikaUdalostNavstevy,
  zdroj: BranaAnalytikaUdalostNavstevy,
): void {
  if (zdroj.zdroj === "sdileni") {
    cil.zdroj = "sdileni";
    return;
  }
  if (zdroj.zdroj !== "qr") {
    return;
  }
  cil.zdroj = "qr";
  if (zdroj.qrDesktop) {
    cil.qrDesktop = true;
  }
}

function jeSpusteni(hodnota: unknown): hodnota is BranaAnalytikaSpusteni {
  return hodnota === "ikona" || hodnota === "prohlizec";
}

function jeNavstevnik(hodnota: unknown): hodnota is BranaAnalytikaNavstevnik {
  return hodnota === "novy" || hodnota === "vracejici";
}
