type BranaDenniPredelProps = {
  label: string;
};

/** Vizuální předěl mezi dny – znovu použitelný při budoucím seskupení podle data. */
export function BranaDenniPredel({ label }: BranaDenniPredelProps) {
  return (
    <div className="brana-denni-predel" aria-label="Změna dne">
      <hr className="brana-denni-predel-linka" aria-hidden />
      <p className="brana-denni-predel-datum">{label}</p>
    </div>
  );
}
