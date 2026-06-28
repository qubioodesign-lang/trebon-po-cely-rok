import type { PolozkaVerejna } from "@/types";

/**
 * Startovní index pro SSR – bez sessionStorage (na serveru nedostupné).
 * Klient po hydrataci může upřesnit z localStorage.
 */
export function ziskatPocatecniIndexServer(
  polozky: PolozkaVerejna[],
  pocatecniPolozkaId?: string
): number {
  if (pocatecniPolozkaId) {
    const zOdkazu = polozky.findIndex((p) => p.id === pocatecniPolozkaId);
    if (zOdkazu >= 0) return zOdkazu;
  }
  return 0;
}
