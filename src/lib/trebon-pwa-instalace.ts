/** Instalační prompt PWA Třeboně – odděleně od BRÁNY. */

export type TrebonBeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    __trebonPwaInstalacniPrompt?: TrebonBeforeInstallPromptEvent;
    __trebonPwaPosluchaceRegistrovani?: boolean;
  }
}

const posluchaciPromptu = new Set<() => void>();
const posluchaciInstalace = new Set<() => void>();

function oznamitZmenuPromptu(): void {
  posluchaciPromptu.forEach((posluchac) => {
    posluchac();
  });
}

function ziskatUlozenyPrompt(): TrebonBeforeInstallPromptEvent | null {
  return window.__trebonPwaInstalacniPrompt ?? null;
}

function ulozitPrompt(udalost: TrebonBeforeInstallPromptEvent): void {
  udalost.preventDefault();
  window.__trebonPwaInstalacniPrompt = udalost;
  oznamitZmenuPromptu();
}

function zahoditPrompt(): void {
  if (!window.__trebonPwaInstalacniPrompt) {
    return;
  }

  delete window.__trebonPwaInstalacniPrompt;
  oznamitZmenuPromptu();
}

export function jeTrebonInstalacniPromptKDispozici(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return ziskatUlozenyPrompt() !== null;
}

export function priZmeneTrebonInstalacnihoPromptu(
  posluchac: () => void,
): () => void {
  posluchaciPromptu.add(posluchac);

  return () => {
    posluchaciPromptu.delete(posluchac);
  };
}

export function priTrebonAppInstalled(posluchac: () => void): () => void {
  posluchaciInstalace.add(posluchac);

  return () => {
    posluchaciInstalace.delete(posluchac);
  };
}

/** Registruje posluchače BIP / appinstalled (volá se z RegistracePWA). */
export function inicializovatTrebonPwaInstalaci(): void {
  if (typeof window === "undefined" || window.__trebonPwaPosluchaceRegistrovani) {
    return;
  }

  window.__trebonPwaPosluchaceRegistrovani = true;

  window.addEventListener("beforeinstallprompt", (udalost) => {
    ulozitPrompt(udalost as TrebonBeforeInstallPromptEvent);
  });

  window.addEventListener("appinstalled", () => {
    zahoditPrompt();
    posluchaciInstalace.forEach((posluchac) => {
      posluchac();
    });
  });
}

export async function vyvolatTrebonInstalacniDialog(): Promise<
  "accepted" | "dismissed" | "nedostupny"
> {
  const prompt = ziskatUlozenyPrompt();

  if (!prompt) {
    return "nedostupny";
  }

  delete window.__trebonPwaInstalacniPrompt;
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
  inicializovatTrebonPwaInstalaci();
}
