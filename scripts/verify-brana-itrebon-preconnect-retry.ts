/**
 * Úzký verify: jeden retry GET na www.itrebon.cz jen při 15s abortu před connect.
 * Spuštění: npx tsx scripts/verify-brana-itrebon-preconnect-retry.ts
 * READ-ONLY: žádný živý fetch / Blob / ostrý scan.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BRANA_SCAN_TIMEOUT_HLASKA,
  ITREBON_PRECONNECT_RETRY_HOST,
  jeBranaScanTimeoutHlaska,
  jeItrebonPreConnectRetryHost,
  provestSItrebonPreConnectRetry,
  smiItrebonPreConnectRetry,
  type ItrebonSitFaze,
} from "../src/lib/brana/admin/itrebon-preconnect-retry";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    fail(msg);
  }
}

const HOST = ITREBON_PRECONNECT_RETRY_HOST;
const JINY_HOST = "www.trebonsko.cz";

function preConnectTimeout(): Error {
  return new Error(BRANA_SCAN_TIMEOUT_HLASKA);
}

type HttpOdpoved = { status: number; body: string };

async function nacistJakoScan(
  hostname: string,
  get: (sitFaze: ItrebonSitFaze, cisloPokusu: 1 | 2) => Promise<HttpOdpoved>,
): Promise<string> {
  const odpoved = await provestSItrebonPreConnectRetry(hostname, get);
  if (odpoved.status < 200 || odpoved.status >= 300) {
    throw new Error(`Zdroj neodpověděl úspěšně (HTTP ${odpoved.status}).`);
  }
  return odpoved.body;
}

function zachytPhaseLogy(fn: () => Promise<void>): Promise<string[]> {
  const puvodni = console.error;
  const phase: string[] = [];
  console.error = (...args: unknown[]) => {
    if (args[0] === "[BRANA_SCAN_NET_PHASE]") {
      const payload = args[1] as { phase?: string } | undefined;
      if (typeof payload?.phase === "string") {
        phase.push(payload.phase);
      }
    }
  };
  return fn()
    .finally(() => {
      console.error = puvodni;
    })
    .then(() => phase);
}

async function overA(): Promise<void> {
  let pokusu = 0;
  const phase = await zachytPhaseLogy(async () => {
    const telo = await nacistJakoScan(HOST, async () => {
      pokusu += 1;
      if (pokusu === 1) {
        throw preConnectTimeout();
      }
      return { status: 200, body: "<html>kalendar</html>" };
    });
    assert(telo === "<html>kalendar</html>", "A: druhé tělo se nenačetlo");
  });
  assert(pokusu === 2, `A: očekávány 2 pokusy, bylo ${pokusu}`);
  assert(
    phase.includes("itrebon-preconnect-retry"),
    "A: chybí [BRANA_SCAN_NET_PHASE] itrebon-preconnect-retry",
  );
}

async function overB(): Promise<void> {
  let pokusu = 0;
  let konecna: unknown;
  const phase = await zachytPhaseLogy(async () => {
    try {
      await nacistJakoScan(HOST, async () => {
        pokusu += 1;
        throw preConnectTimeout();
      });
    } catch (error) {
      konecna = error;
    }
  });
  assert(pokusu === 2, `B: očekávány 2 pokusy, bylo ${pokusu}`);
  assert(jeBranaScanTimeoutHlaska(konecna), "B: konečná chyba musí zůstat 15s timeout");
  assert(
    konecna instanceof Error && konecna.name === "Error",
    "B: ostatní hosty i iTřeboň dál používají původní Error",
  );
  assert(
    phase.filter((p) => p === "itrebon-preconnect-retry").length === 1,
    "B: retry se smí zalogovat jen jednou (žádný třetí pokus)",
  );
}

async function overHttpBezRetry(status: number, oznaceni: string): Promise<void> {
  let pokusu = 0;
  let konecna: unknown;
  const phase = await zachytPhaseLogy(async () => {
    try {
      await nacistJakoScan(HOST, async () => {
        pokusu += 1;
        return { status, body: "chyba" };
      });
    } catch (error) {
      konecna = error;
    }
  });
  assert(pokusu === 1, `${oznaceni}: HTTP ${status} se nerretryuje`);
  assert(
    konecna instanceof Error &&
      konecna.message === `Zdroj neodpověděl úspěšně (HTTP ${status}).`,
    `${oznaceni}: musí zůstat HTTP chyba, ne timeout`,
  );
  assert(
    !phase.includes("itrebon-preconnect-retry"),
    `${oznaceni}: nesmí logovat retry`,
  );
}

async function overE(): Promise<void> {
  const poConnect: Array<(faze: ItrebonSitFaze) => void> = [
    (faze) => {
      faze.probehlConnect = true;
    },
    (faze) => {
      faze.probehlSecureConnect = true;
    },
    (faze) => {
      faze.probehlConnect = true;
      faze.probehlSecureConnect = true;
    },
  ];
  for (const zapisFaze of poConnect) {
    let pokusu = 0;
    const chyba = preConnectTimeout();
    let konecna: unknown;
    await zachytPhaseLogy(async () => {
      try {
        await nacistJakoScan(HOST, async (faze) => {
          pokusu += 1;
          zapisFaze(faze);
          throw chyba;
        });
      } catch (error) {
        konecna = error;
      }
    });
    assert(pokusu === 1, "E: timeout po connect se nerretryuje");
    assert(konecna === chyba, "E: původní chyba musí zůstat");
  }

  let pokusuReset = 0;
  const poSpojeni = Object.assign(new Error("socket hang up"), {
    code: "ECONNRESET",
  });
  try {
    await nacistJakoScan(HOST, async (faze) => {
      pokusuReset += 1;
      faze.probehlConnect = true;
      throw poSpojeni;
    });
    fail("E: ECONNRESET po spojení musí zůstat chybou");
  } catch (error) {
    assert(error === poSpojeni, "E: ECONNRESET se nerretryuje");
  }
  assert(pokusuReset === 1, "E: ECONNRESET = jeden pokus");
}

async function overF(): Promise<void> {
  let pokusu = 0;
  let konecna: unknown;
  const phase = await zachytPhaseLogy(async () => {
    try {
      await nacistJakoScan(JINY_HOST, async () => {
        pokusu += 1;
        throw preConnectTimeout();
      });
    } catch (error) {
      konecna = error;
    }
  });
  assert(pokusu === 1, "F: jiný host se touto změnou nerretryuje");
  assert(jeBranaScanTimeoutHlaska(konecna), "F: timeout jiného hostu zůstává bez retry");
  assert(
    !phase.includes("itrebon-preconnect-retry"),
    "F: jiný host nesmí logovat itrebon-preconnect-retry",
  );
}

async function overG(): Promise<void> {
  let pokusu = 0;
  const phase = await zachytPhaseLogy(async () => {
    const telo = await nacistJakoScan(HOST, async () => {
      pokusu += 1;
      return { status: 200, body: "ok" };
    });
    assert(telo === "ok", "G: úspěšné tělo");
  });
  assert(pokusu === 1, `G: očekáván 1 request, bylo ${pokusu}`);
  assert(
    !phase.includes("itrebon-preconnect-retry"),
    "G: úspěšný GET nesmí retryovat",
  );
}

function overPredikat(): void {
  assert(jeItrebonPreConnectRetryHost(HOST), "host www.itrebon.cz");
  assert(
    jeItrebonPreConnectRetryHost("WWW.ITREBON.CZ."),
    "host bez tečky a case-insensitive",
  );
  assert(!jeItrebonPreConnectRetryHost("itrebon.cz"), "bez www se nerretryuje");
  assert(!jeItrebonPreConnectRetryHost(JINY_HOST), "jiný host se nerretryuje");

  assert(
    smiItrebonPreConnectRetry({
      hostname: HOST,
      cisloPokusu: 1,
      vyprselTimeout: true,
      probehlConnect: false,
      probehlSecureConnect: false,
    }),
    "predicate: prokázaný pre-connect timeout",
  );
  assert(
    !smiItrebonPreConnectRetry({
      hostname: HOST,
      cisloPokusu: 2,
      vyprselTimeout: true,
      probehlConnect: false,
      probehlSecureConnect: false,
    }),
    "predicate: druhý pokus už ne",
  );
  assert(
    !smiItrebonPreConnectRetry({
      hostname: HOST,
      cisloPokusu: 1,
      vyprselTimeout: true,
      probehlConnect: true,
      probehlSecureConnect: false,
    }),
    "predicate: po connect ne",
  );
  assert(
    !smiItrebonPreConnectRetry({
      hostname: HOST,
      cisloPokusu: 1,
      vyprselTimeout: false,
      probehlConnect: false,
      probehlSecureConnect: false,
    }),
    "predicate: bez timeout hlášky ne",
  );
}

function vyrezFunkce(src: string, header: string): string {
  const start = src.indexOf(header);
  assert(start >= 0, `chybí ${header}`);
  const dalsi = src.indexOf("\nasync function ", start + header.length);
  const konec = dalsi >= 0 ? dalsi : src.length;
  return src.slice(start, konec);
}

function nactiScanSrc(): string {
  const tady = dirname(fileURLToPath(import.meta.url));
  return readFileSync(
    join(tady, "../src/lib/brana/admin/skenovat-zdroj.ts"),
    "utf8",
  );
}

function overZapojeniDoScanu(): void {
  const scanSrc = nactiScanSrc();
  assert(
    scanSrc.includes("const FETCH_TIMEOUT_MS = 15_000;"),
    "FETCH_TIMEOUT_MS musí zůstat 15 s",
  );
  assert(
    scanSrc.includes("const MAX_REDIRECTS = 5;"),
    "MAX_REDIRECTS musí zůstat 5",
  );
  assert(
    !/FETCH_TIMEOUT_MS\s*=\s*(30_000|60_000|30000|60000)/.test(scanSrc),
    "timeout se nesmí prodloužit",
  );
  assert(
    !scanSrc.includes("nacistTeloZdrojePoHops"),
    "redirect smyčka se nesmí znovu rozdělovat",
  );
  assert(
    !scanSrc.includes("provestJednoHttpGet"),
    "obecný per-hop GET helper se nesmí vracet",
  );
  assert(
    !scanSrc.includes("BranaScanNetTimeoutError"),
    "nový timeout Error typ nesmí platit pro všechny hosty",
  );
  assert(
    !scanSrc.includes("rejectJednou"),
    "původní reject/resolve ostatních hostů se nesmí měnit",
  );
  assert(
    scanSrc.includes('reject(new Error("Načtení zdroje vypršelo."))'),
    "ostatní hosty i timeout dál používají původní Error",
  );
  assert(
    scanSrc.includes("httpGetItrebonSPreConnectRetry"),
    "retry musí být zapojen jen v iTřeboň GET",
  );
  assert(
    scanSrc.includes("jeItrebonPreConnectRetryHost(aktualni.hostname)"),
    "retry cesta jen pro www.itrebon.cz",
  );
  assert(
    scanSrc.includes("sestavItrebonKalendarUrlky(zdroj.url)"),
    "12stránkové iTřeboň stránkování se nesmí měnit",
  );
  const jkt = scanSrc.indexOf(
    "} else if (jeItrebonDivadloJkTylaZdroj(zdroj)) {",
  );
  const gbu = scanSrc.indexOf(
    "} else if (jeItrebonGalerieBuddhistickehoUmeniZdrojUrl(zdroj.url)) {",
  );
  assert(jkt > 0 && gbu > jkt, "JKT větev musí zůstat před GBU");
}

function overJinyHostSdilanyTimeoutVeZdroji(): void {
  const scanSrc = nactiScanSrc();
  const nacist = vyrezFunkce(scanSrc, "async function nacistTeloZdroje(");
  const itrebonGet = vyrezFunkce(
    scanSrc,
    "async function httpGetItrebonSPreConnectRetry(",
  );

  assert(
    nacist.includes("const controller = new AbortController();"),
    "nacistTeloZdroje: jeden AbortController",
  );
  assert(
    (nacist.match(/new AbortController/g) ?? []).length === 1,
    "jiný host: právě jeden AbortController na celé načtení",
  );
  assert(
    nacist.includes("setTimeout(") &&
      nacist.includes("FETCH_TIMEOUT_MS") &&
      nacist.includes("controller.abort()"),
    "jiný host: jeden 15s abort na celé načtení",
  );
  assert(
    nacist.includes(
      "for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++)",
    ),
    "původní redirect smyčka v nacistTeloZdroje",
  );
  assert(
    nacist.includes("httpGetItrebonSPreConnectRetry("),
    "iTřeboň GET je jen odbočka v původní smyčce",
  );
  assert(
    nacist.includes("httpRequestNaOvereneAdresy(") &&
      nacist.includes("controller.signal"),
    "jiný host: všechny redirect hopy sdílejí stejný signal",
  );
  assert(
    itrebonGet.includes("cisloPokusu === 1") &&
      itrebonGet.includes("sdilenySignal"),
    "iTřeboň 1. pokus používá sdílený timeout",
  );
  assert(
    itrebonGet.includes("cisloPokusu") &&
      itrebonGet.includes("new AbortController()"),
    "iTřeboň 2. pokus má čerstvý 15s AbortController",
  );
}

async function overItrebonRedirectNeniRetry(): Promise<void> {
  let pokusu = 0;
  const phase = await zachytPhaseLogy(async () => {
    let cesta = "/kalendar.html";
    let telo = "";
    for (let redirect = 0; redirect <= 5; redirect++) {
      const odpoved = await provestSItrebonPreConnectRetry(HOST, async () => {
        pokusu += 1;
        if (cesta === "/kalendar.html") {
          return { status: 302, body: "" };
        }
        return { status: 200, body: "cil" };
      });
      if (odpoved.status >= 300 && odpoved.status < 400) {
        cesta = "/cil.html";
        continue;
      }
      if (odpoved.status < 200 || odpoved.status >= 300) {
        throw new Error(
          `Zdroj neodpověděl úspěšně (HTTP ${odpoved.status}).`,
        );
      }
      telo = odpoved.body;
      break;
    }
    assert(telo === "cil", "I: redirect musí doručit cílové tělo");
  });
  assert(pokusu === 2, `I: redirect = 2 hopy bez retry, bylo ${pokusu}`);
  assert(
    !phase.includes("itrebon-preconnect-retry"),
    "I: 302 po navázaném spojení není důvod k retry",
  );
}

async function overJinyHostRedirectSdilanyBudget(): Promise<void> {
  const FETCH_TIMEOUT_MS = 15_000;
  const MAX_REDIRECTS = 5;
  const hopSignaly: AbortSignal[] = [];
  let hopu = 0;

  const controller = new AbortController();
  let abortFired = 0;
  const timeout = setTimeout(() => {
    abortFired += 1;
    controller.abort();
  }, FETCH_TIMEOUT_MS);

  try {
    let cesta = "/a";
    let telo = "";
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
      const odpoved = await (async () => {
        hopu += 1;
        hopSignaly.push(controller.signal);
        if (controller.signal.aborted) {
          throw new Error("Načtení zdroje vypršelo.");
        }
        if (cesta === "/a") {
          return { status: 302, body: "" };
        }
        return { status: 200, body: "ok" };
      })();
      if (odpoved.status >= 300 && odpoved.status < 400) {
        if (redirect === MAX_REDIRECTS) {
          throw new Error("Zdroj překročil povolený počet přesměrování.");
        }
        cesta = "/b";
        continue;
      }
      if (odpoved.status < 200 || odpoved.status >= 300) {
        throw new Error(
          `Zdroj neodpověděl úspěšně (HTTP ${odpoved.status}).`,
        );
      }
      telo = odpoved.body;
      break;
    }
    assert(telo === "ok", "H: jiný host redirect chain doručí tělo");
  } finally {
    clearTimeout(timeout);
  }

  assert(hopu === 2, `H: 2 hopy, bylo ${hopu}`);
  assert(
    hopSignaly.length === 2 && hopSignaly[0] === hopSignaly[1],
    "H: oba hopy sdílejí tentýž AbortSignal",
  );
  assert(abortFired === 0, "H: úspěšný redirect nesmí spustit 15s abort");
  assert(!hopSignaly[0].aborted, "H: sdílený signal zůstává živý");

  const poVycepani = new AbortController();
  const timerPoVycepani = setTimeout(() => poVycepani.abort(), FETCH_TIMEOUT_MS);
  try {
    poVycepani.abort();
    const t0 = Date.now();
    assert(poVycepani.signal.aborted, "H: budget vyčerpán před 2. hopem");
    const hop2Ms = Date.now() - t0;
    assert(
      hop2Ms < 50,
      "H: 2. hop po vyčerpání společného budgetu končí hned, ne po nových 15s",
    );
  } finally {
    clearTimeout(timerPoVycepani);
  }
}

async function overJinyHostBezNovehoRetry(): Promise<void> {
  await overF();
  await overJinyHostRedirectSdilanyBudget();
  for (const status of [404, 500] as const) {
    let pokusu = 0;
    try {
      await nacistJakoScan(JINY_HOST, async () => {
        pokusu += 1;
        return { status, body: "chyba" };
      });
      fail(`jiný host HTTP ${status} musí selhat`);
    } catch (error) {
      assert(
        error instanceof Error &&
          error.message === `Zdroj neodpověděl úspěšně (HTTP ${status}).`,
        `jiný host HTTP ${status}`,
      );
    }
    assert(pokusu === 1, `jiný host HTTP ${status}: právě 1 pokus`);
  }
}

async function main(): Promise<void> {
  overPredikat();
  overZapojeniDoScanu();
  overJinyHostSdilanyTimeoutVeZdroji();
  await overG();
  await overA();
  await overB();
  await overE();
  await overHttpBezRetry(500, "C");
  await overHttpBezRetry(404, "D");
  await overItrebonRedirectNeniRetry();
  await overJinyHostBezNovehoRetry();
  console.log("OK itrebon pre-connect retry A–I");
}

void main();
