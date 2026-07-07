/** Trvalé vyloučení tohoto zařízení ze všech statistik (localStorage) */
export const KLIC_VYLouCIT_ZE_STATISTIK = "trebon_vyloucit_ze_statistik";

export function jeVyloucenoZeStatistik(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return localStorage.getItem(KLIC_VYLouCIT_ZE_STATISTIK) === "1";
}

export function nastavitVylouceniZeStatistik(vyloucit: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  if (vyloucit) {
    localStorage.setItem(KLIC_VYLouCIT_ZE_STATISTIK, "1");
    return;
  }

  localStorage.removeItem(KLIC_VYLouCIT_ZE_STATISTIK);
}
