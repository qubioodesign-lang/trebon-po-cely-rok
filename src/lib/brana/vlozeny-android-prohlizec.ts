import { jePWA } from "@/lib/uloziste";
import { jeInstalacniPromptKDispozici } from "./pwa-instalace";

const SESSION_KLIC_EMBEDDED = "brana_embedded_android";

export function jeAndroid(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /Android/i.test(navigator.userAgent);
}

/** Uloží embedded kontext z první navigace (referrer android-app://). */
export function zapamatovatEmbeddedAndroidKontext(): void {
  if (typeof window === "undefined") {
    return;
  }

  if (document.referrer.startsWith("android-app://")) {
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
