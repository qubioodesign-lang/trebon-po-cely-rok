"use client";

import Link from "next/link";
import { Fragment, useState, type MouseEvent } from "react";
import { dnesVPraze, formatDenDatum } from "@/lib/brana/cas";
import { kotvaScrollovani7Dni, kotvaScrollovaniVikend, kotvaScrollovaniVyhled, textCasoveKotvy } from "@/lib/brana/casova-kotva";
import { branaVerejnaCesta } from "@/lib/brana/cesty";
import {
  sousedniBranaStranka,
  type BranaVerejnaStranka,
} from "@/lib/brana/navigace-stranky";
import {
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
} from "./BranaKotvaScrollProvider";
import { BranaSwipeObsah, pripravitBranaListovani } from "./BranaSwipeObsah";
import { BranaIkonaObalka } from "./BranaIkony";
import { BranaTlacitkoSdileni } from "./BranaTlacitkoSdileni";
import { BranaTextAktualizace, BranaAktualizaceProvider } from "./BranaTextAktualizace";

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

/**
 * Kostra první veřejné obrazovky Brány – pouze rozložení, bez dat a funkcí.
 * Určeno pro mobil (max-w-md).
 */
type BranaObrazovkaProps = {
  aktivniStranka?: BranaVerejnaStranka;
  opakovaniSeznamu?: number;
  data?: BranaSdilenaPohledovaData;
  konfiguracePohledu?: BranaKonfiguracePohledu[];
};

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

export function BranaObrazovka({
  aktivniStranka = "dnes",
  opakovaniSeznamu = 1,
  data: dataProp,
  konfiguracePohledu,
}: BranaObrazovkaProps) {
  const [pohled, setPohled] = useState<BranaVerejnaStranka>(aktivniStranka);
  const data = dataProp ?? nactiBranaSdilenaPohledovaData();
  const opakovani =
    konfiguracePohledu?.find((polozka) => polozka.id === pohled)
      ?.opakovaniSeznamu ?? opakovaniSeznamu;
  const host = useBranaHost();
  const navigace = useBranaNavigace();
  const vzkazHref = useBranaVerejnaCesta("vzkaz");
  const trebonHref = useBranaOdkazNaTrebon();
  const kotvaScroll = kotvaScrollProStranku(pohled);
  const pocetBloku = pohled === "vyhled" ? 2 : opakovani;

  const prepnoutPohledKlikem = (cil: BranaVerejnaStranka) => {
    if (cil === pohled) {
      return;
    }

    setPohled(cil);

    const cesta = branaVerejnaCesta(cil, host);
    const aktualni = `${window.location.pathname}${window.location.search}`;
    const cilova = `${cesta}${window.location.search}`;

    if (aktualni !== cilova) {
      window.history.pushState(null, "", cilova);
    }
  };

  const onNavClick = (
    event: MouseEvent<HTMLAnchorElement>,
    cil: BranaVerejnaStranka,
  ) => {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      pripravitBranaListovani(pohled, cil);
      return;
    }

    event.preventDefault();
    prepnoutPohledKlikem(cil);
  };

  const onSwipe = (smer: "predchozi" | "nasledujici") => {
    const cil = sousedniBranaStranka(pohled, smer, host);

    if (cil) {
      prepnoutPohledKlikem(cil.id);
    }
  };

  const seznamAkci = (
    <>
      {Array.from({ length: pocetBloku }, (_, blok) => (
        <Fragment key={`blok-${blok}`}>
          {zobrazitDenniPredel(pohled, blok) ? (
            <BranaDenniPredel />
          ) : null}
          <ul className="brana-seznam-akci">
            {akceProBlok(data, pohled, blok).map((akce, indexVBloku) => {
              const { typ, misto, nazev, cas } = rozlozAkci(akce);
              const globalniIndex =
                pohled === "vyhled"
                  ? blok * data.vyhledPredelIndex + indexVBloku
                  : indexVBloku;

              return (
                <li
                  key={`${blok}-${akce.mistoNeboTyp}-${akce.nazev}-${akce.cas}`}
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
        key={pohled}
        aktivniStranka={pohled}
        scrollovat={!!kotvaScroll}
        pata={pata}
        onSwipe={onSwipe}
      >
        {seznamAkci}
      </BranaSwipeObsah>
      </div>
    </BranaKotvaScrollProvider>
    </BranaAktualizaceProvider>
  );
}
