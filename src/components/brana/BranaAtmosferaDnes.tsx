import { BranaAtmosferaVez } from "./BranaAtmosferaVez";

type BranaAtmosferaDnesProps = {
  /** Už hotová veřejná věta z pevného mapování. */
  veta: string;
};

/**
 * Veřejná Atmosféra pouze pro DNES — mimo Kalendář.
 * Rodič musí vyrenderovat jen když je věta k dispozici (žádný prázdný wrapper).
 */
export function BranaAtmosferaDnes({ veta }: BranaAtmosferaDnesProps) {
  return (
    <p className="brana-atmosfera">
      <BranaAtmosferaVez className="brana-atmosfera-vez" />
      <span className="brana-akce-typ">{veta}</span>
    </p>
  );
}
