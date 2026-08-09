/**
 * DOČASNÝ jednorázový E2E seed – přesně 6 automatických CEKA.
 * Po dokončení testu celý soubor odstranit.
 * Žádný paralelní storage – stejný PRIVATE Blob dokument + konfigurace.
 */

import "server-only";

import { put } from "@vercel/blob";
import { jeAdminPrihlasen } from "@/lib/autentizace";
import {
  kontrolniBlokVPraze,
  patriUdalostDoBlizkehoOkna,
  patriUdalostDoKontrolnihoBloku,
  sestavIdProSchvalitKontrolu,
  spocitejPrazdneDnyKontrolnihoBloku,
} from "@/lib/brana/admin/kontrolni-blok";
import {
  vytvoritScanKlicAutomatickeUdalosti,
  projektujVyhledPodleRoku,
  type BranaKonkretniUdalost,
} from "@/lib/brana/admin/konkretni-udalost";
import {
  BRANA_KONKRETNI_UDALOSTI_BLOB_CESTA,
  nacistKonkretniUdalosti,
} from "@/lib/brana/admin/konkretni-udalosti-uloziste";
import {
  maBranaAdminBlobKonfiguraci,
  ziskatVolbyBranaAdminBlob,
} from "@/lib/brana/admin/env-blob-brana-admin";
import { nacistRedakcniPoradi } from "@/lib/brana/admin/redakcni-poradi-uloziste";
import { maUkazkovyVyhledAno } from "@/lib/brana/admin/ukazkove-udalosti";

const VERZE_ULOZISTE = 1;
const MISTO = "TEST BRÁNA E2E";

const SPEC = [
  {
    nazev: "TEST BRÁNA E2E 01",
    datumOd: "2026-08-09",
    cas: "10:01",
    redakcniPolozkaId: "kino-svetozor",
  },
  {
    nazev: "TEST BRÁNA E2E 02",
    datumOd: "2026-08-10",
    cas: "10:02",
    redakcniPolozkaId: "kino-svetozor",
  },
  {
    nazev: "TEST BRÁNA E2E 03",
    datumOd: "2026-08-16",
    cas: "10:03",
    redakcniPolozkaId: "kino-svetozor",
  },
  {
    nazev: "TEST BRÁNA E2E 04",
    datumOd: "2026-08-17",
    cas: "10:04",
    redakcniPolozkaId: "kino-svetozor",
  },
  {
    nazev: "TEST BRÁNA E2E 05",
    datumOd: "2026-08-27",
    cas: "10:05",
    redakcniPolozkaId: "kino-svetozor",
  },
  {
    nazev: "TEST BRÁNA E2E 06",
    datumOd: "2026-09-07",
    cas: "10:06",
    redakcniPolozkaId: "vylov-rozmberka",
  },
] as const;

const OCEKAVANE_NAZVY = SPEC.map((s) => s.nazev);

export type BranaE2eJednorazovySeedVysledek = {
  ids: string[];
  nazvy: string[];
  pocetPred: number;
  pocetPo: number;
  prazdneDnyPred: number;
  prazdneDnyPo: number;
};

function stop(duvod: string): never {
  throw new Error(`E2E seed STOP: ${duvod}. Nic nebylo uloženo.`);
}

/** Zrcadlo produkčního scan-dedupu (scanKlic / obsahový fallback). */
function jeDuplicitniAutomatickaUdalost(
  existujici: BranaKonkretniUdalost,
  kandidat: {
    redakcniPolozkaId: string;
    datumOd: string;
    cas: string;
    nazev: string;
  },
  kandidatScanKlic: string,
): boolean {
  if (
    typeof existujici.scanKlic === "string" &&
    existujici.scanKlic.length > 0
  ) {
    return existujici.scanKlic === kandidatScanKlic;
  }
  return (
    existujici.redakcniPolozkaId === kandidat.redakcniPolozkaId &&
    existujici.datumOd === kandidat.datumOd &&
    existujici.cas.trim() === kandidat.cas.trim() &&
    existujici.nazev.trim().toLowerCase() === kandidat.nazev.trim().toLowerCase()
  );
}

function jeValidniAutoCeka(u: BranaKonkretniUdalost): boolean {
  return (
    typeof u.id === "string" &&
    u.id.startsWith("auto-") &&
    u.id.length > 5 &&
    typeof u.redakcniPolozkaId === "string" &&
    u.redakcniPolozkaId.trim().length > 0 &&
    u.rucniPoziceVDni === null &&
    u.stavSchvaleni === "CEKA_NA_SCHVALENI" &&
    typeof u.datumOd === "string" &&
    typeof u.datumDo === "string" &&
    u.datumOd === u.datumDo &&
    typeof u.cas === "string" &&
    typeof u.mistoNeboTyp === "string" &&
    typeof u.nazev === "string" &&
    typeof u.scanKlic === "string" &&
    u.scanKlic.length > 0
  );
}

async function ulozitDokumentJednimPutem(dokument: {
  verzeUloziste: number;
  posledniScanDokoncen: boolean;
  udalosti: BranaKonkretniUdalost[];
}): Promise<void> {
  const volby = ziskatVolbyBranaAdminBlob();
  if (!volby.token) {
    stop("chybí BLOB_BRANA_ADMIN_READ_WRITE_TOKEN");
  }
  await put(BRANA_KONKRETNI_UDALOSTI_BLOB_CESTA, JSON.stringify(dokument, null, 2), {
    ...volby,
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
}

/**
 * Jednorázový fail-closed seed: 0 nebo přesně +6, jeden put až po všech kontrolách.
 */
export async function vlozitE2eJednorazovySeedSestiCeka(): Promise<BranaE2eJednorazovySeedVysledek> {
  if (!(await jeAdminPrihlasen())) {
    stop("nejste přihlášeni");
  }
  if (!maBranaAdminBlobKonfiguraci()) {
    stop("chybí konfigurace PRIVATE Blob administrace BRÁNY");
  }

  const [uloziste, redakcni] = await Promise.all([
    nacistKonkretniUdalosti(),
    nacistRedakcniPoradi(),
  ]);

  if (!uloziste.ok) {
    stop("nepodařilo se načíst konkrétní události");
  }
  if (!redakcni.ok) {
    stop("nepodařilo se načíst redakční pořadí");
  }

  const svetozor = redakcni.polozky.find((p) => p.id === "kino-svetozor");
  if (!svetozor) {
    stop("chybí redakční položka kino-svetozor");
  }
  if (svetozor.pouzivat !== "ANO" || svetozor.vyhled !== "NE") {
    stop(
      `kino-svetozor musí mít Používat=ANO a Výhled=NE (je pouzivat=${svetozor.pouzivat}, vyhled=${JSON.stringify(svetozor.vyhled)})`,
    );
  }

  const vylov = redakcni.polozky.find((p) => p.id === "vylov-rozmberka");
  if (!vylov) {
    stop("chybí redakční položka vylov-rozmberka");
  }
  if (vylov.pouzivat !== "ANO" || vylov.vyhled !== "ANO") {
    stop(
      `vylov-rozmberka musí mít Používat=ANO a Výhled=ANO (je pouzivat=${vylov.pouzivat}, vyhled=${JSON.stringify(vylov.vyhled)})`,
    );
  }

  const blok = kontrolniBlokVPraze();
  if (blok.blokOdIso !== "2026-08-17" || blok.blokDoIso !== "2026-09-06") {
    stop(
      `kontrolní blok musí být 2026-08-17…2026-09-06 (je ${blok.blokOdIso}…${blok.blokDoIso})`,
    );
  }
  if (blok.blokIsoDny.length !== 21) {
    stop(`kontrolní blok musí mít 21 dnů (je ${blok.blokIsoDny.length})`);
  }

  const vyhledPodleId = new Map(
    redakcni.polozky.map((p) => [p.id, p.vyhled] as const),
  );
  const maVyhledAno = (redakcniPolozkaId: string) =>
    maUkazkovyVyhledAno(
      redakcniPolozkaId,
      vyhledPodleId.get(redakcniPolozkaId),
    );

  const persistovane = uloziste.udalosti;
  const pocetPred = persistovane.length;
  const davkaPred = sestavIdProSchvalitKontrolu(persistovane, maVyhledAno);
  const prazdnePred = spocitejPrazdneDnyKontrolnihoBloku(
    persistovane,
    davkaPred,
  );
  if (prazdnePred.pocet !== 21) {
    stop(`před seedem očekáváno 21 prázdných dnů (je ${prazdnePred.pocet})`);
  }

  for (const nazev of OCEKAVANE_NAZVY) {
    if (persistovane.some((u) => u.nazev === nazev)) {
      stop(`událost „${nazev}“ už v PRIVATE datech existuje`);
    }
  }

  if (SPEC.length !== 6) {
    stop("interní SPEC musí mít přesně 6 položek");
  }

  const nove: BranaKonkretniUdalost[] = [];
  for (const spec of SPEC) {
    const scanKlic = vytvoritScanKlicAutomatickeUdalosti({
      redakcniPolozkaId: spec.redakcniPolozkaId,
      datumOd: spec.datumOd,
      cas: spec.cas,
      nazev: spec.nazev,
    });

    const kandidat = {
      redakcniPolozkaId: spec.redakcniPolozkaId,
      datumOd: spec.datumOd,
      cas: spec.cas,
      nazev: spec.nazev,
    };

    if (
      persistovane.some((u) =>
        jeDuplicitniAutomatickaUdalost(u, kandidat, scanKlic),
      )
    ) {
      stop(`dedup kolize vůči existující události u „${spec.nazev}“`);
    }
    if (
      nove.some((u) =>
        jeDuplicitniAutomatickaUdalost(u, kandidat, scanKlic),
      )
    ) {
      stop(`dedup kolize mezi kandidáty u „${spec.nazev}“`);
    }

    const nova: BranaKonkretniUdalost = {
      id: `auto-${crypto.randomUUID()}`,
      redakcniPolozkaId: spec.redakcniPolozkaId,
      datumOd: spec.datumOd,
      datumDo: spec.datumOd,
      cas: spec.cas,
      mistoNeboTyp: MISTO,
      nazev: spec.nazev,
      rucniPoziceVDni: null,
      stavSchvaleni: "CEKA_NA_SCHVALENI",
      scanKlic,
    };

    if (!jeValidniAutoCeka(nova)) {
      stop(`kandidát „${spec.nazev}“ neprošel validací auto CEKA`);
    }
    if (persistovane.some((u) => u.id === nova.id)) {
      stop(`kolize ID ${nova.id}`);
    }
    nove.push(nova);
  }

  if (nove.length !== 6) {
    stop(`připraveno ${nove.length} místo 6`);
  }

  const spojene = [...persistovane, ...nove];
  if (spojene.length !== pocetPred + 6) {
    stop("výsledný počet ≠ původní + 6");
  }

  for (const puvodni of persistovane) {
    const stejne = spojene.find((u) => u.id === puvodni.id);
    if (!stejne || JSON.stringify(stejne) !== JSON.stringify(puvodni)) {
      stop(`existující událost ${puvodni.id} by byla změněna`);
    }
  }
  for (const puvodni of persistovane) {
    if (!spojene.some((u) => u.id === puvodni.id)) {
      stop(`existující událost ${puvodni.id} by byla odstraněna`);
    }
  }

  const davkaPo = sestavIdProSchvalitKontrolu(spojene, maVyhledAno);
  const prazdnePo = spocitejPrazdneDnyKontrolnihoBloku(spojene, davkaPo);
  if (prazdnePo.pocet !== 19) {
    stop(`po simulaci očekáváno 19 prázdných dnů (je ${prazdnePo.pocet})`);
  }

  const zmizene = prazdnePred.prazdneIsoDny.filter(
    (d) => !prazdnePo.prazdneIsoDny.includes(d),
  );
  if (
    zmizene.length !== 2 ||
    !zmizene.includes("2026-08-17") ||
    !zmizene.includes("2026-08-27")
  ) {
    stop(`zmizelé nuly ≠ {2026-08-17, 2026-08-27}: ${zmizene.join(",")}`);
  }

  const testNazvy = new Set<string>(OCEKAVANE_NAZVY);
  const vyhledNazvy = projektujVyhledPodleRoku(spojene, maVyhledAno)
    .flatMap((g) => g.udalosti)
    .filter((u) => testNazvy.has(u.nazev))
    .map((u) => u.nazev);
  if (vyhledNazvy.length !== 1 || vyhledNazvy[0] !== "TEST BRÁNA E2E 06") {
    stop(
      `ve Výhledu z testovacích dat musí být jen E2E 06 (je: ${vyhledNazvy.join(",")})`,
    );
  }

  const idSetDavky = new Set(davkaPo);
  for (const nova of nove) {
    if (!idSetDavky.has(nova.id)) {
      stop(`Schválit kontrolu by nezahrnulo „${nova.nazev}“`);
    }
  }

  const e1 = nove[0]!;
  const e2 = nove[1]!;
  const e3 = nove[2]!;
  const e4 = nove[3]!;
  const e5 = nove[4]!;
  const e6 = nove[5]!;

  if (
    !patriUdalostDoBlizkehoOkna(e1) ||
    !patriUdalostDoBlizkehoOkna(e2) ||
    !patriUdalostDoBlizkehoOkna(e3)
  ) {
    stop("E2E 01–03 musí patřit do blízkého okna");
  }
  if (
    !patriUdalostDoKontrolnihoBloku(e4, blok) ||
    !patriUdalostDoKontrolnihoBloku(e5, blok)
  ) {
    stop("E2E 04–05 musí patřit do 21denního bloku");
  }
  if (patriUdalostDoBlizkehoOkna(e6) || patriUdalostDoKontrolnihoBloku(e6, blok)) {
    stop("E2E 06 nesmí patřit do blízkého okna ani 21denního bloku");
  }

  const dokument = {
    verzeUloziste: VERZE_ULOZISTE,
    posledniScanDokoncen: uloziste.posledniScanDokoncen,
    udalosti: spojene,
  };

  // Jediný put – až po všech kontrolách.
  await ulozitDokumentJednimPutem(dokument);

  return {
    ids: nove.map((u) => u.id),
    nazvy: nove.map((u) => u.nazev),
    pocetPred,
    pocetPo: spojene.length,
    prazdneDnyPred: 21,
    prazdneDnyPo: 19,
  };
}
