/**
 * Jedna publikační položka v administraci BRÁNY.
 * Pouze vykreslení CO / KDE / názvu / údaje vpravo.
 * Vzhled: brana-admin-kalendar.css (kopie měr z veřejné BRÁNY).
 */
import type { ReactNode } from "react";

export type BranaAdminAkcePolozkaProps = {
  typ: string;
  misto: string;
  nazev: string;
  udajVpravo: string;
  /** Oddělovač před místem; výchozí mezera (Trh používá ` · `). */
  oddelovacPredMistem?: string;
  /** Volitelný admin chrome pod řádkem (např. Smazat) */
  chrome?: ReactNode;
};

export function BranaAdminAkcePolozka({
  typ,
  misto,
  nazev,
  udajVpravo,
  oddelovacPredMistem = " ",
  chrome,
}: BranaAdminAkcePolozkaProps) {
  return (
    <li>
      {/* Stejný grid jako Kalendář: text vlevo, údaj vpravo (.brana-admin-akce-nahled). */}
      <div className="brana-admin-akce-nahled">
        <div className="brana-admin-akce-obsah">
          <div className="brana-admin-akce-radek">
            <span className="brana-admin-akce-typ">{typ}</span>
            {misto ? (
              <span className="brana-admin-akce-misto">
                {oddelovacPredMistem}
                {misto}
              </span>
            ) : null}
          </div>
          {nazev ? (
            <span className="brana-admin-akce-nazev">{nazev}</span>
          ) : null}
        </div>
        <span className="brana-admin-akce-cas">{udajVpravo}</span>
      </div>
      {chrome ? (
        <div className="brana-admin-akce-chrome">{chrome}</div>
      ) : null}
    </li>
  );
}
