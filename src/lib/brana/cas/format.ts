import type { BranaDatum } from "./cas";

const CESKE_DNY = [
  "Neděle",
  "Pondělí",
  "Úterý",
  "Středa",
  "Čtvrtek",
  "Pátek",
  "Sobota",
] as const;

function denVTydnuZDatumu(datum: BranaDatum): number {
  return new Date(Date.UTC(datum.rok, datum.mesic - 1, datum.den, 12)).getUTCDay();
}

/** Formát pro UI: „Pátek 31. 7.“ */
export function formatDenDatum(datum: BranaDatum): string {
  const den = CESKE_DNY[denVTydnuZDatumu(datum)];
  return `${den} ${datum.den}. ${datum.mesic}.`;
}

/** Porovnání pro testy. */
export function formatDatumKratce(datum: BranaDatum): string {
  return `${datum.den}. ${datum.mesic}. ${datum.rok}`;
}
