import Link from "next/link";
import { dnesVPraze, formatDenDatum } from "@/lib/brana/cas";
import { textCasoveKotvy } from "@/lib/brana/casova-kotva";
import { BRANA_REFERENCNI_AKCE } from "@/lib/brana/referencni-akce";
import { BRANA_NAVIGACE } from "@/lib/brana/navigace-stranky";
import type { BranaVerejnaStranka } from "@/lib/brana/navigace-stranky";
import { BranaIkonaObalka, BranaIkonaSdileni } from "./BranaIkony";

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

export function BranaObrazovka({
  aktivniStranka = "dnes",
  opakovaniSeznamu = 1,
}: BranaObrazovkaProps) {
  const akceKZobrazeni = Array.from({ length: opakovaniSeznamu }, (_, blok) =>
    BRANA_REFERENCNI_AKCE.map((akce) => ({ akce, blok })),
  ).flat();

  return (
    <div className="brana-obrazovka">
      <div className="brana-horni-celek">
        <header className="brana-horni-lista">
          <div className="brana-ikona-misto">
            <BranaIkonaObalka />
          </div>
          <p className="brana-horni-lista-nadpis">
            <span className="brana-znacka-hlavni">BRÁNA</span>
            <span className="brana-znacka-podtitul"> do Třeboně</span>
          </p>
          <div className="brana-ikona-misto">
            <BranaIkonaSdileni />
          </div>
        </header>

        <section className="brana-kotva-blok" aria-label="Kotva dne">
          <div className="brana-kotva-radek">
            <span className="brana-kotva-ikona" aria-hidden />
            <p className="brana-kotva-text">Třeboň je dnes klidná</p>
            <span className="brana-kotva-ikona" aria-hidden />
          </div>
        </section>

        <p className="brana-datum">
          {aktivniStranka === "dnes"
            ? formatDenDatum(dnesVPraze())
            : "Středa 29. 7."}
        </p>

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

        <p className="brana-casova-kotva" aria-label="Časová kotva">
          {textCasoveKotvy(aktivniStranka)}
        </p>
      </div>

      <section className="brana-prostor-obsah" aria-label="Akce">
        <ul className="brana-seznam-akci">
          {akceKZobrazeni.map(({ akce, blok }) => {
            const { typ, misto, nazev, cas } = rozlozAkci(akce);

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
                <span className="brana-akce-cas">{cas}</span>
              </li>
            );
          })}
        </ul>

        <footer className="brana-pata">
          <div className="brana-pata-stred">
            <Link href="/" className="brana-pata-odkaz">
              Třeboň po celý rok
            </Link>
          </div>
          <p className="brana-pata-aktualizace">Aktualizováno dnes v 6:00</p>
        </footer>
      </section>
    </div>
  );
}
