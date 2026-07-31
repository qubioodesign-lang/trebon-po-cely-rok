import type { BranaVerejnaStranka } from "./navigace-stranky";

const CESKE_DNY = [
  "Neděle",
  "Pondělí",
  "Úterý",
  "Středa",
  "Čtvrtek",
  "Pátek",
  "Sobota",
] as const;

/** Aktuální okamžik v časovém pásmu Třeboně (Europe/Prague). */
function dnesVPraze(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Prague" }),
  );
}

function formatDenDatum(datum: Date): string {
  const den = CESKE_DNY[datum.getDay()];
  return `${den} ${datum.getDate()}. ${datum.getMonth() + 1}.`;
}

function prvniDenVikendu(dnes: Date): Date {
  const denVTydnu = dnes.getDay();

  if (denVTydnu === 6) {
    return dnes;
  }

  const sobota = new Date(dnes);

  if (denVTydnu === 0) {
    sobota.setDate(dnes.getDate() - 1);
    return sobota;
  }

  sobota.setDate(dnes.getDate() + (6 - denVTydnu));
  return sobota;
}

/** Text časové kotvy podle aktivní veřejné stránky BRÁNY. */
export function textCasoveKotvy(stranka: BranaVerejnaStranka): string {
  const dnes = dnesVPraze();

  switch (stranka) {
    case "dnes":
      return formatDenDatum(dnes);
    case "zitra": {
      const zitra = new Date(dnes);
      zitra.setDate(dnes.getDate() + 1);
      return formatDenDatum(zitra);
    }
    case "vikend":
      return formatDenDatum(prvniDenVikendu(dnes));
    case "7-dni":
      return formatDenDatum(dnes);
    case "vyhled":
      return String(dnes.getFullYear());
  }
}
