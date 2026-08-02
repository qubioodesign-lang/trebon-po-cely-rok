/** Text hlavního tlačítka pro přechod z embedded prohlížeče do Chromu. */
export const BRANA_TEKST_OTEVRIT_V_CHROMU =
  "Otevřít v Chromu a přidat na plochu";

/**
 * Intent URL pro otevření aktuální stránky v aplikaci Chrome.
 * Při absenci Chromu použije S.browser_fallback_url (HTTPS).
 */
export function sestavitOtevreniVChromuIntentUrl(aktualniUrl: string): string {
  const url = new URL(aktualniUrl);
  const cesta = `${url.host}${url.pathname}${url.search}${url.hash}`;
  const fallback = encodeURIComponent(aktualniUrl);

  return `intent://${cesta}#Intent;scheme=https;action=android.intent.action.VIEW;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
}

/** Alternativa k intentu – přímá navigace schématem googlechrome:// */
export function sestavitGoogleChromeNavigateUrl(aktualniUrl: string): string {
  return `googlechrome://navigate?url=${encodeURIComponent(aktualniUrl)}`;
}

/** Aktuální URL stránky včetně cesty a query parametrů. */
export function aktualniStrankaUrl(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.href;
}
