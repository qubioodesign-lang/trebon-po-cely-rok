import "server-only";

import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import type { LookupAddress } from "node:dns";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import {
  pridatCekajiciAutomatickeUdalostiZeScanu,
  pridatCekajiciAutomatickeUdalostiZeScanuProScheduler,
  type BranaScanAutomatickaUdalostVstup,
  type PridatCekajiciZeScanuVysledek,
} from "./konkretni-udalosti-uloziste";
import {
  nacistRedakcniPoradi,
  nacistRedakcniPoradiProScheduler,
  type NacistRedakcniPoradiVysledek,
} from "./redakcni-poradi-uloziste";
import { jePlatnaZdrojUrl, doplnVychoziPoleZdroje, type BranaZdroj } from "./zdroj";
import {
  deduplikovatScanKandidaty,
  BRANA_TRHY_REDAKCNI_POLOZKA_ID,
  jeDumStepankaNetolickehoZdrojUrl,
  jeCityEventTrhyZdrojUrl,
  jeMintTrhyZdrojUrl,
  jeRybarstviZdrojUrl,
  jeTrebonskoRemeslneTrhyZdrojUrl,
  jeZameckaLekarnaZdrojUrl,
  parsovatUdalostiZeZdroje,
  sestavDumStepankaKalendarUrlkyCtyriMesice,
  sestavRybarstviPodzimniVylovyUrl,
  sestavZameckaLekarnaHubUrl,
  vytahnoutZameckaLekarnaMesicUrlky,
  type BranaScanKandidat,
} from "./zdroj-scan-parser";
import { sestavJazykBranyPoSparovani } from "./jazyk-brany-po-sparovani";
import {
  dnesIsoVPraze,
  jeUdalostCelaMinula,
} from "./konkretni-udalost";
import {
  vytvoritNezarazenyKlic,
  type BranaNezarazenyScanKandidat,
} from "./nezarazene";
import {
  ulozitNesparovaneNezarazene,
  ulozitNesparovaneNezarazeneProScheduler,
  vyresitNezarazenePoUspesnemMatchi,
  vyresitNezarazenePoUspesnemMatchiProScheduler,
} from "./nezarazene-uloziste";
import {
  sparovatSHlidanymiKotvami,
  sparovatSRedakcniPolozkou,
  sparovatVlastnictvimHlidaneKotvy,
} from "./zdroj-scan-sparovani";
import {
  sestavHlavickyScanFetch,
} from "./scan-fetch-hlavicky";
import {
  nacistZdroje,
  nacistZdrojeProScheduler,
  type NacistZdrojeVysledek,
} from "./zdroje-uloziste";

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
    // DOČASNÁ DIAGNOSTIKA – odstranit po získání produkčního důkazu.
    const requestStartedAt = Date.now();
    const logPhase = (
      phase: string,
      extra: Record<string, string | number | boolean | null | undefined> = {},
    ) => {
      console.error("[BRANA_SCAN_NET_PHASE]", {
        phase,
        protocol: cil.protocol,
        requestHostnameIsIP: isIP(
          typeof pinned.address === "string" ? pinned.address : "",
        ),
        family: pinned.family,
        port: cil.port || (cil.protocol === "https:" ? 443 : 80),
        elapsedMs: Date.now() - requestStartedAt,
        ...extra,
      });
    };

    if (signal.aborted) {
      logPhase("abort-signal");
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
      headers: sestavHlavickyScanFetch(cil.toString(), cil.host),
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

    // DOČASNÁ DIAGNOSTIKA – odstranit po získání produkčního důkazu.
    logPhase("before-request");

    const req = transport.request(requestOptions, (res) => {
      // DOČASNÁ DIAGNOSTIKA – odstranit po získání produkčního důkazu.
      logPhase("response", { statusCode: res.statusCode ?? null });

      const kusy: Buffer[] = [];
      let celkem = 0;
      let firstDataLogged = false;
      res.on("data", (chunk: Buffer) => {
        // DOČASNÁ DIAGNOSTIKA – odstranit po získání produkčního důkazu.
        if (!firstDataLogged) {
          firstDataLogged = true;
          logPhase("first-data");
        }
        celkem += chunk.length;
        if (celkem > FETCH_MAX_BYTU) {
          req.destroy();
          reject(new Error("Odpověď zdroje je příliš velká."));
          return;
        }
        kusy.push(chunk);
      });
      res.on("end", () => {
        // DOČASNÁ DIAGNOSTIKA – odstranit po získání produkčního důkazu.
        logPhase("response-end");
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: Buffer.concat(kusy),
          finalUrl: cil,
        });
      });
      res.on("error", reject);
    });

    // DOČASNÁ DIAGNOSTIKA – odstranit po získání produkčního důkazu.
    req.on("socket", (socket) => {
      const socketFamily =
        "remoteFamily" in socket && typeof socket.remoteFamily === "string"
          ? socket.remoteFamily
          : undefined;
      const encrypted =
        "encrypted" in socket ? Boolean(socket.encrypted) : false;
      logPhase("socket", {
        socketFamily: socketFamily ?? null,
        encrypted,
      });
      socket.on("connect", () => {
        const connectFamily =
          "remoteFamily" in socket && typeof socket.remoteFamily === "string"
            ? socket.remoteFamily
            : undefined;
        logPhase("connect", {
          socketFamily: connectFamily ?? null,
          encrypted:
            "encrypted" in socket ? Boolean(socket.encrypted) : false,
        });
      });
      // TLS: secureConnect existuje na TLSSocket.
      if (
        cil.protocol === "https:" &&
        "on" in socket &&
        typeof (socket as { on?: unknown }).on === "function"
      ) {
        socket.on("secureConnect", () => {
          logPhase("secureConnect", {
            socketFamily:
              "remoteFamily" in socket &&
              typeof socket.remoteFamily === "string"
                ? socket.remoteFamily
                : null,
            encrypted: true,
          });
        });
      }
    });

    const onAbort = () => {
      // DOČASNÁ DIAGNOSTIKA – odstranit po získání produkčního důkazu.
      logPhase("abort-listener");
      req.destroy();
      reject(new Error("Načtení zdroje vypršelo."));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    req.on("timeout", () => {
      // DOČASNÁ DIAGNOSTIKA – odstranit po získání produkčního důkazu.
      logPhase("req-timeout");
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
  // DOČASNÁ DIAGNOSTIKA – odstranit po získání produkčního důkazu.
  const abortSignalStartedAt = Date.now();
  const timeout = setTimeout(() => {
    console.error("[BRANA_SCAN_NET_PHASE]", {
      phase: "abort-signal",
      elapsedMs: Date.now() - abortSignalStartedAt,
    });
    controller.abort();
  }, FETCH_TIMEOUT_MS);

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
 * Jádro scanu jednoho známého zdroje (bez auth).
 * URL bere výhradně ze serverově načteného data/brana-zdroje.json.
 * Nemění posledniScanDokoncen. Nové události → CEKA_NA_SCHVALENI.
 */
async function skenovatZnamyZdrojJadro(
  zdrojId: string,
  nacistZdrojeFn: () => Promise<NacistZdrojeVysledek>,
  nacistRedakcniFn: () => Promise<NacistRedakcniPoradiVysledek>,
  pridatCekajiciFn: (
    kandidati: readonly BranaScanAutomatickaUdalostVstup[],
  ) => Promise<PridatCekajiciZeScanuVysledek>,
  ulozitNesparovaneFn: (args: {
    zdrojId: string;
    zdrojNazev: string;
    nesparovane: readonly BranaNezarazenyScanKandidat[];
  }) => Promise<void>,
  vyresitNezarazeneFn: (
    uspesneZpracovaneKlice: readonly string[],
  ) => Promise<void>,
): Promise<BranaSkenovatZdrojVysledek> {
  const id = typeof zdrojId === "string" ? zdrojId.trim() : "";
  if (!id) {
    throw new Error("Chybí id zdroje.");
  }

  const zdroje = await nacistZdrojeFn();
  if (!zdroje.ok) {
    throw new Error("Seznam zdrojů se nepodařilo načíst.");
  }

  const zdrojSurovy: BranaZdroj | undefined = zdroje.zdroje.find(
    (z) => z.id === id,
  );
  if (!zdrojSurovy) {
    throw new Error("Zdroj nebyl nalezen.");
  }
  const zdroj = doplnVychoziPoleZdroje(zdrojSurovy);

  // HLIDANE_KOTVY bez kotev: fail-closed, žádný fetch/zápis.
  if (
    zdroj.rezimScanu === "HLIDANE_KOTVY" &&
    zdroj.hlidaneRedakcniPolozkaIds.length === 0
  ) {
    return {
      nalezeno: 0,
      pridanoDoKalendare: 0,
      jizExistuje: 0,
      nezarazeno: 0,
    };
  }

  // DSN: 4 SSR měsíce kalendáře.
  // Zámecká lékárna: hub → discovery zveřejněných měsíců (max 4) → parse.
  // Rybářství Třeboň: 1 fetch autoritativní /podzimni-vylov-rybniku.
  // Ostatní zdroje: 1 fetch = 1 URL.
  let kandidati: BranaScanKandidat[];
  if (jeDumStepankaNetolickehoZdrojUrl(zdroj.url)) {
    const urlky = sestavDumStepankaKalendarUrlkyCtyriMesice(zdroj.url);
    const sloucene: BranaScanKandidat[] = [];
    for (const mesicUrl of urlky) {
      const { text, contentType } = await nacistTeloZdroje(mesicUrl);
      sloucene.push(...parsovatUdalostiZeZdroje(text, contentType));
    }
    kandidati = deduplikovatScanKandidaty(sloucene);
  } else if (jeZameckaLekarnaZdrojUrl(zdroj.url)) {
    const hubUrl = sestavZameckaLekarnaHubUrl(zdroj.url);
    const { text: hubHtml } = await nacistTeloZdroje(hubUrl);
    const mesice = vytahnoutZameckaLekarnaMesicUrlky(hubHtml, hubUrl);
    const sloucene: BranaScanKandidat[] = [];
    for (const mesicUrl of mesice) {
      const { text, contentType } = await nacistTeloZdroje(mesicUrl);
      sloucene.push(...parsovatUdalostiZeZdroje(text, contentType));
    }
    kandidati = deduplikovatScanKandidaty(sloucene);
  } else if (jeRybarstviZdrojUrl(zdroj.url)) {
    const vylovyUrl = sestavRybarstviPodzimniVylovyUrl(zdroj.url);
    const { text, contentType } = await nacistTeloZdroje(vylovyUrl);
    kandidati = parsovatUdalostiZeZdroje(text, contentType);
  } else {
    const { text, contentType } = await nacistTeloZdroje(zdroj.url);
    kandidati = parsovatUdalostiZeZdroje(text, contentType);
  }

  const redakcni = await nacistRedakcniFn();
  if (!redakcni.ok) {
    throw new Error("Redakční pořadí se nepodařilo načíst. Nic nebylo uloženo.");
  }

  const hlidaneKotvy = zdroj.rezimScanu === "HLIDANE_KOTVY";

  let nezarazeno = 0;
  const kUlozeni: BranaScanAutomatickaUdalostVstup[] = [];
  const nesparovane: BranaNezarazenyScanKandidat[] = [];
  const uspesneZpracovaneKlice: string[] = [];
  const dnesIso = dnesIsoVPraze();

  for (const kandidat of kandidati) {
    // Skončená událost: ignorovat (ani CEKA, ani Nezařazené).
    if (jeUdalostCelaMinula(kandidat, dnesIso)) {
      continue;
    }

    const sparovani =
      hlidaneKotvy &&
      (jeTrebonskoRemeslneTrhyZdrojUrl(zdroj.url) ||
        jeCityEventTrhyZdrojUrl(zdroj.url) ||
        jeMintTrhyZdrojUrl(zdroj.url))
        ? sparovatVlastnictvimHlidaneKotvy(
            redakcni.polozky,
            zdroj.hlidaneRedakcniPolozkaIds,
            BRANA_TRHY_REDAKCNI_POLOZKA_ID,
          )
        : hlidaneKotvy
          ? sparovatSHlidanymiKotvami(
              kandidat,
              redakcni.polozky,
              zdroj.hlidaneRedakcniPolozkaIds,
            )
          : sparovatSRedakcniPolozkou(kandidat, redakcni.polozky, {
              zdrojNazev: zdroj.nazev,
            });

    if (!sparovani.ok) {
      // Bohatý zdroj: neshody se neposílají do Nezařazených (provozní šum).
      if (hlidaneKotvy) {
        continue;
      }
      nezarazeno += 1;
      nesparovane.push({
        nazev: kandidat.nazev,
        datumOd: kandidat.datumOd,
        datumDo: kandidat.datumDo,
        cas: kandidat.cas,
        mistoNeboTyp: kandidat.mistoNeboTyp,
      });
      continue;
    }
    const pravidlo = redakcni.polozky.find(
      (p) => p.id === sparovani.redakcniPolozkaId,
    );
    const jazyk = sestavJazykBranyPoSparovani({
      polozka: pravidlo?.polozka ?? "",
      kandidatMisto: kandidat.mistoNeboTyp,
      zdrojNazev: zdroj.nazev,
      jazykVerejny: pravidlo?.jazykVerejny ?? null,
    });
    kUlozeni.push({
      redakcniPolozkaId: sparovani.redakcniPolozkaId,
      datumOd: kandidat.datumOd,
      datumDo: kandidat.datumDo,
      cas: kandidat.cas,
      mistoNeboTyp: jazyk.mistoNeboTyp,
      nazev: kandidat.nazev,
      ...(jazyk.verejneCo !== undefined
        ? {
            verejneCo: jazyk.verejneCo,
            verejneRozliseni: jazyk.verejneRozliseni ?? null,
          }
        : {}),
    });
    uspesneZpracovaneKlice.push(
      vytvoritNezarazenyKlic({
        zdrojId: zdroj.id,
        datumOd: kandidat.datumOd,
        cas: kandidat.cas,
        nazev: kandidat.nazev,
      }),
    );
  }

  // 1) NO-MATCH do inboxu dřív, než CEKA writer (nesmí se ztratit při chybě CEKA).
  await ulozitNesparovaneFn({
    zdrojId: zdroj.id,
    zdrojNazev: zdroj.nazev,
    nesparovane,
  });

  // 2) Standardní MATCH → CEKA / jizExistuje.
  const ulozeni = await pridatCekajiciFn(kUlozeni);

  // 3) Resolve otevřených jen po úspěšném writeru (bez throw).
  await vyresitNezarazeneFn(uspesneZpracovaneKlice);

  return {
    nalezeno: kandidati.length,
    pridanoDoKalendare: ulozeni.pridano,
    jizExistuje: ulozeni.jizExistuje,
    nezarazeno,
  };
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

  return skenovatZnamyZdrojJadro(
    zdrojId,
    nacistZdroje,
    nacistRedakcniPoradi,
    pridatCekajiciAutomatickeUdalostiZeScanu,
    ulozitNesparovaneNezarazene,
    vyresitNezarazenePoUspesnemMatchi,
  );
}

/**
 * Stejný scan jednoho zdroje pro důvěryhodný scheduler (po ověření CRON_SECRET).
 * Bez admin session. Nemění posledniScanDokoncen. Žádný push.
 */
export async function skenovatZnamyZdrojProScheduler(
  zdrojId: string,
): Promise<BranaSkenovatZdrojVysledek> {
  return skenovatZnamyZdrojJadro(
    zdrojId,
    nacistZdrojeProScheduler,
    nacistRedakcniPoradiProScheduler,
    pridatCekajiciAutomatickeUdalostiZeScanuProScheduler,
    ulozitNesparovaneNezarazeneProScheduler,
    vyresitNezarazenePoUspesnemMatchiProScheduler,
  );
}
