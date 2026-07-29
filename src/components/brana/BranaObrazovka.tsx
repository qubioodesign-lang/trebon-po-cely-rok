import {
  BranaIkonaObalka,
  BranaIkonaOkno,
  BranaIkonaSdileni,
} from "./BranaIkony";

const POLOZKY_NAVIGACE = [
  "Dnes",
  "Zítra",
  "Víkend",
  "7 dní",
  "Výhled",
] as const;

/**
 * Kostra první veřejné obrazovky Brány – pouze rozložení, bez dat a funkcí.
 * Určeno pro mobil (max-w-md).
 */
export function BranaObrazovka() {
  return (
    <div className="brana-obrazovka">
      <header className="brana-horni-lista">
        <div className="brana-ikona-misto">
          <BranaIkonaObalka />
        </div>
        <p className="brana-horni-lista-nadpis">BRÁNA do Třeboně</p>
        <div className="brana-ikona-misto">
          <BranaIkonaSdileni />
        </div>
      </header>

      <section className="brana-kotva-blok" aria-label="Kotva dne">
        <div className="brana-kotva-radek">
          <span className="brana-kotva-ikona" aria-hidden />
          <p className="brana-kotva-text">Třeboň je dnes klidná</p>
          <span className="brana-kotva-ikona">
            <BranaIkonaOkno />
          </span>
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

      <div className="brana-prostor-obsah" aria-hidden />

      <p className="brana-aktualizace">Aktualizováno dnes 6:00</p>

      <footer className="brana-zapati-rezerva" aria-hidden />
    </div>
  );
}
