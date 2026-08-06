/**
 * Jedna publikační položka v administraci BRÁNY.
 * Pouze vykreslení CO / KDE / názvu / údaje vpravo.
 * Typografie přes existující třídy .brana-akce-* (beze změny veřejné BRÁNY).
 */
export type BranaAdminAkcePolozkaProps = {
  typ: string;
  misto: string;
  nazev: string;
  udajVpravo: string;
};

export function BranaAdminAkcePolozka({
  typ,
  misto,
  nazev,
  udajVpravo,
}: BranaAdminAkcePolozkaProps) {
  return (
    <li>
      <div className="brana-akce-obsah">
        <div className="brana-akce-radek">
          <span className="brana-akce-typ">{typ}</span>
          {misto ? <span className="brana-akce-misto"> {misto}</span> : null}
        </div>
        {nazev ? <span className="brana-akce-nazev">{nazev}</span> : null}
      </div>
      <span className="brana-akce-cas">{udajVpravo}</span>
    </li>
  );
}
