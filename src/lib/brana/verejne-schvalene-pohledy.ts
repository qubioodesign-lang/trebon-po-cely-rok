import "server-only";

import { BlobNotFoundError, get } from "@vercel/blob";
import { unstable_noStore as noStore } from "next/cache";
import {
  aktualniVikendVPraze,
  dnesVPraze,
  jeVikendPouzeNedeleVPraze,
  okamzikVPraze,
  pridatDny,
  zitraVPraze,
  type BranaDatum,
} from "@/lib/brana/cas";
import type { BranaVerejnaStranka } from "@/lib/brana/navigace-stranky";
import { opakovaniSeznamuAkci } from "@/lib/brana/navigace-stranky";
import type {
  BranaReferencniAkce,
  BranaSdilenaPohledovaData,
} from "@/lib/brana/pohledy-data";
import {
  maBranaAdminBlobKonfiguraci,
  ziskatVolbyBranaAdminBlob,
} from "@/lib/brana/admin/env-blob-brana-admin";
import {
  dnyTrvaniUdalosti,
  formatujDatumVyhled,
  jeBranaStavSchvaleni,
  normalizovatStavSchvaleni,
  normalizovatVerejnaJazykovaPoleZBlobu,
  rokUdalosti,
  seradUdalostiDne,
  seskupVyhledUdalostiRokuNaSouhrny,
  type BranaAdminVyhledSouhrn,
  type BranaKonkretniUdalost,
  type BranaRedakcniPoradiProKalendar,
} from "@/lib/brana/admin/konkretni-udalost";
import {
  BRANA_KONKRETNI_UDALOSTI_BLOB_CESTA,
} from "@/lib/brana/admin/konkretni-udalosti-uloziste";
import { nacistRedakcniPoradiProScheduler } from "@/lib/brana/admin/redakcni-poradi-uloziste";
import type { BranaRedakcniPolozkaStav } from "@/lib/brana/admin/redakcni-kostra";
import { maDatumOdPatritDoVyhledu } from "@/lib/brana/admin/obdobi-7-dni";
import { maUkazkovyVyhledAno } from "@/lib/brana/admin/ukazkove-udalosti";

const VERZE_ULOZISTE = 1;

type BlobCteniTextu =
  | { stav: "neexistuje" }
  | { stav: "ok"; text: string };

export type NactiVerejneSchvalenePohledovaDataVysledek =
  | { ok: true; data: BranaSdilenaPohledovaData }
  | { ok: false };

export type VerejnaCasovaOkna = {
  dnesIso: string;
  zitraIso: string;
  vikendIsoDny: string[];
  sedmDniIso: string[];
  aktualniRok: number;
};

function datumNaIso(datum: BranaDatum): string {
  return `${datum.rok}-${String(datum.mesic).padStart(2, "0")}-${String(datum.den).padStart(2, "0")}`;
}

/** Europe/Prague okna shodná s veřejnými helpery; `okamzik` jen pro ověření. */
export function sestavVerejnaCasovaOkna(
  okamzik: Date = new Date(),
): VerejnaCasovaOkna {
  const dnes = dnesVPraze(okamzik);
  const zitra = zitraVPraze(okamzik);
  const vikend = aktualniVikendVPraze(okamzik);
  const vikendIsoDny = jeVikendPouzeNedeleVPraze(okamzik)
    ? [datumNaIso(vikend.nedele)]
    : [datumNaIso(vikend.sobota), datumNaIso(vikend.nedele)];

  return {
    dnesIso: datumNaIso(dnes),
    zitraIso: datumNaIso(zitra),
    vikendIsoDny,
    sedmDniIso: Array.from({ length: 7 }, (_, index) =>
      datumNaIso(pridatDny(zitra, index)),
    ),
    aktualniRok: okamzikVPraze(okamzik).rok,
  };
}

function jeUdalostZBlobu(hodnota: unknown): boolean {
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

  return true;
}

function normalizovatUdalostZBlobu(hodnota: unknown): BranaKonkretniUdalost {
  const u = hodnota as Record<string, unknown>;
  const redakcniPolozkaId =
    u.redakcniPolozkaId === null
      ? null
      : (u.redakcniPolozkaId as string).trim();
  const scanKlic =
    typeof u.scanKlic === "string" && u.scanKlic.trim().length > 0
      ? u.scanKlic.trim()
      : undefined;
  const jazyk = normalizovatVerejnaJazykovaPoleZBlobu(u);
  const verejnaPole = jazyk.ok ? jazyk.pole : {};
  return {
    id: (u.id as string).trim(),
    redakcniPolozkaId,
    datumOd: u.datumOd as string,
    datumDo: u.datumDo as string,
    cas: u.cas as string,
    mistoNeboTyp: u.mistoNeboTyp as string,
    nazev: u.nazev as string,
    rucniPoziceVDni:
      redakcniPolozkaId === null ? (u.rucniPoziceVDni as number) : null,
    stavSchvaleni: normalizovatStavSchvaleni(u.stavSchvaleni),
    ...(scanKlic !== undefined ? { scanKlic } : {}),
    ...verejnaPole,
  };
}

function parsovatDokumentUdalosti(
  parsed: unknown,
): BranaKonkretniUdalost[] | null {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const data = parsed as Record<string, unknown>;
  if (data.verzeUloziste !== VERZE_ULOZISTE) {
    return null;
  }
  if (typeof data.posledniScanDokoncen !== "boolean") {
    return null;
  }
  if (!Array.isArray(data.udalosti)) {
    return null;
  }
  if (!data.udalosti.every(jeUdalostZBlobu)) {
    return null;
  }
  return data.udalosti.map(normalizovatUdalostZBlobu);
}

async function nacistTextKonkretniUdalosti(): Promise<BlobCteniTextu> {
  const volby = ziskatVolbyBranaAdminBlob();

  if (!volby.token) {
    throw new Error("Chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN.");
  }

  try {
    const vysledek = await get(BRANA_KONKRETNI_UDALOSTI_BLOB_CESTA, {
      access: "private",
      ...volby,
    });

    if (vysledek === null) {
      return { stav: "neexistuje" };
    }

    if (!vysledek.stream) {
      throw new Error("Blob get vrátil odpověď bez použitelného streamu.");
    }

    const text = await new Response(vysledek.stream).text();
    return { stav: "ok", text };
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return { stav: "neexistuje" };
    }
    throw error;
  }
}

/**
 * READ-ONLY načtení stejného PRIVATE dokumentu bez admin session.
 * Žádný put. Token zůstává server-side.
 */
async function nacistKonkretniUdalostiProVerejnouProjekci(): Promise<
  { ok: true; udalosti: BranaKonkretniUdalost[] } | { ok: false }
> {
  noStore();

  if (!maBranaAdminBlobKonfiguraci()) {
    console.error(
      "[brana-verejne-schvalene] chybí BLOB_BRANA_ADMIN_STORE_ID nebo BLOB_BRANA_ADMIN_READ_WRITE_TOKEN",
    );
    return { ok: false };
  }

  try {
    const cteni = await nacistTextKonkretniUdalosti();

    if (cteni.stav === "neexistuje") {
      return { ok: true, udalosti: [] };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(cteni.text) as unknown;
    } catch (error) {
      console.error(
        "[brana-verejne-schvalene] neplatný JSON v Blob dokumentu",
        error,
      );
      return { ok: false };
    }

    const udalosti = parsovatDokumentUdalosti(parsed);
    if (!udalosti) {
      console.error("[brana-verejne-schvalene] Blob dokument neprošel validací");
      return { ok: false };
    }

    return { ok: true, udalosti };
  } catch (error) {
    console.error(
      "[brana-verejne-schvalene] selhání čtení PRIVATE Blobu",
      error,
    );
    return { ok: false };
  }
}

function jeUkazkovaUdalost(udalost: BranaKonkretniUdalost): boolean {
  return udalost.id.startsWith("ukazka-");
}

function doVerejneAkce(udalost: BranaKonkretniUdalost): BranaReferencniAkce {
  return {
    mistoNeboTyp: udalost.mistoNeboTyp,
    nazev: udalost.nazev,
    cas: udalost.cas,
    ...(udalost.verejneCo !== undefined
      ? {
          verejneCo: udalost.verejneCo,
          verejneRozliseni: udalost.verejneRozliseni ?? null,
        }
      : {}),
  };
}

function doVerejneAkceZeSouhrnu(
  souhrn: BranaAdminVyhledSouhrn,
): BranaReferencniAkce {
  return {
    mistoNeboTyp: souhrn.mistoNeboTyp,
    nazev: souhrn.nazev,
    cas: "",
    ...(souhrn.verejneCo !== undefined
      ? {
          verejneCo: souhrn.verejneCo,
          verejneRozliseni: souhrn.verejneRozliseni ?? null,
        }
      : {}),
  };
}

function prazdnaDataProStranku(
  stranka: BranaVerejnaStranka,
): BranaSdilenaPohledovaData {
  const pocet =
    stranka === "vyhled" ? 2 : opakovaniSeznamuAkci(stranka);
  const bloky = Array.from({ length: pocet }, () => [] as BranaReferencniAkce[]);
  return {
    akce: [],
    bloky,
    vyhledDatumy: [],
    vyhledPredelIndex: 0,
    ...(stranka === "vyhled"
      ? { vyhledDatumyBloky: Array.from({ length: pocet }, () => [] as string[]) }
      : {}),
  };
}

/**
 * Čistá projekce SCHVALENO → veřejná pohledová data (bez I/O).
 * Denní pohledy: dnyTrvaniUdalosti. Výhled: stejné seskupení série jako Admin
 * (seskupVyhledUdalostiRokuNaSouhrny), jen ze SCHVALENO karet.
 */
export function projektujSchvaleneDoVerejnehoPohledu(args: {
  stranka: BranaVerejnaStranka;
  udalosti: readonly BranaKonkretniUdalost[];
  redakcniPolozky: readonly BranaRedakcniPolozkaStav[];
  okna: VerejnaCasovaOkna;
}): BranaSdilenaPohledovaData {
  const { stranka, udalosti, redakcniPolozky, okna } = args;

  const polozkyPodleId = new Map(
    redakcniPolozky.map((p) => [p.id, p] as const),
  );

  const maPouzivatAno = (redakcniPolozkaId: string | null): boolean => {
    if (redakcniPolozkaId === null) {
      return true;
    }
    return polozkyPodleId.get(redakcniPolozkaId)?.pouzivat === "ANO";
  };

  const maVyhledAno = (redakcniPolozkaId: string): boolean =>
    maUkazkovyVyhledAno(
      redakcniPolozkaId,
      polozkyPodleId.get(redakcniPolozkaId)?.vyhled,
    );

  const maVyhledSerii = (redakcniPolozkaId: string): boolean =>
    polozkyPodleId.get(redakcniPolozkaId)?.vyhledSerie !== false;

  const poradiRedakcni = (
    redakcniPolozkaId: string,
  ): BranaRedakcniPoradiProKalendar | undefined => {
    const polozka = polozkyPodleId.get(redakcniPolozkaId);
    if (!polozka) {
      return undefined;
    }
    return {
      priorita: polozka.priorita,
      subpriorita: polozka.subpriorita,
    };
  };

  const kandidati = udalosti.filter(
    (u) =>
      u.stavSchvaleni === "SCHVALENO" &&
      !jeUkazkovaUdalost(u) &&
      maPouzivatAno(u.redakcniPolozkaId),
  );

  const udalostiProDen = (isoDen: string): BranaReferencniAkce[] => {
    const vDni = kandidati.filter((u) =>
      dnyTrvaniUdalosti(u).includes(isoDen),
    );
    return seradUdalostiDne(vDni, poradiRedakcni).map(doVerejneAkce);
  };

  if (stranka === "dnes") {
    const akce = udalostiProDen(okna.dnesIso);
    return {
      akce,
      bloky: [akce],
      vyhledDatumy: [],
      vyhledPredelIndex: 0,
    };
  }

  if (stranka === "zitra") {
    const akce = udalostiProDen(okna.zitraIso);
    return {
      akce,
      bloky: [akce],
      vyhledDatumy: [],
      vyhledPredelIndex: 0,
    };
  }

  if (stranka === "vikend") {
    const bloky = okna.vikendIsoDny.map(udalostiProDen);
    return {
      akce: bloky[0] ?? [],
      bloky,
      vyhledDatumy: [],
      vyhledPredelIndex: 0,
    };
  }

  if (stranka === "7-dni") {
    const bloky = okna.sedmDniIso.map(udalostiProDen);
    return {
      akce: bloky[0] ?? [],
      bloky,
      vyhledDatumy: [],
      vyhledPredelIndex: 0,
    };
  }

  // Výhled – stejný význam jako maDatumOdPatritDoVyhledu + Výhled=ANO (ruční ne).
  const vyhledUdalosti = kandidati.filter((u) => {
    if (u.redakcniPolozkaId === null) {
      return false;
    }
    if (
      !maDatumOdPatritDoVyhledu(u.datumOd, {
        dnesIso: okna.dnesIso,
        sedmDniIso: okna.sedmDniIso,
      })
    ) {
      return false;
    }
    return maVyhledAno(u.redakcniPolozkaId);
  });

  const podleRoku = new Map<number, BranaKonkretniUdalost[]>();
  for (const udalost of vyhledUdalosti) {
    const rok = rokUdalosti(udalost);
    const seznam = podleRoku.get(rok) ?? [];
    seznam.push(udalost);
    podleRoku.set(rok, seznam);
  }

  const souhrnyRoku = (rok: number): BranaAdminVyhledSouhrn[] =>
    seskupVyhledUdalostiRokuNaSouhrny(
      rok,
      podleRoku.get(rok) ?? [],
      maVyhledSerii,
    );

  const letosni = souhrnyRoku(okna.aktualniRok);
  const pozdejsi = [...podleRoku.keys()]
    .filter((rok) => rok > okna.aktualniRok)
    .sort((a, b) => a - b)
    .flatMap((rok) => souhrnyRoku(rok));

  const blok0Akce = letosni.map(doVerejneAkceZeSouhrnu);
  const blok0Datumy = letosni.map(formatujDatumVyhled);
  const blok1Akce = pozdejsi.map(doVerejneAkceZeSouhrnu);
  const blok1Datumy = pozdejsi.map(formatujDatumVyhled);

  return {
    akce: [...blok0Akce, ...blok1Akce],
    bloky: [blok0Akce, blok1Akce],
    vyhledDatumy: [...blok0Datumy, ...blok1Datumy],
    vyhledPredelIndex: blok0Akce.length,
    vyhledDatumyBloky: [blok0Datumy, blok1Datumy],
  };
}

/**
 * Server-only načtení SCHVALENO → data jednoho veřejného pohledu.
 * Při chybě čtení/validace: ok: false (žádný mix s provizorními daty).
 */
export async function nactiVerejneSchvalenePohledovaData(
  stranka: BranaVerejnaStranka,
  okamzik: Date = new Date(),
): Promise<NactiVerejneSchvalenePohledovaDataVysledek> {
  const [udalostiVysledek, redakcniVysledek] = await Promise.all([
    nacistKonkretniUdalostiProVerejnouProjekci(),
    nacistRedakcniPoradiProScheduler(),
  ]);

  if (!udalostiVysledek.ok || !redakcniVysledek.ok) {
    return { ok: false };
  }

  const data = projektujSchvaleneDoVerejnehoPohledu({
    stranka,
    udalosti: udalostiVysledek.udalosti,
    redakcniPolozky: redakcniVysledek.polozky,
    okna: sestavVerejnaCasovaOkna(okamzik),
  });

  return { ok: true, data };
}

/** Fail-closed prázdná data pohledu – bez provizorního mixu. */
export function prazdnaVerejnaPohledovaDataPriChybe(
  stranka: BranaVerejnaStranka,
): BranaSdilenaPohledovaData {
  return prazdnaDataProStranku(stranka);
}
