/** Dočasná diagnostika inicializace stránky – jen s ?test=2 */

export type DiagKlic =
  | "nav"
  | "html"
  | "dom"
  | "pageHtml"
  | "webpack"
  | "mainApp"
  | "layoutJs"
  | "pageJs"
  | "layoutHydrate"
  | "modulGalerie"
  | "indexPolozky"
  | "galerieRender"
  | "galerie"
  | "pageServerTrvani"
  | "apiServerTrvani"
  | "prolnuti"
  | "prolnutiA"
  | "prolnutiB"
  | "prolnutiStart";

export type DiagData = Partial<Record<DiagKlic, number>>;

declare global {
  interface Window {
    __TREBON_DIAG?: DiagData;
  }
}

export function jeDiagTest2(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("test") === "2";
}

export function msOdNav(): number {
  return Math.round(performance.now());
}

export function zaznamenatDiag(klic: DiagKlic, hodnota?: number): void {
  if (typeof window === "undefined" || !jeDiagTest2()) return;
  if (!window.__TREBON_DIAG) window.__TREBON_DIAG = {};
  window.__TREBON_DIAG[klic] = hodnota ?? msOdNav();
  window.dispatchEvent(new CustomEvent("trebon-diag"));
}

export function ziskatDiag(): DiagData {
  if (typeof window === "undefined") return {};
  return window.__TREBON_DIAG ?? {};
}

export function formatDiagCas(cas: number | undefined): string {
  return cas === undefined ? "—" : String(Math.round(cas));
}
