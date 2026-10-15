/**
 * Třeboňský maraton — jediný údaj z odpočtu na https://naturemarathon.cz/.
 * Čte jen datum z atributu data-datum u hero__counter. Čas z odpočtu
 * se do karty nepřenáší.
 */

import { dnesIsoVPraze } from "./konkretni-udalost";
import type { BranaScanKandidat } from "./zdroj-scan-parser";

export const BRANA_TREBONSKY_MARATON_REDAKCNI_POLOZKA_ID = "trebonsky-maraton";
export const BRANA_TREBONSKY_MARATON_NAZEV = "Třeboňský maraton";
export const BRANA_TREBONSKY_MARATON_MISTO = "Třeboň";

const HOST = "naturemarathon.cz";

export function jeTrebonskyMaratonZdrojUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
  if (host !== HOST) return false;
  const path = parsed.pathname.replace(/\/+$/, "") || "/";
  return path === "/";
}

function atribut(attrs: string, jmeno: string): string | null {
  const re = new RegExp(`\\b${jmeno}\\s*=\\s*"([^"]*)"`, "i");
  const nalez = attrs.match(re);
  return nalez ? nalez[1] : null;
}

function maTridu(attrs: string, token: string): boolean {
  const trida = atribut(attrs, "class");
  if (!trida) return false;
  return trida.split(/\s+/).includes(token);
}

function jeKalendarniDen(iso: string): boolean {
  const nalez = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!nalez) return false;
  const rok = Number(nalez[1]);
  const mesic = Number(nalez[2]);
  const den = Number(nalez[3]);
  const dt = new Date(Date.UTC(rok, mesic - 1, den));
  return (
    dt.getUTCFullYear() === rok &&
    dt.getUTCMonth() === mesic - 1 &&
    dt.getUTCDate() === den
  );
}

/**
 * Nejvýše jeden budoucí den. Chybějící, neplatný nebo nejednoznačný
 * odpočet, minulý ročník a text zpráv vrací prázdný seznam.
 */
export function parsovatTrebonskyMaratonOdpocty(
  html: string,
  referencniOkamzik: Date = new Date(),
): BranaScanKandidat[] {
  const data: string[] = [];
  for (const tag of html.matchAll(/<div\b([^>]*)>/gi)) {
    const attrs = tag[1] ?? "";
    if (!maTridu(attrs, "hero__counter")) continue;
    const datum = atribut(attrs, "data-datum");
    if (datum == null) continue;
    data.push(datum.trim());
  }
  if (data.length !== 1) return [];

  const nalez = /^(\d{4}-\d{2}-\d{2})(?:T[\d:.+-]+)?$/.exec(data[0]);
  if (!nalez) return [];
  const iso = nalez[1];
  if (!jeKalendarniDen(iso)) return [];
  if (iso < dnesIsoVPraze(referencniOkamzik)) return [];

  const rok = iso.slice(0, 4);
  return [
    {
      nazev: BRANA_TREBONSKY_MARATON_NAZEV,
      datumOd: iso,
      datumDo: iso,
      cas: "",
      mistoNeboTyp: BRANA_TREBONSKY_MARATON_MISTO,
      zdrojIdentita: `${BRANA_TREBONSKY_MARATON_REDAKCNI_POLOZKA_ID}|${rok}`,
    },
  ];
}
