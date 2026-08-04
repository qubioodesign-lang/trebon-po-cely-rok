/** Instalační prompt PWA BRÁNY – princip Třeboně, vlastní store a klíče. */

import { jePWA } from "@/lib/uloziste";

export type BranaBeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    __branaPwaInstalacniPrompt?: BranaBeforeInstallPromptEvent;
    __branaPwaPosluchaceRegistrovani?: boolean;
  }
}

const posluchaciPromptu = new Set<() => void>();
const posluchaciInstalace = new Set<() => void>();

let dialogProbiha = false;

function oznamitZmenuPromptu(): void {
  posluchaciPromptu.forEach((posluchac) => {
    posluchac();
  });
}

function ziskatUlozenyPrompt(): BranaBeforeInstallPromptEvent | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.__branaPwaInstalacniPrompt ?? null;
}

function ulozitPrompt(udalost: BranaBeforeInstallPromptEvent): void {
  udalost.preventDefault();
  window.__branaPwaInstalacniPrompt = udalost;
  oznamitZmenuPromptu();
}

function zahoditPrompt(): void {
  if (!window.__branaPwaInstalacniPrompt) {
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
  if (typeof window === "undefined") {
    return false;
  }

  return ziskatUlozenyPrompt() !== null;
}

export function priZmeneInstalacnihoPromptu(posluchac: () => void): () => void {
  posluchaciPromptu.add(posluchac);

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

/**
 * Jedna inicializace: jeden guard, jeden BIP listener, jeden appinstalled.
 * Opakované volání je bezpečné.
 */
export function inicializovatBranaPwaInstalaci(): void {
  if (typeof window === "undefined" || window.__branaPwaPosluchaceRegistrovani) {
    return;
  }

  window.__branaPwaPosluchaceRegistrovani = true;

  window.addEventListener("beforeinstallprompt", (udalost) => {
    ulozitPrompt(udalost as BranaBeforeInstallPromptEvent);
  });

  window.addEventListener("appinstalled", () => {
    zahoditPrompt();
    posluchaciInstalace.forEach((posluchac) => {
      posluchac();
    });
  });
}

/**
 * Přímé volání prompt() ze skutečného uživatelského kliknutí.
 * Bez timeoutu, pollingu ani jiného async mezikroku před prompt().
 */
export async function vyvolatInstalacniDialog(): Promise<
  "accepted" | "dismissed" | "nedostupny"
> {
  if (dialogProbiha) {
    return "nedostupny";
  }

  const prompt = ziskatUlozenyPrompt();

  if (!prompt) {
    return "nedostupny";
  }

  dialogProbiha = true;
  delete window.__branaPwaInstalacniPrompt;
  oznamitZmenuPromptu();

  try {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    return outcome;
  } catch {
    return "dismissed";
  } finally {
    dialogProbiha = false;
  }
}

if (typeof window !== "undefined") {
  inicializovatBranaPwaInstalaci();
}
