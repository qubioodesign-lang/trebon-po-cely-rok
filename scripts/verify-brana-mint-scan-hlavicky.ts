/**
 * Regrese: MINT-specifické HTTP hlavičky scanu (bez síťového volání).
 * Spuštění: npx tsx scripts/verify-brana-mint-scan-hlavicky.ts
 */

import {
  SCAN_USER_AGENT_MINT,
  SCAN_USER_AGENT_OBECNY,
  sestavHlavickyScanFetch,
} from "../src/lib/brana/admin/scan-fetch-hlavicky";
import { jeMintTrhyZdrojUrl } from "../src/lib/brana/admin/zdroj-scan-parser";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) fail(msg);
}

const MINT_URL = "https://www.mintmarket.cz/";
const MINT_DETAIL = "https://www.mintmarket.cz/cs/trh/trebon-12";
const TREBONSKO_URL = "https://www.trebonsko.cz/remeslne-trhy-trebon";
const CITYEVENT_URL = "https://www.cityevent.cz/pro-ucastniky/";
const RYBARSTVI_URL = "https://www.rybarstvi.cz/podzimni-vylov-rybniku";

assert(jeMintTrhyZdrojUrl(MINT_URL), "mint listing gate");
assert(jeMintTrhyZdrojUrl(MINT_DETAIL), "mint detail gate");
assert(!jeMintTrhyZdrojUrl(TREBONSKO_URL), "trebonsko ≠ mint");
assert(!jeMintTrhyZdrojUrl(CITYEVENT_URL), "cityevent ≠ mint");

const mint = sestavHlavickyScanFetch(MINT_URL, "www.mintmarket.cz");
assert(mint["User-Agent"] === SCAN_USER_AGENT_MINT, "MINT browser UA");
assert(mint.Connection === "close", "MINT Connection: close");
assert(mint.Host === "www.mintmarket.cz", "MINT Host");
assert(!SCAN_USER_AGENT_MINT.includes("BranaAdminScan"), "MINT UA ≠ obecný");

const mintDetail = sestavHlavickyScanFetch(MINT_DETAIL, "www.mintmarket.cz");
assert(
  mintDetail["User-Agent"] === SCAN_USER_AGENT_MINT,
  "MINT detail browser UA",
);
assert(mintDetail.Connection === "close", "MINT detail Connection: close");

for (const [label, url, host] of [
  ["Třeboňsko", TREBONSKO_URL, "www.trebonsko.cz"],
  ["City Event", CITYEVENT_URL, "www.cityevent.cz"],
  ["Rybářství", RYBARSTVI_URL, "www.rybarstvi.cz"],
] as const) {
  const h = sestavHlavickyScanFetch(url, host);
  assert(
    h["User-Agent"] === SCAN_USER_AGENT_OBECNY,
    `${label}: UA BranaAdminScan/1.0`,
  );
  assert(h.Connection === undefined, `${label}: bez Connection`);
  assert(h.Host === host, `${label}: Host`);
}

console.log("OK MINT scan hlavičky izolované; ostatní zdroje beze změny");
