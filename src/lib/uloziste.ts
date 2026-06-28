import type { PolozkaVerejna } from "@/types";

/** Klíč pro uložení pozice v sessionStorage */
export const KLIC_POZICE_GALERIE = "trebon_pozice_galerie";

/** Klíč pro ID právě prohlížené položky (záloha pro sdílení) */
export const KLIC_POLOZKA_GALERIE = "trebon_polozka_galerie";

/** Klíč pro identifikaci návštěvníka v localStorage */
export const KLIC_NAVSTEVNIK_ID = "trebon_navstevnik_id";

/** Klíč pro dokončené povolení upozornění na stránce chci se vracet */
export const KLIC_UPOZORNENI_AKTIVNI = "trebon_upozorneni_aktivni";

/** Uloží aktuální pozici galerie do sessionStorage */
export function ulozitPoziciGalerie(index: number): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KLIC_POZICE_GALERIE, String(index));
}

/** Uloží ID aktuální položky galerie */
export function ulozitPolozkuGalerie(polozkaId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KLIC_POLOZKA_GALERIE, polozkaId);
}

/** Načte uložené ID položky galerie */
export function nacistPolozkuGalerie(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(KLIC_POLOZKA_GALERIE);
}

/**
 * Vrátí startovní index galerie.
 * Priorita: sdílecí odkaz (?polozka=) → sessionStorage → 0.
 */
export function ziskatPocatecniIndexGalerie(
  polozky: PolozkaVerejna[],
  pocatecniPolozkaId?: string
): number {
  if (pocatecniPolozkaId) {
    const zOdkazu = polozky.findIndex((p) => p.id === pocatecniPolozkaId);
    if (zOdkazu >= 0) return zOdkazu;
  }

  const ulozeneId = nacistPolozkuGalerie();
  if (ulozeneId) {
    const zUloziste = polozky.findIndex((p) => p.id === ulozeneId);
    if (zUloziste >= 0) return zUloziste;
  }

  return ziskatPlatnouPoziciGalerie(polozky.length);
}

/** Načte uloženou pozici galerie ze sessionStorage */
export function nacistPoziciGalerie(): number {
  if (typeof window === "undefined") return 0;
  const hodnota = sessionStorage.getItem(KLIC_POZICE_GALERIE);
  if (hodnota === null) return 0;
  const index = parseInt(hodnota, 10);
  return isNaN(index) ? 0 : index;
}

/**
 * Vrátí uloženou pozici, pokud je v rozsahu galerie.
 * Index 0 je platný – uživatel nesmí skončit na začátku omylem.
 */
export function ziskatPlatnouPoziciGalerie(pocetPolozek: number): number {
  if (pocetPolozek <= 0) return 0;
  const ulozena = nacistPoziciGalerie();
  if (ulozena >= 0 && ulozena < pocetPolozek) return ulozena;
  return 0;
}

/** Vytvoří unikátní ID – funguje i přes HTTP (bez crypto.randomUUID) */
function vytvoritNavstevnikId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Získá nebo vytvoří unikátní ID návštěvníka */
export function ziskatNavstevnikId(): string {
  if (typeof window === "undefined") return "";

  let id = localStorage.getItem(KLIC_NAVSTEVNIK_ID);
  if (!id) {
    id = vytvoritNavstevnikId();
    localStorage.setItem(KLIC_NAVSTEVNIK_ID, id);
  }
  return id;
}

/** Uloží příznak dokončeného flow „Dostávat upozornění“ */
export function ulozitUpozorneniAktivni(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KLIC_UPOZORNENI_AKTIVNI, "1");
}

/** Načte příznak dokončeného flow „Dostávat upozornění“ */
export function maUlozeneUpozorneniAktivni(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KLIC_UPOZORNENI_AKTIVNI) === "1";
}

/** Smaže lokální příznak – např. když chybí skutečná push subscription */
export function vymazatUpozorneniAktivni(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KLIC_UPOZORNENI_AKTIVNI);
}

/** Detekce iOS zařízení pro návod k PWA */
export function jeIOS(): boolean {
  if (typeof window === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Detekce, zda běží jako nainstalovaná PWA */
export function jePWA(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

/** Detekce podpory push notifikací */
export function podporujePushNotifikace(): boolean {
  if (typeof window === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window;
}
