export const SDILENI_TITULEK = "Třeboň po celý rok";
export const SDILENI_TEXT = "Na chvíli zpátky do Třeboně.";

/** Veřejná adresa galerie pro facebookový náhled. Nezávislá na hostu administrace. */
export const FACEBOOK_NAHLED_ZAKLAD = "https://www.trebonpocelyrok.cz";

/** Stabilní odkaz na třetí fotografii jednoho prolnutí. Nemění pořadí ani sdílení návštěvníků. */
export function sestavitUrlNahleduFacebook(polozkaId: string): string {
  return `${FACEBOOK_NAHLED_ZAKLAD}/?nahled=${encodeURIComponent(polozkaId)}`;
}

/** Sestaví trvalý sdílecí odkaz na konkrétní položku galerie */
export function sestavitSdileciUrl(polozkaId: string): string {
  if (typeof window === "undefined") {
    return `/?polozka=${polozkaId}&z=sdileni`;
  }
  return `${window.location.origin}/?polozka=${encodeURIComponent(polozkaId)}&z=sdileni`;
}

/** Systémové sdílení, nebo zkopírování odkazu do schránky */
export async function sdiletPolozku(
  polozkaId: string
): Promise<"sdileno" | "zkopirovano"> {
  const url = sestavitSdileciUrl(polozkaId);

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ url });
      return "sdileno";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
    }
  }

  await navigator.clipboard.writeText(url);
  return "zkopirovano";
}
