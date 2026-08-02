import { BRANA_OTEVRENO_V_CHROMU_PARAM } from "./vlozeny-android-prohlizec";

/** Text hlavního tlačítka pro přechod z embedded prohlížeče do Chromu. */
export const BRANA_TEKST_OTEVRIT_V_CHROMU =
  "Otevřít v Chromu a přidat na plochu";

/** Přidá jednorázový parametr potvrzující otevření v plném Chromu. */
export function pridatOtevrenoVChromuParam(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set(BRANA_OTEVRENO_V_CHROMU_PARAM, "1");
  return parsed.toString();
}

/**
 * Intent URL pro otevření aktuální stránky v aplikaci Chrome.
 * Při absenci Chromu použije S.browser_fallback_url (HTTPS).
 */
export function sestavitOtevreniVChromuIntentUrl(aktualniUrl: string): string {
  const url = pridatOtevrenoVChromuParam(aktualniUrl);
  const parsed = new URL(url);
  const cesta = `${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
  const fallback = encodeURIComponent(url);

  return `intent://${cesta}#Intent;scheme=https;action=android.intent.action.VIEW;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
}

/** Alternativa k intentu – přímá navigace schématem googlechrome:// */
export function sestavitGoogleChromeNavigateUrl(aktualniUrl: string): string {
  return `googlechrome://navigate?url=${encodeURIComponent(pridatOtevrenoVChromuParam(aktualniUrl))}`;
}

/** Aktuální URL stránky včetně cesty a query parametrů. */
export function aktualniStrankaUrl(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.href;
}

/** Připraví URL pro klepnutí – vymaže embedded stav a vrátí intent odkaz. */
export function pripravitOtevreniVChromu(aktualniUrl: string): string {
  return sestavitOtevreniVChromuIntentUrl(aktualniUrl);
}
