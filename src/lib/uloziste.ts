/** Klíč pro uložení pozice v sessionStorage */
export const KLIC_POZICE_GALERIE = "trebon_pozice_galerie";

/** Klíč pro identifikaci návštěvníka v localStorage */
export const KLIC_NAVSTEVNIK_ID = "trebon_navstevnik_id";

/** Uloží aktuální pozici galerie do sessionStorage */
export function ulozitPoziciGalerie(index: number): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KLIC_POZICE_GALERIE, String(index));
}

/** Načte uloženou pozici galerie ze sessionStorage */
export function nacistPoziciGalerie(): number {
  if (typeof window === "undefined") return 0;
  const hodnota = sessionStorage.getItem(KLIC_POZICE_GALERIE);
  if (hodnota === null) return 0;
  const index = parseInt(hodnota, 10);
  return isNaN(index) ? 0 : index;
}

/** Získá nebo vytvoří unikátní ID návštěvníka */
export function ziskatNavstevnikId(): string {
  if (typeof window === "undefined") return "";

  let id = localStorage.getItem(KLIC_NAVSTEVNIK_ID);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KLIC_NAVSTEVNIK_ID, id);
  }
  return id;
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
