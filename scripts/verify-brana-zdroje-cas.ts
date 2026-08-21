/**
 * Fixture CAS / ifMatch pro data/brana-zdroje.json.
 * Bez produkčního Blob WRITE. Spuštění:
 * npx tsx scripts/verify-brana-zdroje-cas.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { BlobPreconditionFailedError } from "@vercel/blob";
import {
  BRANA_ZDROJE_CAS_MAX_POKUSU,
  BranaZdrojeCasKonfliktLimitError,
  zmenitZdrojeDokumentAtomickySIo,
  type BranaZdrojeCasIo,
  type BranaZdrojeDokumentMutace,
} from "../src/lib/brana/admin/zdroje-cas";
import type { BranaZdroj } from "../src/lib/brana/admin/zdroj";

type Dokument = { zdroje: BranaZdroj[] };

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

function zdroj(id: string, nazev: string): BranaZdroj {
  return {
    id,
    nazev,
    typ: "DLOUHODOBY",
    url: `https://priklad.cz/${id}`,
    rezimScanu: "BEZNY",
    hlidaneRedakcniPolozkaIds: [],
  };
}

function dokumentZ(zdroje: BranaZdroj[]): Dokument {
  return { zdroje };
}

function validovat(dokument: Dokument): Dokument | null {
  if (!Array.isArray(dokument.zdroje)) {
    return null;
  }
  const idSet = new Set<string>();
  for (const z of dokument.zdroje) {
    if (!z.id || idSet.has(z.id)) {
      return null;
    }
    idSet.add(z.id);
  }
  return dokument;
}

function mutacePridat(
  novy: BranaZdroj,
): (dokument: Dokument) => BranaZdrojeDokumentMutace<Dokument, BranaZdroj> {
  return (dokument) => {
    const radek: BranaZdroj = { ...novy, id: `zdroj-${novy.id}` };
    dokument.zdroje = [...dokument.zdroje, radek];
    return { typ: "zapsat", dokument, vysledek: radek };
  };
}

function mutacePridatSUuidVMutaci(
  nazev: string,
  noveId: () => string,
): (dokument: Dokument) => BranaZdrojeDokumentMutace<Dokument, BranaZdroj> {
  return (dokument) => {
    const novy = zdroj(noveId(), nazev);
    dokument.zdroje = [...dokument.zdroje, novy];
    return { typ: "zapsat", dokument, vysledek: novy };
  };
}

function mutaceUpravitNazev(
  id: string,
  nazev: string,
): (dokument: Dokument) => BranaZdrojeDokumentMutace<Dokument, BranaZdroj> {
  return (dokument) => {
    const index = dokument.zdroje.findIndex((z) => z.id === id);
    if (index < 0) {
      throw new Error("Zdroj nebyl nalezen.");
    }
    const upraveny: BranaZdroj = { ...dokument.zdroje[index], nazev };
    const zdroje = dokument.zdroje.slice();
    zdroje[index] = upraveny;
    dokument.zdroje = zdroje;
    return { typ: "zapsat", dokument, vysledek: upraveny };
  };
}

function mutaceSmazat(
  id: string,
): (dokument: Dokument) => BranaZdrojeDokumentMutace<Dokument, undefined> {
  return (dokument) => {
    const pred = dokument.zdroje.length;
    const zdroje = dokument.zdroje.filter((z) => z.id !== id);
    if (zdroje.length === pred) {
      throw new Error("Zdroj nebyl nalezen.");
    }
    dokument.zdroje = zdroje;
    return { typ: "zapsat", dokument, vysledek: undefined };
  };
}

class FalesnyBlob {
  dokument: Dokument;
  apiEtag: string;
  storageEtag: string;
  heads = 0;
  gets = 0;
  puts = 0;
  putIfMatch: Array<string | null> = [];
  vzdyPrecondition = false;
  putChyby: unknown[] = [];

  constructor(dokument: Dokument, revize = 1) {
    this.dokument = klon(dokument);
    this.apiEtag = `"api-${revize}"`;
    this.storageEtag = `W/"storage-${revize}"`;
  }

  get etag(): string {
    return this.apiEtag;
  }

  resetCitace(): void {
    this.heads = 0;
    this.gets = 0;
    this.puts = 0;
    this.putIfMatch = [];
  }

  async nacist() {
    this.heads += 1;
    const apiEtag = this.apiEtag;
    this.gets += 1;
    return {
      stav: "ok" as const,
      dokument: klon(this.dokument),
      etag: apiEtag,
    };
  }

  async ulozit(dokument: Dokument, etag: string | null): Promise<void> {
    this.puts += 1;
    this.putIfMatch.push(etag);
    if (etag === this.storageEtag) {
      throw new BlobPreconditionFailedError();
    }
    if (this.vzdyPrecondition) {
      throw new BlobPreconditionFailedError();
    }
    const dalsi = this.putChyby.shift();
    if (dalsi !== undefined) {
      throw dalsi;
    }
    if (etag !== null && etag !== this.apiEtag) {
      throw new BlobPreconditionFailedError();
    }
    this.dokument = klon(dokument);
    const cislo = Number.parseInt(this.apiEtag.replace(/\D/g, ""), 10) || 1;
    const dalsiRevize = cislo + 1;
    this.apiEtag = `"api-${dalsiRevize}"`;
    this.storageEtag = `W/"storage-${dalsiRevize}"`;
  }

  io(): BranaZdrojeCasIo<Dokument> {
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
  mutator: (dokument: Dokument) => BranaZdrojeDokumentMutace<Dokument, unknown>,
): Promise<unknown> {
  return zmenitZdrojeDokumentAtomickySIo(blob.io(), mutator);
}

async function zapsatSeStalymPrvnimCtenim(
  blob: FalesnyBlob,
  stale: { dokument: Dokument; etag: string },
  mutator: (dokument: Dokument) => BranaZdrojeDokumentMutace<Dokument, unknown>,
): Promise<unknown> {
  let prvni = true;
  const io: BranaZdrojeCasIo<Dokument> = {
    nacist: async () => {
      if (prvni) {
        prvni = false;
        blob.heads += 1;
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
  return zmenitZdrojeDokumentAtomickySIo(io, mutator);
}

function teloFunkce(zdrojKod: string, hlavicka: string): string {
  const start = zdrojKod.indexOf(hlavicka);
  if (start < 0) {
    return "";
  }
  const dalsiExport = zdrojKod.indexOf(
    "\nexport async function ",
    start + hlavicka.length,
  );
  const dalsiAsync = zdrojKod.indexOf(
    "\nasync function ",
    start + hlavicka.length,
  );
  const kandidati = [dalsiExport, dalsiAsync].filter((i) => i >= 0);
  const konec = kandidati.length === 0 ? zdrojKod.length : Math.min(...kandidati);
  return zdrojKod.slice(start, konec);
}

async function hlavni(): Promise<void> {
  const a = zdroj("id-a", "Zdroj A");
  const b = zdroj("id-b", "Zdroj B");
  const c = zdroj("id-c", "Zdroj C");
  const pocatek = dokumentZ([a, b, c]);

  {
    const blob = new FalesnyBlob(pocatek);
    await zapsat(blob, mutaceUpravitNazev("id-a", "Zdroj A upraven"));
    assert(
      blob.heads === 1 &&
        blob.gets === 1 &&
        blob.puts === 1 &&
        blob.putIfMatch[0] === '"api-1"' &&
        blob.putIfMatch[0] !== blob.storageEtag &&
        blob.dokument.zdroje.find((z) => z.id === "id-a")?.nazev ===
          "Zdroj A upraven",
      "A: běžný zápis = HEAD + GET + PUT(ifMatch z HEAD)",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    const revize = { dokument: klon(blob.dokument), etag: blob.etag };
    await zapsat(blob, mutaceUpravitNazev("id-a", "Zdroj A v1"));
    blob.resetCitace();
    await zapsatSeStalymPrvnimCtenim(
      blob,
      revize,
      mutaceUpravitNazev("id-b", "Zdroj B v2"),
    );
    assert(
      blob.dokument.zdroje.find((z) => z.id === "id-a")?.nazev ===
        "Zdroj A v1" &&
        blob.dokument.zdroje.find((z) => z.id === "id-b")?.nazev ===
          "Zdroj B v2" &&
        blob.heads === 2 &&
        blob.gets === 2 &&
        blob.puts === 2 &&
        blob.putIfMatch[0] === '"api-1"' &&
        blob.putIfMatch[1] === '"api-2"',
      "B: PUT e1 → 412, nový HEAD e2, nový GET, mutace, PUT e2 → úspěch",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    const revize = { dokument: klon(blob.dokument), etag: blob.etag };
    await zapsat(blob, mutaceUpravitNazev("id-a", "A-soubezne"));
    await zapsatSeStalymPrvnimCtenim(
      blob,
      revize,
      mutaceUpravitNazev("id-c", "C-soubezne"),
    );
    assert(
      blob.dokument.zdroje.find((z) => z.id === "id-a")?.nazev ===
        "A-soubezne" &&
        blob.dokument.zdroje.find((z) => z.id === "id-b")?.nazev === "Zdroj B" &&
        blob.dokument.zdroje.find((z) => z.id === "id-c")?.nazev ===
          "C-soubezne",
      "C: dvě souběžné úpravy různých id → obě změny zůstávají",
    );
  }

  {
    const blob = new FalesnyBlob(dokumentZ([a, b]));
    const revize = { dokument: klon(blob.dokument), etag: blob.etag };
    await zapsat(blob, mutaceUpravitNazev("id-a", "A-hotovo"));
    await zapsatSeStalymPrvnimCtenim(
      blob,
      revize,
      mutacePridat(zdroj("novy", "Nový zdroj")),
    );
    assert(
      blob.dokument.zdroje.find((z) => z.id === "id-a")?.nazev === "A-hotovo" &&
        blob.dokument.zdroje.some((z) => z.id === "zdroj-novy") &&
        blob.dokument.zdroje.find((z) => z.id === "id-b")?.nazev === "Zdroj B",
      "D: Přidat × Upravit jiného id → obě změny zůstávají",
    );
  }

  {
    let uuidPoradi = 0;
    const blob = new FalesnyBlob(pocatek);
    const revize = { dokument: klon(blob.dokument), etag: blob.etag };
    await zapsat(blob, mutaceUpravitNazev("id-a", "A-uuid"));
    await zapsatSeStalymPrvnimCtenim(
      blob,
      revize,
      mutacePridatSUuidVMutaci("Z UUID", () => `uuid-${(uuidPoradi += 1)}`),
    );
    const sUuid = blob.dokument.zdroje.filter((z) => z.id.startsWith("uuid-"));
    assert(
      blob.dokument.zdroje.find((z) => z.id === "id-a")?.nazev === "A-uuid" &&
        sUuid.length === 1,
      "D2: UUID uvnitř mutace → po retry právě jeden nový řádek",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    const revize = { dokument: klon(blob.dokument), etag: blob.etag };
    await zapsat(blob, mutaceSmazat("id-a"));
    await zapsatSeStalymPrvnimCtenim(
      blob,
      revize,
      mutaceUpravitNazev("id-b", "B-zustal"),
    );
    assert(
      !blob.dokument.zdroje.some((z) => z.id === "id-a") &&
        blob.dokument.zdroje.find((z) => z.id === "id-b")?.nazev ===
          "B-zustal" &&
        blob.dokument.zdroje.some((z) => z.id === "id-c"),
      "E: Smazat × Upravit jiného id → smazaný pryč, úprava zůstane",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    blob.vzdyPrecondition = true;
    let chyba: unknown;
    try {
      await zapsat(blob, mutaceUpravitNazev("id-a", "nemelo"));
    } catch (error) {
      chyba = error;
    }
    assert(
      chyba instanceof BranaZdrojeCasKonfliktLimitError &&
        blob.heads === BRANA_ZDROJE_CAS_MAX_POKUSU &&
        blob.gets === BRANA_ZDROJE_CAS_MAX_POKUSU &&
        blob.puts === BRANA_ZDROJE_CAS_MAX_POKUSU &&
        blob.dokument.zdroje.find((z) => z.id === "id-a")?.nazev === "Zdroj A",
      "F: 8× 412 → fail-closed, dokument beze změny",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    blob.putChyby = [new Error("síťová chyba")];
    let chyba: unknown;
    try {
      await zapsat(blob, mutaceUpravitNazev("id-a", "nemelo"));
    } catch (error) {
      chyba = error;
    }
    assert(
      chyba instanceof Error &&
        chyba.message === "síťová chyba" &&
        !(chyba instanceof BranaZdrojeCasKonfliktLimitError) &&
        blob.heads === 1 &&
        blob.gets === 1 &&
        blob.puts === 1 &&
        blob.dokument.zdroje.find((z) => z.id === "id-a")?.nazev === "Zdroj A",
      "G: jiná chyba se nere-tryuje a failuje",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    await zapsat(blob, mutaceUpravitNazev("id-a", "H-kontrola"));
    const storagePouzity = blob.putIfMatch.some(
      (hodnota) => hodnota === `W/"storage-1"` || hodnota === blob.storageEtag,
    );
    assert(
      !storagePouzity &&
        blob.putIfMatch.every(
          (hodnota) => typeof hodnota === "string" && hodnota.startsWith('"api-'),
        ),
      "H: ifMatch používá HEAD/API etag, ne storage GET etag",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    let chyba: unknown;
    try {
      await zapsat(blob, mutaceSmazat("neexistuje"));
    } catch (error) {
      chyba = error;
    }
    assert(
      chyba instanceof Error &&
        chyba.message === "Zdroj nebyl nalezen." &&
        blob.puts === 0 &&
        blob.dokument.zdroje.length === 3,
      "E2: neexistující id při smazání = chyba, ne retry PUT",
    );
  }

  const root = join(__dirname, "..");
  const uloziste = readFileSync(
    join(root, "src/lib/brana/admin/zdroje-uloziste.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const cas = readFileSync(
    join(root, "src/lib/brana/admin/zdroje-cas.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const skenovat = readFileSync(
    join(root, "src/lib/brana/admin/skenovat-zdroj.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");

  assert(
    cas.includes("zmenitZdrojeDokumentAtomickySIo") &&
      cas.includes("BRANA_ZDROJE_CAS_MAX_POKUSU = 8") &&
      cas.includes("jePreconditionChyba") &&
      !cas.includes("put("),
    "zdroj: CAS smyčka Zdrojů je čistá, bez produkčního PUT",
  );

  assert(
    uloziste.includes("zmenitZdrojeDokumentAtomickySIo") &&
      uloziste.includes("ifMatch: etag") &&
      uloziste.includes("BlobPreconditionFailedError") &&
      uloziste.includes("useCache: false") &&
      uloziste.includes("allowOverwrite: true") &&
      uloziste.includes("cacheControlMaxAge: 0") &&
      uloziste.includes("await head(") &&
      !uloziste.includes("nacistDokumentProZapis") &&
      !uloziste.includes("async function ulozitDokument(") &&
      !uloziste.includes("blob.etag") &&
      !uloziste.includes("vysledek.blob"),
    "I/J: ifMatch z head().etag, starý nechráněný PUT odstraněn",
  );

  const teloNacist = teloFunkce(
    uloziste,
    "async function nacistDokumentSEtagProZapis",
  );
  const indexHead = teloNacist.indexOf("await head(");
  const indexGet = teloNacist.indexOf("await get(");
  assert(
    indexHead >= 0 && indexGet > indexHead,
    "zdroj: pořadí jednoho pokusu je HEAD → GET",
  );

  const writery = [
    "export async function pridatZdroj",
    "export async function upravitZdroj",
    "export async function smazatZdroj",
  ];
  const writeryNaCas = writery.every((hlavicka) => {
    const telo = teloFunkce(uloziste, hlavicka);
    return telo.includes("zmenitZdrojeDokumentAtomicky(");
  });
  assert(writeryNaCas, "I: pridatZdroj / upravitZdroj / smazatZdroj jdou přes CAS");

  const putVyskytu = (uloziste.match(/await put\(/g) ?? []).length;
  assert(
    putVyskytu === 1 &&
      teloFunkce(uloziste, "async function ulozitDokumentSIfMatch").includes(
        "await put(",
      ),
    "J: jediný PUT data/brana-zdroje.json je ifMatch helper",
  );

  assert(
    !skenovat.includes("BRANA_ZDROJE_BLOB_CESTA") &&
      !skenovat.includes("pridatZdroj(") &&
      !skenovat.includes("upravitZdroj(") &&
      !skenovat.includes("smazatZdroj("),
    "scan do brana-zdroje.json nezapisuje",
  );

  const schedulerTelo = teloFunkce(
    uloziste,
    "export async function nacistZdrojeProScheduler",
  );
  assert(
    schedulerTelo.includes("nacistZdrojeDokument()") &&
      !schedulerTelo.includes("zmenitZdrojeDokumentAtomicky(") &&
      !schedulerTelo.includes("put("),
    "scheduler zdroje jen čte",
  );

  if (selhalo > 0) {
    console.error(`\nSelhalo: ${selhalo}`);
    process.exit(1);
  }
  console.log("\nVšechny kontroly CAS Zdrojů prošly.");
}

void hlavni();
