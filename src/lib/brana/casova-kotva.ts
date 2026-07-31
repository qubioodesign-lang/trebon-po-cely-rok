import type { BranaVerejnaStranka } from "./navigace-stranky";
import {
  aktualniVikendVPraze,
  dnesVPraze,
  formatDenDatum,
  okamzikVPraze,
  zitraVPraze,
} from "./cas";
import type { BranaKotvaScrollConfig } from "./kotva-scrollovani";

/** Text časové kotvy podle aktivní veřejné stránky BRÁNY. */
export function textCasoveKotvy(stranka: BranaVerejnaStranka): string {
  switch (stranka) {
    case "dnes":
      return formatDenDatum(dnesVPraze());
    case "zitra":
      return formatDenDatum(zitraVPraze());
    case "vikend":
      return formatDenDatum(aktualniVikendVPraze().sobota);
    case "7-dni":
      return formatDenDatum(dnesVPraze());
    case "vyhled":
      return String(okamzikVPraze().rok);
  }
}

/** Scroll kotva pro pohled Víkend – sobota a neděle z centrální definice víkendu. */
export function kotvaScrollovaniVikend(): BranaKotvaScrollConfig {
  const vikend = aktualniVikendVPraze();

  return {
    vychoziLabel: formatDenDatum(vikend.sobota),
    poPredelu: [formatDenDatum(vikend.nedele)],
  };
}
