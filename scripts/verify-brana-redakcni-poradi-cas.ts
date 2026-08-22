/**
 * Fixture PATCH + field-level CAS pro data/brana-redakcni-poradi.json.
 * Bez produkčního Blob WRITE. Spuštění:
 * npx tsx scripts/verify-brana-redakcni-poradi-cas.ts
 */

import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";
import { BlobPreconditionFailedError } from "@vercel/blob";
import {
  BRANA_REDAKCNI_CAS_MAX_POKUSU,
  BranaRedakcniCasKonfliktLimitError,
  zmenitRedakcniPoradiDokumentAtomickySIo,
  type BranaRedakcniCasIo,
  type BranaRedakcniDokumentMutace,
} from "../src/lib/brana/admin/redakcni-poradi-cas";
import {
  aplikovatRedakcniPoradiPatcheNaPolozky,
  BranaRedakcniFieldKonfliktError,
  BranaRedakcniPatchNeplatnyError,
  parsovatRedakcniPoradiPatche,
  sestavitRedakcniPoradiPatche,
  validovatRedakcniPoradiDokument,
  type BranaRedakcniPatchZmena,
} from "../src/lib/brana/admin/redakcni-poradi-validace";
import {
  vytvoritVychoziRedakcniPoradi,
  type BranaRedakcniPolozkaStav,
} from "../src/lib/brana/admin/redakcni-kostra";

type Dokument = {
  verzeUloziste: number;
  polozky: BranaRedakcniPolozkaStav[];
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

function dokumentZ(polozky: BranaRedakcniPolozkaStav[]): Dokument {
  return { verzeUloziste: 2, polozky: klon(polozky) };
}

function nastavit(
  polozky: readonly BranaRedakcniPolozkaStav[],
  id: string,
  zmena: Partial<BranaRedakcniPolozkaStav>,
): BranaRedakcniPolozkaStav[] {
  return polozky.map((radek) =>
    radek.id === id
      ? { ...radek, ...zmena, id: radek.id, mimoKostru: radek.mimoKostru }
      : radek,
  );
}

function hodnota(
  polozky: readonly BranaRedakcniPolozkaStav[],
  id: string,
  pole: keyof BranaRedakcniPolozkaStav,
): unknown {
  const radek = polozky.find((p) => p.id === id);
  return radek ? radek[pole] : undefined;
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
  poPrvnim412: (() => void) | null = null;

  constructor(dokument: Dokument, revize = 1) {
    this.dokument = klon(dokument);
    this.apiEtag = `"api-${revize}"`;
    this.storageEtag = `W/"storage-${revize}"`;
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
      if (this.poPrvnim412) {
        this.poPrvnim412();
        this.poPrvnim412 = null;
      }
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

  io(): BranaRedakcniCasIo<Dokument> {
    return {
      nacist: () => this.nacist(),
      vychoziDokument: () => dokumentZ(vytvoritVychoziRedakcniPoradi()),
      validovat: (dokument) => validovatRedakcniPoradiDokument(dokument),
      ulozit: (dokument, etag) => this.ulozit(dokument, etag),
      jePreconditionChyba: (error) =>
        error instanceof BlobPreconditionFailedError,
    };
  }
}

function mutatorPatche(
  patche: readonly BranaRedakcniPatchZmena[],
): (dokument: Dokument) => BranaRedakcniDokumentMutace<Dokument, Dokument> {
  return (dokument) => {
    if (patche.length === 0) {
      return { typ: "bezZmeny", vysledek: dokument };
    }
    const po = aplikovatRedakcniPoradiPatcheNaPolozky(dokument.polozky, patche);
    const overeny = validovatRedakcniPoradiDokument({
      verzeUloziste: 2,
      polozky: po,
    });
    if (!overeny) {
      throw new Error("Výsledný dokument neprošel validací. Nic nebylo uloženo.");
    }
    return { typ: "zapsat", dokument: overeny, vysledek: overeny };
  };
}

async function ulozitPanel(
  blob: FalesnyBlob,
  zaklad: readonly BranaRedakcniPolozkaStav[],
  aktualni: readonly BranaRedakcniPolozkaStav[],
): Promise<Dokument> {
  const patche = sestavitRedakcniPoradiPatche(zaklad, aktualni);
  return zmenitRedakcniPoradiDokumentAtomickySIo(
    blob.io(),
    mutatorPatche(patche),
  );
}

async function hlavni(): Promise<void> {
  const seed = vytvoritVychoziRedakcniPoradi();
  const idAno = seed.find((p) => p.pouzivat === "ANO")?.id;
  const ne = seed.filter((p) => p.pouzivat === "NE");
  const idNe1 = ne[0]?.id;
  const idNe2 = ne[1]?.id;
  if (!idAno || !idNe1 || !idNe2) {
    throw new Error("Seed nemá očekávané ANO/NE položky.");
  }

  const pocatek = dokumentZ(
    nastavit(nastavit(seed, idNe1, { priorita: 10, poznamka: "původní" }), idNe2, {
      subpriorita: 1,
      poznamka: "druhá",
    }),
  );

  {
    const blob = new FalesnyBlob(pocatek);
    const aktualni = nastavit(pocatek.polozky, idNe1, { priorita: 20 });
    const vysledek = await ulozitPanel(blob, pocatek.polozky, aktualni);
    const patche = sestavitRedakcniPoradiPatche(pocatek.polozky, aktualni);
    assert(
      patche.length === 1 &&
        patche[0]?.id === idNe1 &&
        patche[0]?.pole === "priorita" &&
        hodnota(vysledek.polozky, idNe1, "priorita") === 20 &&
        blob.puts === 1,
      "A: jeden panel, jedno pole, jedno id → uloží se",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    const aktualni = nastavit(
      nastavit(pocatek.polozky, idNe1, { priorita: 20, poznamka: "nová" }),
      idNe2,
      { subpriorita: 7 },
    );
    const vysledek = await ulozitPanel(blob, pocatek.polozky, aktualni);
    const patche = sestavitRedakcniPoradiPatche(pocatek.polozky, aktualni);
    assert(
      patche.length === 3 &&
        blob.puts === 1 &&
        hodnota(vysledek.polozky, idNe1, "priorita") === 20 &&
        hodnota(vysledek.polozky, idNe1, "poznamka") === "nová" &&
        hodnota(vysledek.polozky, idNe2, "subpriorita") === 7,
      "B: jeden panel, více polí / id → jeden balík, jeden PUT",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    const a = nastavit(pocatek.polozky, idNe1, { priorita: 20 });
    await ulozitPanel(blob, pocatek.polozky, a);
    const b = nastavit(pocatek.polozky, idNe2, { subpriorita: 9 });
    const vysledek = await ulozitPanel(blob, pocatek.polozky, b);
    assert(
      hodnota(vysledek.polozky, idNe1, "priorita") === 20 &&
        hodnota(vysledek.polozky, idNe2, "subpriorita") === 9,
      "C: A priorita id1 × B subpriorita id2 → obě změny",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    const a = nastavit(pocatek.polozky, idNe1, { priorita: 20 });
    await ulozitPanel(blob, pocatek.polozky, a);
    const b = nastavit(pocatek.polozky, idNe1, { poznamka: "sloučená" });
    const vysledek = await ulozitPanel(blob, pocatek.polozky, b);
    assert(
      hodnota(vysledek.polozky, idNe1, "priorita") === 20 &&
        hodnota(vysledek.polozky, idNe1, "poznamka") === "sloučená",
      "D: A priorita id1 × B poznámka id1 → merge",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    const a = nastavit(pocatek.polozky, idNe1, { priorita: 20 });
    await ulozitPanel(blob, pocatek.polozky, a);
    const b = nastavit(pocatek.polozky, idNe1, { priorita: 30 });
    let chyba: unknown;
    try {
      await ulozitPanel(blob, pocatek.polozky, b);
    } catch (error) {
      chyba = error;
    }
    assert(
      chyba instanceof BranaRedakcniFieldKonfliktError &&
        chyba.id === idNe1 &&
        chyba.pole === "priorita" &&
        hodnota(blob.dokument.polozky, idNe1, "priorita") === 20,
      "E: stejná priorita stejného id → field conflict, zůstane 20",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    const a = nastavit(pocatek.polozky, idAno, { pouzivat: "NE" });
    const patcheA = sestavitRedakcniPoradiPatche(pocatek.polozky, a);
    await ulozitPanel(blob, pocatek.polozky, a);
    const b = nastavit(pocatek.polozky, idNe2, { poznamka: "jiná" });
    const vysledek = await ulozitPanel(blob, pocatek.polozky, b);
    assert(
      patcheA.length === 1 &&
        patcheA[0]?.pole === "pouzivat" &&
        hodnota(vysledek.polozky, idAno, "pouzivat") === "NE" &&
        hodnota(vysledek.polozky, idNe2, "poznamka") === "jiná",
      "F: ANO→NE id1 × změna id2 → obě; jen patch pouzivat",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    const a = nastavit(pocatek.polozky, idNe1, { pouzivat: "ANO" });
    const patcheA = sestavitRedakcniPoradiPatche(pocatek.polozky, a);
    await ulozitPanel(blob, pocatek.polozky, a);
    const b = nastavit(pocatek.polozky, idNe2, { poznamka: "po G" });
    const vysledek = await ulozitPanel(blob, pocatek.polozky, b);
    assert(
      patcheA.length === 1 &&
        patcheA[0]?.pole === "pouzivat" &&
        hodnota(vysledek.polozky, idNe1, "pouzivat") === "ANO" &&
        hodnota(vysledek.polozky, idNe2, "poznamka") === "po G",
      "G: NE→ANO id1 × změna id2 → obě; jen patch pouzivat",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    const a = nastavit(pocatek.polozky, idNe1, { priorita: 20 });
    await ulozitPanel(blob, pocatek.polozky, a);
    const b = nastavit(pocatek.polozky, idNe2, { poznamka: "jen druhá" });
    const patcheB = sestavitRedakcniPoradiPatche(pocatek.polozky, b);
    const vysledek = await ulozitPanel(blob, pocatek.polozky, b);
    assert(
      patcheB.length === 1 &&
        patcheB[0]?.id === idNe2 &&
        patcheB[0]?.pole === "poznamka" &&
        !patcheB.some((p) => p.pole === "priorita") &&
        hodnota(vysledek.polozky, idNe1, "priorita") === 20 &&
        hodnota(vysledek.polozky, idNe2, "poznamka") === "jen druhá",
      "H: starý panel nemění prioritu id1, posílá jen poznámku id2",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    blob.putChyby = [new BlobPreconditionFailedError()];
    const aktualni = nastavit(pocatek.polozky, idNe1, { priorita: 20 });
    const vysledek = await ulozitPanel(blob, pocatek.polozky, aktualni);
    assert(
      blob.heads === 2 &&
        blob.gets === 2 &&
        blob.puts === 2 &&
        hodnota(vysledek.polozky, idNe1, "priorita") === 20 &&
        blob.putIfMatch[0] === '"api-1"' &&
        blob.putIfMatch[1] === '"api-1"',
      "I: 412 → nový HEAD/GET → stejné patche → úspěch",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    blob.putChyby = [new BlobPreconditionFailedError()];
    blob.poPrvnim412 = () => {
      blob.dokument = dokumentZ(
        nastavit(blob.dokument.polozky, idNe1, { priorita: 20 }),
      );
    };
    const b = nastavit(pocatek.polozky, idNe1, { priorita: 30 });
    let chyba: unknown;
    try {
      await ulozitPanel(blob, pocatek.polozky, b);
    } catch (error) {
      chyba = error;
    }
    assert(
      chyba instanceof BranaRedakcniFieldKonfliktError &&
        blob.puts === 1 &&
        hodnota(blob.dokument.polozky, idNe1, "priorita") === 20,
      "J: 412 + mezitím stejné pole → field conflict, žádný druhý PUT",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    blob.vzdyPrecondition = true;
    const aktualni = nastavit(pocatek.polozky, idNe1, { priorita: 20 });
    let chyba: unknown;
    try {
      await ulozitPanel(blob, pocatek.polozky, aktualni);
    } catch (error) {
      chyba = error;
    }
    assert(
      chyba instanceof BranaRedakcniCasKonfliktLimitError &&
        blob.heads === BRANA_REDAKCNI_CAS_MAX_POKUSU &&
        blob.puts === BRANA_REDAKCNI_CAS_MAX_POKUSU &&
        hodnota(blob.dokument.polozky, idNe1, "priorita") === 10,
      "K: 8× 412 → fail-closed",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    blob.putChyby = [new Error("síťová chyba")];
    const aktualni = nastavit(pocatek.polozky, idNe1, { priorita: 20 });
    let chyba: unknown;
    try {
      await ulozitPanel(blob, pocatek.polozky, aktualni);
    } catch (error) {
      chyba = error;
    }
    assert(
      chyba instanceof Error &&
        chyba.message === "síťová chyba" &&
        !(chyba instanceof BranaRedakcniCasKonfliktLimitError) &&
        blob.heads === 1 &&
        blob.puts === 1 &&
        hodnota(blob.dokument.polozky, idNe1, "priorita") === 10,
      "L: jiná chyba se nere-tryuje",
    );
  }

  {
    const radekAno = pocatek.polozky.find((p) => p.id === idAno);
    const jazyk = radekAno?.jazykVerejny;
    if (!jazyk) {
      assert(false, "M: seed ANO položka musí mít jazykVerejny");
    } else {
      const blob = new FalesnyBlob(pocatek);
      const jazykA = {
        ...jazyk,
        co: { rezim: "PEVNE" as const, text: "Změna A" },
      };
      const jazykB = {
        ...jazyk,
        rozliseni: { rezim: "PEVNE" as const, text: "Změna B" },
      };
      const a = nastavit(pocatek.polozky, idAno, { jazykVerejny: jazykA });
      await ulozitPanel(blob, pocatek.polozky, a);
      const b = nastavit(pocatek.polozky, idAno, { jazykVerejny: jazykB });
      let chyba: unknown;
      try {
        await ulozitPanel(blob, pocatek.polozky, b);
      } catch (error) {
        chyba = error;
      }
      assert(
        chyba instanceof BranaRedakcniFieldKonfliktError &&
          chyba.pole === "jazykVerejny" &&
          JSON.stringify(hodnota(blob.dokument.polozky, idAno, "jazykVerejny")) ===
            JSON.stringify(jazykA),
        "M: jazykVerejny je jedno pole → druhý writer conflict",
      );
    }
  }

  {
    const neplatne = parsovatRedakcniPoradiPatche([
      {
        id: idNe1,
        pole: "mimoKostru",
        expectedOld: false,
        newValue: true,
      },
    ]);
    const idPole = parsovatRedakcniPoradiPatche([
      { id: idNe1, pole: "id", expectedOld: idNe1, newValue: "x" },
    ]);
    assert(
      neplatne.ok === false && idPole.ok === false,
      "N: patch nepovoleného pole je odmítnut",
    );
  }

  {
    let chyba: unknown;
    try {
      aplikovatRedakcniPoradiPatcheNaPolozky(pocatek.polozky, [
        {
          id: "neexistujici-id",
          pole: "poznamka",
          expectedOld: "",
          newValue: "x",
        },
      ]);
    } catch (error) {
      chyba = error;
    }
    assert(
      chyba instanceof BranaRedakcniPatchNeplatnyError,
      "O: patch neexistujícího id je odmítnut",
    );
  }

  {
    const blob = new FalesnyBlob(pocatek);
    const vysledek = await ulozitPanel(
      blob,
      pocatek.polozky,
      pocatek.polozky,
    );
    assert(
      blob.puts === 0 &&
        blob.putIfMatch.length === 0 &&
        hodnota(vysledek.polozky, idNe1, "priorita") === 10,
      "P: prázdný balík → žádný PUT, bezpečný úspěch",
    );
  }

  const root = join(__dirname, "..");
  const uloziste = readFileSync(
    join(root, "src/lib/brana/admin/redakcni-poradi-uloziste.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const actions = readFileSync(
    join(root, "src/app/brana/admin/actions.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const klient = readFileSync(
    join(root, "src/components/brana/admin/BranaAdminRedakcniPoradi.tsx"),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const cas = readFileSync(
    join(root, "src/lib/brana/admin/redakcni-poradi-cas.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");

  const teloAkceStart = actions.indexOf(
    "export async function ulozitBranaRedakcniPoradiAkce",
  );
  const teloAkceDalsi = actions.indexOf(
    "\nexport async function ",
    teloAkceStart + 10,
  );
  const teloAkce = actions.slice(
    teloAkceStart,
    teloAkceDalsi < 0 ? actions.length : teloAkceDalsi,
  );

  assert(
    uloziste.includes("ulozitRedakcniPoradiPatche") &&
      !uloziste.includes("export async function ulozitRedakcniPoradi(") &&
      teloAkce.includes("parsovatRedakcniPoradiPatche") &&
      teloAkce.includes("ulozitRedakcniPoradiPatche") &&
      !teloAkce.includes("validovatRedakcniPoradiVstup(polozky)") &&
      klient.includes("sestavitRedakcniPoradiPatche(zaklad, polozky)") &&
      klient.includes("setZaklad(vysledek.polozky)") &&
      !klient.includes("ulozitBranaRedakcniPoradiAkce(polozky)") &&
      cas.includes("zmenitRedakcniPoradiDokumentAtomickySIo") &&
      uloziste.includes("useCache: false") &&
      uloziste.includes("ifMatch: etag"),
    "Q: writer/action/klient používají patch model, starý snapshot write je pryč",
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
    tscOk ? "R: npx tsc --noEmit" : `R: npx tsc --noEmit\n${tscVystup}`,
  );

  if (selhalo > 0) {
    console.error(`\nSelhalo: ${selhalo}`);
    process.exit(1);
  }
  console.log("\nVšechny kontroly PATCH CAS Redakčního pořadí prošly.");
}

void hlavni();
