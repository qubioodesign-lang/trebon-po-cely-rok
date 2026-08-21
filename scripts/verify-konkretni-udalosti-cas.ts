/**
 * Fixture CAS / ifMatch pro data/brana-konkretni-udalosti.json.
 * Bez produkčního Blob WRITE. Spuštění:
 * npx tsx scripts/verify-konkretni-udalosti-cas.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { BlobPreconditionFailedError } from "@vercel/blob";
import {
  BRANA_KONKRETNI_UDALOSTI_CAS_MAX_POKUSU,
  BranaCasKonfliktLimitError,
  zmenitDokumentAtomickySIo,
  type BranaCasIo,
  type BranaDokumentMutace,
} from "../src/lib/brana/admin/konkretni-udalosti-cas";
import { duvodZamitnutiUdalostiProSchvalitKontrolu } from "../src/lib/brana/admin/kontrolni-blok";
import {
  jeUdalostCelaMinula,
  skrytAutomatickouKonkretniUdalostZeSeznamu,
  type BranaKonkretniUdalost,
} from "../src/lib/brana/admin/konkretni-udalost";
import { aplikovatUpravuAutomatickeUdalosti } from "../src/lib/brana/admin/redakcni-override";
import {
  aplikovatScanKandidatyNaUdalosti,
  type BranaScanAutomatickaUdalostVstup,
} from "../src/lib/brana/admin/scan-ceka-zapis";

const DNES = "2026-08-21";

type Dokument = {
  verzeUloziste: number;
  posledniScanDokoncen: boolean;
  udalosti: BranaKonkretniUdalost[];
};

let selhalo = 0;
function assert(ok: boolean, popis: string): void {
  if (ok) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhalo += 1;
  console.error(`FAIL ${popis}`);
}

function klon<T>(hodnota: T): T {
  return JSON.parse(JSON.stringify(hodnota)) as T;
}

function auto(
  id: string,
  nazev: string,
  stav: BranaKonkretniUdalost["stavSchvaleni"] = "CEKA_NA_SCHVALENI",
): BranaKonkretniUdalost {
  return {
    id,
    redakcniPolozkaId: "pol-1",
    datumOd: "2026-08-26",
    datumDo: "2026-08-26",
    cas: "17:00",
    mistoNeboTyp: "Kino",
    nazev,
    rucniPoziceVDni: null,
    stavSchvaleni: stav,
    scanKlic: `pol-1|2026-08-26|17:00|${id}`,
    zdrojIdentita: `kino|${id}`,
  };
}

function dokumentZ(udalosti: BranaKonkretniUdalost[]): Dokument {
  return {
    verzeUloziste: 1,
    posledniScanDokoncen: true,
    udalosti,
  };
}

function validovat(dokument: Dokument): Dokument | null {
  if (dokument.verzeUloziste !== 1) {
    return null;
  }
  if (typeof dokument.posledniScanDokoncen !== "boolean") {
    return null;
  }
  if (!Array.isArray(dokument.udalosti)) {
    return null;
  }
  return dokument;
}

function mutaceSchvalit(
  id: string,
): (dokument: Dokument) => BranaDokumentMutace<Dokument, BranaKonkretniUdalost> {
  return (dokument) => {
    const index = dokument.udalosti.findIndex((u) => u.id === id);
    if (index < 0) {
      throw new Error("Událost nebyla nalezena.");
    }
    const existujici = dokument.udalosti[index];
    if (existujici.stavSchvaleni === "SCHVALENO") {
      return { typ: "bezZmeny", vysledek: existujici };
    }
    if (existujici.stavSchvaleni !== "CEKA_NA_SCHVALENI") {
      throw new Error("Událost nelze schválit.");
    }
    const schvalena: BranaKonkretniUdalost = {
      ...existujici,
      stavSchvaleni: "SCHVALENO",
    };
    const noveUdalosti = dokument.udalosti.slice();
    noveUdalosti[index] = schvalena;
    dokument.udalosti = noveUdalosti;
    return { typ: "zapsat", dokument, vysledek: schvalena };
  };
}

function mutaceUpravitNazev(
  id: string,
  nazev: string,
): (dokument: Dokument) => BranaDokumentMutace<Dokument, BranaKonkretniUdalost> {
  return (dokument) => {
    const index = dokument.udalosti.findIndex((u) => u.id === id);
    if (index < 0) {
      throw new Error("Událost nebyla nalezena.");
    }
    const existujici = dokument.udalosti[index];
    const upravena = aplikovatUpravuAutomatickeUdalosti(existujici, {
      datumOd: existujici.datumOd,
      datumDo: existujici.datumDo,
      cas: existujici.cas,
      mistoNeboTyp: existujici.mistoNeboTyp,
      nazev,
    });
    const noveUdalosti = dokument.udalosti.slice();
    noveUdalosti[index] = upravena;
    dokument.udalosti = noveUdalosti;
    return { typ: "zapsat", dokument, vysledek: upravena };
  };
}

function mutaceSkryt(
  id: string,
): (dokument: Dokument) => BranaDokumentMutace<Dokument, BranaKonkretniUdalost> {
  return (dokument) => {
    const vysledek = skrytAutomatickouKonkretniUdalostZeSeznamu(
      dokument.udalosti,
      id,
    );
    if (!vysledek.ok) {
      throw new Error(vysledek.chyba);
    }
    dokument.udalosti = vysledek.udalosti;
    return { typ: "zapsat", dokument, vysledek: vysledek.skryta };
  };
}

function mutaceScan(
  kandidati: readonly BranaScanAutomatickaUdalostVstup[],
): (
  dokument: Dokument,
) => BranaDokumentMutace<
  Dokument,
  ReturnType<typeof aplikovatScanKandidatyNaUdalosti>["vysledek"]
> {
  return (dokument) => {
    const { udalosti, vysledek, zmena } = aplikovatScanKandidatyNaUdalosti(
      dokument.udalosti,
      kandidati,
      DNES,
      jeUdalostCelaMinula,
    );
    if (!zmena) {
      return { typ: "bezZmeny", vysledek };
    }
    dokument.udalosti = udalosti;
    return { typ: "zapsat", dokument, vysledek };
  };
}

function mutaceSchvalitKontrolu(
  ids: readonly string[],
): (
  dokument: Dokument,
) => BranaDokumentMutace<Dokument, { pocetSchvalenych: number }> {
  return (dokument) => {
    const indexyKeSchvaleni: number[] = [];
    for (const id of ids) {
      const existujici = dokument.udalosti.find((u) => u.id === id);
      if (!existujici) {
        throw new Error(
          "Kontrolu nelze schválit: některá událost nebyla nalezena. Nic nebylo uloženo.",
        );
      }
      const duvod = duvodZamitnutiUdalostiProSchvalitKontrolu(existujici);
      if (duvod) {
        throw new Error(duvod);
      }
      indexyKeSchvaleni.push(dokument.udalosti.findIndex((u) => u.id === id));
    }
    const noveUdalosti = dokument.udalosti.slice();
    for (const index of indexyKeSchvaleni) {
      noveUdalosti[index] = {
        ...noveUdalosti[index],
        stavSchvaleni: "SCHVALENO",
      };
    }
    dokument.udalosti = noveUdalosti;
    return {
      typ: "zapsat",
      dokument,
      vysledek: { pocetSchvalenych: indexyKeSchvaleni.length },
    };
  };
}

class FalesnyBlob {
  dokument: Dokument;
  etag: string;
  gets = 0;
  puts = 0;
  vzdyPrecondition = false;
  putChyby: unknown[] = [];

  constructor(dokument: Dokument, etag = "e1") {
    this.dokument = klon(dokument);
    this.etag = etag;
  }

  resetCitace(): void {
    this.gets = 0;
    this.puts = 0;
  }

  async nacist() {
    this.gets += 1;
    return {
      stav: "ok" as const,
      dokument: klon(this.dokument),
      etag: this.etag,
    };
  }

  async ulozit(dokument: Dokument, etag: string | null): Promise<void> {
    this.puts += 1;
    if (this.vzdyPrecondition) {
      throw new BlobPreconditionFailedError();
    }
    const dalsi = this.putChyby.shift();
    if (dalsi !== undefined) {
      throw dalsi;
    }
    if (etag !== null && etag !== this.etag) {
      throw new BlobPreconditionFailedError();
    }
    this.dokument = klon(dokument);
    const cislo = Number.parseInt(this.etag.slice(1), 10);
    this.etag = `e${cislo + 1}`;
  }

  io(): BranaCasIo<Dokument> {
    return {
      nacist: () => this.nacist(),
      vychoziDokument: () => dokumentZ([]),
      validovat,
      ulozit: (dokument, etag) => this.ulozit(dokument, etag),
      jePreconditionChyba: (error) =>
        error instanceof BlobPreconditionFailedError,
    };
  }
}

async function zapsat(
  blob: FalesnyBlob,
  mutator: (dokument: Dokument) => BranaDokumentMutace<Dokument, unknown>,
): Promise<unknown> {
  return zmenitDokumentAtomickySIo(blob.io(), mutator);
}

async function zapsatSeStalymPrvnimCtenim(
  blob: FalesnyBlob,
  stale: { dokument: Dokument; etag: string },
  mutator: (dokument: Dokument) => BranaDokumentMutace<Dokument, unknown>,
): Promise<unknown> {
  let prvni = true;
  const io: BranaCasIo<Dokument> = {
    nacist: async () => {
      if (prvni) {
        prvni = false;
        blob.gets += 1;
        return {
          stav: "ok",
          dokument: klon(stale.dokument),
          etag: stale.etag,
        };
      }
      return blob.nacist();
    },
    vychoziDokument: () => dokumentZ([]),
    validovat,
    ulozit: (dokument, etag) => blob.ulozit(dokument, etag),
    jePreconditionChyba: (error) =>
      error instanceof BlobPreconditionFailedError,
  };
  return zmenitDokumentAtomickySIo(io, mutator);
}

function teloFunkce(zdroj: string, hlavicka: string): string {
  const start = zdroj.indexOf(hlavicka);
  if (start < 0) {
    return "";
  }
  const dalsiExport = zdroj.indexOf("\nexport async function ", start + hlavicka.length);
  const dalsiAsync = zdroj.indexOf("\nasync function ", start + hlavicka.length);
  const kandidati = [dalsiExport, dalsiAsync].filter((i) => i >= 0);
  const konec = kandidati.length === 0 ? zdroj.length : Math.min(...kandidati);
  return zdroj.slice(start, konec);
}

async function hlavni(): Promise<void> {
  const a = auto("id-a", "Film A");
  const b = auto("id-b", "Film B");
  const c = auto("id-c", "Film C");
  const pocatek = dokumentZ([a, b, c]);

  {
    const blob = new FalesnyBlob(pocatek);
    const revize = { dokument: klon(blob.dokument), etag: blob.etag };
    await zapsat(blob, mutaceSchvalit("id-a"));
    blob.resetCitace();
    await zapsatSeStalymPrvnimCtenim(blob, revize, mutaceSchvalit("id-b"));
    const stavy = Object.fromEntries(
      blob.dokument.udalosti.map((u) => [u.id, u.stavSchvaleni]),
    );
    assert(
      stavy["id-a"] === "SCHVALENO" &&
        stavy["id-b"] === "SCHVALENO" &&
        stavy["id-c"] === "CEKA_NA_SCHVALENI" &&
        blob.gets === 2 &&
        blob.puts === 2,
      "A: stejná revize → první CAS uspěje, druhý 412, retry zachová obě změny",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    await zapsat(blob, mutaceSchvalit("id-a"));
    const poA = { dokument: klon(blob.dokument), etag: blob.etag };
    const predB = { dokument: klon(pocatek), etag: "e1" };
    await zapsatSeStalymPrvnimCtenim(blob, predB, mutaceSchvalit("id-b"));
    await zapsatSeStalymPrvnimCtenim(blob, poA, mutaceSchvalit("id-c"));
    const stavy = blob.dokument.udalosti.map((u) => u.stavSchvaleni);
    assert(
      stavy.every((s) => s === "SCHVALENO") && blob.dokument.udalosti.length === 3,
      "B: tři rychlá Schválit různých id → žádná ztráta",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    const revize = { dokument: klon(blob.dokument), etag: blob.etag };
    await zapsat(blob, mutaceSchvalit("id-a"));
    await zapsatSeStalymPrvnimCtenim(
      blob,
      revize,
      mutaceUpravitNazev("id-b", "Film B upraven"),
    );
    const filmA = blob.dokument.udalosti.find((u) => u.id === "id-a");
    const filmB = blob.dokument.udalosti.find((u) => u.id === "id-b");
    assert(
      filmA?.stavSchvaleni === "SCHVALENO" &&
        filmB?.nazev === "Film B upraven" &&
        filmB.stavSchvaleni === "CEKA_NA_SCHVALENI",
      "C: Schválit + Upravit různého id → obě změny zůstanou",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    const revize = { dokument: klon(blob.dokument), etag: blob.etag };
    await zapsat(blob, mutaceSchvalit("id-a"));
    await zapsatSeStalymPrvnimCtenim(blob, revize, mutaceSkryt("id-b"));
    assert(
      blob.dokument.udalosti.find((u) => u.id === "id-a")?.stavSchvaleni ===
        "SCHVALENO" &&
        !blob.dokument.udalosti.some((u) => u.id === "id-b") &&
        blob.dokument.udalosti.some((u) => u.id === "id-c"),
      "D: Schválit + Skrýt různého id → obě změny zůstanou",
    );
  }

  {
    const blob = new FalesnyBlob(dokumentZ([a]));
    const revize = { dokument: klon(blob.dokument), etag: blob.etag };
    const kandidat: BranaScanAutomatickaUdalostVstup = {
      redakcniPolozkaId: "pol-2",
      datumOd: "2026-08-27",
      datumDo: "2026-08-27",
      cas: "20:00",
      mistoNeboTyp: "Kino",
      nazev: "Nový ze scanu",
      zdrojIdentita: "kino|scan-novy",
    };
    await zapsat(blob, mutaceSchvalit("id-a"));
    await zapsatSeStalymPrvnimCtenim(blob, revize, mutaceScan([kandidat]));
    assert(
      blob.dokument.udalosti.find((u) => u.id === "id-a")?.stavSchvaleni ===
        "SCHVALENO" &&
        blob.dokument.udalosti.some(
          (u) => u.nazev === "Nový ze scanu" && u.stavSchvaleni === "CEKA_NA_SCHVALENI",
        ),
      "E: scan zápis + Admin zápis → žádný lost update",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    const revize = { dokument: klon(blob.dokument), etag: blob.etag };
    await zapsat(blob, mutaceSchvalitKontrolu(["id-a", "id-b"]));
    await zapsatSeStalymPrvnimCtenim(blob, revize, mutaceSchvalit("id-c"));
    assert(
      blob.dokument.udalosti.every((u) => u.stavSchvaleni === "SCHVALENO"),
      "F: Schválit kontrolu + jiný writer → žádný lost update",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    blob.vzdyPrecondition = true;
    let chyba: unknown;
    try {
      await zapsat(blob, mutaceSchvalit("id-a"));
    } catch (error) {
      chyba = error;
    }
    assert(
      chyba instanceof BranaCasKonfliktLimitError &&
        blob.gets === BRANA_KONKRETNI_UDALOSTI_CAS_MAX_POKUSU &&
        blob.puts === BRANA_KONKRETNI_UDALOSTI_CAS_MAX_POKUSU &&
        blob.dokument.udalosti.find((u) => u.id === "id-a")?.stavSchvaleni ===
          "CEKA_NA_SCHVALENI",
      "G: retry limit → fail-closed, dokument beze změny",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    blob.putChyby = [new Error("síťová chyba")];
    let chyba: unknown;
    try {
      await zapsat(blob, mutaceSchvalit("id-a"));
    } catch (error) {
      chyba = error;
    }
    assert(
      chyba instanceof Error &&
        chyba.message === "síťová chyba" &&
        !(chyba instanceof BranaCasKonfliktLimitError) &&
        blob.gets === 1 &&
        blob.puts === 1 &&
        blob.dokument.udalosti.find((u) => u.id === "id-a")?.stavSchvaleni ===
          "CEKA_NA_SCHVALENI",
      "H: non-precondition chyba se nere-tryuje a failuje",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    await zapsat(blob, mutaceSchvalit("id-a"));
    assert(
      blob.gets === 1 &&
        blob.puts === 1 &&
        blob.dokument.udalosti.find((u) => u.id === "id-a")?.stavSchvaleni ===
          "SCHVALENO",
      "I: běžný zápis bez konfliktu = jeden GET + jeden PUT",
    );
  }

  const root = join(__dirname, "..");
  const uloziste = readFileSync(
    join(root, "src/lib/brana/admin/konkretni-udalosti-uloziste.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const cas = readFileSync(
    join(root, "src/lib/brana/admin/konkretni-udalosti-cas.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");

  assert(
    cas.includes("zmenitDokumentAtomickySIo") &&
      cas.includes("BRANA_KONKRETNI_UDALOSTI_CAS_MAX_POKUSU = 8") &&
      cas.includes("jePreconditionChyba") &&
      !cas.includes("put("),
    "zdroj: CAS smyčka je čistá, bez produkčního PUT",
  );

  assert(
    uloziste.includes("zmenitDokumentAtomickySIo") &&
      uloziste.includes("ifMatch: etag") &&
      uloziste.includes("BlobPreconditionFailedError") &&
      uloziste.includes("useCache: false") &&
      uloziste.includes("allowOverwrite: true") &&
      uloziste.includes("cacheControlMaxAge: 0") &&
      !uloziste.includes("nacistDokumentProZapis") &&
      !uloziste.includes("await ulozitDokument("),
    "zdroj: uloziste používá ifMatch / etag / čerstvý GET",
  );

  const writery = [
    "export async function nastavitPosledniScanDokoncen",
    "export async function pridatRucniKonkretniUdalost",
    "export async function upravitRucniKonkretniUdalost",
    "export async function smazatRucniKonkretniUdalost",
    "export async function schvalitKonkretniUdalost",
    "export async function schvalitKontroluKonkretnichUdalosti",
    "export async function upravitAutomatickouCekaUdalost",
    "export async function vyrazitAutomatickouCekaUdalost",
    "export async function skrytAutomatickouKonkretniUdalost",
    "async function pridatCekajiciAutomatickeUdalostiZeScanuJadro",
    "export async function uklidMinulychKonkretnichUdalostiProScheduler",
  ];
  const writeryNaCas = writery.every((hlavicka) => {
    const telo = teloFunkce(uloziste, hlavicka);
    return telo.includes("zmenitDokumentAtomicky(");
  });
  assert(writeryNaCas, "zdroj: všichni writery dokumentu jdou přes atomický helper");

  if (selhalo > 0) {
    console.error(`\nSelhalo: ${selhalo}`);
    process.exit(1);
  }
  console.log("\nVšechny kontroly CAS prošly.");
}

void hlavni();
