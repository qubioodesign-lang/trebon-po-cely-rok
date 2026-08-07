import "server-only";

import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import type { LookupAddress } from "node:dns";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import { pridatCekajiciAutomatickeUdalostiZeScanu } from "./konkretni-udalosti-uloziste";
import { nacistRedakcniPoradi } from "./redakcni-poradi-uloziste";
import { jePlatnaZdrojUrl } from "./zdroj";
import { parsovatUdalostiZeZdroje } from "./zdroj-scan-parser";
import { sparovatSRedakcniPolozkou } from "./zdroj-scan-sparovani";
import { nacistZdroje } from "./zdroje-uloziste";

const FETCH_TIMEOUT_MS = 15_000;
const FETCH_MAX_BYTU = 1_500_000;
const MAX_REDIRECTS = 5;

export type BranaSkenovatZdrojVysledek = {
  nalezeno: number;
  pridanoDoKalendare: number;
  jizExistuje: number;
  nezarazeno: number;
};

function jeBlokovanyHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".intranet") ||
    host === "metadata.google.internal"
  );
}

function jeZakazanaIpv4(ip: string): boolean {
  const casti = ip.split(".").map(Number);
  if (casti.length !== 4 || casti.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = casti;
  if (a === 0 || a === 10 || a === 127) {
    return true;
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 192 && b === 0 && (casti[2] === 0 || casti[2] === 2)) {
    return true;
  }
  if (a === 198 && (b === 18 || b === 19)) {
    return true;
  }
  if (a >= 224) {
    return true;
  }
  return false;
}

function jeZakazanaIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  const mappedV4 = lower.match(/^::ffff:((?:\d{1,3}\.){3}\d{1,3})$/i);
  if (mappedV4) {
    return jeZakazanaIpv4(mappedV4[1]);
  }

  const hexty = rozsirIpv6(lower);
  if (!hexty) {
    return true;
  }
  // IPv4-mapped IPv6 (::ffff:0:0/96)
  if (
    hexty[0] === 0 &&
    hexty[1] === 0 &&
    hexty[2] === 0 &&
    hexty[3] === 0 &&
    hexty[4] === 0 &&
    hexty[5] === 0xffff
  ) {
    const v4 = [
      (hexty[6] >> 8) & 0xff,
      hexty[6] & 0xff,
      (hexty[7] >> 8) & 0xff,
      hexty[7] & 0xff,
    ].join(".");
    return jeZakazanaIpv4(v4);
  }
  // unspecified ::
  if (hexty.every((h) => h === 0)) {
    return true;
  }
  // loopback ::1
  if (
    hexty[0] === 0 &&
    hexty[1] === 0 &&
    hexty[2] === 0 &&
    hexty[3] === 0 &&
    hexty[4] === 0 &&
    hexty[5] === 0 &&
    hexty[6] === 0 &&
    hexty[7] === 1
  ) {
    return true;
  }
  // unique local fc00::/7
  if ((hexty[0] & 0xfe00) === 0xfc00) {
    return true;
  }
  // link-local fe80::/10
  if ((hexty[0] & 0xffc0) === 0xfe80) {
    return true;
  }
  // multicast ff00::/8
  if ((hexty[0] & 0xff00) === 0xff00) {
    return true;
  }
  return false;
}

function rozsirIpv6(ip: string): number[] | null {
  if (ip.includes(".")) {
    return null;
  }

  const strany = ip.split("::");
  if (strany.length > 2) {
    return null;
  }
  const leva = strany[0] ? strany[0].split(":") : [];
  const prava = strany.length === 2 && strany[1] ? strany[1].split(":") : [];
  if (leva.some((x) => x === "") || prava.some((x) => x === "")) {
    return null;
  }
  const chybi = 8 - (leva.length + prava.length);
  if (strany.length === 2) {
    if (chybi < 0) {
      return null;
    }
  } else if (leva.length !== 8) {
    return null;
  }
  const hexty = [
    ...leva,
    ...Array(strany.length === 2 ? chybi : 0).fill("0"),
    ...prava,
  ];
  if (hexty.length !== 8) {
    return null;
  }
  const hodnoty = hexty.map((h) => Number.parseInt(h || "0", 16));
  if (hodnoty.some((n) => !Number.isInteger(n) || n < 0 || n > 0xffff)) {
    return null;
  }
  return hodnoty;
}

function jeZakazanaIp(ip: string): boolean {
  const verze = isIP(ip);
  if (verze === 4) {
    return jeZakazanaIpv4(ip);
  }
  if (verze === 6) {
    return jeZakazanaIpv6(ip);
  }
  return true;
}

function overitUrlProFetch(url: string): URL {
  if (!jePlatnaZdrojUrl(url)) {
    throw new Error("URL zdroje musí začínat http:// nebo https://.");
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("URL zdroje není platná.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Povoleny jsou pouze protokoly http a https.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("URL zdroje nesmí obsahovat přihlašovací údaje.");
  }
  if (jeBlokovanyHostname(parsed.hostname)) {
    throw new Error("URL zdroje není pro serverový fetch povolená.");
  }
  return parsed;
}

/**
 * Přeloží hostname a ověří VŠECHNY resolved adresy.
 * Následný TCP/TLS connect jde přímo na ověřenou pinned IP
 * (bez DNS / custom lookup při socket connection).
 */
async function resolvovatAOveritHostname(
  hostname: string,
): Promise<LookupAddress[]> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (jeZakazanaIp(host)) {
      throw new Error("URL zdroje směřuje na zakázanou interní adresu.");
    }
    return [{ address: host, family: isIP(host) as 4 | 6 }];
  }

  let adresy: LookupAddress[];
  try {
    adresy = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error("Hostname zdroje se nepodařilo přeložit.");
  }
  if (adresy.length === 0) {
    throw new Error("Hostname zdroje nevrátil žádnou IP adresu.");
  }
  for (const adresa of adresy) {
    if (jeZakazanaIp(adresa.address)) {
      throw new Error("URL zdroje směřuje na zakázanou interní adresu.");
    }
  }
  return adresy;
}

type FetchVysledek = {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
  finalUrl: URL;
};

function httpRequestNaOvereneAdresy(
  cil: URL,
  overeneAdresy: LookupAddress[],
  signal: AbortSignal,
): Promise<FetchVysledek> {
  const transport = cil.protocol === "https:" ? https : http;
  const pinned = overeneAdresy[0];
  // Původní hostname pro Host / SNI / ověření certifikátu (nikoli pinned IP).
  const puvodniHostname = cil.hostname.replace(/^\[|\]$/g, "");

  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("Načtení zdroje vypršelo."));
      return;
    }

    // Stejné options, které půjdou do transport.request – diagnostika čte přímo je.
    const requestOptions = {
      protocol: cil.protocol,
      // TCP přímo na ověřenou IP – Node přeskočí DNS (isIP(hostname)).
      hostname: pinned.address,
      port: cil.port || (cil.protocol === "https:" ? 443 : 80),
      path: `${cil.pathname}${cil.search}`,
      method: "GET",
      family: pinned.family,
      headers: {
        Accept:
          "text/html, application/xhtml+xml, application/ld+json, application/json;q=0.9, */*;q=0.8",
        "User-Agent": "BranaAdminScan/1.0",
        // Host zůstává původní hostname (+ nestandardní port z URL).
        Host: cil.host,
      },
      timeout: FETCH_TIMEOUT_MS,
      // HTTPS: SNI + ověření certifikátu proti původnímu hostname, ne proti IP.
      servername: puvodniHostname,
    };

    // DOČASNÁ DIAGNOSTIKA – odstranit po získání produkčního důkazu.
    console.error("[BRANA_SCAN_NET_DIAG]", {
      puvodniHostname,
      protocol: requestOptions.protocol,
      pinnedAddressTypeof: typeof pinned.address,
      pinnedAddressNonEmptyString:
        typeof pinned.address === "string" && pinned.address.length > 0,
      pinnedAddressIsIP: isIP(
        typeof pinned.address === "string" ? pinned.address : "",
      ),
      pinnedFamily: pinned.family,
      requestHostnameTypeof: typeof requestOptions.hostname,
      requestHostnameIsIP: isIP(
        typeof requestOptions.hostname === "string"
          ? requestOptions.hostname
          : "",
      ),
      requestHostnameEqualsPinned:
        requestOptions.hostname === pinned.address,
      servername: requestOptions.servername,
      port: requestOptions.port,
      family: requestOptions.family,
      hasCustomLookup: "lookup" in requestOptions,
      autoSelectFamilyExplicit:
        "autoSelectFamily" in requestOptions
          ? (requestOptions as { autoSelectFamily?: boolean }).autoSelectFamily
          : "nenastaveno",
      resolvedCount: overeneAdresy.length,
      resolvedFamilies: overeneAdresy.map((a) => a.family),
    });

    const req = transport.request(requestOptions, (res) => {
      const kusy: Buffer[] = [];
      let celkem = 0;
      res.on("data", (chunk: Buffer) => {
        celkem += chunk.length;
        if (celkem > FETCH_MAX_BYTU) {
          req.destroy();
          reject(new Error("Odpověď zdroje je příliš velká."));
          return;
        }
        kusy.push(chunk);
      });
      res.on("end", () => {
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: Buffer.concat(kusy),
          finalUrl: cil,
        });
      });
      res.on("error", reject);
    });

    const onAbort = () => {
      req.destroy();
      reject(new Error("Načtení zdroje vypršelo."));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Načtení zdroje vypršelo."));
    });
    req.on("error", (error) => {
      // DOČASNÁ DIAGNOSTIKA – odstranit po získání produkčního důkazu.
      if (error instanceof Error) {
        const nodeErr = error as NodeJS.ErrnoException;
        console.error("[BRANA_SCAN_NET_DIAG_ERROR]", {
          name: error.name,
          message: error.message,
          code: nodeErr.code,
          errno: nodeErr.errno,
          syscall: nodeErr.syscall,
          stack: error.stack,
        });
      } else {
        console.error("[BRANA_SCAN_NET_DIAG_ERROR]", {
          nonErrorType: typeof error,
        });
      }
      reject(error);
    });
    req.end();
  });
}

async function nacistTeloZdroje(
  url: string,
): Promise<{ text: string; contentType: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let aktualni = overitUrlProFetch(url);

    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
      const overeneAdresy = await resolvovatAOveritHostname(aktualni.hostname);
      const odpoved = await httpRequestNaOvereneAdresy(
        aktualni,
        overeneAdresy,
        controller.signal,
      );

      if (odpoved.status >= 300 && odpoved.status < 400) {
        const location = odpoved.headers.location;
        if (typeof location !== "string" || !location.trim()) {
          throw new Error("Redirect zdroje nemá platnou Location.");
        }
        if (redirect === MAX_REDIRECTS) {
          throw new Error("Zdroj překročil povolený počet přesměrování.");
        }
        // Každý redirect target znovu projde URL + DNS kontrolou.
        aktualni = overitUrlProFetch(new URL(location, aktualni).toString());
        continue;
      }

      if (odpoved.status < 200 || odpoved.status >= 300) {
        throw new Error(
          `Zdroj neodpověděl úspěšně (HTTP ${odpoved.status}).`,
        );
      }

      const contentTypeHeader = odpoved.headers["content-type"];
      const contentType = Array.isArray(contentTypeHeader)
        ? contentTypeHeader[0] ?? null
        : contentTypeHeader ?? null;

      return {
        text: odpoved.body.toString("utf8"),
        contentType,
      };
    }

    throw new Error("Zdroj překročil povolený počet přesměrování.");
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Načtení zdroje vypršelo.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Ruční scan jednoho známého zdroje podle jeho id.
 * URL bere výhradně ze serverově načteného data/brana-zdroje.json.
 * Nemění posledniScanDokoncen.
 */
export async function skenovatZnamyZdroj(
  zdrojId: string,
): Promise<BranaSkenovatZdrojVysledek> {
  if (!(await jeAdminPrihlasen())) {
    throw new Error("Nejste přihlášeni.");
  }

  const id = typeof zdrojId === "string" ? zdrojId.trim() : "";
  if (!id) {
    throw new Error("Chybí id zdroje.");
  }

  const zdroje = await nacistZdroje();
  if (!zdroje.ok) {
    throw new Error("Seznam zdrojů se nepodařilo načíst.");
  }

  const zdroj = zdroje.zdroje.find((z) => z.id === id);
  if (!zdroj) {
    throw new Error("Zdroj nebyl nalezen.");
  }

  const { text, contentType } = await nacistTeloZdroje(zdroj.url);
  const kandidati = parsovatUdalostiZeZdroje(text, contentType);

  const redakcni = await nacistRedakcniPoradi();
  if (!redakcni.ok) {
    throw new Error("Redakční pořadí se nepodařilo načíst. Nic nebylo uloženo.");
  }

  let nezarazeno = 0;
  const kUlozeni: Array<{
    redakcniPolozkaId: string;
    datumOd: string;
    datumDo: string;
    cas: string;
    mistoNeboTyp: string;
    nazev: string;
  }> = [];

  for (const kandidat of kandidati) {
    const sparovani = sparovatSRedakcniPolozkou(kandidat, redakcni.polozky);
    if (!sparovani.ok) {
      nezarazeno += 1;
      continue;
    }
    kUlozeni.push({
      redakcniPolozkaId: sparovani.redakcniPolozkaId,
      datumOd: kandidat.datumOd,
      datumDo: kandidat.datumDo,
      cas: kandidat.cas,
      mistoNeboTyp: kandidat.mistoNeboTyp || zdroj.nazev,
      nazev: kandidat.nazev,
    });
  }

  const ulozeni = await pridatCekajiciAutomatickeUdalostiZeScanu(kUlozeni);

  return {
    nalezeno: kandidati.length,
    pridanoDoKalendare: ulozeni.pridano,
    jizExistuje: ulozeni.jizExistuje,
    nezarazeno,
  };
}
