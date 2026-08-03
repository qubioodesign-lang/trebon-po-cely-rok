/** Stav iOS instalační vrstvy Třeboně – odděleně od BRÁNY. */

import { jeIOS } from "@/lib/uloziste";

export type TrebonIosInstalacniVarianta = "SAFARI" | "JINY_PROHLIZEC";

type Stav = {
  otevreno: boolean;
  varianta: TrebonIosInstalacniVarianta | null;
};

const stav: Stav = {
  otevreno: false,
  varianta: null,
};

const posluchaci = new Set<() => void>();

function oznamit(): void {
  posluchaci.forEach((posluchac) => {
    posluchac();
  });
}

/** Safari na iOS – ne Chrome/Firefox/Edge in-app prohlížeče. */
export function jeTrebonSafari(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const ua = navigator.userAgent;

  if (
    /CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Chromium|EdgA|OPR|SamsungBrowser/i.test(ua)
  ) {
    return false;
  }

  return jeIOS();
}

export function urcitTrebonIosInstalacniVariantu(): TrebonIosInstalacniVarianta {
  return jeTrebonSafari() ? "SAFARI" : "JINY_PROHLIZEC";
}

export function ziskatTrebonIosInstalacniVrstvu(): Stav {
  return {
    otevreno: stav.otevreno,
    varianta: stav.varianta,
  };
}

export function otevritTrebonIosInstalacniVrstvu(
  varianta: TrebonIosInstalacniVarianta = urcitTrebonIosInstalacniVariantu(),
): void {
  stav.otevreno = true;
  stav.varianta = varianta;
  oznamit();
}

export function zavritTrebonIosInstalacniVrstvu(): void {
  if (!stav.otevreno) {
    return;
  }

  stav.otevreno = false;
  stav.varianta = null;
  oznamit();
}

export function priZmeneTrebonIosInstalacniVrstvy(
  posluchac: () => void,
): () => void {
  posluchaci.add(posluchac);

  return () => {
    posluchaci.delete(posluchac);
  };
}
