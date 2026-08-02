import type { BranaVerejnaStranka } from "./navigace-stranky";
import {
  aktualniVikendVPraze,
  jeVikendPouzeNedeleVPraze,
  dnesVPraze,
  formatDenDatum,
  okamzikVPraze,
  pridatDny,
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
    case "vikend": {
      const vikend = aktualniVikendVPraze();
      return formatDenDatum(
        jeVikendPouzeNedeleVPraze() ? vikend.nedele : vikend.sobota,
      );
    }
    case "7-dni":
      return formatDenDatum(zitraVPraze());
    case "vyhled":
      return String(okamzikVPraze().rok);
  }
}

/** Scroll kotva pro pohled Víkend – sobota a neděle, v neděli jen aktuální den. */
export function kotvaScrollovaniVikend(): BranaKotvaScrollConfig | null {
  if (jeVikendPouzeNedeleVPraze()) {
    return null;
  }

  const vikend = aktualniVikendVPraze();

  return {
    vychoziLabel: formatDenDatum(vikend.sobota),
    poPredelu: [formatDenDatum(vikend.nedele)],
  };
}

/** Sedm po sobě jdoucích kalendářních dnů od zítřka (bez dneška) v Europe/Prague. */
export function obdobi7DniVPraze(): string[] {
  const zitra = zitraVPraze();

  return Array.from({ length: 7 }, (_, index) =>
    formatDenDatum(pridatDny(zitra, index)),
  );
}

/** Scroll kotva pro pohled 7 dní – sedm dnů od zítřka, šest předělů mezi bloky. */
export function kotvaScrollovani7Dni(): BranaKotvaScrollConfig {
  const dny = obdobi7DniVPraze();

  return {
    vychoziLabel: dny[0],
    poPredelu: dny.slice(1),
  };
}

/** Scroll kotva pro pohled Výhled – aktuální rok a následující rok po předělu. */
export function kotvaScrollovaniVyhled(): BranaKotvaScrollConfig {
  const rok = okamzikVPraze().rok;

  return {
    vychoziLabel: String(rok),
    poPredelu: [String(rok + 1)],
  };
}
