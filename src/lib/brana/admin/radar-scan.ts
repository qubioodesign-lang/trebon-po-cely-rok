/**
 * RADAR krok 3: první automatický sběr.
 * Čistý návrat kandidátů. Žádný Blob WRITE, žádný Kalendář, žádný cron.
 */

import { radarDnesIso } from "./radar";
import {
  delkaRozmeziDnu,
  dnyRozmezi,
  normalizovatRadarText,
  pridatDnyKIso,
  type RadarHrubyNalez,
} from "./radar-html";
import { vytahnoutRadarKphNalezy } from "./radar-kultura-pod-hvezdami";
import { vytahnoutRadarTlsNalezy } from "./radar-letni-setkavani";
import { vytahnoutRadarTrebonskoNalezy } from "./radar-trebonsko";
import {
  BRANA_RADAR_VSTUP_KPH,
  BRANA_RADAR_VSTUP_TLS,
  BRANA_RADAR_VSTUP_TREBONSKO,
  BRANA_RADAR_VSTUP_ZAMEK,
  BRANA_RADAR_VSTUPY,
} from "./radar-vstupy";
import {
  vytahnoutRadarZamekMesice,
  vytahnoutRadarZamekNalezy,
} from "./radar-zamek";

const OKNO_DNI = 14;
const FETCH_TIMEOUT_MS = 20_000;
const USER_AGENT = "BranaRadarReadOnly/1.0";

export type RadarScanKandidat = {
  radarVstupId: string;
  datumOd: string;
  cas: string;
  nazev: string;
  kde: string;
  url: string;
};

export type RadarScanOziveni = {
  radarVstupId: string;
  nazevZdroje: string;
  url: string;
};

export type RadarScanChyba = {
  radarVstupId: string;
  chyba: string;
};

export type RadarScanVysledek = {
  oknoOd: string;
  oknoDo: string;
  hruby: number;
  poGeografii: number;
  poOkne: number;
  odectenoUzVBrane: number;
  odectenoSum: number;
  kandidati: RadarScanKandidat[];
  oziveni: RadarScanOziveni[];
  podleVstupu: { radarVstupId: string; pocet: number }[];
  chyby: RadarScanChyba[];
};

export type RadarScanVolby = {
  ted?: Date;
  stahnoutHtml?: (url: string, init?: RequestInit) => Promise<string>;
  fetchTimeoutMs?: number;
  limitMs?: number;
  startAtMs?: number;
};

const GEO_VYJIMKY: readonly string[] = [
  "zahrada cep",
  "pergola u sv. vita",
  "pergola u svateho vita",
];

/** Město Třeboň, ne region Třeboňsko. */
const TREBON_MESTO_RE =
  /(?:^|[^a-z])trebon(?:i|e|ska|sky|ske|skou|skem)?(?:[^a-z]|$)/;

const UZ_V_BRANE_NAZEV: readonly string[] = [
  "remeslne trhy",
  "remeslny trh",
  "tecka s trhem",
  "letni tecka s trhem",
  "mint market",
  "vidiny",
  "festival vizualni tvorby",
  "sireny na cestach",
  "za dvermi kancelari",
  "o jidle, piti a stolovani",
  "o jidle piti a stolovani",
  "pikantnosti z rozmberske",
  "petr vok na trebon stehovati",
  "prohlidka divadla j. k. tyla",
  "prohlidka divadla jk tyla",
  "rozmberska noc",
  "tanecni vecer",
  "otevirani lazensk",
];

const UZ_V_BRANE_URL: readonly string[] = [
  "/remeslne-trhy-trebon",
  "/letni-trhy-v-treboni",
  "/otevirani-lazenske-sezony",
  "/kategorie/kina",
  "/kategorie/lazensky-kulturni-program",
  "mintmarket.cz",
  "tdf.cz",
  "vidiny.cz",
  "zameckalekarnatrebon.cz",
  "okolotrebone.cz",
];

export function radarOknoDo(oknoOd: string): string {
  const doDne = pridatDnyKIso(oknoOd, OKNO_DNI);
  if (!doDne) {
    return oknoOd;
  }
  return doDne;
}

function geoKlic(text: string): string {
  return normalizovatRadarText(text.replace(/[-_./]+/g, " "));
}

/**
 * Fail-closed geografie: jen doložené město Třeboň, nebo Cep / Pergola.
 * Třeboňsko, „Chlum u Třeboně“ ani „Okolo Třeboně“ nestačí.
 * Listing trebonsko.cz nemá pole místa — signál je jen název / URL / KDE.
 */
export function jeRadarPovolenaGeografie(text: string): boolean {
  const n = geoKlic(text);
  if (GEO_VYJIMKY.some((v) => n.includes(geoKlic(v)))) {
    return true;
  }
  const bezUTreboně = n.replace(/\b[a-z]+\s+u trebone\b/g, " ");
  const bezOkolo = bezUTreboně.replace(/\bokolo trebone\b/g, " ");
  const bezRegionu = bezOkolo.replace(/\btrebonsko\b/g, " ");
  return TREBON_MESTO_RE.test(bezRegionu);
}

export function prekryvaRadarOkno(args: {
  datumOd: string;
  datumDo: string;
  oknoOd: string;
  oknoDo: string;
}): boolean {
  return args.datumOd <= args.oknoDo && args.datumDo >= args.oknoOd;
}

export function jeZjevneUzVBrane(nalez: {
  nazev: string;
  url: string;
}): boolean {
  const url = nalez.url.toLowerCase();
  if (UZ_V_BRANE_URL.some((cast) => url.includes(cast))) {
    return true;
  }
  const n = normalizovatRadarText(nalez.nazev);
  if (n.includes("hradozamecka")) {
    return false;
  }
  return UZ_V_BRANE_NAZEV.some((cast) => n.includes(cast));
}

export function jeZjevnySumProvoz(nalez: RadarHrubyNalez): boolean {
  const n = normalizovatRadarText(`${nalez.nazev} ${nalez.kde}`);
  if (
    n.includes("soiree") ||
    n.includes("hradozamecka") ||
    n.includes("kostymovan") ||
    n.includes("komedie") ||
    n.includes("open air")
  ) {
    return false;
  }
  if (delkaRozmeziDnu(nalez.datumOd, nalez.datumDo) > OKNO_DNI) {
    return true;
  }
  if (
    n.startsWith("vystava") ||
    n.includes(" vystava ") ||
    n.includes("- vystava") ||
    n.startsWith("putovni vystava")
  ) {
    return true;
  }
  if (
    n.startsWith("tip trebon") ||
    n.includes("prohlidky, prochazky") ||
    n.includes("oteviraci doba") ||
    n.includes("kalendar koncertu festivalu okolo")
  ) {
    return true;
  }
  if (
    (n.includes("prohlidkova trasa") ||
      n.includes("prohlidky zamku") ||
      n.includes("standardni prohlidka")) &&
    !n.includes("soiree") &&
    !n.includes("hradozamecka")
  ) {
    return true;
  }
  return false;
}

export function jeZjevneZruseno(nazev: string): boolean {
  const n = normalizovatRadarText(nazev);
  return n.includes("zruseno") || n.includes("zrusena") || n.includes("neuskutecni");
}

function rozlozitNaDnyVOkne(
  nalez: RadarHrubyNalez,
  radarVstupId: string,
  oknoOd: string,
  oknoDo: string,
): RadarScanKandidat[] {
  const dny = dnyRozmezi(nalez.datumOd, nalez.datumDo, OKNO_DNI + 1);
  if (dny.length === 0) {
    if (nalez.datumOd >= oknoOd && nalez.datumOd <= oknoDo) {
      return [
        {
          radarVstupId,
          datumOd: nalez.datumOd,
          cas: nalez.cas,
          nazev: nalez.nazev,
          kde: nalez.kde,
          url: nalez.url,
        },
      ];
    }
    return [];
  }
  return dny
    .filter((d) => d >= oknoOd && d <= oknoDo)
    .map((d) => ({
      radarVstupId,
      datumOd: d,
      cas: nalez.cas,
      nazev: nalez.nazev,
      kde: nalez.kde,
      url: nalez.url,
    }));
}

function klicKandidata(k: RadarScanKandidat): string {
  return `${k.datumOd}|${normalizovatRadarText(k.nazev)}`;
}

function sloucitDuplicity(kandidati: RadarScanKandidat[]): RadarScanKandidat[] {
  const mapa = new Map<string, RadarScanKandidat>();
  for (const k of kandidati) {
    const klic = klicKandidata(k);
    const stary = mapa.get(klic);
    if (!stary) {
      mapa.set(klic, k);
      continue;
    }
    const lepsiUrl =
      k.url.length > stary.url.length || k.radarVstupId === BRANA_RADAR_VSTUP_ZAMEK
        ? k.url
        : stary.url;
    const lepsiKde = k.kde || stary.kde;
    const lepsiCas = k.cas || stary.cas;
    const lepsiVstup =
      k.radarVstupId === BRANA_RADAR_VSTUP_ZAMEK
        ? k.radarVstupId
        : stary.radarVstupId;
    mapa.set(klic, {
      radarVstupId: lepsiVstup,
      datumOd: k.datumOd,
      cas: lepsiCas,
      nazev: stary.nazev,
      kde: lepsiKde,
      url: lepsiUrl,
    });
  }
  return [...mapa.values()].sort((a, b) => {
    if (a.datumOd !== b.datumOd) {
      return a.datumOd < b.datumOd ? -1 : 1;
    }
    return a.nazev.localeCompare(b.nazev, "cs");
  });
}

export async function stahnoutRadarHtml(
  url: string,
  init?: RequestInit,
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const hlavicky = new Headers(init?.headers);
    if (!hlavicky.has("User-Agent")) {
      hlavicky.set("User-Agent", USER_AGENT);
    }
    if (!hlavicky.has("Accept")) {
      hlavicky.set("Accept", "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8");
    }
    const odpoved = await fetch(url, {
      ...init,
      headers: hlavicky,
      redirect: "follow",
      signal: ctrl.signal,
    });
    if (!odpoved.ok) {
      throw new Error(`HTTP ${odpoved.status}`);
    }
    return await odpoved.text();
  } finally {
    clearTimeout(timer);
  }
}

function mesiceOkna(oknoOd: string, oknoDo: string): { rok: number; mesic: number }[] {
  const odRok = Number(oknoOd.slice(0, 4));
  const odMesic = Number(oknoOd.slice(5, 7));
  const doRok = Number(oknoDo.slice(0, 4));
  const doMesic = Number(oknoDo.slice(5, 7));
  const out: { rok: number; mesic: number }[] = [];
  let rok = odRok;
  let mesic = odMesic;
  while (rok < doRok || (rok === doRok && mesic <= doMesic)) {
    out.push({ rok, mesic });
    mesic += 1;
    if (mesic > 12) {
      mesic = 1;
      rok += 1;
    }
  }
  return out;
}

async function sberVstupu(args: {
  vstupId: string;
  url: string;
  stahnoutHtml: (url: string, init?: RequestInit) => Promise<string>;
  oknoOd: string;
  oknoDo: string;
}): Promise<RadarHrubyNalez[]> {
  if (args.vstupId === BRANA_RADAR_VSTUP_TREBONSKO) {
    const html = await args.stahnoutHtml(args.url);
    return vytahnoutRadarTrebonskoNalezy(html, args.url);
  }
  if (args.vstupId === BRANA_RADAR_VSTUP_ZAMEK) {
    const html = await args.stahnoutHtml(args.url);
    const nabidnute = vytahnoutRadarZamekMesice(html);
    const potrebne = mesiceOkna(args.oknoOd, args.oknoDo);
    const mesice =
      nabidnute.length > 0
        ? nabidnute.filter((m) =>
            potrebne.some((p) => p.rok === m.rok && p.mesic === m.mesic),
          )
        : potrebne;
    return vytahnoutRadarZamekNalezy({
      listingHtml: html,
      listingUrl: args.url,
      stahnoutHtml: args.stahnoutHtml,
      mesice,
    });
  }
  if (args.vstupId === BRANA_RADAR_VSTUP_KPH) {
    const html = await args.stahnoutHtml(args.url);
    return vytahnoutRadarKphNalezy(html, args.url);
  }
  if (args.vstupId === BRANA_RADAR_VSTUP_TLS) {
    const html = await args.stahnoutHtml(args.url);
    return vytahnoutRadarTlsNalezy(html, args.url);
  }
  return [];
}

/**
 * Read-only sběr. Nevolá úložiště, nevolá Kalendář, nemění produkční scan.
 */
export async function spustitRadarScanReadOnly(
  volby: RadarScanVolby = {},
): Promise<RadarScanVysledek> {
  const ted = volby.ted ?? new Date();
  const oknoOd = radarDnesIso(ted);
  const oknoDo = radarOknoDo(oknoOd);
  const fetchTimeoutMs = volby.fetchTimeoutMs ?? FETCH_TIMEOUT_MS;
  const deadlineAtMs =
    volby.limitMs !== undefined
      ? (volby.startAtMs ?? Date.now()) + volby.limitMs
      : undefined;

  const stahnoutHtml = async (
    url: string,
    init?: RequestInit,
  ): Promise<string> => {
    if (deadlineAtMs !== undefined && Date.now() >= deadlineAtMs) {
      throw new Error("limit času");
    }
    if (volby.stahnoutHtml) {
      return volby.stahnoutHtml(url, init);
    }
    const zbyva =
      deadlineAtMs === undefined
        ? fetchTimeoutMs
        : Math.max(1, deadlineAtMs - Date.now());
    return stahnoutRadarHtml(url, init, Math.min(fetchTimeoutMs, zbyva));
  };

  const chyby: RadarScanChyba[] = [];
  const oziveni: RadarScanOziveni[] = [];
  const hrubyPoVstupech: { vstupId: string; nalezy: RadarHrubyNalez[] }[] = [];

  for (const vstup of BRANA_RADAR_VSTUPY) {
    if (deadlineAtMs !== undefined && Date.now() >= deadlineAtMs) {
      chyby.push({ radarVstupId: vstup.id, chyba: "limit času" });
      hrubyPoVstupech.push({ vstupId: vstup.id, nalezy: [] });
      continue;
    }
    try {
      const nalezy = await sberVstupu({
        vstupId: vstup.id,
        url: vstup.url,
        stahnoutHtml,
        oknoOd,
        oknoDo,
      });
      hrubyPoVstupech.push({ vstupId: vstup.id, nalezy });

      if (
        vstup.id === BRANA_RADAR_VSTUP_KPH ||
        vstup.id === BRANA_RADAR_VSTUP_TLS
      ) {
        const vOkne = nalezy.some((n) =>
          prekryvaRadarOkno({
            datumOd: n.datumOd,
            datumDo: n.datumDo,
            oknoOd,
            oknoDo,
          }),
        );
        const budouci = nalezy.some((n) => n.datumOd > oknoDo);
        if (!vOkne && budouci) {
          oziveni.push({
            radarVstupId: vstup.id,
            nazevZdroje: `Nový program · ${vstup.nazev} · Zdroj`,
            url: vstup.url,
          });
        }
      }
    } catch (error) {
      const zprava = error instanceof Error ? error.message : "stažení selhalo";
      chyby.push({ radarVstupId: vstup.id, chyba: zprava });
      hrubyPoVstupech.push({ vstupId: vstup.id, nalezy: [] });
    }
  }

  type Oznaceny = {
    vstupId: string;
    nalez: RadarHrubyNalez;
  };
  const hruby: Oznaceny[] = [];
  for (const skupina of hrubyPoVstupech) {
    for (const nalez of skupina.nalezy) {
      hruby.push({ vstupId: skupina.vstupId, nalez });
    }
  }

  const poGeografii = hruby.filter((r) =>
    jeRadarPovolenaGeografie(`${r.nalez.nazev} ${r.nalez.kde} ${r.nalez.url}`),
  );
  const poOkne = poGeografii.filter((r) =>
    prekryvaRadarOkno({
      datumOd: r.nalez.datumOd,
      datumDo: r.nalez.datumDo,
      oknoOd,
      oknoDo,
    }),
  );

  let odectenoUzVBrane = 0;
  let odectenoSum = 0;
  const prosle: Oznaceny[] = [];
  for (const r of poOkne) {
    if (jeZjevneUzVBrane(r.nalez)) {
      odectenoUzVBrane += 1;
      continue;
    }
    if (jeZjevnySumProvoz(r.nalez) || jeZjevneZruseno(r.nalez.nazev)) {
      odectenoSum += 1;
      continue;
    }
    prosle.push(r);
  }

  const rozlozene: RadarScanKandidat[] = [];
  for (const r of prosle) {
    rozlozene.push(
      ...rozlozitNaDnyVOkne(r.nalez, r.vstupId, oknoOd, oknoDo),
    );
  }
  const kandidati = sloucitDuplicity(rozlozene);

  const podleVstupu = BRANA_RADAR_VSTUPY.map((v) => ({
    radarVstupId: v.id,
    pocet: kandidati.filter((k) => k.radarVstupId === v.id).length,
  }));

  return {
    oknoOd,
    oknoDo,
    hruby: hruby.length,
    poGeografii: poGeografii.length,
    poOkne: poOkne.length,
    odectenoUzVBrane,
    odectenoSum,
    kandidati,
    oziveni,
    podleVstupu,
    chyby,
  };
}

export function formatovatRadarScanKandidata(k: RadarScanKandidat): string {
  const [, m, d] = k.datumOd.split("-");
  const datum = `${Number(d)}. ${Number(m)}.`;
  const casti = [datum, k.nazev];
  if (k.kde) {
    casti.push(k.kde);
  }
  if (k.cas) {
    casti.push(k.cas);
  }
  if (k.url) {
    casti.push(k.url);
  }
  casti.push(k.radarVstupId);
  return casti.join(" · ");
}

export { BRANA_RADAR_VSTUPY };
