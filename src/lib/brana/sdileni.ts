/** Jediná sdílená adresa. Vždy Dnes, bez parametrů právě otevřené stránky. */
export const BRANA_SDILENA_ADRESA = "https://www.trebonpocelyrok.cz/brana?z=sdileni";

/** Sdílení stránky BRÁNY – Web Share API s fallbackem na schránku */
export async function sdiletBrana(): Promise<"sdileno" | "zkopirovano"> {
  const url = BRANA_SDILENA_ADRESA;
  const title = "BRÁNA do Třeboně";

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, url });
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
