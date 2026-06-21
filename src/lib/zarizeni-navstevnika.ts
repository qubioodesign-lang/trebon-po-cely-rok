import { jeIOS } from "@/lib/uloziste";

/** Povolené kategorie zařízení pro analytics v1.1 */
export type TypZarizeni = "android" | "iphone" | "desktop" | "ostatni";

export const ZARIZENI_NAVSTEV: TypZarizeni[] = [
  "android",
  "iphone",
  "desktop",
  "ostatni",
];

export const POPISY_ZARIZENI: Record<TypZarizeni, string> = {
  android: "Android",
  iphone: "iPhone / iOS",
  desktop: "Desktop",
  ostatni: "Ostatní",
};

export function jePlatneZarizeni(hodnota: string): hodnota is TypZarizeni {
  return (ZARIZENI_NAVSTEV as string[]).includes(hodnota);
}

export function prazdnaPocitadlaZarizeni(): Record<TypZarizeni, number> {
  return {
    android: 0,
    iphone: 0,
    desktop: 0,
    ostatni: 0,
  };
}

/**
 * Určí kategorii zařízení v prohlížeči.
 * User-Agent se na server neposílá – pouze agregovaná kategorie.
 */
export function urcitZarizeniNavstevnika(): TypZarizeni {
  if (typeof window === "undefined") {
    return "ostatni";
  }

  const ua = navigator.userAgent;

  if (/Android/i.test(ua)) {
    return "android";
  }

  if (jeIOS()) {
    return "iphone";
  }

  const uaData = (
    navigator as Navigator & { userAgentData?: { mobile?: boolean } }
  ).userAgentData;
  if (uaData?.mobile === false) {
    return "desktop";
  }

  if (/Windows NT|Macintosh|CrOS|Linux x86_64|Linux i686/i.test(ua) && !/Mobile/i.test(ua)) {
    return "desktop";
  }

  if (uaData?.mobile === true) {
    return "ostatni";
  }

  return "ostatni";
}
