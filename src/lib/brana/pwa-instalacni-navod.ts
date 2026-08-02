import { jeIOS } from "@/lib/uloziste";

export const BRANA_NAVOD_ANDROID_CHROME =
  "Otevřete nabídku ⋮ a zvolte Instalovat aplikaci.";

export const BRANA_NAVOD_IOS_SAFARI =
  "V Safari klepněte na Sdílet a zvolte Přidat na plochu.";

export const BRANA_NAVOD_IOS_JINY =
  "Otevřete BRÁNU v Safari a přidejte ji na plochu přes Sdílet.";

export const BRANA_NAVOD_OBECNY =
  "Přidejte BRÁNU na plochu z nabídky prohlížeče.";

/** Safari na iOS – ne Chrome/Firefox/Edge in-app prohlížeče. */
export function jeSafari(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const ua = navigator.userAgent;

  if (/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Chromium|EdgA|OPR|SamsungBrowser/i.test(ua)) {
    return false;
  }

  return jeIOS();
}

export function jeAndroid(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /Android/i.test(navigator.userAgent);
}

export function jeChromeNaAndroidu(): boolean {
  if (!jeAndroid()) {
    return false;
  }

  const ua = navigator.userAgent;
  return /Chrome/i.test(ua) && !/EdgA|OPR|SamsungBrowser/i.test(ua);
}

/** Krátký návod podle zařízení a prohlížeče, když není k dispozici systémový prompt. */
export function zvolitInstalacniNavod(): string {
  if (jeIOS()) {
    return jeSafari() ? BRANA_NAVOD_IOS_SAFARI : BRANA_NAVOD_IOS_JINY;
  }

  if (jeChromeNaAndroidu()) {
    return BRANA_NAVOD_ANDROID_CHROME;
  }

  return BRANA_NAVOD_OBECNY;
}
