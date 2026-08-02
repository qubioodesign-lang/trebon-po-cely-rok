import { jePWA } from "@/lib/uloziste";
import { jeInstalacniPromptKDispozici } from "./pwa-instalace";

const SESSION_KLIC_EMBEDDED = "brana_embedded_android";

/** Pozitivní stav potvrzeného plného Chromu v aktuální kartě. */
export const BRANA_PLNY_CHROME_KLIC = "brana_plny_chrome";

/** Jednorázový query parametr potvrzující otevření v plném Chromu. */
export const BRANA_OTEVRENO_V_CHROMU_PARAM = "otevrenoVChromu";

export function jeAndroid(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /Android/i.test(navigator.userAgent);
}

export function vymazatEmbeddedAndroidKontext(): void {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.removeItem(SESSION_KLIC_EMBEDDED);
}

function maOtevrenoVChromuParam(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    new URL(window.location.href).searchParams.get(
      BRANA_OTEVRENO_V_CHROMU_PARAM,
    ) === "1"
  );
}

/**
 * Po načtení v plném Chromu: vymaže embedded stav a odstraní technický parametr z URL.
 * @returns true, pokud šlo o potvrzený přechod z embedded prohlížeče
 */
export function zpracovatOtevreniVChromu(): boolean {
  if (typeof window === "undefined" || !maOtevrenoVChromuParam()) {
    return false;
  }

  vymazatEmbeddedAndroidKontext();
  sessionStorage.setItem(BRANA_PLNY_CHROME_KLIC, "1");

  const url = new URL(window.location.href);
  url.searchParams.delete(BRANA_OTEVRENO_V_CHROMU_PARAM);
  const cistaCesta = `${url.pathname}${url.search}${url.hash}`;

  window.history.replaceState(window.history.state, "", cistaCesta);

  return true;
}

/** Uloží embedded kontext z první navigace (referrer android-app://). */
export function zapamatovatEmbeddedAndroidKontext(): void {
  if (typeof window === "undefined") {
    return;
  }

  if (maOtevrenoVChromuParam()) {
    return;
  }

  if (document.referrer.startsWith("android-app://")) {
    sessionStorage.removeItem(BRANA_PLNY_CHROME_KLIC);
    sessionStorage.setItem(SESSION_KLIC_EMBEDDED, "1");
  }
}

function maEmbeddedAndroidSession(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return sessionStorage.getItem(SESSION_KLIC_EMBEDDED) === "1";
}

/**
 * Heuristika embedded Android prohlížeče (Custom Tab, WhatsApp, Messenger…).
 * Není stoprocentní – kombinuje referrer a sessionStorage z prvního načtení.
 */
export function jeVlozenyAndroidProhlizec(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  if (!jeAndroid() || jePWA()) {
    return false;
  }

  if (sessionStorage.getItem(BRANA_PLNY_CHROME_KLIC) === "1") {
    return false;
  }

  if (maOtevrenoVChromuParam()) {
    return false;
  }

  if (document.referrer.startsWith("android-app://")) {
    return true;
  }

  return maEmbeddedAndroidSession();
}

/**
 * Přechod do plného Chromu – pouze při silném důkazu embedded kontextu
 * a bez dostupného beforeinstallprompt.
 */
export function potrebujeOtevritVChromu(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  if (jeInstalacniPromptKDispozici()) {
    return false;
  }

  return jeVlozenyAndroidProhlizec();
}

/** Vyčistí embedded stav při instalaci nebo spuštění jako PWA. */
export function vycistitEmbeddedPoInstalaci(): void {
  vymazatEmbeddedAndroidKontext();
}
