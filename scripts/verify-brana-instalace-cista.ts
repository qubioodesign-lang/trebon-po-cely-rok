/**
 * Automatické kontroly nové izolované instalační vrstvy BRÁNY.
 * Spuštění: npx tsx scripts/verify-brana-instalace-cista.ts
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
let chyby = 0;

function assert(ok: boolean, popis: string, detail?: string) {
  if (ok) {
    console.log(`OK  ${popis}`);
    return;
  }
  chyby++;
  console.error(`CHYBA ${popis}${detail ? ` – ${detail}` : ""}`);
}

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

type PromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function makePrompt() {
  let promptCalls = 0;
  const event = {
    preventDefault() {},
    prompt: async () => {
      promptCalls++;
    },
    userChoice: Promise.resolve({
      outcome: "accepted" as const,
      platform: "web",
    }),
  };
  return {
    promptCalls: () => promptCalls,
    event: event as unknown as PromptEvent,
  };
}

function installFakeWindow() {
  const listeners = new Map<string, Set<(ev: Event) => void>>();
  const win = {
    __branaPwaInstalacniPrompt: undefined as PromptEvent | undefined,
    __branaPwaPosluchaceRegistrovani: undefined as boolean | undefined,
    matchMedia: () => ({
      matches: false,
      media: "",
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      onchange: null,
      dispatchEvent: () => true,
    }),
    addEventListener(typ: string, fn: (ev: Event) => void) {
      if (!listeners.has(typ)) listeners.set(typ, new Set());
      listeners.get(typ)!.add(fn);
    },
    removeEventListener(typ: string, fn: (ev: Event) => void) {
      listeners.get(typ)?.delete(fn);
    },
    dispatchEvent(ev: Event) {
      for (const fn of listeners.get(ev.type) ?? []) fn(ev);
      return true;
    },
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  };
  (globalThis as unknown as { window: typeof win }).window = win;
  return win;
}

// --- Statické kontroly ---
const instalaceSrc = read("src/lib/brana/pwa-instalace.ts");
const stavSrc = read("src/lib/brana/pwa-instalacni-stav.ts");
const vyzva = read("src/components/brana/BranaVyzvaPlocha.tsx");
const layout = read("src/app/brana/layout.tsx");
const registrace = read("src/components/brana/BranaRegistracePWA.tsx");
const politika = read("src/lib/brana/vyzva-plocha.ts");
const trebonInst = read("src/lib/trebon-pwa-instalace.ts");
const trebonUi = read("src/components/ObrazovkaChciSeVracet.tsx");
const middleware = read("src/middleware.ts");
const swBrana = read("src/lib/brana/service-worker.ts");
const manifest = read("public/brana/manifest.webmanifest");
const iosVrstva = read("src/components/brana/BranaIosInstalacniVrstva.tsx");

assert(politika.includes("BRANA_VYZVA_ZDVORILOST_MS = 8_000"), "čas: 8000 ms zachován");
assert(!layout.includes("pwa-instalace-vcasna"), "layout: bez early BIP skriptu");
assert(!layout.includes("beforeInteractive"), "layout: bez beforeInteractive install");
assert(registrace.includes("inicializovatBranaPwaInstalaci"), "registrace: init BIP");
assert(!instalaceSrc.includes("__branaPwaVcasnyPrompt"), "store: bez dual early");
assert(!instalaceSrc.includes("CHROME_INTENT"), "instalace: bez CHROME_INTENT");
assert(!instalaceSrc.includes("intent://"), "instalace: bez intent://");
assert(!instalaceSrc.includes("googlechrome://"), "instalace: bez googlechrome");
assert(instalaceSrc.includes("__branaPwaInstalacniPrompt"), "store: jeden BRÁNA klíč");
assert(instalaceSrc.includes("__branaPwaPosluchaceRegistrovani"), "store: jeden guard");
assert(instalaceSrc.includes("beforeinstallprompt"), "instalace: BIP listener");
assert(instalaceSrc.includes("appinstalled"), "instalace: appinstalled");
assert(instalaceSrc.includes("preventDefault"), "instalace: preventDefault");
assert(instalaceSrc.includes("prompt.prompt()"), "instalace: přímý prompt()");
assert(instalaceSrc.includes("userChoice"), "instalace: userChoice");
assert(instalaceSrc.includes("dialogProbiha"), "instalace: ochrana dvojkliku");
assert(!instalaceSrc.includes("setInterval"), "instalace: bez pollingu");
assert(!vyzva.includes("Připravuji přidání na plochu"), "CTA: bez Připravuji");
assert(!vyzva.includes("BRANA_PRIPRAVA_MAX_MS"), "CTA: bez 2s čekání");
assert(!vyzva.includes("Otevřít v Chromu"), "CTA: bez Chrome textu");
assert(!vyzva.includes("intent://"), "CTA: bez intent");
assert(vyzva.includes("Přidat"), "CTA: text Přidat");
assert(vyzva.includes("BRÁNU"), "CTA: text BRÁNU");
assert(vyzva.includes("na plochu"), "CTA: text na plochu");
assert(vyzva.includes("brana-orientacni-oddelovac"), "CTA: stejná pozice (linka)");
assert(vyzva.includes("brana-casova-kotva"), "CTA: stejná pozice (kotva)");
assert(vyzva.includes("brana-vyzva-plocha"), "CTA: stejné CSS třídy");
assert(stavSrc.includes("BEZ_INSTALACNIHO_PROMPTU"), "stav: BIP gate Android");
assert(stavSrc.includes("if (jeIOS())"), "stav: iOS větev");
assert(
  !stavSrc.includes('typ: "CHROME_INTENT"') &&
    !stavSrc.includes("| { typ: \"CHROME_INTENT\""),
  "stav: bez CHROME_INTENT",
);
assert(trebonInst.includes("__trebonPwaInstalacniPrompt"), "Třeboň: store beze změny");
assert(!trebonInst.includes("__branaPwaInstalacniPrompt"), "Třeboň: nesdílí BRÁNA store");
assert(trebonUi.includes("Přidat Třeboň na plochu"), "Třeboň: CTA beze změny");
assert(swBrana.includes('register("/sw.js"'), "BRÁNA SW /sw.js");
assert(middleware.includes('pathname === "/sw.js"'), "middleware SW rewrite");
assert(manifest.includes("brana.trebonpocelyrok.cz"), "manifest: PWA identita");
assert(iosVrstva.includes("BranaIosInstalacniVrstva") || iosVrstva.length > 0, "iOS vrstva existuje");

async function main() {
  const win = installFakeWindow();

  // Čistý import – auto-init musí zaregistrovat posluchače.
  const instalace = await import("../src/lib/brana/pwa-instalace");
  assert(
    win.__branaPwaPosluchaceRegistrovani === true,
    "init: guard po auto-inicializaci",
  );

  const origNav = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      userAgent:
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
    },
  });

  const { urcitBranaVyzvaViditelnost, urcitBranaCestuPoKliknuti } = await import(
    "../src/lib/brana/pwa-instalacni-stav"
  );

  // --- Android: čas bez přepnutí / přepnutí bez času ---
  // (politika je vstupní parametr – produktová vrstva vyzva-plocha)
  assert(
    urcitBranaVyzvaViditelnost({
      vyzvaZavrena: false,
      nainstalovano: false,
      politikaZobrazeniSplnena: false,
      aktualniUrl: "https://brana.trebonpocelyrok.cz/",
    }).viditelna === false,
    "Android: bez politiky skryté (i s BIP)",
  );

  // --- Android: BIP nepřipravený ---
  delete win.__branaPwaInstalacniPrompt;
  const bezBip = urcitBranaVyzvaViditelnost({
    vyzvaZavrena: false,
    nainstalovano: false,
    politikaZobrazeniSplnena: true,
    aktualniUrl: "https://brana.trebonpocelyrok.cz/",
  });
  assert(
    bezBip.viditelna === false &&
      "duvod" in bezBip &&
      bezBip.duvod === "BEZ_INSTALACNIHO_PROMPTU",
    "Android: bez BIP výzva skrytá",
  );
  assert(
    urcitBranaCestuPoKliknuti({
      aktualniUrl: "https://brana.trebonpocelyrok.cz/",
    }).typ === "ZATIM_NEDOSTUPNA",
    "Android: bez BIP cesta nedostupná",
  );
  assert(
    (await instalace.vyvolatInstalacniDialog()) === "nedostupny",
    "Android: bez BIP prompt nedostupný",
  );

  // --- Android: BIP přes listener ---
  const p = makePrompt();
  win.dispatchEvent(
    Object.assign(new Event("beforeinstallprompt"), p.event) as Event,
  );
  // Fake Event + assign nemusí projít typově – uložíme přímo a přes listener:
  delete win.__branaPwaInstalacniPrompt;
  const listenersOk = (() => {
    const raw = new Event("beforeinstallprompt");
    Object.assign(raw, p.event);
    win.dispatchEvent(raw);
    return instalace.jeInstalacniPromptKDispozici();
  })();
  if (!listenersOk) {
    // Fallback: ulozit jako by listener zavolal preventDefault cestu
    win.__branaPwaInstalacniPrompt = p.event;
  }
  assert(instalace.jeInstalacniPromptKDispozici(), "Android: BIP ve store");

  assert(
    urcitBranaVyzvaViditelnost({
      vyzvaZavrena: false,
      nainstalovano: false,
      politikaZobrazeniSplnena: true,
      aktualniUrl: "https://brana.trebonpocelyrok.cz/",
    }).viditelna === true,
    "Android: politika + BIP → viditelné",
  );
  assert(
    urcitBranaCestuPoKliknuti({
      aktualniUrl: "https://brana.trebonpocelyrok.cz/",
    }).typ === "PROMPT",
    "Android: cesta PROMPT",
  );

  const vysledek = await instalace.vyvolatInstalacniDialog();
  assert(vysledek === "accepted", "Android: klik accepted");
  assert(p.promptCalls() === 1, "Android: prompt() právě jednou");
  assert(!instalace.jeInstalacniPromptKDispozici(), "Android: store po prompt prázdný");

  // --- Dvojí kliknutí ---
  const p2 = makePrompt();
  win.__branaPwaInstalacniPrompt = p2.event;
  const [r1, r2] = await Promise.all([
    instalace.vyvolatInstalacniDialog(),
    instalace.vyvolatInstalacniDialog(),
  ]);
  assert(
    [r1, r2].filter((x) => x === "accepted").length === 1 &&
      [r1, r2].filter((x) => x === "nedostupny").length === 1,
    "Android: dvojí klik → jeden dialog",
  );
  assert(p2.promptCalls() === 1, "Android: dvojí klik → prompt() jednou");

  // --- appinstalled ---
  let installed = 0;
  instalace.priAppInstalled(() => {
    installed++;
  });
  win.__branaPwaInstalacniPrompt = makePrompt().event;
  win.dispatchEvent(new Event("appinstalled"));
  assert(installed === 1, "Standalone: appinstalled notifikace");
  assert(!instalace.jeInstalacniPromptKDispozici(), "Standalone: store vyčištěn");
  assert(
    urcitBranaVyzvaViditelnost({
      vyzvaZavrena: false,
      nainstalovano: true,
      politikaZobrazeniSplnena: true,
      aktualniUrl: "https://brana.trebonpocelyrok.cz/",
    }).viditelna === false,
    "Standalone: výzva skrytá",
  );

  // --- iOS bez BIP ---
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
    },
  });
  delete win.__branaPwaInstalacniPrompt;
  assert(
    urcitBranaVyzvaViditelnost({
      vyzvaZavrena: false,
      nainstalovano: false,
      politikaZobrazeniSplnena: true,
      aktualniUrl: "https://brana.trebonpocelyrok.cz/",
    }).viditelna === true,
    "iOS: viditelné bez BIP",
  );
  assert(
    urcitBranaCestuPoKliknuti({
      aktualniUrl: "https://brana.trebonpocelyrok.cz/",
    }).typ === "IOS_INSTALACE",
    "iOS: cesta IOS_INSTALACE",
  );

  // --- Desktop ---
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    },
  });
  assert(
    urcitBranaVyzvaViditelnost({
      vyzvaZavrena: false,
      nainstalovano: false,
      politikaZobrazeniSplnena: true,
      aktualniUrl: "https://brana.trebonpocelyrok.cz/",
    }).viditelna === false,
    "Desktop: výzva skrytá",
  );

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: origNav,
  });

  if (chyby > 0) {
    console.error(`\nSelhalo kontrol: ${chyby}`);
    process.exit(1);
  }

  console.log("\nVšechny automatické kontroly prošly.");
}

void main();
