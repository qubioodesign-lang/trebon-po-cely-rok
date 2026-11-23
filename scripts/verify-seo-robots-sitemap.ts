/**
 * Lokální seznamy sitemap a robots podle hostitele. Bez sítě a bez zápisu.
 * Spuštění: npx tsx scripts/verify-seo-robots-sitemap.ts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  SEO_CESTY_BRANA,
  SEO_CESTY_WWW,
  SEO_HOST_BRANA,
  SEO_HOST_WWW,
  SEO_ROBOTS_POVOLENA_CESTA,
  SEO_ROBOTS_ZAKAZY,
  druhSeoHostitele,
  robotsProHost,
  urlSitemapProHost,
} from "../src/lib/seo-verejne-adresy";

let selhalo = 0;

function assert(ok: boolean, popis: string): void {
  if (ok) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhalo += 1;
  console.error(`FAIL ${popis}`);
}

function stejne(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((polozka, index) => polozka === b[index]);
}

function jakoPole(hodnota: string | string[] | undefined): string[] {
  if (!hodnota) {
    return [];
  }
  return Array.isArray(hodnota) ? hodnota : [hodnota];
}

/** Nejdelší shoda. Při stejné délce vyhrává Allow. */
function robotiZakazuji(cesta: string, host: string): boolean {
  const rules = robotsProHost(host).rules;
  const pravidlo = Array.isArray(rules) ? rules[0] : rules;
  const povozeni = jakoPole(pravidlo?.allow);
  const zakazy = jakoPole(pravidlo?.disallow);
  let nejdelsi = -1;
  let zakazano = false;
  for (const povoleno of povozeni) {
    if (cesta.startsWith(povoleno) && povoleno.length >= nejdelsi) {
      nejdelsi = povoleno.length;
      zakazano = false;
    }
  }
  for (const zakaz of zakazy) {
    if (cesta.startsWith(zakaz) && zakaz.length > nejdelsi) {
      nejdelsi = zakaz.length;
      zakazano = true;
    }
  }
  return zakazano;
}

const WWW = `https://${SEO_HOST_WWW}`;
const BRANA = `https://${SEO_HOST_BRANA}`;

const sitemapWww = urlSitemapProHost(SEO_HOST_WWW);
const sitemapBrana = urlSitemapProHost(SEO_HOST_BRANA);
assert(
  stejne(sitemapWww, SEO_CESTY_WWW.map((cesta) => (cesta === "/" ? `${WWW}/` : `${WWW}${cesta}`))),
  "www sitemap má / a /informace",
);
assert(
  stejne(
    sitemapBrana,
    SEO_CESTY_BRANA.map((cesta) => (cesta === "/" ? `${BRANA}/` : `${BRANA}${cesta}`)),
  ),
  "brana sitemap má šest kanonických cest",
);
assert(
  sitemapWww.every((url) => !url.includes("?")) &&
    sitemapBrana.every((url) => !url.includes("?")),
  "sitemap nemá parametry",
);

const robotsWww = robotsProHost(SEO_HOST_WWW);
const robotsBrana = robotsProHost("BRANA.trebonpocelyrok.cz:443");
assert(robotsWww.sitemap === `${WWW}/sitemap.xml`, "www robots odkazuje na svou sitemap");
assert(robotsBrana.sitemap === `${BRANA}/sitemap.xml`, "brana robots odkazuje na svou sitemap");
assert(
  stejne(jakoPole((robotsWww.rules as { disallow?: string[] }).disallow), [
    ...SEO_ROBOTS_ZAKAZY,
  ]),
  "www má jen schválené zákazy",
);
assert(
  stejne(jakoPole((robotsBrana.rules as { disallow?: string[] }).disallow), [
    ...SEO_ROBOTS_ZAKAZY,
  ]),
  "brana má stejné konkrétní zákazy",
);
assert(
  !SEO_ROBOTS_ZAKAZY.includes("/brana" as (typeof SEO_ROBOTS_ZAKAZY)[number]),
  "plošné /brana není zákaz",
);

const povolene = [
  "/",
  "/informace",
  "/zitra",
  "/vikend",
  "/7-dni",
  "/vyhled",
  "/brana",
  "/sw.js",
  "/brana/sw.js",
  SEO_ROBOTS_POVOLENA_CESTA,
  "/manifest.json",
  "/brana/manifest.webmanifest",
  "/icon",
  "/apple-icon",
  "/brana/icon",
  "/brana/apple-icon",
  "/pwa-splash-icon",
];
for (const cesta of povolene) {
  assert(!robotiZakazuji(cesta, SEO_HOST_WWW), `www nepokrývá ${cesta}`);
  assert(!robotiZakazuji(cesta, SEO_HOST_BRANA), `brana nepokrývá ${cesta}`);
}

const zakazane = [...SEO_ROBOTS_ZAKAZY, "/admin/kalendar", "/api/polozky", "/brana/admin/analytika"];
for (const cesta of zakazane) {
  assert(robotiZakazuji(cesta, SEO_HOST_WWW), `www zakazuje ${cesta}`);
}

const preview = robotsProHost("trebon-po-cely-rok-git-main.vercel.app");
const localhost = robotsProHost("localhost:3000");
assert(druhSeoHostitele(null) === "neznamy", "prázdný host je neznámý");
assert(preview.sitemap === undefined, "preview nemá odkaz na sitemap");
assert(localhost.sitemap === undefined, "localhost nemá odkaz na sitemap");
assert(
  (preview.rules as { disallow?: string }).disallow === "/" &&
    (preview.rules as { allow?: string }).allow === undefined,
  "preview má jen Disallow: /",
);
assert(urlSitemapProHost("localhost:3000").length === 0, "localhost má prázdnou sitemap");
assert(
  urlSitemapProHost("trebon-po-cely-rok.vercel.app").join(" ").includes("trebonpocelyrok.cz") ===
    false,
  "preview sitemap neobsahuje produkční adresy",
);

const root = process.cwd();
const robotsZdroj = readFileSync(resolve(root, "src/app/robots.ts"), "utf8");
const sitemapZdroj = readFileSync(resolve(root, "src/app/sitemap.ts"), "utf8");
const middleware = readFileSync(resolve(root, "src/middleware.ts"), "utf8");
assert(
  robotsZdroj.includes('headers()') && robotsZdroj.includes('dynamic = "force-dynamic"'),
  "robots.ts čte host a je dynamický",
);
assert(
  sitemapZdroj.includes("headers()") && sitemapZdroj.includes('dynamic = "force-dynamic"'),
  "sitemap.ts čte host a je dynamický",
);
assert(
  !middleware.includes("/robots.txt") && !middleware.includes("/sitemap.xml"),
  "middleware tyto cesty nepřepisuje",
);

if (selhalo > 0) {
  console.error(`SELHALO: ${selhalo}`);
  process.exit(1);
}
console.log("VŠE OK — sitemap a robots podle hostitele");
