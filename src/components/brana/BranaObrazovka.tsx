"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { dnesVPraze, formatDenDatum } from "@/lib/brana/cas";
import {
  kotvaScrollovani7Dni,
  kotvaScrollovaniVikend,
  kotvaScrollovaniVyhled,
  textCasoveKotvy,
} from "@/lib/brana/casova-kotva";
import { branaVerejnaCesta } from "@/lib/brana/cesty";
import type { BranaVerejnaStranka } from "@/lib/brana/navigace-stranky";
import { sousedniBranaStranka } from "@/lib/brana/navigace-stranky";
import {
  branaKonfiguracePohledu,
  branaPohledZPathname,
  indexBranaPohledu,
  nactiBranaSdilenaPohledovaData,
  type BranaKonfiguracePohledu,
  type BranaSdilenaPohledovaData,
} from "@/lib/brana/pohledy-data";
import {
  useBranaHost,
  useBranaNavigace,
  useBranaOdkazNaTrebon,
  useBranaVerejnaCesta,
} from "@/lib/brana/use-brana-cesty";
import { BranaDenniPredel } from "./BranaDenniPredel";
import {
  BranaCasovaKotvaScrollovana,
  BranaKotvaScrollProvider,
  useBranaKotvaScroll,
} from "./BranaKotvaScrollProvider";
import {
  BranaSwipeObsah,
  type BranaListovaniPrechod,
} from "./BranaSwipeObsah";
import { BranaIkonaObalka } from "./BranaIkony";
import { BranaTlacitkoSdileni } from "./BranaTlacitkoSdileni";
import {
  BranaTextAktualizace,
  BranaAktualizaceProvider,
} from "./BranaTextAktualizace";

const JEDNOSLOVNE_TYPY_AKCE = new Set([
  "Kino",
  "Divadlo",
  "Koncert",
  "Festival",
  "Výstava",
  "Prohlídka",
  "Přednáška",
]);

function rozdelTypAkce(mistoNeboTyp: string): { typ: string; zbytek: string } {
  if (mistoNeboTyp === "Pro děti") {
    return { typ: "Pro děti", zbytek: "" };
  }

  const mezera = mistoNeboTyp.indexOf(" ");
  if (mezera === -1) {
    return { typ: mistoNeboTyp, zbytek: "" };
  }

  const prvniSlovo = mistoNeboTyp.slice(0, mezera);
  if (JEDNOSLOVNE_TYPY_AKCE.has(prvniSlovo)) {
    return { typ: prvniSlovo, zbytek: mistoNeboTyp.slice(mezera + 1) };
  }

  return { typ: mistoNeboTyp, zbytek: "" };
}

function rozlozAkci(akce: BranaSdilenaPohledovaData["akce"][number]): {
  typ: string;
  misto: string;
  nazev: string;
  cas: string;
} {
  const { typ, zbytek } = rozdelTypAkce(akce.mistoNeboTyp);

  if (zbytek) {
    return { typ, misto: zbytek, nazev: akce.nazev, cas: akce.cas };
  }

  if (JEDNOSLOVNE_TYPY_AKCE.has(typ) || typ === "Pro děti") {
    return { typ, misto: "", nazev: akce.nazev, cas: akce.cas };
  }

  return { typ, misto: akce.nazev, nazev: "", cas: akce.cas };
}

const JEDNOPISMENNE_PREDLOZKY = /(\s)([ksvzou])(\s+)(?=\S)/gi;

/** Nezlomitelná mezera za jednopísmennou předložkou – pouze při vykreslení. */
function zalomPredlozky(text: string): string {
  return text.replace(JEDNOPISMENNE_PREDLOZKY, "$1$2\u00A0");
}

function preferujeReducedMotion(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function kotvaScrollProStranku(
  stranka: BranaVerejnaStranka,
): ReturnType<typeof kotvaScrollovaniVikend> | null {
  switch (stranka) {
    case "vikend":
      return kotvaScrollovaniVikend();
    case "7-dni":
      return kotvaScrollovani7Dni();
    case "vyhled":
      return kotvaScrollovaniVyhled();
    default:
      return null;
  }
}

function zobrazitDenniPredel(stranka: BranaVerejnaStranka, blok: number): boolean {
  if (blok === 0) {
    return false;
  }

  if (stranka === "vikend") {
    return blok === 1;
  }

  if (stranka === "7-dni") {
    return blok >= 1 && blok <= 6;
  }

  if (stranka === "vyhled") {
    return blok === 1;
  }

  return false;
}

function akceProBlok(
  data: BranaSdilenaPohledovaData,
  stranka: BranaVerejnaStranka,
  blok: number,
): BranaSdilenaPohledovaData["akce"] {
  if (stranka !== "vyhled") {
    return data.akce;
  }

  return blok === 0
    ? data.akce.slice(0, data.vyhledPredelIndex)
    : data.akce.slice(data.vyhledPredelIndex);
}

function udajVpravo(
  data: BranaSdilenaPohledovaData,
  stranka: BranaVerejnaStranka,
  index: number,
  cas: string,
): string {
  if (stranka === "vyhled") {
    return data.vyhledDatumy[index] ?? cas;
  }

  return cas;
}

function SeznamAkciPohledu({
  pohled,
  data,
  konfiguracePohledu,
}: {
  pohled: BranaVerejnaStranka;
  data: BranaSdilenaPohledovaData;
  konfiguracePohledu: BranaKonfiguracePohledu[];
}) {
  const konfigurace =
    konfiguracePohledu.find((polozka) => polozka.id === pohled) ??
    branaKonfiguracePohledu(pohled);
  const pocetBloku = pohled === "vyhled" ? 2 : konfigurace.opakovaniSeznamu;

  return (
    <>
      {Array.from({ length: pocetBloku }, (_, blok) => (
        <Fragment key={`${pohled}-blok-${blok}`}>
          {zobrazitDenniPredel(pohled, blok) ? <BranaDenniPredel /> : null}
          <ul className="brana-seznam-akci">
            {akceProBlok(data, pohled, blok).map((akce, indexVBloku) => {
              const { typ, misto, nazev, cas } = rozlozAkci(akce);
              const globalniIndex =
                pohled === "vyhled"
                  ? blok * data.vyhledPredelIndex + indexVBloku
                  : indexVBloku;

              return (
                <li
                  key={`${pohled}-${blok}-${akce.mistoNeboTyp}-${akce.nazev}-${akce.cas}`}
                >
                  <div className="brana-akce-obsah">
                    <div className="brana-akce-radek">
                      <span className="brana-akce-typ">{typ}</span>
                      {misto ? (
                        <span className="brana-akce-misto">
                          {" "}
                          {zalomPredlozky(misto)}
                        </span>
                      ) : null}
                    </div>
                    {nazev ? (
                      <span className="brana-akce-nazev">
                        {zalomPredlozky(nazev)}
                      </span>
                    ) : null}
                  </div>
                  <span className="brana-akce-cas">
                    {udajVpravo(data, pohled, globalniIndex, cas)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Fragment>
      ))}
    </>
  );
}

type BranaObrazovkaProps = {
  /** Počáteční pohled z URL – SSR/hydratace. */
  pocatecniPohled?: BranaVerejnaStranka;
  /** Společná data všech pohledů (jedna pravda). */
  data?: BranaSdilenaPohledovaData;
  /** Konfigurace všech pěti pohledů ze serveru. */
  konfiguracePohledu?: BranaKonfiguracePohledu[];
  /** @deprecated Použijte pocatecniPohled */
  aktivniStranka?: BranaVerejnaStranka;
};

type PrechodStav = {
  z: BranaVerejnaStranka;
  na: BranaVerejnaStranka;
  smer: 1 | -1;
  bezi: boolean;
};

/**
 * Klientský shell pěti veřejných pohledů BRÁNY.
 * Po hydrataci přepíná bez RSC; URL zůstávají SSR vstupy.
 */
export function BranaObrazovka({
  pocatecniPohled,
  data: dataProp,
  konfiguracePohledu: konfiguraceProp,
  aktivniStranka = "dnes",
}: BranaObrazovkaProps) {
  const vychoziPohled = pocatecniPohled ?? aktivniStranka;
  const data = dataProp ?? nactiBranaSdilenaPohledovaData();
  const konfiguracePohledu =
    konfiguraceProp ??
    (["dnes", "zitra", "vikend", "7-dni", "vyhled"] as const).map(
      branaKonfiguracePohledu,
    );
  const navigace = useBranaNavigace();
  const host = useBranaHost();
  const pathname = usePathname();
  const vzkazHref = useBranaVerejnaCesta("vzkaz");
  const trebonHref = useBranaOdkazNaTrebon();

  const [pohled, setPohled] = useState<BranaVerejnaStranka>(vychoziPohled);
  const [prechod, setPrechod] = useState<PrechodStav | null>(null);
  const pohledRef = useRef(pohled);
  const prechodRef = useRef(prechod);
  const ignorovatPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    pohledRef.current = pohled;
  }, [pohled]);

  useEffect(() => {
    prechodRef.current = prechod;
  }, [prechod]);

  const kotvaScroll = kotvaScrollProStranku(pohled);

  const aktualizujUrl = useCallback(
    (cil: BranaVerejnaStranka) => {
      const cesta = branaVerejnaCesta(cil, host);
      const aktualni = `${window.location.pathname}${window.location.search}`;
      const cilova = `${cesta}${window.location.search}`;

      if (aktualni === cilova) {
        return;
      }

      ignorovatPathnameRef.current = cesta;
      window.history.pushState(null, "", cilova);
    },
    [host],
  );

  const prepnoutPohled = useCallback(
    (
      na: BranaVerejnaStranka,
      volby?: { historie?: "push" | "none" },
    ) => {
      const historie = volby?.historie ?? "push";
      const z = pohledRef.current;

      if (na === z && !prechodRef.current) {
        return;
      }

      if (prechodRef.current?.na === na && pohledRef.current === na) {
        return;
      }

      const indexZ = indexBranaPohledu(z);
      const indexNa = indexBranaPohledu(na);

      if (indexZ < 0 || indexNa < 0 || indexZ === indexNa) {
        setPohled(na);
        setPrechod(null);
        if (historie === "push") {
          aktualizujUrl(na);
        }
        return;
      }

      const smer: 1 | -1 = indexNa > indexZ ? 1 : -1;

      if (preferujeReducedMotion()) {
        setPrechod(null);
        setPohled(na);
        if (historie === "push") {
          aktualizujUrl(na);
        }
        return;
      }

      setPohled(na);
      setPrechod({ z, na, smer, bezi: false });

      if (historie === "push") {
        aktualizujUrl(na);
      }
    },
    [aktualizujUrl],
  );

  // Back / Forward – Next synchronizuje pathname po native history.
  useEffect(() => {
    const zUrl = branaPohledZPathname(pathname, host);

    if (!zUrl) {
      return;
    }

    if (ignorovatPathnameRef.current === pathname) {
      ignorovatPathnameRef.current = null;
      return;
    }

    if (zUrl === pohledRef.current && !prechodRef.current) {
      return;
    }

    if (zUrl === pohledRef.current && prechodRef.current?.na === zUrl) {
      return;
    }

    prepnoutPohled(zUrl, { historie: "none" });
  }, [pathname, host, prepnoutPohled]);

  const onPrechodBezi = useCallback(() => {
    setPrechod((stav) => (stav ? { ...stav, bezi: true } : null));
  }, []);

  const onPrechodHotovo = useCallback(() => {
    setPrechod(null);
  }, []);

  const onSwipe = useCallback(
    (smer: "predchozi" | "nasledujici") => {
      const cil = sousedniBranaStranka(pohledRef.current, smer, host);

      if (cil) {
        prepnoutPohled(cil.id);
      }
    },
    [host, prepnoutPohled],
  );

  const onNavClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    cil: BranaVerejnaStranka,
  ) => {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();
    prepnoutPohled(cil);
  };

  const listovaniPrechod: BranaListovaniPrechod | null = prechod
    ? {
        smer: prechod.smer,
        bezi: prechod.bezi,
        odjezd: (
          <SeznamAkciPohledu
            pohled={prechod.z}
            data={data}
            konfiguracePohledu={konfiguracePohledu}
          />
        ),
        prijezd: (
          <SeznamAkciPohledu
            pohled={prechod.na}
            data={data}
            konfiguracePohledu={konfiguracePohledu}
          />
        ),
      }
    : null;

  const klidovySeznam: ReactNode = (
    <SeznamAkciPohledu
      pohled={pohled}
      data={data}
      konfiguracePohledu={konfiguracePohledu}
    />
  );

  const pata = (
    <footer className="brana-pata">
      <div className="brana-pata-stred">
        <Link href={trebonHref} className="brana-pata-odkaz">
          <span className="brana-pata-odkaz-text">Třeboň po celý rok</span>{" "}
          <span className="brana-pata-odkaz-sipka" aria-hidden>
            →
          </span>
        </Link>
      </div>
      <p className="brana-pata-aktualizace">
        <BranaTextAktualizace />
      </p>
    </footer>
  );

  return (
    <BranaAktualizaceProvider>
      <BranaKotvaScrollProvider config={kotvaScroll}>
        <BranaObrazovkaVnitrni
          pohled={pohled}
          kotvaScroll={kotvaScroll}
          navigace={navigace}
          vzkazHref={vzkazHref}
          onNavClick={onNavClick}
          listovaniPrechod={listovaniPrechod}
          klidovySeznam={klidovySeznam}
          pata={pata}
          onPrechodBezi={onPrechodBezi}
          onPrechodHotovo={onPrechodHotovo}
          onSwipe={onSwipe}
        />
      </BranaKotvaScrollProvider>
    </BranaAktualizaceProvider>
  );
}

function BranaObrazovkaVnitrni({
  pohled,
  kotvaScroll,
  navigace,
  vzkazHref,
  onNavClick,
  listovaniPrechod,
  klidovySeznam,
  pata,
  onPrechodBezi,
  onPrechodHotovo,
  onSwipe,
}: {
  pohled: BranaVerejnaStranka;
  kotvaScroll: ReturnType<typeof kotvaScrollProStranku>;
  navigace: ReturnType<typeof useBranaNavigace>;
  vzkazHref: string;
  onNavClick: (
    event: React.MouseEvent<HTMLAnchorElement>,
    cil: BranaVerejnaStranka,
  ) => void;
  listovaniPrechod: BranaListovaniPrechod | null;
  klidovySeznam: ReactNode;
  pata: ReactNode;
  onPrechodBezi: () => void;
  onPrechodHotovo: () => void;
  onSwipe: (smer: "predchozi" | "nasledujici") => void;
}) {
  const kontext = useBranaKotvaScroll();

  return (
    <div className="brana-obrazovka">
      <div className="brana-horni-celek">
        <header className="brana-horni-lista">
          <div className="brana-ikona-misto">
            <Link
              href={vzkazHref}
              className="flex h-full w-full items-center justify-center text-white no-underline"
              aria-label="Nechte vzkaz BRÁNĚ"
            >
              <BranaIkonaObalka />
            </Link>
          </div>
          <p className="brana-horni-lista-nadpis">
            <span className="brana-znacka-hlavni">BRÁNA</span>
            <span className="brana-znacka-podtitul"> do Třeboně</span>
          </p>
          <div className="brana-ikona-misto">
            <BranaTlacitkoSdileni />
          </div>
        </header>

        <section className="brana-kotva-blok" aria-label="Kotva dne">
          <div className="brana-kotva-radek">
            <span className="brana-kotva-ikona" aria-hidden />
            <p className="brana-kotva-text">
              <BranaTextAktualizace />
            </p>
            <span className="brana-kotva-ikona" aria-hidden />
          </div>
        </section>

        <p className="brana-datum">{formatDenDatum(dnesVPraze())}</p>

        <nav className="brana-navigace" aria-label="Období">
          {navigace.map((polozka) => (
            <Link
              key={polozka.id}
              href={polozka.href}
              className={
                polozka.id === pohled
                  ? "brana-nav-polozka brana-nav-polozka-vybrana"
                  : "brana-nav-polozka"
              }
              onClick={(event) => onNavClick(event, polozka.id)}
            >
              {polozka.label}
            </Link>
          ))}
        </nav>

        <hr className="brana-orientacni-oddelovac" aria-hidden />

        {kotvaScroll ? (
          <BranaCasovaKotvaScrollovana
            vychoziLabel={kotvaScroll.vychoziLabel}
          />
        ) : (
          <p className="brana-casova-kotva" aria-label="Časová kotva">
            {textCasoveKotvy(pohled)}
          </p>
        )}
      </div>

      <BranaSwipeObsah
        scrollovat={!!kotvaScroll}
        pata={pata}
        prechod={listovaniPrechod}
        onPrechodBezi={onPrechodBezi}
        onPrechodHotovo={onPrechodHotovo}
        onSwipe={onSwipe}
        registerScrollRoot={kontext?.registerScrollRoot}
      >
        {klidovySeznam}
      </BranaSwipeObsah>
    </div>
  );
}
