/**
 * Validace JSON dokumentů uvnitř brana-backup v1.
 * Bez server-only – sdílené s verify i obnovou.
 */

import { jeBranaStavSchvaleni } from "@/lib/brana/admin/konkretni-udalost";
import { BRANA_NEZARAZENE_VERZE_ULOZISTE } from "@/lib/brana/admin/nezarazene";
import type { BranaRedakcniPolozkaStav } from "@/lib/brana/admin/redakcni-kostra";
import {
  validovatRedakcniPoradiDokument,
  validovatRedakcniPoradiVstup,
} from "@/lib/brana/admin/redakcni-poradi-validace";
import { validovatVolitelnySkupinovyScanStav } from "@/lib/brana/admin/skupinovy-scan-stav";
import {
  doplnVychoziPoleZdroje,
  jeBranaZdrojRezimScanu,
  jeBranaZdrojTyp,
  jePlatnaZdrojUrl,
  type BranaZdroj,
} from "@/lib/brana/admin/zdroj";
import {
  BRANA_ZALOHA_KALENDAR_VERZE,
  BRANA_ZALOHA_REDAKCNI_VERZE,
  BRANA_ZALOHA_SOUBORY,
  type BranaZalohaDokumentyTexty,
  type BranaZalohaSoubor,
} from "./typy";

export type BranaZalohaDokumenty = {
  "data/brana-konkretni-udalosti.json": unknown;
  "data/brana-redakcni-poradi.json": {
    verzeUloziste: number;
    polozky: BranaRedakcniPolozkaStav[];
  };
  "data/brana-zdroje.json": { zdroje: BranaZdroj[] };
  "data/brana-upozorneni-nastaveni.json": unknown;
  "data/brana-nezarazene.json": unknown;
};

function jeUdalostProZalohu(hodnota: unknown): boolean {
  if (!hodnota || typeof hodnota !== "object") {
    return false;
  }
  const u = hodnota as Record<string, unknown>;
  if (
    !(
      typeof u.id === "string" &&
      u.id.length > 0 &&
      typeof u.datumOd === "string" &&
      typeof u.datumDo === "string" &&
      typeof u.cas === "string" &&
      typeof u.mistoNeboTyp === "string" &&
      typeof u.nazev === "string"
    )
  ) {
    return false;
  }

  if (u.redakcniPolozkaId === null) {
    if (
      typeof u.rucniPoziceVDni !== "number" ||
      !Number.isInteger(u.rucniPoziceVDni) ||
      u.rucniPoziceVDni < 0
    ) {
      return false;
    }
  } else if (typeof u.redakcniPolozkaId === "string") {
    if (u.redakcniPolozkaId.trim().length === 0) {
      return false;
    }
    if (u.rucniPoziceVDni !== null) {
      return false;
    }
  } else {
    return false;
  }

  if (u.stavSchvaleni !== undefined && !jeBranaStavSchvaleni(u.stavSchvaleni)) {
    return false;
  }

  if (
    u.scanKlic !== undefined &&
    u.scanKlic !== null &&
    (typeof u.scanKlic !== "string" || u.scanKlic.trim().length === 0)
  ) {
    return false;
  }

  if (
    u.zdrojIdentita !== undefined &&
    u.zdrojIdentita !== null &&
    (typeof u.zdrojIdentita !== "string" || u.zdrojIdentita.trim().length === 0)
  ) {
    return false;
  }

  if (u.typZdroje !== undefined && u.typZdroje !== "RYCHLY") {
    return false;
  }

  if (u.redakcneUpravenaPole !== undefined) {
    if (!Array.isArray(u.redakcneUpravenaPole)) {
      return false;
    }
    if (!u.redakcneUpravenaPole.every((p) => typeof p === "string")) {
      return false;
    }
  }

  return true;
}

export function validovatKonkretniUdalostiZalohy(
  parsed: unknown,
): unknown | null {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const data = parsed as Record<string, unknown>;
  if (data.verzeUloziste !== BRANA_ZALOHA_KALENDAR_VERZE) {
    return null;
  }
  if (typeof data.posledniScanDokoncen !== "boolean") {
    return null;
  }
  if (!Array.isArray(data.udalosti)) {
    return null;
  }
  if (!data.udalosti.every(jeUdalostProZalohu)) {
    return null;
  }
  return parsed;
}

export function validovatRedakcniPoradiZalohy(parsed: unknown): {
  verzeUloziste: number;
  polozky: BranaZalohaDokumenty["data/brana-redakcni-poradi.json"]["polozky"];
} | null {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const root = parsed as { verzeUloziste?: unknown; polozky?: unknown };
  if (root.verzeUloziste !== BRANA_ZALOHA_REDAKCNI_VERZE) {
    return null;
  }
  const vstup = validovatRedakcniPoradiVstup(root.polozky, {
    legacyVyhled: true,
  });
  if (!vstup.ok) {
    return null;
  }
  return validovatRedakcniPoradiDokument({
    verzeUloziste: BRANA_ZALOHA_REDAKCNI_VERZE,
    polozky: vstup.polozky,
  });
}

function jePlatnyZdrojZalohy(hodnota: unknown): boolean {
  if (!hodnota || typeof hodnota !== "object") {
    return false;
  }
  const z = hodnota as Record<string, unknown>;
  if (
    typeof z.id !== "string" ||
    z.id.trim().length === 0 ||
    typeof z.nazev !== "string" ||
    z.nazev.trim().length === 0 ||
    !jeBranaZdrojTyp(z.typ) ||
    typeof z.url !== "string" ||
    z.url.trim().length === 0 ||
    !jePlatnaZdrojUrl(z.url.trim())
  ) {
    return false;
  }
  if (
    z.rezimScanu !== undefined &&
    z.rezimScanu !== null &&
    !jeBranaZdrojRezimScanu(z.rezimScanu)
  ) {
    return false;
  }
  if (
    z.hlidaneRedakcniPolozkaIds !== undefined &&
    z.hlidaneRedakcniPolozkaIds !== null &&
    !Array.isArray(z.hlidaneRedakcniPolozkaIds)
  ) {
    return false;
  }
  if (Array.isArray(z.hlidaneRedakcniPolozkaIds)) {
    for (const id of z.hlidaneRedakcniPolozkaIds) {
      if (typeof id !== "string") {
        return false;
      }
    }
  }
  return true;
}

export function validovatZdrojeZalohy(
  parsed: unknown,
): { zdroje: BranaZdroj[] } | null {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const zdroje = (parsed as { zdroje?: unknown }).zdroje;
  if (!Array.isArray(zdroje) || !zdroje.every(jePlatnyZdrojZalohy)) {
    return null;
  }
  const normalizovane = zdroje.map((hodnota) => {
    const z = hodnota as {
      id: string;
      nazev: string;
      typ: BranaZdroj["typ"];
      url: string;
      rezimScanu?: unknown;
      hlidaneRedakcniPolozkaIds?: unknown;
    };
    return doplnVychoziPoleZdroje({
      id: z.id.trim(),
      nazev: z.nazev.trim(),
      typ: z.typ,
      url: z.url.trim(),
      rezimScanu: z.rezimScanu,
      hlidaneRedakcniPolozkaIds: z.hlidaneRedakcniPolozkaIds,
    });
  });
  const idSet = new Set<string>();
  for (const zdroj of normalizovane) {
    if (idSet.has(zdroj.id)) {
      return null;
    }
    idSet.add(zdroj.id);
  }
  return { zdroje: normalizovane };
}

function jeIsoDen(hodnota: unknown): boolean {
  return typeof hodnota === "string" && /^\d{4}-\d{2}-\d{2}$/.test(hodnota);
}

function jeVolitelnyIsoDen(hodnota: unknown): boolean {
  return hodnota === null || hodnota === undefined || jeIsoDen(hodnota);
}

function jePlatnaPushSubscriptionZalohy(hodnota: unknown): boolean {
  if (!hodnota || typeof hodnota !== "object") {
    return false;
  }
  const s = hodnota as Record<string, unknown>;
  if (typeof s.endpoint !== "string" || s.endpoint.trim().length === 0) {
    return false;
  }
  if (s.expirationTime !== null && typeof s.expirationTime !== "number") {
    return false;
  }
  if (!s.keys || typeof s.keys !== "object") {
    return false;
  }
  const keys = s.keys as Record<string, unknown>;
  return (
    typeof keys.p256dh === "string" &&
    keys.p256dh.length > 0 &&
    typeof keys.auth === "string" &&
    keys.auth.length > 0
  );
}

export function validovatUpozorneniZalohy(parsed: unknown): unknown | null {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const raw = parsed as Record<string, unknown>;
  if (typeof raw.upozorneniAktivni !== "boolean") {
    return null;
  }
  if (raw.telefon !== undefined && typeof raw.telefon !== "string") {
    return null;
  }

  let pushSubscription: unknown = null;
  if (raw.pushSubscription !== null && raw.pushSubscription !== undefined) {
    if (!jePlatnaPushSubscriptionZalohy(raw.pushSubscription)) {
      return null;
    }
    pushSubscription = raw.pushSubscription;
  }

  if (raw.upozorneniAktivni === true && pushSubscription === null) {
    return null;
  }

  if (!jeVolitelnyIsoDen(raw.pristiDlouhodobaKontrola)) {
    return null;
  }
  if (!jeVolitelnyIsoDen(raw.posledniDokoncenaDlouhodobaKontrola)) {
    return null;
  }
  if (!jeVolitelnyIsoDen(raw.posledniUpozorneniRychle)) {
    return null;
  }
  if (!jeVolitelnyIsoDen(raw.posledniUpozorneniDlouhodobe)) {
    return null;
  }
  if (!jeVolitelnyIsoDen(raw.posledniUpozorneniAsistovaneKotva)) {
    return null;
  }
  if (!jeVolitelnyIsoDen(raw.schvalenoDoIso)) {
    return null;
  }

  const rychly = validovatVolitelnySkupinovyScanStav(
    raw.posledniRychlySkupinovyScan,
    "Poslední rychlý skupinový scan",
  );
  if (!rychly.ok) {
    return null;
  }
  const dlouhy = validovatVolitelnySkupinovyScanStav(
    raw.posledniDlouhySkupinovyScan,
    "Poslední dlouhý skupinový scan",
  );
  if (!dlouhy.ok) {
    return null;
  }

  return parsed;
}

function jePlatnyNezarazenyNalez(hodnota: unknown): boolean {
  if (!hodnota || typeof hodnota !== "object") {
    return false;
  }
  const n = hodnota as Record<string, unknown>;
  return (
    typeof n.id === "string" &&
    n.id.trim().length > 0 &&
    typeof n.klic === "string" &&
    n.klic.length > 0 &&
    typeof n.zdrojId === "string" &&
    n.zdrojId.trim().length > 0 &&
    typeof n.zdrojNazev === "string" &&
    typeof n.datumOd === "string" &&
    typeof n.datumDo === "string" &&
    typeof n.cas === "string" &&
    typeof n.mistoNeboTyp === "string" &&
    typeof n.nazev === "string" &&
    n.nazev.trim().length > 0
  );
}

export function validovatNezarazeneZalohy(parsed: unknown): unknown | null {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const root = parsed as {
    verzeUloziste?: unknown;
    otevrene?: unknown;
    odmitnuteKlice?: unknown;
  };
  if (!Array.isArray(root.otevrene) || !root.otevrene.every(jePlatnyNezarazenyNalez)) {
    return null;
  }
  if (!Array.isArray(root.odmitnuteKlice)) {
    return null;
  }
  for (const k of root.odmitnuteKlice) {
    if (typeof k !== "string" || k.length === 0) {
      return null;
    }
  }
  if (
    root.verzeUloziste !== undefined &&
    root.verzeUloziste !== BRANA_NEZARAZENE_VERZE_ULOZISTE
  ) {
    return null;
  }
  return parsed;
}

const VALIDATORY: {
  [K in BranaZalohaSoubor]: (parsed: unknown) => unknown | null;
} = {
  "data/brana-konkretni-udalosti.json": validovatKonkretniUdalostiZalohy,
  "data/brana-redakcni-poradi.json": validovatRedakcniPoradiZalohy,
  "data/brana-zdroje.json": validovatZdrojeZalohy,
  "data/brana-upozorneni-nastaveni.json": validovatUpozorneniZalohy,
  "data/brana-nezarazene.json": validovatNezarazeneZalohy,
};

export function parsovatAValidovatDokumentyZalohy(
  texty: BranaZalohaDokumentyTexty,
): BranaZalohaDokumenty {
  const vysledek = {} as BranaZalohaDokumenty;

  for (const cesta of BRANA_ZALOHA_SOUBORY) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(texty[cesta]) as unknown;
    } catch {
      throw new Error(`Záloha obsahuje neplatný JSON: ${cesta}.`);
    }
    const overeny = VALIDATORY[cesta](parsed);
    if (overeny === null) {
      throw new Error(`Záloha obsahuje neplatný dokument: ${cesta}.`);
    }
    (vysledek as Record<string, unknown>)[cesta] = overeny;
  }

  return vysledek;
}
