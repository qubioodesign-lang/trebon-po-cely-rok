import { jePWA } from "@/lib/uloziste";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    __branaPwaVcasnyPrompt?: BeforeInstallPromptEvent;
  }
}

let ulozenyPrompt: BeforeInstallPromptEvent | null = null;
const posluchaciPromptu = new Set<() => void>();
const posluchaciInstalace = new Set<() => void>();
let posluchaceRegistrovani = false;

function oznamitZmenuPromptu(): void {
  posluchaciPromptu.forEach((posluchac) => {
    posluchac();
  });
}

/** Načte prompt zachycený inline skriptem v layoutu BRÁNY před hydratací. */
function nacistVcasnyPrompt(): void {
  const vcasny = window.__branaPwaVcasnyPrompt;

  if (!vcasny || ulozenyPrompt !== null) {
    return;
  }

  ulozenyPrompt = vcasny;
  delete window.__branaPwaVcasnyPrompt;
  oznamitZmenuPromptu();
}

/** BRÁNA běží jako nainstalovaná PWA (display-mode: standalone nebo iOS). */
export function jeBranaSpustenaJakoPwa(): boolean {
  return jePWA();
}

export function zachytitInstalacniPrompt(udalost: Event): void {
  udalost.preventDefault();
  ulozenyPrompt = udalost as BeforeInstallPromptEvent;
  oznamitZmenuPromptu();
}

export function jeInstalacniPromptKDispozici(): boolean {
  return ulozenyPrompt !== null;
}

export function zahoditInstalacniPrompt(): void {
  if (ulozenyPrompt === null) {
    return;
  }

  ulozenyPrompt = null;
  oznamitZmenuPromptu();
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
 * Registruje globální posluchače co nejdříve po načtení stránky BRÁNY.
 * Opakované volání je bezpečné.
 */
export function inicializovatBranaPwaInstalaci(): void {
  if (typeof window === "undefined" || posluchaceRegistrovani) {
    return;
  }

  posluchaceRegistrovani = true;

  nacistVcasnyPrompt();

  window.addEventListener("brana-pwa-prompt", nacistVcasnyPrompt);

  window.addEventListener("beforeinstallprompt", (udalost) => {
    zachytitInstalacniPrompt(udalost);
  });

  window.addEventListener("appinstalled", () => {
    zahoditInstalacniPrompt();
    posluchaciInstalace.forEach((posluchac) => {
      posluchac();
    });
  });
}

/** Vyvolá systémový instalační dialog prohlížeče; uloženou událost zahodí. */
export async function vyvolatInstalacniDialog(): Promise<
  "accepted" | "dismissed" | "nedostupny"
> {
  const prompt = ulozenyPrompt;

  if (!prompt) {
    return "nedostupny";
  }

  ulozenyPrompt = null;
  oznamitZmenuPromptu();

  try {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    return outcome;
  } catch {
    return "dismissed";
  }
}

if (typeof window !== "undefined") {
  inicializovatBranaPwaInstalaci();
}
