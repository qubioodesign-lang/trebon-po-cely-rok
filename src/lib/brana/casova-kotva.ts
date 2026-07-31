import type { BranaVerejnaStranka } from "./navigace-stranky";
import {
  aktualniVikendVPraze,
  dnesVPraze,
  formatDenDatum,
  okamzikVPraze,
  pridatDny,
} from "./cas";

/** Text časové kotvy podle aktivní veřejné stránky BRÁNY. */
export function textCasoveKotvy(stranka: BranaVerejnaStranka): string {
  switch (stranka) {
    case "dnes":
      return formatDenDatum(dnesVPraze());
    case "zitra":
      return formatDenDatum(pridatDny(dnesVPraze(), 1));
    case "vikend":
      return formatDenDatum(aktualniVikendVPraze().sobota);
    case "7-dni":
      return formatDenDatum(dnesVPraze());
    case "vyhled":
      return String(okamzikVPraze().rok);
  }
}
