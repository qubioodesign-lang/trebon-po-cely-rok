"use client";

import Link from "next/link";
import { Fragment } from "react";
import { dnesVPraze, formatDenDatum } from "@/lib/brana/cas";
import { kotvaScrollovani7Dni, kotvaScrollovaniVikend, kotvaScrollovaniVyhled, textCasoveKotvy } from "@/lib/brana/casova-kotva";
import type { BranaVerejnaStranka } from "@/lib/brana/navigace-stranky";
import {
  nactiBranaSdilenaPohledovaData,
  type BranaKonfiguracePohledu,
  type BranaSdilenaPohledovaData,
} from "@/lib/brana/pohledy-data";
import { rozlozAkci } from "@/lib/brana/admin/akce-rozlozeni";
import {
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
  if (data.bloky) {
    return [...(data.bloky[blok] ?? [])];
  }

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
  blok: number,
  indexVBloku: number,
  globalniIndex: number,
  cas: string,
): string {
  if (stranka === "vyhled") {
    if (data.vyhledDatumyBloky) {
      return data.vyhledDatumyBloky[blok]?.[indexVBloku] ?? cas;
    }
    return data.vyhledDatumy[globalniIndex] ?? cas;
  }

  return cas;
}

export function BranaObrazovka({
  aktivniStranka = "dnes",
  opakovaniSeznamu = 1,
  data: dataProp,
  konfiguracePohledu,
}: BranaObrazovkaProps) {
  const pohled = aktivniStranka;
  const data = dataProp ?? nactiBranaSdilenaPohledovaData();
  const opakovani =
    konfiguracePohledu?.find((polozka) => polozka.id === pohled)
      ?.opakovaniSeznamu ?? opakovaniSeznamu;
  const navigace = useBranaNavigace();
  const vzkazHref = useBranaVerejnaCesta("vzkaz");
  const trebonHref = useBranaOdkazNaTrebon();
  const kotvaScroll = kotvaScrollProStranku(pohled);
  const pocetBloku = data.bloky
    ? data.bloky.length
    : pohled === "vyhled"
      ? 2
      : opakovani;

  const onNavClick = (cil: BranaVerejnaStranka) => {
    if (cil === pohled) {
      return;
    }

    pripravitBranaListovani(pohled, cil);
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
                  key={`${blok}-${akce.mistoNeboTyp}-${akce.nazev}-${akce.cas}-${indexVBloku}`}
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
                    {udajVpravo(
                      data,
                      pohled,
                      blok,
                      indexVBloku,
                      globalniIndex,
                      cas,
                    )}
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
              prefetch={true}
              className={
                polozka.id === pohled
                  ? "brana-nav-polozka brana-nav-polozka-vybrana"
                  : "brana-nav-polozka"
              }
              onClick={() => onNavClick(polozka.id)}
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
        aktivniStranka={pohled}
        scrollovat={!!kotvaScroll}
        pata={pata}
      >
        {seznamAkci}
      </BranaSwipeObsah>
      </div>
    </BranaKotvaScrollProvider>
    </BranaAktualizaceProvider>
  );
}
