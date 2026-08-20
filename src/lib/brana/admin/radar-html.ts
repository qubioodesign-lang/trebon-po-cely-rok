/**
 * Společné HTML / datumové pomůcky RADAR extractoru.
 * Nejsou produkční parser. Nic nezapisují.
 */

export type RadarHrubyNalez = {
  nazev: string;
  datumOd: string;
  datumDo: string;
  cas: string;
  kde: string;
  url: string;
};

const ISO_DEN = /^\d{4}-\d{2}-\d{2}$/;

export function dekodovatHtmlText(raw: string): string {
  return raw
    .replace(/&#(\d+);/g, (_, n: string) => {
      const kod = Number(n);
      return Number.isFinite(kod) ? String.fromCharCode(kod) : "";
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n: string) => {
      const kod = Number.parseInt(n, 16);
      return Number.isFinite(kod) ? String.fromCharCode(kod) : "";
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function textBezHtml(html: string): string {
  return dekodovatHtmlText(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|h\d|tr|div)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  );
}

export function normalizovatRadarText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function jePlatnyIsoDen(iso: string): boolean {
  if (!ISO_DEN.test(iso)) {
    return false;
  }
  const [y, m, d] = iso.split("-").map(Number);
  const datum = new Date(Date.UTC(y, m - 1, d));
  return (
    datum.getUTCFullYear() === y &&
    datum.getUTCMonth() + 1 === m &&
    datum.getUTCDate() === d
  );
}

export function formatujIsoDen(rok: number, mesic: number, den: number): string {
  return `${rok}-${String(mesic).padStart(2, "0")}-${String(den).padStart(2, "0")}`;
}

export function isoZCeskehoData(
  den: number,
  mesic: number,
  rok: number,
): string | null {
  if (!jePlatnyIsoDen(formatujIsoDen(rok, mesic, den))) {
    return null;
  }
  return formatujIsoDen(rok, mesic, den);
}

export function pridatDnyKIso(iso: string, dny: number): string | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    return null;
  }
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + dny));
  return formatujIsoDen(
    dt.getUTCFullYear(),
    dt.getUTCMonth() + 1,
    dt.getUTCDate(),
  );
}

export function dnyRozmezi(odIso: string, doIso: string, maxDni = 15): string[] {
  if (!jePlatnyIsoDen(odIso) || !jePlatnyIsoDen(doIso) || doIso < odIso) {
    return [];
  }
  const dny: string[] = [];
  let kurzor = odIso;
  while (kurzor <= doIso) {
    dny.push(kurzor);
    if (dny.length > maxDni) {
      return [];
    }
    const dalsi = pridatDnyKIso(kurzor, 1);
    if (!dalsi) {
      return [];
    }
    kurzor = dalsi;
  }
  return dny;
}

export function delkaRozmeziDnu(odIso: string, doIso: string): number {
  const dny = dnyRozmezi(odIso, doIso, 400);
  return dny.length === 0 ? 0 : dny.length;
}

export function atributHref(atributy: string): string {
  const m = atributy.match(/\bhref=["']([^"']+)["']/i);
  return (m?.[1] ?? "").trim();
}

export function kanonizovatHttpUrl(
  href: string,
  zaklad: string,
  povoleneHosty?: readonly string[],
): string {
  try {
    const abs = new URL(href, zaklad);
    if (abs.protocol !== "http:" && abs.protocol !== "https:") {
      return "";
    }
    const host = abs.hostname.replace(/^www\./i, "").toLowerCase();
    if (povoleneHosty && !povoleneHosty.includes(host)) {
      return "";
    }
    abs.hash = "";
    return abs.toString();
  } catch {
    return "";
  }
}

export function vytahnoutCasZTextu(text: string): string {
  const t = text.replace(/\u00a0/g, " ");
  const m = t.match(/\b([01]?\d|2[0-3])[.:]([0-5]\d)(?!\.\d)/);
  if (!m) {
    return "";
  }
  return `${String(m[1]).padStart(2, "0")}:${m[2]}`;
}

export function parsovatCeskeDatumVTextu(
  text: string,
): { od: string; doDne: string } | null {
  const t = text.replace(/\u00a0/g, " ");
  const rozmezi = t.match(
    /(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})\s*[–\-]\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/,
  );
  if (rozmezi) {
    const od = isoZCeskehoData(
      Number(rozmezi[1]),
      Number(rozmezi[2]),
      Number(rozmezi[3]),
    );
    const doDne = isoZCeskehoData(
      Number(rozmezi[4]),
      Number(rozmezi[5]),
      Number(rozmezi[6]),
    );
    if (od && doDne && doDne >= od) {
      return { od, doDne };
    }
  }
  const stejneMesic = t.match(
    /(\d{1,2})\.\s*[–\-]\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/,
  );
  if (stejneMesic) {
    const od = isoZCeskehoData(
      Number(stejneMesic[1]),
      Number(stejneMesic[3]),
      Number(stejneMesic[4]),
    );
    const doDne = isoZCeskehoData(
      Number(stejneMesic[2]),
      Number(stejneMesic[3]),
      Number(stejneMesic[4]),
    );
    if (od && doDne && doDne >= od) {
      return { od, doDne };
    }
  }
  const tečky = t.match(/(\d{1,2})\.(\d{2})\.(20\d{2})(?:\s*[–\-]\s*(\d{1,2})\.(\d{2})\.(20\d{2}))?/);
  if (tečky) {
    const od = isoZCeskehoData(
      Number(tečky[1]),
      Number(tečky[2]),
      Number(tečky[3]),
    );
    const doDne = tečky[4]
      ? isoZCeskehoData(Number(tečky[4]), Number(tečky[5]), Number(tečky[6]))
      : od;
    if (od && doDne && doDne >= od) {
      return { od, doDne };
    }
  }
  const jeden = t.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/);
  if (!jeden) {
    return null;
  }
  const iso = isoZCeskehoData(
    Number(jeden[1]),
    Number(jeden[2]),
    Number(jeden[3]),
  );
  return iso ? { od: iso, doDne: iso } : null;
}
