/**
 * Úzký parser nástěnky ZUŠ Třeboň (`/p-planakci.html`).
 * Jen „Koncert žáků“ a „Vánoční Miniturné“ s jedním ověřeným místem v Třeboni.
 * Jiný zdroj tento modul nevolá. Nečitelná stránka vrací prázdný seznam.
 */

import type { BranaScanKandidat } from "./zdroj-scan-parser";

export const BRANA_ZUS_TREBON_AKCE_REDAKCNI_POLOZKA_ID = "zus-trebon-akce";

const ZUS_PLANAKCI_IDENTITA = "zus-planakci";
const ZUS_HOST = "zustrebon.cz";
const ZUS_PLANAKCI_CESTA = "/p-planakci.html";

const NAZEV_KONCERT_ZAKU = "Koncert žáků";

type PovoleneMisto = {
  fraze: string;
  misto: string;
  klic: string;
};

/** Místa ověřená na nástěnce. Samotný web školy Třeboň nedokládá. */
const POVOLENA_MISTA: readonly PovoleneMisto[] = [
  { fraze: "sál ZUŠ", misto: "sál ZUŠ", klic: "sal-zus" },
  {
    fraze: "sál Lázní Aurora",
    misto: "sál Lázní Aurora",
    klic: "sal-lazni-aurora",
  },
  {
    fraze: "Divadlo J. K. Tyla",
    misto: "Divadlo J. K. Tyla, Třeboň",
    klic: "divadlo-j-k-tyla",
  },
];

/** Další obec v odstavci = víc než jedno místo. */
const CIZI_OBEC =
  /suchdol|velenic|lomnic|borovan|doman[ií]n|jindřich[uů]v hradec|dvory nad lu[zž]nic|(?:^|[^a-zěščřžýáíéúůďťň])praha(?:[^a-zěščřžýáíéúůďťň]|$)/i;

function dekodovat(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n: string) => {
      const kod = Number(n);
      return Number.isFinite(kod) ? String.fromCharCode(kod) : "";
    })
    .replace(/\s+/g, " ")
    .trim();
}

function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function jeZusTrebonPlanAkciZdrojUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, "").toLowerCase();
    return host === ZUS_HOST && path === ZUS_PLANAKCI_CESTA;
  } catch {
    return false;
  }
}

function jeKoncertZaku(nazev: string): boolean {
  return nazev === NAZEV_KONCERT_ZAKU;
}

function jeVanocniMiniturne(nazev: string): boolean {
  return /^vánoční miniturné(?:\s+(?:[ivxlcdm]+|\d+)\.?)?$/i.test(nazev);
}

function datumZNastenky(text: string): string | null {
  const shoda = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!shoda) {
    return null;
  }
  const den = Number(shoda[1]);
  const mesic = Number(shoda[2]);
  const rok = Number(shoda[3]);
  const kontrola = new Date(Date.UTC(rok, mesic - 1, den));
  if (
    kontrola.getUTCFullYear() !== rok ||
    kontrola.getUTCMonth() !== mesic - 1 ||
    kontrola.getUTCDate() !== den
  ) {
    return null;
  }
  return `${shoda[3]}-${shoda[2]}-${shoda[1]}`;
}

function casZOdstavce(text: string): string | null {
  const shody = [
    ...text.matchAll(/(?:od\s+)?(\d{1,2})(?::(\d{2}))?\s*h\b/gi),
  ];
  if (shody.length !== 1) {
    return null;
  }
  const hodina = Number(shody[0][1]);
  const minuta = shody[0][2] === undefined ? 0 : Number(shody[0][2]);
  if (hodina > 23 || minuta > 59) {
    return null;
  }
  return `${String(hodina).padStart(2, "0")}:${String(minuta).padStart(2, "0")}`;
}

function mistoZOdstavce(text: string): PovoleneMisto | null {
  if (CIZI_OBEC.test(text)) {
    return null;
  }
  const nalezena = POVOLENA_MISTA.filter((m) => text.includes(m.fraze));
  if (nalezena.length !== 1) {
    return null;
  }
  return nalezena[0] ?? null;
}

/**
 * HTML nástěnky → kandidáti. Bez data, času nebo jednoho povoleného místa nic.
 */
export function parsovatZusTrebonPlanAkci(html: string): BranaScanKandidat[] {
  if (!html.includes("actual_board_record")) {
    return [];
  }

  const vysledek: BranaScanKandidat[] = [];
  const videne = new Set<string>();
  const karty = html.matchAll(
    /<div class="actual_board_record">([\s\S]*?)<\/div>/gi,
  );

  for (const karta of karty) {
    const telo = karta[1] ?? "";
    const nazev = dekodovat(
      (telo.match(/actual_board_name">([\s\S]*?)<\/span>/i) ?? [])[1] ?? "",
    );
    if (!jeKoncertZaku(nazev) && !jeVanocniMiniturne(nazev)) {
      continue;
    }

    const datum = datumZNastenky(
      dekodovat(
        (telo.match(/actual_board_date">([\s\S]*?)<\/span>/i) ?? [])[1] ?? "",
      ),
    );
    if (!datum) {
      continue;
    }

    const odstavec = dekodovat((telo.match(/<p>([\s\S]*?)<\/p>/i) ?? [])[1] ?? "");
    const cas = casZOdstavce(odstavec);
    const misto = mistoZOdstavce(odstavec);
    if (!cas || !misto) {
      continue;
    }

    const zdrojIdentita = [
      ZUS_PLANAKCI_IDENTITA,
      datum,
      slug(nazev),
      misto.klic,
    ].join("|");
    if (videne.has(zdrojIdentita)) {
      continue;
    }
    videne.add(zdrojIdentita);

    vysledek.push({
      nazev,
      datumOd: datum,
      datumDo: datum,
      cas,
      mistoNeboTyp: misto.misto,
      zdrojIdentita,
    });
  }

  return vysledek;
}
