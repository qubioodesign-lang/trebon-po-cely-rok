import { jePWA } from "@/lib/uloziste";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let ulozenyPrompt: BeforeInstallPromptEvent | null = null;
const posluchaci = new Set<() => void>();

function oznamitZmenu(): void {
  posluchaci.forEach((posluchac) => {
    posluchac();
  });
}

/** BRÁNA běží jako nainstalovaná PWA (display-mode: standalone nebo iOS). */
export function jeBranaSpustenaJakoPwa(): boolean {
  return jePWA();
}

export function zachytitInstalacniPrompt(udalost: Event): void {
  udalost.preventDefault();
  ulozenyPrompt = udalost as BeforeInstallPromptEvent;
  oznamitZmenu();
}

export function jeInstalacniPromptKDispozici(): boolean {
  return ulozenyPrompt !== null;
}

export function zahoditInstalacniPrompt(): void {
  if (ulozenyPrompt === null) {
    return;
  }

  ulozenyPrompt = null;
  oznamitZmenu();
}

export function priZmeneInstalacnihoPromptu(posluchac: () => void): () => void {
  posluchaci.add(posluchac);

  return () => {
    posluchaci.delete(posluchac);
  };
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
  oznamitZmenu();

  try {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    return outcome;
  } catch {
    return "dismissed";
  }
}
