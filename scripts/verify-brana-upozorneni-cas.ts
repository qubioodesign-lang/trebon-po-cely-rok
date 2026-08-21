/**
 * Fixture CAS / ifMatch pro data/brana-upozorneni-nastaveni.json.
 * Bez produkčního Blob WRITE. Spuštění:
 * npx tsx scripts/verify-brana-upozorneni-cas.ts
 */

import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";
import { BlobPreconditionFailedError } from "@vercel/blob";
import type { BranaSkupinovyScanStav } from "../src/lib/brana/admin/skupinovy-scan-stav";
import {
  BRANA_UPOZORNENI_CAS_MAX_POKUSU,
  BranaUpozorneniCasKonfliktLimitError,
  zmenitUpozorneniDokumentAtomickySIo,
  type BranaUpozorneniCasIo,
  type BranaUpozorneniDokumentMutace,
} from "../src/lib/brana/admin/upozorneni-cas";

type PushSubscription = {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
};

type Dokument = {
  telefon: string;
  upozorneniAktivni: boolean;
  pushSubscription: PushSubscription | null;
  pristiDlouhodobaKontrola: string | null;
  posledniDokoncenaDlouhodobaKontrola: string | null;
  posledniUpozorneniRychle: string | null;
  posledniUpozorneniDlouhodobe: string | null;
  posledniUpozorneniAsistovaneKotva: string | null;
  posledniRychlySkupinovyScan: BranaSkupinovyScanStav | null;
  posledniDlouhySkupinovyScan: BranaSkupinovyScanStav | null;
  schvalenoDoIso: string | null;
};

const KOTVA_DOKONCENA = "2026-08-03";
const KOTVA_PRISTI = "2026-08-17";
const KOTVA_PO_CHECKPOINTU = "2026-08-31";
const SCHVALENO_DO = "2026-08-30";

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

function vychoziDokument(): Dokument {
  return {
    telefon: "",
    upozorneniAktivni: false,
    pushSubscription: null,
    pristiDlouhodobaKontrola: null,
    posledniDokoncenaDlouhodobaKontrola: null,
    posledniUpozorneniRychle: null,
    posledniUpozorneniDlouhodobe: null,
    posledniUpozorneniAsistovaneKotva: null,
    posledniRychlySkupinovyScan: null,
    posledniDlouhySkupinovyScan: null,
    schvalenoDoIso: null,
  };
}

function pocatecniDokument(): Dokument {
  return {
    ...vychoziDokument(),
    pristiDlouhodobaKontrola: KOTVA_PRISTI,
    posledniDokoncenaDlouhodobaKontrola: KOTVA_DOKONCENA,
  };
}

function scanRazitko(dokoncenoAt: string): BranaSkupinovyScanStav {
  return {
    dokoncenoAt,
    chybneZdroje: 0,
    chybneZdrojeNazvy: [],
  };
}

function pushSubscription(): PushSubscription {
  return {
    endpoint: "https://push.priklad.cz/test",
    expirationTime: null,
    keys: { p256dh: "p256dh", auth: "auth" },
  };
}

function validovat(dokument: Dokument): Dokument | null {
  if (!dokument || typeof dokument !== "object") {
    return null;
  }
  if (typeof dokument.upozorneniAktivni !== "boolean") {
    return null;
  }
  return dokument;
}

function mutacePristi(
  pristi: string | null,
): (dokument: Dokument) => BranaUpozorneniDokumentMutace<Dokument, Dokument> {
  return (dokument) => {
    const vysledek: Dokument = {
      ...dokument,
      pristiDlouhodobaKontrola: pristi,
    };
    return { typ: "zapsat", dokument: vysledek, vysledek };
  };
}

function mutacePushZapnout(
  subscription: PushSubscription,
): (dokument: Dokument) => BranaUpozorneniDokumentMutace<Dokument, Dokument> {
  return (dokument) => {
    const vysledek: Dokument = {
      ...dokument,
      pushSubscription: subscription,
      upozorneniAktivni: true,
    };
    return { typ: "zapsat", dokument: vysledek, vysledek };
  };
}

function mutaceSchvalenoDo(
  schvalenoDoIso: string,
): (dokument: Dokument) => BranaUpozorneniDokumentMutace<Dokument, Dokument> {
  return (dokument) => {
    const vysledek: Dokument = {
      ...dokument,
      schvalenoDoIso,
    };
    return { typ: "zapsat", dokument: vysledek, vysledek };
  };
}

function mutaceRazitkoRychly(
  stav: BranaSkupinovyScanStav,
): (dokument: Dokument) => BranaUpozorneniDokumentMutace<Dokument, Dokument> {
  return (dokument) => {
    const vysledek: Dokument = {
      ...dokument,
      posledniRychlySkupinovyScan: stav,
    };
    return { typ: "zapsat", dokument: vysledek, vysledek };
  };
}

function mutaceCheckpoint(
  datumVPraze: string,
  pristiPo: string,
): (dokument: Dokument) => BranaUpozorneniDokumentMutace<Dokument, Dokument> {
  return (dokument) => {
    if (dokument.pristiDlouhodobaKontrola !== datumVPraze) {
      throw new Error(
        "Kotva pristiDlouhodobaKontrola neodpovídá datu právě dokončeného checkpointu.",
      );
    }
    const vysledek: Dokument = {
      ...dokument,
      posledniDokoncenaDlouhodobaKontrola: datumVPraze,
      pristiDlouhodobaKontrola: pristiPo,
    };
    return { typ: "zapsat", dokument: vysledek, vysledek };
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

  io(): BranaUpozorneniCasIo<Dokument> {
    return {
      nacist: () => this.nacist(),
      vychoziDokument,
      validovat,
      ulozit: (dokument, etag) => this.ulozit(dokument, etag),
      jePreconditionChyba: (error) =>
        error instanceof BlobPreconditionFailedError,
    };
  }
}

async function zapsat(
  blob: FalesnyBlob,
  mutator: (dokument: Dokument) => BranaUpozorneniDokumentMutace<
    Dokument,
    unknown
  >,
): Promise<unknown> {
  return zmenitUpozorneniDokumentAtomickySIo(blob.io(), mutator);
}

async function zapsatSeStalymPrvnimCtenim(
  blob: FalesnyBlob,
  stale: { dokument: Dokument; etag: string },
  mutator: (dokument: Dokument) => BranaUpozorneniDokumentMutace<
    Dokument,
    unknown
  >,
): Promise<unknown> {
  let prvni = true;
  const io: BranaUpozorneniCasIo<Dokument> = {
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
    vychoziDokument,
    validovat,
    ulozit: (dokument, etag) => blob.ulozit(dokument, etag),
    jePreconditionChyba: (error) =>
      error instanceof BlobPreconditionFailedError,
  };
  return zmenitUpozorneniDokumentAtomickySIo(io, mutator);
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
  const pocatek = pocatecniDokument();
  const razitko = scanRazitko("2026-08-21T07:00:00.000Z");
  const push = pushSubscription();

  {
    const blob = new FalesnyBlob(pocatek);
    await zapsat(blob, mutacePristi("2026-08-24"));
    assert(
      blob.heads === 1 &&
        blob.gets === 1 &&
        blob.puts === 1 &&
        blob.putIfMatch[0] === '"api-1"' &&
        blob.dokument.pristiDlouhodobaKontrola === "2026-08-24" &&
        blob.dokument.posledniDokoncenaDlouhodobaKontrola === KOTVA_DOKONCENA,
      "A: běžný zápis = HEAD + GET + PUT",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    await zapsat(blob, mutacePristi("2026-08-24"));
    const ifMatch = blob.putIfMatch[0];
    assert(
      blob.putIfMatch.length === 1 && ifMatch === '"api-1"',
      "B: ifMatch = API etag z HEAD",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    const revize = { dokument: klon(blob.dokument), etag: blob.etag };
    await zapsat(blob, mutacePristi("2026-08-24"));
    blob.resetCitace();
    await zapsatSeStalymPrvnimCtenim(
      blob,
      revize,
      mutacePushZapnout(push),
    );
    assert(
      blob.dokument.pristiDlouhodobaKontrola === "2026-08-24" &&
        blob.dokument.upozorneniAktivni === true &&
        blob.dokument.pushSubscription?.endpoint === push.endpoint &&
        blob.heads === 2 &&
        blob.gets === 2 &&
        blob.puts === 2 &&
        blob.putIfMatch[0] === '"api-1"' &&
        blob.putIfMatch[1] === '"api-2"',
      "C: PUT e1 → 412, nový HEAD e2, nový GET, mutace, PUT e2 → úspěch",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    const revize = { dokument: klon(blob.dokument), etag: blob.etag };
    await zapsat(blob, mutacePristi("2026-08-24"));
    await zapsatSeStalymPrvnimCtenim(
      blob,
      revize,
      mutacePushZapnout(push),
    );
    assert(
      blob.dokument.pristiDlouhodobaKontrola === "2026-08-24" &&
        blob.dokument.upozorneniAktivni === true &&
        blob.dokument.pushSubscription?.endpoint === push.endpoint &&
        blob.dokument.posledniDokoncenaDlouhodobaKontrola === KOTVA_DOKONCENA,
      "D: dva writery, dvě pole → obě změny zůstávají",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    const revize = { dokument: klon(blob.dokument), etag: blob.etag };
    await zapsat(blob, mutaceSchvalenoDo(SCHVALENO_DO));
    await zapsatSeStalymPrvnimCtenim(
      blob,
      revize,
      mutaceRazitkoRychly(razitko),
    );
    assert(
      blob.dokument.schvalenoDoIso === SCHVALENO_DO &&
        blob.dokument.posledniRychlySkupinovyScan?.dokoncenoAt ===
          razitko.dokoncenoAt &&
        blob.dokument.pristiDlouhodobaKontrola === KOTVA_PRISTI,
      "E: schvalenoDoIso × scan razítko → obě změny zůstávají",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    const revize = { dokument: klon(blob.dokument), etag: blob.etag };
    await zapsat(
      blob,
      mutaceCheckpoint(KOTVA_PRISTI, KOTVA_PO_CHECKPOINTU),
    );
    await zapsatSeStalymPrvnimCtenim(
      blob,
      revize,
      mutaceSchvalenoDo(SCHVALENO_DO),
    );
    assert(
      blob.dokument.posledniDokoncenaDlouhodobaKontrola === KOTVA_PRISTI &&
        blob.dokument.pristiDlouhodobaKontrola === KOTVA_PO_CHECKPOINTU &&
        blob.dokument.schvalenoDoIso === SCHVALENO_DO,
      "F: checkpoint zachová obě kotvy a schvalenoDoIso také zůstane",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    blob.vzdyPrecondition = true;
    let chyba: unknown;
    try {
      await zapsat(blob, mutaceSchvalenoDo(SCHVALENO_DO));
    } catch (error) {
      chyba = error;
    }
    assert(
      chyba instanceof BranaUpozorneniCasKonfliktLimitError &&
        blob.heads === BRANA_UPOZORNENI_CAS_MAX_POKUSU &&
        blob.gets === BRANA_UPOZORNENI_CAS_MAX_POKUSU &&
        blob.puts === BRANA_UPOZORNENI_CAS_MAX_POKUSU &&
        blob.dokument.schvalenoDoIso === null,
      "G: 8× 412 → fail-closed, žádný předstíraný úspěch",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    blob.putChyby = [new Error("síťová chyba")];
    let chyba: unknown;
    try {
      await zapsat(blob, mutaceSchvalenoDo(SCHVALENO_DO));
    } catch (error) {
      chyba = error;
    }
    assert(
      chyba instanceof Error &&
        chyba.message === "síťová chyba" &&
        !(chyba instanceof BranaUpozorneniCasKonfliktLimitError) &&
        blob.heads === 1 &&
        blob.gets === 1 &&
        blob.puts === 1 &&
        blob.dokument.schvalenoDoIso === null,
      "H: jiná chyba se nere-tryuje a failuje",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    await zapsat(blob, mutaceSchvalenoDo(SCHVALENO_DO));
    const storagePouzity = blob.putIfMatch.some(
      (hodnota) =>
        hodnota === `W/"storage-1"` || hodnota === blob.storageEtag,
    );
    assert(
      !storagePouzity &&
        blob.putIfMatch.every(
          (hodnota) =>
            typeof hodnota === "string" && hodnota.startsWith('"api-'),
        ),
      "I: ifMatch používá HEAD/API etag, ne storage GET etag",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    blob.neexistuje = true;
    await zapsat(blob, mutacePristi(KOTVA_PRISTI));
    assert(
      blob.heads === 1 &&
        blob.gets === 0 &&
        blob.puts === 1 &&
        blob.putIfMatch[0] === null &&
        blob.dokument.pristiDlouhodobaKontrola === KOTVA_PRISTI,
      "HEAD 404 → výchozí dokument, první PUT bez ifMatch",
    );
  }

  const root = join(__dirname, "..");
  const uloziste = readFileSync(
    join(root, "src/lib/brana/admin/upozorneni-uloziste.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const cas = readFileSync(
    join(root, "src/lib/brana/admin/upozorneni-cas.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const actions = readFileSync(
    join(root, "src/app/brana/admin/actions.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");

  assert(
    cas.includes("zmenitUpozorneniDokumentAtomickySIo") &&
      cas.includes("BRANA_UPOZORNENI_CAS_MAX_POKUSU = 8") &&
      cas.includes("jePreconditionChyba") &&
      !cas.includes("put("),
    "zdroj: CAS smyčka Upozornění je čistá, bez produkčního PUT",
  );

  const writery = [
    "export async function ulozitPristiDlouhodobouKontrolu",
    "export async function ulozitSchvalenoDoIsoPoSchvaleniKontrolnihoBloku",
    "export async function ulozitPushSubscription",
    "export async function vypnoutPushSubscription",
    "export async function ulozitPosledniSkupinovyScanProScheduler",
    "export async function dokoncitDlouhodobouKontroluProScheduler",
    "export async function ulozitPosledniUpozorneniRychleProScheduler",
    "export async function ulozitPosledniUpozorneniDlouhodobeProScheduler",
    "export async function ulozitPosledniUpozorneniAsistovaneKotvuProScheduler",
  ];
  const writeryNaCas = writery.every((hlavicka) => {
    const telo = teloFunkce(uloziste, hlavicka);
    return telo.includes("zmenitUpozorneniDokumentAtomicky(");
  });
  assert(
    writeryNaCas && writery.length === 9,
    "J: všech 9 writerů volá jediný CAS helper",
  );

  const teloCheckpoint = teloFunkce(
    uloziste,
    "export async function dokoncitDlouhodobouKontroluProScheduler",
  );
  assert(
    teloCheckpoint.includes("posledniDokoncenaDlouhodobaKontrola") &&
      teloCheckpoint.includes("pristiDlouhodobaKontrola: dalsi.pristi") &&
      (teloCheckpoint.match(/zmenitUpozorneniDokumentAtomicky\(/g) ?? [])
        .length === 1,
    "F/J: checkpoint mění obě kotvy v jedné atomické mutaci",
  );

  const putVyskytu = (uloziste.match(/await put\(/g) ?? []).length;
  const teloPut = teloFunkce(
    uloziste,
    "async function ulozitDokumentSIfMatch",
  );
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
      !uloziste.includes("nacistNeboVychoziDokument") &&
      !uloziste.includes("blob.etag") &&
      !uloziste.includes("vysledek.blob"),
    "K: jediný PUT tohoto Blobu je chráněný ifMatch; starý PUT odstraněn",
  );

  const teloSchvalit = teloFunkce(
    actions,
    "export async function schvalitKontroluAkce",
  );
  const iNacist = teloSchvalit.indexOf("nacistUpozorneniNastaveni(");
  const iKalendar = teloSchvalit.indexOf("schvalitKontroluKonkretnichUdalosti(");
  const iUpozorneni = teloSchvalit.indexOf(
    "ulozitSchvalenoDoIsoPoSchvaleniKontrolnihoBloku(",
  );
  const iRevalidate = teloSchvalit.indexOf("revalidatePath(");
  assert(
    iNacist >= 0 &&
      iKalendar > iNacist &&
      iUpozorneni > iKalendar &&
      iRevalidate > iUpozorneni,
    "L: pořadí Schválit kontrolu v actions.ts se nezměnilo",
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
  console.log("\nVšechny kontroly CAS Upozornění prošly.");
}

void hlavni();
