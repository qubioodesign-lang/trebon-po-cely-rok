/** Vodorovná linka pod popisem – u prolnutí jemný bod během prolínání A→B */
export function LinkaPodPopisem({
  animovat = false,
  beh = 0,
  dobaMs = 6_500,
}: {
  animovat?: boolean;
  beh?: number;
  dobaMs?: number;
}) {
  return (
    <div
      className="relative h-px w-[150px] max-w-[45%] bg-white/40"
      aria-hidden="true"
    >
      {animovat && dobaMs > 0 && (
        <span
          key={beh}
          className="prolnuti-linka-bod pointer-events-none absolute top-1/2 block"
          style={{ animationDuration: `${dobaMs}ms` }}
        />
      )}
    </div>
  );
}
