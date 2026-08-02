import Link from "next/link";
import { Fragment } from "react";
import { dnesVPraze, formatDenDatum } from "@/lib/brana/cas";
import { kotvaScrollovani7Dni, kotvaScrollovaniVikend, kotvaScrollovaniVyhled, textCasoveKotvy } from "@/lib/brana/casova-kotva";
import { BRANA_REFERENCNI_AKCE } from "@/lib/brana/referencni-akce";
import {
  BRANA_VYHLED_DATUMY,
  BRANA_VYHLED_PREDEL_INDEX,
} from "@/lib/brana/referencni-vyhled-datumy";
import { BRANA_NAVIGACE } from "@/lib/brana/navigace-stranky";
import type { BranaVerejnaStranka } from "@/lib/brana/navigace-stranky";
import { BranaDenniPredel } from "./BranaDenniPredel";
import {
  BranaCasovaKotvaScrollovana,
  BranaKotvaScrollProvider,
} from "./BranaKotvaScrollProvider";
import { BranaSwipeObsah } from "./BranaSwipeObsah";
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

function rozlozAkci(akce: (typeof BRANA_REFERENCNI_AKCE)[number]): {
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
  stranka: BranaVerejnaStranka,
  blok: number,
): (typeof BRANA_REFERENCNI_AKCE)[number][] {
  if (stranka !== "vyhled") {
    return BRANA_REFERENCNI_AKCE;
  }

  return blok === 0
    ? BRANA_REFERENCNI_AKCE.slice(0, BRANA_VYHLED_PREDEL_INDEX)
    : BRANA_REFERENCNI_AKCE.slice(BRANA_VYHLED_PREDEL_INDEX);
}

function udajVpravo(
  stranka: BranaVerejnaStranka,
  index: number,
  cas: string,
): string {
  if (stranka === "vyhled") {
    return BRANA_VYHLED_DATUMY[index] ?? cas;
  }

  return cas;
}

export function BranaObrazovka({
  aktivniStranka = "dnes",
  opakovaniSeznamu = 1,
}: BranaObrazovkaProps) {
  const kotvaScroll = kotvaScrollProStranku(aktivniStranka);
  const pocetBloku =
    aktivniStranka === "vyhled" ? 2 : opakovaniSeznamu;

  const obsahSeznamu = (
    <>
      {Array.from({ length: pocetBloku }, (_, blok) => (
        <Fragment key={`blok-${blok}`}>
          {zobrazitDenniPredel(aktivniStranka, blok) ? (
            <BranaDenniPredel />
          ) : null}
          <ul className="brana-seznam-akci">
            {akceProBlok(aktivniStranka, blok).map((akce, indexVBloku) => {
              const { typ, misto, nazev, cas } = rozlozAkci(akce);
              const globalniIndex =
                aktivniStranka === "vyhled"
                  ? blok * BRANA_VYHLED_PREDEL_INDEX + indexVBloku
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
                    {udajVpravo(aktivniStranka, globalniIndex, cas)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Fragment>
      ))}

      <footer className="brana-pata">
        <div className="brana-pata-stred">
          <Link href="/" className="brana-pata-odkaz">
            Třeboň po celý rok →
          </Link>
        </div>
        <p className="brana-pata-aktualizace">
          <BranaTextAktualizace />
        </p>
      </footer>
    </>
  );

  return (
    <BranaAktualizaceProvider>
    <BranaKotvaScrollProvider config={kotvaScroll}>
      <div className="brana-obrazovka">
      <div className="brana-horni-celek">
        <header className="brana-horni-lista">
          <div className="brana-ikona-misto">
            <Link
              href="/brana/vzkaz"
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
          {BRANA_NAVIGACE.map((polozka) => (
            <Link
              key={polozka.id}
              href={polozka.href}
              className={
                polozka.id === aktivniStranka
                  ? "brana-nav-polozka brana-nav-polozka-vybrana"
                  : "brana-nav-polozka"
              }
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
            {textCasoveKotvy(aktivniStranka)}
          </p>
        )}
      </div>

      <BranaSwipeObsah
        aktivniStranka={aktivniStranka}
        scrollovat={!!kotvaScroll}
      >
        {obsahSeznamu}
      </BranaSwipeObsah>
      </div>
    </BranaKotvaScrollProvider>
    </BranaAktualizaceProvider>
  );
}
