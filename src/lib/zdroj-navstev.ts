/** Povolené zdroje návštěv pro analytics v1a */
export type ZdrojNavstevnika =
  | "qr"
  | "desktop-qr"
  | "whatsapp"
  | "sdileni"
  | "primy"
  | "ostatni";

export const ZDROJE_NAVSTEV: ZdrojNavstevnika[] = [
  "qr",
  "desktop-qr",
  "whatsapp",
  "sdileni",
  "primy",
  "ostatni",
];

export const POPISY_ZDROJU: Record<ZdrojNavstevnika, string> = {
  qr: "QR",
  "desktop-qr": "QR (desktop pozvánka)",
  whatsapp: "WhatsApp",
  sdileni: "Sdílení",
  primy: "Přímý vstup",
  ostatni: "Ostatní",
};

const KLIC_NAVSTEVA_SESSION = "trebon_analytics_navsteva";

export function jePlatnyZdrojNavstevy(
  hodnota: string
): hodnota is ZdrojNavstevnika {
  return (ZDROJE_NAVSTEV as string[]).includes(hodnota);
}

/** Určí zdroj z URL parametrů a referreru (pouze v prohlížeči) */
export function urcitZdrojNavstevy(): ZdrojNavstevnika {
  if (typeof window === "undefined") {
    return "primy";
  }

  const params = new URLSearchParams(window.location.search);
  const zdroj = params.get("zdroj")?.toLowerCase();
  const z = params.get("z")?.toLowerCase();

  if (zdroj === "desktop-qr") return "desktop-qr";
  if (z === "qr") return "qr";
  if (z === "wa" || z === "whatsapp") return "whatsapp";
  if (z === "sdileni" || params.get("polozka")) return "sdileni";

  const referrer = document.referrer;
  if (referrer) {
    try {
      const refUrl = new URL(referrer);
      if (refUrl.origin !== window.location.origin) {
        return "ostatni";
      }
    } catch {
      return "ostatni";
    }
  }

  return "primy";
}

/** Vrátí true, pokud je v této relaci prohlížeče návštěva už zaznamenaná */
export function bylaNavstevaVSession(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(KLIC_NAVSTEVA_SESSION) === "1";
}

export function oznacitNavstevuVSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KLIC_NAVSTEVA_SESSION, "1");
}
