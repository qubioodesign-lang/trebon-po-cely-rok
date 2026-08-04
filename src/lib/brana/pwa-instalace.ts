import { jePWA } from "@/lib/uloziste";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    /** Jediné úložiště beforeinstallprompt (early skript i modul). */
    __branaPwaInstalacniPrompt?: BeforeInstallPromptEvent;
    /** Guard: listener BIP/appinstalled už registrován (early nebo modul). */
    __branaPwaPosluchaceRegistrovani?: boolean;
    /** Guard: React bridge (event → Set) už napojen. */
    __branaPwaModulNotifikace?: boolean;
  }
}

const BRANA_BIP_READY = "brana-bip-ready";
const BRANA_APPINSTALLED = "brana-appinstalled";

const posluchaciPromptu = new Set<() => void>();
const posluchaciInstalace = new Set<() => void>();

function oznamitZmenuPromptu(): void {
  posluchaciPromptu.forEach((posluchac) => {
    posluchac();
  });
}

function oznamitAppInstalled(): void {
  posluchaciInstalace.forEach((posluchac) => {
    posluchac();
  });
}

function ziskatUlozenyPrompt(): BeforeInstallPromptEvent | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.__branaPwaInstalacniPrompt ?? null;
}

function ulozitPrompt(udalost: BeforeInstallPromptEvent): void {
  udalost.preventDefault();
  window.__branaPwaInstalacniPrompt = udalost;
  // Modul oznamuje Set přímo; early skript používá window event → bridge.
  oznamitZmenuPromptu();
}

function zahoditPrompt(): void {
  if (typeof window === "undefined" || !window.__branaPwaInstalacniPrompt) {
    return;
  }

  delete window.__branaPwaInstalacniPrompt;
  oznamitZmenuPromptu();
}

/** BRÁNA běží jako nainstalovaná PWA (display-mode: standalone nebo iOS). */
export function jeBranaSpustenaJakoPwa(): boolean {
  return jePWA();
}

export function jeInstalacniPromptKDispozici(): boolean {
  return ziskatUlozenyPrompt() !== null;
}

export function zahoditInstalacniPrompt(): void {
  zahoditPrompt();
}

/**
 * Přihlášení ke změně BIP store.
 * Okamžitě synchronizuje aktuální stav (BIP zachycený před hydratací).
 */
export function priZmeneInstalacnihoPromptu(posluchac: () => void): () => void {
  posluchaciPromptu.add(posluchac);
  posluchac();

  return () => {
    posluchaciPromptu.delete(posluchac);
  };
}

export function priAppInstalled(posluchac: () => void): () => void {
  posluchaciInstalace.add(posluchac);

  return () => {
    posluchaciInstalace.delete(posluchac);
  };
}

/** Napojí early skript (window eventy) na React Set – vždy, i když BIP listener už běží. */
function napojitModuloveNotifikace(): void {
  if (typeof window === "undefined" || window.__branaPwaModulNotifikace) {
    return;
  }

  window.__branaPwaModulNotifikace = true;

  window.addEventListener(BRANA_BIP_READY, () => {
    oznamitZmenuPromptu();
  });

  window.addEventListener(BRANA_APPINSTALLED, () => {
    oznamitAppInstalled();
  });

  if (window.__branaPwaInstalacniPrompt) {
    oznamitZmenuPromptu();
  }
}

/**
 * Registruje BIP/appinstalled jen pokud early skript ještě neběžel.
 * Notifikační bridge napojí vždy.
 */
export function inicializovatBranaPwaInstalaci(): void {
  if (typeof window === "undefined") {
    return;
  }

  napojitModuloveNotifikace();

  if (window.__branaPwaPosluchaceRegistrovani) {
    return;
  }

  window.__branaPwaPosluchaceRegistrovani = true;

  window.addEventListener("beforeinstallprompt", (udalost) => {
    ulozitPrompt(udalost as BeforeInstallPromptEvent);
  });

  window.addEventListener("appinstalled", () => {
    zahoditPrompt();
    oznamitAppInstalled();
  });
}

/**
 * Horní limit jen pro visící userChoice – prompt() se volá hned v gestu.
 */
export const BRANA_INSTALACNI_DIALOG_MAX_MS = 8_000;

let dialogProbiha = false;

/** Vyvolá systémový dialog; před prompt() žádné await/polling. */
export async function vyvolatInstalacniDialog(): Promise<
  "accepted" | "dismissed" | "nedostupny"
> {
  if (dialogProbiha) {
    return "nedostupny";
  }

  // Lock hned – zabrání souběžnému druhému prompt() ze stejného gesta.
  dialogProbiha = true;

  const prompt = ziskatUlozenyPrompt();

  if (!prompt) {
    dialogProbiha = false;
    return "nedostupny";
  }

  delete window.__branaPwaInstalacniPrompt;
  oznamitZmenuPromptu();

  try {
    // prompt() hned – žádný await předtím.
    const promptPromise = prompt.prompt();

    const vysledek = await Promise.race([
      (async (): Promise<"accepted" | "dismissed"> => {
        await promptPromise;
        const { outcome } = await prompt.userChoice;
        return outcome;
      })(),
      new Promise<"dismissed">((resolve) => {
        window.setTimeout(() => {
          resolve("dismissed");
        }, BRANA_INSTALACNI_DIALOG_MAX_MS);
      }),
    ]);

    return vysledek;
  } catch {
    return "dismissed";
  } finally {
    dialogProbiha = false;
  }
}

if (typeof window !== "undefined") {
  inicializovatBranaPwaInstalaci();
}
