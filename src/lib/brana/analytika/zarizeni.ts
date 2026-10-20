import type { BranaAnalytikaZarizeni } from "./model";

const MAX_DELKA_USER_AGENT = 512;

/**
 * Zařadí zařízení podle hlavičky User-Agent, kterou prohlížeč posílá sám.
 * Text hlavičky se neukládá. Neznámá nebo prázdná hlavička je Ostatní.
 * iPad, který se hlásí jen jako Macintosh, zůstane počítač.
 */
export function klasifikovatZarizeniZUserAgent(raw: unknown): BranaAnalytikaZarizeni {
  if (typeof raw !== "string") {
    return "ostatni";
  }
  const text = raw.slice(0, MAX_DELKA_USER_AGENT);
  if (text.trim() === "") {
    return "ostatni";
  }
  if (/iPad|iPhone|iPod/i.test(text)) {
    return "ios";
  }
  if (/Android/i.test(text)) {
    return "android";
  }
  if (/Windows Phone|Windows Mobile/i.test(text)) {
    return "ostatni";
  }
  if (/Windows NT/i.test(text)) {
    return "pocitac";
  }
  if (/Macintosh|Mac OS X/i.test(text)) {
    return "pocitac";
  }
  if (/CrOS/i.test(text)) {
    return "pocitac";
  }
  if (/X11/i.test(text) && /Linux/i.test(text)) {
    return "pocitac";
  }
  return "ostatni";
}
