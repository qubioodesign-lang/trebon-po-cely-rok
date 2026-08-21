/**
 * Fixture CAS / ifMatch pro data/brana-nezarazene.json.
 * Bez produkčního Blob WRITE. Spuštění:
 * npx tsx scripts/verify-brana-nezarazene-cas.ts
 */

import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";
import { BlobPreconditionFailedError } from "@vercel/blob";
import {
  BRANA_NEZARAZENE_CAS_MAX_POKUSU,
  BranaNezarazeneCasKonfliktLimitError,
  zmenitNezarazeneDokumentAtomickySIo,
  type BranaNezarazeneCasIo,
  type BranaNezarazeneDokumentMutace,
} from "../src/lib/brana/admin/nezarazene-cas";
import {
  pridatNesparovaneDoNezarazenych,
  smazatNezarazenyNalezVDokumentu,
  vychoziNezarazeneDokument,
  vytvoritNezarazenyKlic,
  vyresitOtevreneNezarazenePodleKlicu,
  type BranaNezarazeneDokument,
  type BranaNezarazenyNalez,
  type BranaNezarazenyScanKandidat,
} from "../src/lib/brana/admin/nezarazene";

type Dokument = BranaNezarazeneDokument;

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

function kandidat(
  nazev: string,
  datumOd = "2026-08-26",
): BranaNezarazenyScanKandidat {
  return {
    nazev,
    datumOd,
    datumDo: datumOd,
    cas: "17:00",
    mistoNeboTyp: "Kino",
  };
}

function klicPro(
  zdrojId: string,
  nazev: string,
  datumOd = "2026-08-26",
): string {
  return vytvoritNezarazenyKlic({
    zdrojId,
    datumOd,
    cas: "17:00",
    nazev,
  });
}

function nalez(
  id: string,
  zdrojId: string,
  nazev: string,
): BranaNezarazenyNalez {
  const datumOd = "2026-08-26";
  return {
    id,
    klic: klicPro(zdrojId, nazev, datumOd),
    zdrojId,
    zdrojNazev: `Zdroj ${zdrojId}`,
    datumOd,
    datumDo: datumOd,
    cas: "17:00",
    mistoNeboTyp: "Kino",
    nazev,
  };
}

function dokumentZ(otevrene: BranaNezarazenyNalez[]): Dokument {
  return {
    ...vychoziNezarazeneDokument(),
    otevrene,
  };
}

function jeStejnyDokument(a: Dokument, b: Dokument): boolean {
  const stejneOtevrene =
    a.otevrene.length === b.otevrene.length &&
    a.otevrene.every((n, i) => n.id === b.otevrene[i]?.id);
  const stejneOdmitnute =
    a.odmitnuteKlice.length === b.odmitnuteKlice.length &&
    a.odmitnuteKlice.every((k, i) => k === b.odmitnuteKlice[i]);
  return stejneOtevrene && stejneOdmitnute;
}

function validovat(dokument: Dokument): Dokument | null {
  if (!dokument || typeof dokument !== "object") {
    return null;
  }
  if (!Array.isArray(dokument.otevrene) || !Array.isArray(dokument.odmitnuteKlice)) {
    return null;
  }
  return dokument;
}

function mutacePridat(
  zdrojId: string,
  nazev: string,
  noveId: () => string,
): (dokument: Dokument) => BranaNezarazeneDokumentMutace<Dokument, undefined> {
  return (dokument) => {
    const po = pridatNesparovaneDoNezarazenych(dokument, {
      zdrojId,
      zdrojNazev: `Zdroj ${zdrojId}`,
      nesparovane: [kandidat(nazev)],
      noveId,
    });
    if (jeStejnyDokument(dokument, po)) {
      return { typ: "bezZmeny", vysledek: undefined };
    }
    return { typ: "zapsat", dokument: po, vysledek: undefined };
  };
}

function mutaceResolve(
  klice: readonly string[],
): (dokument: Dokument) => BranaNezarazeneDokumentMutace<Dokument, undefined> {
  return (dokument) => {
    const po = vyresitOtevreneNezarazenePodleKlicu(dokument, klice);
    if (jeStejnyDokument(dokument, po)) {
      return { typ: "bezZmeny", vysledek: undefined };
    }
    return { typ: "zapsat", dokument: po, vysledek: undefined };
  };
}

function mutaceSmazat(
  id: string,
): (dokument: Dokument) => BranaNezarazeneDokumentMutace<Dokument, undefined> {
  return (dokument) => {
    const vysledek = smazatNezarazenyNalezVDokumentu(dokument, id);
    if ("chyba" in vysledek) {
      throw new Error(vysledek.chyba);
    }
    return { typ: "zapsat", dokument: vysledek, vysledek: undefined };
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
  neexistuje = false;

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
    if (this.neexistuje) {
      return { stav: "neexistuje" as const };
    }
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
    this.neexistuje = false;
    const cislo = Number.parseInt(this.apiEtag.replace(/\D/g, ""), 10) || 1;
    const dalsiRevize = cislo + 1;
    this.apiEtag = `"api-${dalsiRevize}"`;
    this.storageEtag = `W/"storage-${dalsiRevize}"`;
  }

  io(): BranaNezarazeneCasIo<Dokument> {
    return {
      nacist: () => this.nacist(),
      vychoziDokument: vychoziNezarazeneDokument,
      validovat,
      ulozit: (dokument, etag) => this.ulozit(dokument, etag),
      jePreconditionChyba: (error) =>
        error instanceof BlobPreconditionFailedError,
    };
  }
}

async function zapsat(
  blob: FalesnyBlob,
  mutator: (
    dokument: Dokument,
  ) => BranaNezarazeneDokumentMutace<Dokument, unknown>,
): Promise<unknown> {
  return zmenitNezarazeneDokumentAtomickySIo(blob.io(), mutator);
}

async function zapsatSeStalymPrvnimCtenim(
  blob: FalesnyBlob,
  stale: { dokument: Dokument; etag: string },
  mutator: (
    dokument: Dokument,
  ) => BranaNezarazeneDokumentMutace<Dokument, unknown>,
): Promise<unknown> {
  let prvni = true;
  const io: BranaNezarazeneCasIo<Dokument> = {
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
    vychoziDokument: vychoziNezarazeneDokument,
    validovat,
    ulozit: (dokument, etag) => blob.ulozit(dokument, etag),
    jePreconditionChyba: (error) =>
      error instanceof BlobPreconditionFailedError,
  };
  return zmenitNezarazeneDokumentAtomickySIo(io, mutator);
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
  const a = nalez("id-a", "zdroj-a", "Nález A");
  const b = nalez("id-b", "zdroj-b", "Nález B");
  const pocatek = dokumentZ([a]);

  {
    const blob = new FalesnyBlob(pocatek);
    await zapsat(blob, mutacePridat("zdroj-b", "Nález B", () => "id-b-novy"));
    assert(
      blob.heads === 1 &&
        blob.gets === 1 &&
        blob.puts === 1 &&
        blob.putIfMatch[0] === '"api-1"' &&
        blob.dokument.otevrene.some((n) => n.id === "id-a") &&
        blob.dokument.otevrene.some((n) => n.klic === klicPro("zdroj-b", "Nález B")),
      "A: běžný zápis = HEAD + GET + PUT",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    await zapsat(blob, mutacePridat("zdroj-b", "Nález B", () => "id-b-novy"));
    const ifMatch = blob.putIfMatch[0];
    assert(
      blob.putIfMatch.length === 1 && ifMatch === '"api-1"',
      "B: ifMatch = API etag z HEAD",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    const revize = { dokument: klon(blob.dokument), etag: blob.etag };
    await zapsat(blob, mutacePridat("zdroj-b", "Nález B", () => "id-b-1"));
    blob.resetCitace();
    await zapsatSeStalymPrvnimCtenim(
      blob,
      revize,
      mutacePridat("zdroj-c", "Nález C", () => "id-c-1"),
    );
    assert(
      blob.dokument.otevrene.some((n) => n.klic === klicPro("zdroj-b", "Nález B")) &&
        blob.dokument.otevrene.some((n) => n.klic === klicPro("zdroj-c", "Nález C")) &&
        blob.heads === 2 &&
        blob.gets === 2 &&
        blob.puts === 2 &&
        blob.putIfMatch[0] === '"api-1"' &&
        blob.putIfMatch[1] === '"api-2"',
      "C: PUT e1 → 412, nový HEAD e2, nový GET, mutace, PUT e2 → úspěch",
    );
  }

  {
    const blob = new FalesnyBlob(dokumentZ([]));
    const revize = { dokument: klon(blob.dokument), etag: blob.etag };
    await zapsat(blob, mutacePridat("zdroj-a", "Nález A", () => "id-a-scan"));
    await zapsatSeStalymPrvnimCtenim(
      blob,
      revize,
      mutacePridat("zdroj-b", "Nález B", () => "id-b-scan"),
    );
    assert(
      blob.dokument.otevrene.some((n) => n.klic === klicPro("zdroj-a", "Nález A")) &&
        blob.dokument.otevrene.some((n) => n.klic === klicPro("zdroj-b", "Nález B")) &&
        blob.dokument.otevrene.length === 2,
      "D: scan × scan, dva různé klíče → oba zůstanou v otevrene",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    const revize = { dokument: klon(blob.dokument), etag: blob.etag };
    await zapsat(blob, mutacePridat("zdroj-b", "Nález B", () => "id-b-scan"));
    await zapsatSeStalymPrvnimCtenim(blob, revize, mutaceSmazat("id-a"));
    assert(
      !blob.dokument.otevrene.some((n) => n.id === "id-a") &&
        blob.dokument.otevrene.some((n) => n.klic === klicPro("zdroj-b", "Nález B")) &&
        blob.dokument.odmitnuteKlice.includes(a.klic),
      "E: scan přidá B, Smazat A → B otevřený, A pryč, klic A v odmitnuteKlice",
    );
  }

  {
    const blob = new FalesnyBlob(dokumentZ([b]));
    const revize = { dokument: klon(blob.dokument), etag: blob.etag };
    await zapsat(blob, mutacePridat("zdroj-a", "Nález A", () => "id-a-scan"));
    await zapsatSeStalymPrvnimCtenim(blob, revize, mutaceResolve([b.klic]));
    assert(
      blob.dokument.otevrene.some((n) => n.klic === klicPro("zdroj-a", "Nález A")) &&
        !blob.dokument.otevrene.some((n) => n.klic === b.klic) &&
        blob.dokument.odmitnuteKlice.length === 0,
      "F: nový NO-MATCH A + resolve B → obě operace zachovány",
    );
  }

  {
    const blob = new FalesnyBlob(dokumentZ([a, b]));
    const revize = { dokument: klon(blob.dokument), etag: blob.etag };
    await zapsat(blob, mutaceSmazat("id-a"));
    await zapsatSeStalymPrvnimCtenim(blob, revize, mutaceResolve([b.klic]));
    assert(
      !blob.dokument.otevrene.some((n) => n.id === "id-a") &&
        !blob.dokument.otevrene.some((n) => n.id === "id-b") &&
        blob.dokument.odmitnuteKlice.includes(a.klic) &&
        !blob.dokument.odmitnuteKlice.includes(b.klic),
      "G: Smazat A × resolve B → A pryč s pamětí, B pryč bez ztráty paměti A",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    blob.vzdyPrecondition = true;
    let chyba: unknown;
    try {
      await zapsat(blob, mutacePridat("zdroj-b", "Nález B", () => "id-b"));
    } catch (error) {
      chyba = error;
    }
    assert(
      chyba instanceof BranaNezarazeneCasKonfliktLimitError &&
        blob.heads === BRANA_NEZARAZENE_CAS_MAX_POKUSU &&
        blob.gets === BRANA_NEZARAZENE_CAS_MAX_POKUSU &&
        blob.puts === BRANA_NEZARAZENE_CAS_MAX_POKUSU &&
        blob.dokument.otevrene.length === 1 &&
        blob.dokument.otevrene[0]?.id === "id-a",
      "H: 8× 412 → fail-closed",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    blob.putChyby = [new Error("síťová chyba")];
    let chyba: unknown;
    try {
      await zapsat(blob, mutacePridat("zdroj-b", "Nález B", () => "id-b"));
    } catch (error) {
      chyba = error;
    }
    assert(
      chyba instanceof Error &&
        chyba.message === "síťová chyba" &&
        !(chyba instanceof BranaNezarazeneCasKonfliktLimitError) &&
        blob.heads === 1 &&
        blob.gets === 1 &&
        blob.puts === 1 &&
        blob.dokument.otevrene.length === 1,
      "I: jiná chyba se nere-tryuje a failuje",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    await zapsat(blob, mutacePridat("zdroj-b", "Nález B", () => "id-b"));
    const storagePouzity = blob.putIfMatch.some(
      (hodnota) => hodnota === `W/"storage-1"` || hodnota === blob.storageEtag,
    );
    assert(
      !storagePouzity &&
        blob.putIfMatch.every(
          (hodnota) => typeof hodnota === "string" && hodnota.startsWith('"api-'),
        ),
      "J: ifMatch používá HEAD/API etag, ne storage GET etag",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    blob.neexistuje = true;
    await zapsat(blob, mutacePridat("zdroj-a", "Nález A", () => "id-a"));
    assert(
      blob.heads === 1 &&
        blob.gets === 0 &&
        blob.puts === 1 &&
        blob.putIfMatch[0] === null &&
        blob.dokument.otevrene.some((n) => n.klic === klicPro("zdroj-a", "Nález A")),
      "HEAD 404 → výchozí dokument, první PUT bez ifMatch",
    );
  }

  const root = join(__dirname, "..");
  const uloziste = readFileSync(
    join(root, "src/lib/brana/admin/nezarazene-uloziste.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const cas = readFileSync(
    join(root, "src/lib/brana/admin/nezarazene-cas.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const cistaLogika = readFileSync(
    join(root, "src/lib/brana/admin/nezarazene.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const scan = readFileSync(
    join(root, "src/lib/brana/admin/skenovat-zdroj.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const actions = readFileSync(
    join(root, "src/app/brana/admin/actions.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");

  assert(
    cas.includes("zmenitNezarazeneDokumentAtomickySIo") &&
      cas.includes("BRANA_NEZARAZENE_CAS_MAX_POKUSU = 8") &&
      cas.includes("jePreconditionChyba") &&
      !cas.includes("put("),
    "zdroj: CAS smyčka Nezařazených je čistá, bez produkčního PUT",
  );

  const teloNesparovane = teloFunkce(
    uloziste,
    "async function ulozitNesparovaneJadro",
  );
  const teloResolve = teloFunkce(uloziste, "async function vyresitPoMatchiJadro");
  const teloSmazatJadro = teloFunkce(
    uloziste,
    "async function smazatNezarazenyNalezJadro",
  );
  assert(
    teloNesparovane.includes("zmenitNezarazeneDokumentAtomicky(") &&
      teloNesparovane.includes("noveId: () => `nez-${crypto.randomUUID()}`") &&
      teloResolve.includes("zmenitNezarazeneDokumentAtomicky(") &&
      teloSmazatJadro.includes("zmenitNezarazeneDokumentAtomicky(") &&
      teloSmazatJadro.includes("smazatNezarazenyNalezVDokumentu") &&
      teloFunkce(
        uloziste,
        "export async function ulozitNesparovaneNezarazene",
      ).includes("ulozitNesparovaneJadro(") &&
      teloFunkce(
        uloziste,
        "export async function ulozitNesparovaneNezarazeneProScheduler",
      ).includes("ulozitNesparovaneJadro(") &&
      teloFunkce(
        uloziste,
        "export async function vyresitNezarazenePoUspesnemMatchi",
      ).includes("vyresitPoMatchiJadro(") &&
      teloFunkce(
        uloziste,
        "export async function vyresitNezarazenePoUspesnemMatchiProScheduler",
      ).includes("vyresitPoMatchiJadro(") &&
      teloFunkce(
        uloziste,
        "export async function smazatNezarazenyNalez",
      ).includes("smazatNezarazenyNalezJadro("),
    "K: všech 5 exportů končí na jediné CAS cestě",
  );

  const putVyskytu = (uloziste.match(/await put\(/g) ?? []).length;
  const teloPut = teloFunkce(uloziste, "async function ulozitDokumentSIfMatch");
  const teloNacist = teloFunkce(
    uloziste,
    "async function nacistDokumentSEtagProZapis",
  );
  const indexHead = teloNacist.indexOf("await head(");
  const indexGet = teloNacist.indexOf("await get(");
  assert(
    putVyskytu === 1 &&
      teloPut.includes("await put(") &&
      teloPut.includes("ifMatch: etag") &&
      teloPut.includes("allowOverwrite: true") &&
      teloPut.includes("cacheControlMaxAge: 0") &&
      uloziste.includes("useCache: false") &&
      uloziste.includes("BlobPreconditionFailedError") &&
      indexHead >= 0 &&
      indexGet > indexHead &&
      !uloziste.includes("async function ulozitDokument(") &&
      !uloziste.includes("nacistDokumentProZapis") &&
      !uloziste.includes("blob.etag") &&
      !uloziste.includes("vysledek.blob"),
    "L: jediný PUT tohoto Blobu je chráněný ifMatch; starý PUT odstraněn",
  );

  assert(
    cistaLogika.includes("odmitnute.add(nalez.klic)") &&
      cistaLogika.includes("odmitnuteKlice: dokument.odmitnuteKlice.slice()") &&
      !scan.includes("zmenitNezarazeneDokumentAtomicky") &&
      teloFunkce(
        actions,
        "export async function smazatBranaNezarazenyNalezAkce",
      ).includes("smazatNezarazenyNalez("),
    "nezarazene.ts / scan / actions.ts se nemění; význam Smazat zůstává v čisté logice",
  );

  let tscOk = false;
  let tscVystup = "";
  try {
    execSync("npx tsc --noEmit", {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe",
    });
    tscOk = true;
  } catch (error) {
    const detail = error as { stdout?: string; stderr?: string };
    tscVystup = `${detail.stdout ?? ""}${detail.stderr ?? ""}`;
  }
  assert(
    tscOk,
    tscOk ? "M: npx tsc --noEmit" : `M: npx tsc --noEmit\n${tscVystup}`,
  );

  if (selhalo > 0) {
    console.error(`\nSelhalo: ${selhalo}`);
    process.exit(1);
  }
  console.log("\nVšechny kontroly CAS Nezařazených prošly.");
}

void hlavni();
