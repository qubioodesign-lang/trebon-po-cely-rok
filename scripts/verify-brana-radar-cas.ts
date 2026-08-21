/**
 * Fixture CAS / ifMatch pro data/brana-radar.json.
 * Bez produkčního Blob WRITE. Spuštění:
 * npx tsx scripts/verify-brana-radar-cas.ts
 */

import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";
import { BlobPreconditionFailedError } from "@vercel/blob";
import {
  BRANA_RADAR_CAS_MAX_POKUSU,
  BranaRadarCasKonfliktLimitError,
  zmenitRadarDokumentAtomickySIo,
  type BranaRadarCasIo,
  type BranaRadarDokumentMutace,
} from "../src/lib/brana/admin/radar-cas";
import {
  BRANA_RADAR_PUVOD_POUZITO,
  jeStejnyRadarDokument,
  pouzitRadarStopu,
  smazatRadarStopu,
  uklidRadarDokument,
  vychoziRadarDokument,
  vytvoritRadarOtiskKlic,
  zapsatRadarScanDoDokumentu,
  type BranaRadarDokument,
  type BranaRadarPracovniStopa,
  type BranaRadarScanKandidatVstup,
} from "../src/lib/brana/admin/radar";

type Dokument = BranaRadarDokument;

const DNES = "2026-08-21";
const DATUM_AKTIVNI = "2026-08-26";
const DATUM_PROSLE = "2026-08-01";
const TED = "2026-08-21T07:00:00.000Z";

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

function stopa(
  id: string,
  nazev: string,
  datumOd: string,
  vstupId = "vstup-1",
): BranaRadarPracovniStopa {
  return {
    id,
    radarVstupId: vstupId,
    datumOd,
    cas: "17:00",
    nazev,
    kde: "Třeboň",
    url: "https://priklad.cz/radar",
    nalezenoAt: TED,
  };
}

function dokumentZ(pracovni: BranaRadarPracovniStopa[]): Dokument {
  return {
    ...vychoziRadarDokument(),
    pracovni,
  };
}

function kandidatZeStopy(
  s: BranaRadarPracovniStopa,
): BranaRadarScanKandidatVstup {
  return {
    radarVstupId: s.radarVstupId,
    datumOd: s.datumOd,
    cas: s.cas,
    nazev: s.nazev,
    kde: s.kde,
    url: s.url,
  };
}

function validovat(dokument: Dokument): Dokument | null {
  if (!dokument || typeof dokument !== "object") {
    return null;
  }
  if (!Array.isArray(dokument.pracovni) || !Array.isArray(dokument.historie)) {
    return null;
  }
  return dokument;
}

function mutaceUklid(
  dnesIso: string,
): (dokument: Dokument) => BranaRadarDokumentMutace<Dokument, Dokument> {
  return (dokument) => {
    const uklizeny = uklidRadarDokument(dokument, dnesIso);
    if (jeStejnyRadarDokument(dokument, uklizeny)) {
      return { typ: "bezZmeny", vysledek: uklizeny };
    }
    return { typ: "zapsat", dokument: uklizeny, vysledek: uklizeny };
  };
}

function mutacePouzit(
  id: string,
): (dokument: Dokument) => BranaRadarDokumentMutace<Dokument, undefined> {
  return (dokument) => {
    const uklizeny = uklidRadarDokument(dokument, DNES);
    const po = pouzitRadarStopu(uklizeny, id, { tedIso: TED });
    if ("chyba" in po) {
      throw new Error(po.chyba);
    }
    return { typ: "zapsat", dokument: po, vysledek: undefined };
  };
}

function mutaceSmazat(
  id: string,
): (dokument: Dokument) => BranaRadarDokumentMutace<Dokument, undefined> {
  return (dokument) => {
    const uklizeny = uklidRadarDokument(dokument, DNES);
    const po = smazatRadarStopu(uklizeny, id);
    if ("chyba" in po) {
      throw new Error(po.chyba);
    }
    return { typ: "zapsat", dokument: po, vysledek: undefined };
  };
}

function mutaceScan(
  kandidati: readonly BranaRadarScanKandidatVstup[],
  noveId: () => string,
): (dokument: Dokument) => BranaRadarDokumentMutace<Dokument, undefined> {
  return (dokument) => {
    const uklizeny = uklidRadarDokument(dokument, DNES);
    const po = zapsatRadarScanDoDokumentu(uklizeny, kandidati, {
      tedIso: TED,
      noveId,
      dnesIso: DNES,
      behDokoncen: true,
    });
    if (jeStejnyRadarDokument(dokument, po)) {
      return { typ: "bezZmeny", vysledek: undefined };
    }
    return { typ: "zapsat", dokument: po, vysledek: undefined };
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

  io(): BranaRadarCasIo<Dokument> {
    return {
      nacist: () => this.nacist(),
      vychoziDokument: vychoziRadarDokument,
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
  ) => BranaRadarDokumentMutace<Dokument, unknown>,
): Promise<unknown> {
  return zmenitRadarDokumentAtomickySIo(blob.io(), mutator);
}

async function zapsatSeStalymPrvnimCtenim(
  blob: FalesnyBlob,
  stale: { dokument: Dokument; etag: string },
  mutator: (
    dokument: Dokument,
  ) => BranaRadarDokumentMutace<Dokument, unknown>,
): Promise<unknown> {
  let prvni = true;
  const io: BranaRadarCasIo<Dokument> = {
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
    vychoziDokument: vychoziRadarDokument,
    validovat,
    ulozit: (dokument, etag) => blob.ulozit(dokument, etag),
    jePreconditionChyba: (error) =>
      error instanceof BlobPreconditionFailedError,
  };
  return zmenitRadarDokumentAtomickySIo(io, mutator);
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
  const a = stopa("id-a", "Stopa A", DATUM_AKTIVNI, "vstup-a");
  const b = stopa("id-b", "Stopa B", DATUM_AKTIVNI, "vstup-b");
  const prosle = stopa("id-prosle", "Stopa stará", DATUM_PROSLE, "vstup-x");
  const nova = stopa("id-nova", "Stopa nová", DATUM_AKTIVNI, "vstup-c");
  const pocatek = dokumentZ([a, b]);

  {
    const blob = new FalesnyBlob(pocatek);
    await zapsat(blob, mutacePouzit("id-a"));
    const ifMatch = blob.putIfMatch[0];
    assert(
      blob.heads === 1 &&
        blob.gets === 1 &&
        blob.puts === 1 &&
        ifMatch === '"api-1"' &&
        !blob.dokument.pracovni.some((s) => s.id === "id-a") &&
        blob.dokument.pracovni.some((s) => s.id === "id-b"),
      "A: běžný zápis = HEAD + GET + PUT",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    await zapsat(blob, mutacePouzit("id-a"));
    const ifMatch = blob.putIfMatch[0];
    assert(
      blob.putIfMatch.length === 1 && ifMatch === '"api-1"',
      "B: ifMatch = API etag z HEAD",
    );
  }

  {
    const blob = new FalesnyBlob(dokumentZ([a, b, prosle]));
    const revize = { dokument: klon(blob.dokument), etag: blob.apiEtag };
    await zapsat(blob, mutacePouzit("id-a"));
    blob.heads = 0;
    blob.gets = 0;
    blob.puts = 0;
    blob.putIfMatch = [];
    await zapsatSeStalymPrvnimCtenim(blob, revize, mutaceSmazat("id-b"));
    assert(
      !blob.dokument.pracovni.some((s) => s.id === "id-a") &&
        !blob.dokument.pracovni.some((s) => s.id === "id-b") &&
        !blob.dokument.pracovni.some((s) => s.id === "id-prosle") &&
        blob.heads === 2 &&
        blob.gets === 2 &&
        blob.puts === 2 &&
        blob.putIfMatch[0] === '"api-1"' &&
        blob.putIfMatch[1] === '"api-2"',
      "C: PUT e1 → 412, nový HEAD e2, nový GET, úklid, mutace, PUT e2 → úspěch",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    const revize = { dokument: klon(blob.dokument), etag: blob.apiEtag };
    await zapsat(blob, mutacePouzit("id-a"));
    await zapsatSeStalymPrvnimCtenim(blob, revize, mutaceSmazat("id-b"));
    const historieA = blob.dokument.historie.filter(
      (h) => h.id === "id-a" && h.puvod === BRANA_RADAR_PUVOD_POUZITO,
    );
    const otiskA = vytvoritRadarOtiskKlic(a);
    const otiskB = vytvoritRadarOtiskKlic(b);
    assert(
      !blob.dokument.pracovni.some((s) => s.id === "id-a") &&
        !blob.dokument.pracovni.some((s) => s.id === "id-b") &&
        historieA.length === 1 &&
        blob.dokument.smazatOtisky.some((o) => o.klic === otiskA) &&
        blob.dokument.smazatOtisky.some((o) => o.klic === otiskB) &&
        !blob.dokument.historie.some((h) => h.id === "id-b"),
      "D: Použít A × Smazat B → historie jen A, otisky A i B",
    );
  }

  {
    const blob = new FalesnyBlob(dokumentZ([prosle]));
    const revize = { dokument: klon(blob.dokument), etag: blob.apiEtag };
    await zapsat(
      blob,
      mutaceScan([kandidatZeStopy(nova)], () => "id-nova"),
    );
    await zapsatSeStalymPrvnimCtenim(blob, revize, mutaceUklid(DNES));
    assert(
      blob.dokument.pracovni.some((s) => s.nazev === "Stopa nová") &&
        !blob.dokument.pracovni.some((s) => s.id === "id-prosle") &&
        blob.dokument.posledniBehAt === TED,
      "E: scan přidá novou × úklid prošlé → nová zůstane, prošlá zmizí, posledniBehAt",
    );
  }

  {
    const blob = new FalesnyBlob(dokumentZ([a]));
    const revize = { dokument: klon(blob.dokument), etag: blob.apiEtag };
    await zapsat(
      blob,
      mutaceScan([kandidatZeStopy(nova)], () => "id-nova"),
    );
    await zapsatSeStalymPrvnimCtenim(blob, revize, mutacePouzit("id-a"));
    assert(
      blob.dokument.pracovni.some((s) => s.nazev === "Stopa nová") &&
        !blob.dokument.pracovni.some((s) => s.id === "id-a") &&
        blob.dokument.historie.some(
          (h) => h.id === "id-a" && h.puvod === BRANA_RADAR_PUVOD_POUZITO,
        ) &&
        blob.dokument.posledniBehAt === TED,
      "F: scan × Použít jiné id → obě operace zachovány",
    );
  }

  {
    const blob = new FalesnyBlob(dokumentZ([prosle]));
    const revize = { dokument: klon(blob.dokument), etag: blob.apiEtag };
    await zapsat(
      blob,
      mutaceScan([kandidatZeStopy(nova)], () => "id-nova"),
    );
    await zapsatSeStalymPrvnimCtenim(blob, revize, mutaceUklid(DNES));
    assert(
      blob.dokument.pracovni.some((s) => s.nazev === "Stopa nová") &&
        !blob.dokument.pracovni.some((s) => s.id === "id-prosle") &&
        blob.dokument.posledniBehAt === TED,
      "G: úklid při čtení × scan writer → nové stopy i úklid, žádný lost update",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    blob.vzdyPrecondition = true;
    let chyba: unknown;
    try {
      await zapsat(blob, mutacePouzit("id-a"));
    } catch (error) {
      chyba = error;
    }
    assert(
      chyba instanceof BranaRadarCasKonfliktLimitError &&
        blob.heads === BRANA_RADAR_CAS_MAX_POKUSU &&
        blob.gets === BRANA_RADAR_CAS_MAX_POKUSU &&
        blob.puts === BRANA_RADAR_CAS_MAX_POKUSU &&
        blob.dokument.pracovni.some((s) => s.id === "id-a"),
      "H: 8× 412 u explicitního writeru → fail-closed",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    blob.putChyby = [new Error("síťová chyba")];
    let chyba: unknown;
    try {
      await zapsat(blob, mutacePouzit("id-a"));
    } catch (error) {
      chyba = error;
    }
    assert(
      chyba instanceof Error &&
        chyba.message === "síťová chyba" &&
        !(chyba instanceof BranaRadarCasKonfliktLimitError) &&
        blob.heads === 1 &&
        blob.gets === 1 &&
        blob.puts === 1 &&
        blob.dokument.pracovni.some((s) => s.id === "id-a"),
      "I: jiná chyba se nere-tryuje a failuje",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    await zapsat(blob, mutacePouzit("id-a"));
    const storagePouzity = blob.putIfMatch.some((hodnota) =>
      typeof hodnota === "string" ? hodnota.startsWith("W/") : false,
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
    await zapsat(
      blob,
      mutaceScan([kandidatZeStopy(nova)], () => "id-nova"),
    );
    assert(
      blob.heads === 1 &&
        blob.gets === 0 &&
        blob.puts === 1 &&
        blob.putIfMatch[0] === null &&
        blob.dokument.pracovni.some((s) => s.nazev === "Stopa nová"),
      "HEAD 404 explicitní writer → výchozí dokument, první PUT bez ifMatch",
    );
  }

  {
    const blob = new FalesnyBlob(vychoziRadarDokument());
    blob.neexistuje = true;
    const vysledek = await zapsat(blob, mutaceUklid(DNES));
    assert(
      blob.puts === 0 &&
        blob.putIfMatch.length === 0 &&
        Array.isArray((vysledek as Dokument).pracovni) &&
        (vysledek as Dokument).pracovni.length === 0,
      "HEAD 404 u úklidu čtení → prázdný RADAR, žádný PUT",
    );
  }

  const root = join(__dirname, "..");
  const uloziste = readFileSync(
    join(root, "src/lib/brana/admin/radar-uloziste.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const cas = readFileSync(
    join(root, "src/lib/brana/admin/radar-cas.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const radarLogika = readFileSync(
    join(root, "src/lib/brana/admin/radar.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const beh = readFileSync(
    join(root, "src/lib/brana/admin/radar-beh.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const scan = readFileSync(
    join(root, "src/lib/brana/admin/radar-scan.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const actions = readFileSync(
    join(root, "src/app/brana/admin/actions.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");

  assert(
    cas.includes("zmenitRadarDokumentAtomickySIo") &&
      cas.includes("BRANA_RADAR_CAS_MAX_POKUSU = 8") &&
      !cas.includes("put("),
    "zdroj: CAS smyčka RADARu je čistá, bez produkčního PUT",
  );

  const teloNacistJadro = teloFunkce(uloziste, "async function nacistRadarJadro");
  const teloRucni = teloFunkce(uloziste, "async function pridatRucniNalezJadro");
  const teloPouzit = teloFunkce(uloziste, "async function pouzitRadarStopuJadro");
  const teloSmazat = teloFunkce(uloziste, "async function smazatRadarStopuJadro");
  const teloScan = teloFunkce(
    uloziste,
    "export async function zapsatRadarScanProScheduler",
  );
  assert(
    teloNacistJadro.includes("zmenitRadarDokumentAtomicky(") &&
      teloRucni.includes("zmenitRadarDokumentAtomicky(") &&
      teloRucni.includes("noveId: () => `radar-${crypto.randomUUID()}`") &&
      teloPouzit.includes("zmenitRadarDokumentAtomicky(") &&
      teloSmazat.includes("zmenitRadarDokumentAtomicky(") &&
      teloScan.includes("zmenitRadarDokumentAtomicky(") &&
      teloScan.includes("noveId: () => `radar-${crypto.randomUUID()}`") &&
      teloFunkce(uloziste, "export async function pridatRucniRadarNalez").includes(
        "pridatRucniNalezJadro(",
      ) &&
      teloFunkce(
        uloziste,
        "export async function pouzitRadarPracovniStopu",
      ).includes("pouzitRadarStopuJadro(") &&
      teloFunkce(
        uloziste,
        "export async function smazatRadarPracovniStopu",
      ).includes("smazatRadarStopuJadro(") &&
      teloFunkce(uloziste, "export async function nacistRadar").includes(
        "nacistRadarJadro()",
      ),
    "K: všech 5 zápisových cest používá CAS helper",
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
      teloPut.includes("ifMatch: etag") &&
      teloPut.includes("allowOverwrite: true") &&
      teloPut.includes("cacheControlMaxAge: 0") &&
      uloziste.includes("useCache: false") &&
      indexHead >= 0 &&
      indexGet > indexHead &&
      !uloziste.includes("async function ulozitDokument(") &&
      !uloziste.includes("nacistDokumentProZapis") &&
      !uloziste.includes("blob.etag") &&
      !uloziste.includes("vysledek.blob"),
    "L: jediný PUT tohoto Blobu je chráněný ifMatch; starý PUT odstraněn",
  );

  assert(
    teloNacistJadro.includes('zalogovatChybuCteni("úklid se neuložil"') &&
      teloNacistJadro.includes("nacistRadarJenCteniUklidene") &&
      teloNacistJadro.includes("return { ok: true, pracovni:") &&
      !teloNacistJadro.includes("throw new BranaRadarCasKonfliktLimitError") &&
      teloPouzit.includes("throw new Error(po.chyba)") &&
      teloSmazat.includes("throw new Error(po.chyba)"),
    "M: fail-soft úklid při čtení zachován; explicitní writery fail-closed",
  );

  assert(
    radarLogika.includes("uklidRadarDokument") &&
      !beh.includes("zmenitRadarDokumentAtomicky") &&
      !scan.includes("await put(") &&
      teloFunkce(
        actions,
        "export async function pouzitBranaRadarStopuAkce",
      ).includes("pouzitRadarPracovniStopu("),
    "radar.ts / radar-beh.ts / radar-scan.ts / actions.ts se nemění",
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
    tscOk ? "N: npx tsc --noEmit" : `N: npx tsc --noEmit\n${tscVystup}`,
  );

  if (selhalo > 0) {
    console.error(`\nSelhalo: ${selhalo}`);
    process.exit(1);
  }
  console.log("\nVšechny kontroly CAS RADARu prošly.");
}

void hlavni();
