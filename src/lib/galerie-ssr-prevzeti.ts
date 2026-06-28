/** Doba fade-out SSR vrstvy při převzetí klientskou galerií (ms) */
export const SSR_PREVZETI_FADE_MS = 200;

export function jsouGalerieFotkyPripravene(
  kontejner: HTMLElement | null
): boolean {
  if (!kontejner) return false;
  const imgs = kontejner.querySelectorAll("img");
  if (imgs.length === 0) return false;
  return Array.from(imgs).every((img) => {
    const el = img as HTMLImageElement;
    return el.complete && el.naturalWidth > 0;
  });
}

export function zmizetSsrGalerie(onHotovo: () => void): void {
  const ssr = document.getElementById("trebon-ssr-galerie");
  if (!ssr) {
    onHotovo();
    return;
  }

  ssr.style.transition = `opacity ${SSR_PREVZETI_FADE_MS}ms ease-out`;
  ssr.style.opacity = "0";
  ssr.style.pointerEvents = "none";

  window.setTimeout(() => {
    ssr.remove();
    onHotovo();
  }, SSR_PREVZETI_FADE_MS + 30);
}

export function odstranitSsrGalerieOkamzite(): void {
  document.getElementById("trebon-ssr-galerie")?.remove();
}
