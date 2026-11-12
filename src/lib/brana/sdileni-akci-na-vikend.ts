import { okamzikVPraze } from "@/lib/brana/cas";
import {
  dalsiZmenaStavuZameckehoParku,
  stavZameckehoParku,
  verejnaVetaZameckehoParku,
} from "@/lib/brana/zamecky-park";

/**
 * Jedno sdělení na místě parku.
 * Další věta může dostat vlastní popisek, dny a výpočet
 * ze stejných už načtených událostí. Místo zůstává jeden odstavec.
 */
export const POPISEK_AKCI_NA_VIKEND = "Akcí na víkend";

const DEN_PONDELI = 1;
const DEN_CTVRTEK = 4;

export function isoDenPrahy(okamzik: Date): string {
  const praha = okamzikVPraze(okamzik);
  const mesic = String(praha.mesic).padStart(2, "0");
  const den = String(praha.den).padStart(2, "0");
  return `${praha.rok}-${mesic}-${den}`;
}

/** Pondělí nebo čtvrtek a přirozený stav parku „nic“. Skrytí parku okno nerozšiřuje. */
export function jeOknoAkciNaVikend(okamzik: Date): boolean {
  const den = okamzikVPraze(okamzik).denVTydnu;
  if (den !== DEN_PONDELI && den !== DEN_CTVRTEK) {
    return false;
  }
  return stavZameckehoParku(okamzik) === "nic";
}

export function pocetRadkuVikendoveProjekce(
  bloky: readonly (readonly unknown[])[] | undefined,
): number | null {
  if (!bloky) {
    return null;
  }
  let soucet = 0;
  for (const blok of bloky) {
    soucet += blok.length;
  }
  if (!Number.isInteger(soucet) || soucet < 0) {
    return null;
  }
  return soucet;
}

/**
 * Věta patří na obrazovku jen s kladným počtem z téhož pražského dne
 * a jen dokud je park ve stavu „nic“.
 */
export function maSeZobrazitAkciNaVikend(
  okamzik: Date,
  pocet: number | null,
  oknoIso: string | null,
): boolean {
  if (pocet == null || !Number.isInteger(pocet) || pocet < 1) {
    return false;
  }
  if (!oknoIso || isoDenPrahy(okamzik) !== oknoIso) {
    return false;
  }
  return jeOknoAkciNaVikend(okamzik);
}

/** Další hranice, kdy se viditelnost může změnit. Bez posunu za čas parku. */
export function dalsiKontrolaAkciNaVikend(okamzik: Date): Date {
  return dalsiZmenaStavuZameckehoParku(okamzik);
}

/**
 * Selhání výpočtu čísla nechá původní data a nevrátí počet.
 * Nula zůstane nulou; větu z ní neskládá volající.
 */
export function pripojitVolitelnyPocet<T>(
  data: T,
  spocitat: () => { pocet: number | null; oknoIso: string | null },
): { data: T; pocet: number | null; oknoIso: string | null } {
  try {
    const vysledek = spocitat();
    return {
      data,
      pocet: vysledek.pocet,
      oknoIso: vysledek.oknoIso,
    };
  } catch {
    return { data, pocet: null, oknoIso: null };
  }
}

/** Sdělení a věta parku nemohou platit v jednom okamžiku. */
export function vetaParkuASdeleniSeNekryji(
  okamzik: Date,
  pocet: number | null,
  oknoIso: string | null,
  parkSkrytoDo: string | null,
): boolean {
  const sdeleni = maSeZobrazitAkciNaVikend(okamzik, pocet, oknoIso);
  const park = verejnaVetaZameckehoParku(okamzik, parkSkrytoDo) !== null;
  return !(sdeleni && park);
}

const OKNO_ISO = /^\d{4}-\d{2}-\d{2}$/;

export type NacteniSkrytiAkciNaVikend =
  | { stav: "neni" }
  | { stav: "ok"; skrytoDo: string | null; oknoIso: string | null }
  | { stav: "chyba" };

/** Konec dnešního okna. Mimo okno null, takže skrytí dopředu uložit nejde. */
export function konecAktualnihoOknaAkciNaVikend(okamzik: Date): Date | null {
  if (!jeOknoAkciNaVikend(okamzik)) {
    return null;
  }
  return dalsiKontrolaAkciNaVikend(okamzik);
}

export function jePlatneSkrytiAkciNaVikend(hodnota: unknown): hodnota is string {
  return typeof hodnota === "string" && Number.isFinite(Date.parse(hodnota));
}

export function jePlatneOknoIsoAkciNaVikend(hodnota: unknown): hodnota is string {
  return typeof hodnota === "string" && OKNO_ISO.test(hodnota);
}

/**
 * Dokument nese jen konec skrytí a den okna.
 * Počet akcí do něj nepatří. Poškozený dokument není platné skrytí.
 */
export function parsovatDokumentSkrytiAkciNaVikend(
  surovy: unknown,
):
  | { ok: true; skrytoDo: string | null; oknoIso: string | null }
  | { ok: false } {
  if (!surovy || typeof surovy !== "object") {
    return { ok: false };
  }
  const root = surovy as Record<string, unknown>;
  if (root.verze !== 1) {
    return { ok: false };
  }
  const bezSkryti = root.skrytoDo === null || root.skrytoDo === undefined;
  const bezOkna = root.oknoIso === null || root.oknoIso === undefined;
  if (bezSkryti && bezOkna) {
    return { ok: true, skrytoDo: null, oknoIso: null };
  }
  if (
    !jePlatneSkrytiAkciNaVikend(root.skrytoDo) ||
    !jePlatneOknoIsoAkciNaVikend(root.oknoIso)
  ) {
    return { ok: false };
  }
  return { ok: true, skrytoDo: root.skrytoDo, oknoIso: root.oknoIso };
}

export function nacteniSkrytiAkciNaVikendZDokumentu(
  surovy: unknown,
): NacteniSkrytiAkciNaVikend {
  const dokument = parsovatDokumentSkrytiAkciNaVikend(surovy);
  if (!dokument.ok) {
    return { stav: "chyba" };
  }
  return {
    stav: "ok",
    skrytoDo: dokument.skrytoDo,
    oknoIso: dokument.oknoIso,
  };
}

/**
 * Čtení, které spadne nebo vrátí neznámý tvar, je chyba.
 * Volající pak větu neukáže a zbytek stránky nechá být.
 */
export function chranitCteniSkrytiAkciNaVikend(
  cist: () => NacteniSkrytiAkciNaVikend,
): NacteniSkrytiAkciNaVikend {
  try {
    const nacteni = cist();
    if (
      nacteni &&
      (nacteni.stav === "ok" ||
        nacteni.stav === "neni" ||
        nacteni.stav === "chyba")
    ) {
      return nacteni;
    }
    return { stav: "chyba" };
  } catch {
    return { stav: "chyba" };
  }
}

/**
 * Skrytí platí jen pro uložený pražský den a jen do konce jeho okna.
 * Starší i pozdější čas další okno neskryje.
 */
export function jeAkciNaVikendRucneSkryte(
  okamzik: Date,
  skrytoDo: string | null,
  oknoIso: string | null,
): boolean {
  if (
    !jePlatneSkrytiAkciNaVikend(skrytoDo) ||
    !jePlatneOknoIsoAkciNaVikend(oknoIso)
  ) {
    return false;
  }
  if (oknoIso !== isoDenPrahy(okamzik) || !jeOknoAkciNaVikend(okamzik)) {
    return false;
  }
  const konec = Date.parse(skrytoDo);
  const konecOkna = dalsiKontrolaAkciNaVikend(okamzik).getTime();
  return okamzik.getTime() < konec && konec <= konecOkna;
}

/**
 * Chyba čtení nebo platné skrytí vezme větě počet.
 * Samotný výpočet počtu se nemění; ven jde jen nový pár hodnot.
 */
export function uplatnitSkrytiAkciNaVikend(
  okamzik: Date,
  pocet: number | null,
  oknoIso: string | null,
  nacteni: NacteniSkrytiAkciNaVikend,
): { pocet: number | null; oknoIso: string | null } {
  const bezpecne = chranitCteniSkrytiAkciNaVikend(() => nacteni);
  if (bezpecne.stav === "chyba") {
    return { pocet: null, oknoIso: null };
  }
  const skrytoDo = bezpecne.stav === "ok" ? bezpecne.skrytoDo : null;
  const oknoSkryti = bezpecne.stav === "ok" ? bezpecne.oknoIso : null;
  if (jeAkciNaVikendRucneSkryte(okamzik, skrytoDo, oknoSkryti)) {
    return { pocet: null, oknoIso: null };
  }
  return { pocet, oknoIso };
}
