import {
  dnesVPraze,
  okamzikVPraze,
  okamzikZPrahy,
  pridatDny,
} from "@/lib/brana/cas";
import {
  dalsiZmenaStavuZameckehoParku,
  dalsiZmenaVerejnehoTextuParku,
  stavZameckehoParku,
  verejnaVetaZameckehoParku,
} from "@/lib/brana/zamecky-park";

/**
 * Jedno sdělení na místě parku.
 * Další věta může dostat vlastní popisek, dny a výpočet
 * ze stejných už načtených událostí. Místo zůstává jeden odstavec.
 */
export const POPISEK_AKCI_NA_VIKEND = "Akcí na víkend";
export const DODATEK_TRHY_JSOU = " · a jsou trhy";
export const DODATEK_TRHY_NEJSOU = " · trhy nejsou";

const DEN_PONDELI = 1;
const DEN_CTVRTEK = 4;
const PISMENO = "a-záčďéěíňóřšťúůýž";
const VYRAZ_SLOVA_TRHU = new RegExp(
  `(^|[^${PISMENO}])(?:trzích|trhů|trhem|trhu|trhy|trh|jarmark)(?=$|[^${PISMENO}])`,
);

export function isoDenPrahy(okamzik: Date): string {
  const praha = okamzikVPraze(okamzik);
  const mesic = String(praha.mesic).padStart(2, "0");
  const den = String(praha.den).padStart(2, "0");
  return `${praha.rok}-${mesic}-${den}`;
}

function jeDenVikendovehoSdeleni(okamzik: Date): boolean {
  const den = okamzikVPraze(okamzik).denVTydnu;
  return den === DEN_PONDELI || den === DEN_CTVRTEK;
}

/** Půlnoc následujícího pražského dne. Konec večerního návratu sdělení. */
export function pulnocPoDniPrahy(okamzik: Date): Date {
  const dalsi = pridatDny(dnesVPraze(okamzik), 1);
  return okamzikZPrahy(dalsi.rok, dalsi.mesic, dalsi.den, 0, 0);
}

/**
 * Večer po zavření téhož dne. Ráno 00:00–07:00 sem nepatří:
 * další změna stavu je ještě dnešní sedmá hodina.
 */
function jeVecerPoZavreniParku(okamzik: Date): boolean {
  if (stavZameckehoParku(okamzik) !== "zavreno") {
    return false;
  }
  return isoDenPrahy(dalsiZmenaStavuZameckehoParku(okamzik)) !== isoDenPrahy(okamzik);
}

/**
 * Pondělí nebo čtvrtek, od 7:00 do začátku upozornění parku
 * a znovu od zavření do půlnoci. Skrytí parku okno nerozšiřuje.
 */
export function jeOknoAkciNaVikend(okamzik: Date): boolean {
  if (!jeDenVikendovehoSdeleni(okamzik)) {
    return false;
  }
  if (stavZameckehoParku(okamzik) === "nic") {
    return true;
  }
  return jeVecerPoZavreniParku(okamzik);
}

/**
 * Počet se připraví i během upozornění parku.
 * Věta v tu chvíli nesvítí, otevřená stránka ji po zavření ukáže bez nového požadavku.
 * Ráno před sedmou a ostatní dny se nepočítá.
 */
export function maSePripravitPocetAkciNaVikend(okamzik: Date): boolean {
  if (!jeDenVikendovehoSdeleni(okamzik)) {
    return false;
  }
  if (jeOknoAkciNaVikend(okamzik)) {
    return true;
  }
  return stavZameckehoParku(okamzik) === "brzy";
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
 * a jen v pondělním nebo čtvrtečním okně.
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

/**
 * Další hranice viditelnosti. V pondělí a ve čtvrtek večer je to půlnoc,
 * jinak nejbližší změna stavu parku.
 */
export function dalsiKontrolaAkciNaVikend(okamzik: Date): Date {
  const park = dalsiZmenaStavuZameckehoParku(okamzik);
  if (!jeDenVikendovehoSdeleni(okamzik)) {
    return park;
  }
  const pulnoc = pulnocPoDniPrahy(okamzik);
  return pulnoc.getTime() < park.getTime() ? pulnoc : park;
}

/**
 * Park si v pondělí a ve čtvrtek večer připočte půlnoc,
 * aby se zavřená věta vrátila, až víkendové sdělení skončí.
 * Ostatní dny zůstávají na původní hranici parku.
 */
export function dalsiPrekresleniParkuVedleVikendu(
  okamzik: Date,
  skrytoDo: string | null,
): Date {
  const park = dalsiZmenaVerejnehoTextuParku(okamzik, skrytoDo);
  if (!jeDenVikendovehoSdeleni(okamzik)) {
    return park;
  }
  const pulnoc = pulnocPoDniPrahy(okamzik);
  return pulnoc.getTime() < park.getTime() ? pulnoc : park;
}

/**
 * Selhání výpočtu čísla nechá původní data a nevrátí počet.
 * Nula zůstane nulou; větu z ní neskládá volající.
 */
export function pripojitVolitelnyPocet<T>(
  data: T,
  spocitat: () => {
    pocet: number | null;
    oknoIso: string | null;
    jsouTrhy?: boolean | null;
  },
): {
  data: T;
  pocet: number | null;
  oknoIso: string | null;
  jsouTrhy: boolean | null;
} {
  try {
    const vysledek = spocitat();
    const pocet = vysledek.pocet;
    const jsouTrhy =
      pocet != null && pocet > 0 && typeof vysledek.jsouTrhy === "boolean"
        ? vysledek.jsouTrhy
        : null;
    return {
      data,
      pocet,
      oknoIso: vysledek.oknoIso,
      jsouTrhy,
    };
  } catch {
    return { data, pocet: null, oknoIso: null, jsouTrhy: null };
  }
}

/**
 * Věta parku, která smí být vedle víkendového sdělení.
 * Dokud sdělení svítí, zavřený park se neukáže.
 */
export function vetaParkuVedleAkciNaVikend(
  okamzik: Date,
  pocet: number | null,
  oknoIso: string | null,
  parkSkrytoDo: string | null,
): string | null {
  const veta = verejnaVetaZameckehoParku(okamzik, parkSkrytoDo);
  if (maSeZobrazitAkciNaVikend(okamzik, pocet, oknoIso)) {
    return null;
  }
  return veta;
}

/** Sdělení a věta parku nemohou platit v jednom okamžiku. */
export function vetaParkuASdeleniSeNekryji(
  okamzik: Date,
  pocet: number | null,
  oknoIso: string | null,
  parkSkrytoDo: string | null,
): boolean {
  const sdeleni = maSeZobrazitAkciNaVikend(okamzik, pocet, oknoIso);
  const park =
    vetaParkuVedleAkciNaVikend(okamzik, pocet, oknoIso, parkSkrytoDo) !== null;
  return !(sdeleni && park);
}

export type UdalostProRozpoznaniTrhu = {
  redakcniPolozkaId: string | null;
  nazev: string;
  mistoNeboTyp: string;
  verejneCo?: string | null;
  verejneRozliseni?: string | null;
};

/** Samostatné slovo trh / jarmark. Ne podřetězec uvnitř jiného slova. */
export function textObsahujeSlovoTrhu(text: string): boolean {
  return VYRAZ_SLOVA_TRHU.test(text.toLocaleLowerCase("cs-CZ"));
}

/**
 * Trh je schválená položka „trhy“, nebo ruční událost,
 * jejíž název či veřejné označení nese samostatné slovo trh.
 */
export function jeUdalostTrhem(udalost: UdalostProRozpoznaniTrhu): boolean {
  if (udalost.redakcniPolozkaId === "trhy") {
    return true;
  }
  if (udalost.redakcniPolozkaId !== null) {
    return false;
  }
  const text = [
    udalost.nazev,
    udalost.mistoNeboTyp,
    udalost.verejneCo,
    udalost.verejneRozliseni,
  ]
    .filter((cast): cast is string => typeof cast === "string" && cast.length > 0)
    .join("\n");
  return textObsahujeSlovoTrhu(text);
}

const OKNO_ISO = /^\d{4}-\d{2}-\d{2}$/;

export type NacteniSkrytiAkciNaVikend =
  | { stav: "neni" }
  | { stav: "ok"; skrytoDo: string | null; oknoIso: string | null }
  | { stav: "chyba" };

/**
 * Skrytí platí do půlnoci téhož pražského dne.
 * Mimo okno null, takže skrytí dopředu uložit nejde.
 */
export function konecAktualnihoOknaAkciNaVikend(okamzik: Date): Date | null {
  if (!jeOknoAkciNaVikend(okamzik)) {
    return null;
  }
  return pulnocPoDniPrahy(okamzik);
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
 * Skrytí platí jen pro uložený pražský den a jen do jeho půlnoci.
 * Drží i přes upozornění parku, takže večer se věta sama nevrátí.
 * Starší i pozdější čas další pondělí nebo čtvrtek neskryje.
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
  if (oknoIso !== isoDenPrahy(okamzik) || !jeDenVikendovehoSdeleni(okamzik)) {
    return false;
  }
  const konec = Date.parse(skrytoDo);
  const pulnoc = pulnocPoDniPrahy(okamzik).getTime();
  return okamzik.getTime() < konec && konec <= pulnoc;
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
