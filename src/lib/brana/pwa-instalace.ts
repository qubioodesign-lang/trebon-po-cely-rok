import { jePWA } from "@/lib/uloziste";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    /** Zachycený včasným synchronním skriptem – může přijít před načtením bundlu. */
    __branaPwaVcasnyPrompt?: BeforeInstallPromptEvent;
    /** Jediné úložiště promptu sdílené mezi všemi JS chunky. */
    __branaPwaInstalacniPrompt?: BeforeInstallPromptEvent;
    __branaPwaPosluchaceRegistrovani?: boolean;
  }
}

const posluchaciPromptu = new Set<() => void>();
const posluchaciInstalace = new Set<() => void>();

function oznamitZmenuPromptu(): void {
  posluchaciPromptu.forEach((posluchac) => {
    posluchac();
  });
}

/** Sloučí včasný prompt ze skriptu do sdíleného window úložiště. */
function synchronizovatPromptZeWindow(): void {
  const vcasny = window.__branaPwaVcasnyPrompt;

  if (!vcasny) {
    return;
  }

  window.__branaPwaInstalacniPrompt = vcasny;
  delete window.__branaPwaVcasnyPrompt;
  oznamitZmenuPromptu();
}

function ziskatUlozenyPrompt(): BeforeInstallPromptEvent | null {
  synchronizovatPromptZeWindow();
  return window.__branaPwaInstalacniPrompt ?? null;
}

function ulozitPrompt(udalost: BeforeInstallPromptEvent): void {
  udalost.preventDefault();
  window.__branaPwaInstalacniPrompt = udalost;
  delete window.__branaPwaVcasnyPrompt;
  oznamitZmenuPromptu();
}

function zahoditPrompt(): void {
  if (!window.__branaPwaInstalacniPrompt && !window.__branaPwaVcasnyPrompt) {
    return;
  }

  delete window.__branaPwaInstalacniPrompt;
  delete window.__branaPwaVcasnyPrompt;
  oznamitZmenuPromptu();
}

/** BRÁNA běží jako nainstalovaná PWA (display-mode: standalone nebo iOS). */
export function jeBranaSpustenaJakoPwa(): boolean {
  return jePWA();
}

export function zachytitInstalacniPrompt(udalost: Event): void {
  ulozitPrompt(udalost as BeforeInstallPromptEvent);
}

export function jeInstalacniPromptKDispozici(): boolean {
  return ziskatUlozenyPrompt() !== null;
}

export function zahoditInstalacniPrompt(): void {
  zahoditPrompt();
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
 * Opakované volání je bezpečné – stav posluchačů je na window kvůli duplicitním chunkům.
 */
export function inicializovatBranaPwaInstalaci(): void {
  if (typeof window === "undefined" || window.__branaPwaPosluchaceRegistrovani) {
    return;
  }

  window.__branaPwaPosluchaceRegistrovani = true;

  synchronizovatPromptZeWindow();

  window.addEventListener("brana-pwa-prompt", synchronizovatPromptZeWindow);

  window.addEventListener("beforeinstallprompt", (udalost) => {
    zachytitInstalacniPrompt(udalost);
  });

  window.addEventListener("appinstalled", () => {
    zahoditPrompt();
    posluchaciInstalace.forEach((posluchac) => {
      posluchac();
    });
  });
}

/** Vyvolá systémový instalační dialog prohlížeče; uloženou událost zahodí. */
export async function vyvolatInstalacniDialog(): Promise<
  "accepted" | "dismissed" | "nedostupny"
> {
  const prompt = ziskatUlozenyPrompt();

  if (!prompt) {
    return "nedostupny";
  }

  delete window.__branaPwaInstalacniPrompt;
  delete window.__branaPwaVcasnyPrompt;
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
