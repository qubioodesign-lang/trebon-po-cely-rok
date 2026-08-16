/**
 * Hlavičky HTTP GET pro scan známého zdroje.
 * Bez server-only – sdílené mezi skenovat-zdroj a regresními testy.
 */

import { jeMintTrhyZdrojUrl } from "./zdroj-scan-parser";

/** Obecný UA pro všechny zdroje kromě MINT. */
export const SCAN_USER_AGENT_OBECNY = "BranaAdminScan/1.0";

/**
 * MINT Market: browser UA
 * (po 2× produkčním socket hang up s obecným UA).
 */
export const SCAN_USER_AGENT_MINT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const SCAN_ACCEPT =
  "text/html, application/xhtml+xml, application/ld+json, application/json;q=0.9, */*;q=0.8";

/**
 * MINT-only: browser UA + Connection: close.
 * Ostatní zdroje: BranaAdminScan/1.0, bez Connection.
 */
export function sestavHlavickyScanFetch(
  url: string,
  host: string,
): Record<string, string> {
  if (jeMintTrhyZdrojUrl(url)) {
    return {
      Accept: SCAN_ACCEPT,
      "User-Agent": SCAN_USER_AGENT_MINT,
      Host: host,
      Connection: "close",
    };
  }
  return {
    Accept: SCAN_ACCEPT,
    "User-Agent": SCAN_USER_AGENT_OBECNY,
    Host: host,
  };
}
