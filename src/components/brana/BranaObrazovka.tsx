import Link from "next/link";
import { BRANA_REFERENCNI_AKCE } from "@/lib/brana/referencni-akce";
import { BranaIkonaObalka, BranaIkonaSdileni } from "./BranaIkony";

const POLOZKY_NAVIGACE = [
  "Dnes",
  "Zítra",
  "Víkend",
  "7 dní",
  "Výhled",
] as const;

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
export function BranaObrazovka() {
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

        <p className="brana-datum">Středa 29. 7.</p>

        <nav className="brana-navigace" aria-label="Období">
          {POLOZKY_NAVIGACE.map((polozka) => (
            <span
              key={polozka}
              className={
                polozka === "Dnes"
                  ? "brana-nav-polozka brana-nav-polozka-vybrana"
                  : "brana-nav-polozka"
              }
            >
              {polozka}
            </span>
          ))}
        </nav>

        <hr className="brana-orientacni-oddelovac" aria-hidden />
      </div>

      <section className="brana-prostor-obsah" aria-label="Akce">
        <ul className="brana-seznam-akci">
          {BRANA_REFERENCNI_AKCE.map((akce) => {
            const { typ, misto, nazev, cas } = rozlozAkci(akce);

            return (
              <li key={`${akce.mistoNeboTyp}-${akce.nazev}-${akce.cas}`}>
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
          <Link href="/" className="brana-pata-odkaz">
            <span className="brana-znacka-hlavni">Třeboň</span>
            <span className="brana-znacka-podtitul"> po celý rok</span>
          </Link>
          <p className="brana-pata-aktualizace">Aktualizováno dnes v 6:00</p>
        </footer>
      </section>
    </div>
  );
}
