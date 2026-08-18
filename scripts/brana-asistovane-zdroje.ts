/**
 * Asistované zdroje BRÁNY — provozní orchestrátor.
 *
 * Fixture (žádný živý fetch, žádný zápis mezidokumentu):
 *   npx tsx scripts/brana-asistovane-zdroje.ts --fixture
 *
 * Provozní aktualizace (jen z tohoto PC):
 *   npx tsx scripts/brana-asistovane-zdroje.ts --aktualizovat
 *
 * Zápis mezidokumentu jen při OK. KONTROLA / STOP soubor nemění.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  BRANA_JKT_ITREBON_MEZIDOKUMENT_RELATIVNI_CESTA,
  MAX_KANDIDATU_JKT,
  nacistItrebonJktMezidokumentZeSouboru,
  parsovatItrebonDivadloJkTyla,
  parsovatItrebonJktMezidokument,
} from "../src/lib/brana/admin/divadlo-jk-tyla";
import {
  deduplikovatScanKandidaty,
  sestavItrebonKalendarUrlky,
  type BranaScanKandidat,
} from "../src/lib/brana/admin/zdroj-scan-parser";

const JKT_ID = "jkt";
const JKT_NAZEV = "Divadlo J. K. Tyla";
const JKT_URL = "https://www.itrebon.cz/kalendar.html";
const JKT_OCEKAVANO_STRAN = 12;
const JKT_MEZIDOKUMENT = BRANA_JKT_ITREBON_MEZIDOKUMENT_RELATIVNI_CESTA;
const JKT_POLE = [
  "zdrojIdentita",
  "nazev",
  "datumOd",
  "datumDo",
  "cas",
  "mistoNeboTyp",
] as const;

type StavAsistovanehoZdroje = "OK" | "KONTROLA" | "STOP";

type JktMezidokumentKandidat = {
  nazev: string;
  datumOd: string;
  datumDo: string;
  cas: string;
  mistoNeboTyp: string;
  zdrojIdentita: string;
};

type JktMezidokument = {
  vytvoreno: string;
  zdrojUrl: string;
  kandidati: JktMezidokumentKandidat[];
};

type AsistovanyZdroj = {
  id: string;
  nazev: string;
  mezidokumentRelativniCesta: string;
};

/** Seznam asistovaných zdrojů. Další zdroj = nová položka, stejný uživatelský pokyn. */
const ASISTOVANE_ZDROJE: readonly AsistovanyZdroj[] = [
  {
    id: JKT_ID,
    nazev: JKT_NAZEV,
    mezidokumentRelativniCesta: JKT_MEZIDOKUMENT,
  },
];

const JKT_VERIFY: readonly string[] = [
  "scripts/verify-brana-itrebon-jkt-parser.ts",
  "scripts/verify-brana-itrebon-jkt-mezidokument.ts",
  "scripts/verify-brana-itrebon-gbu-parser.ts",
  "scripts/verify-brana-hlidane-kotvy.ts",
  "scripts/verify-brana-scan-zdroj-identita.ts",
  "scripts/verify-brana-zdroj-identita-matching.ts",
];

type JktVyhodnoceni = {
  stav: StavAsistovanehoZdroje;
  duvod: string;
  stranNacteno: number;
  stranOcekavano: number;
  predchoziPocet: number;
  novyPocet: number;
  noveIdentity: string[];
  zmizeleIdentity: string[];
  dokument: JktMezidokument | null;
};

function mapovatKandidata(k: BranaScanKandidat): JktMezidokumentKandidat | string {
  const zdrojIdentita = k.zdrojIdentita?.trim() ?? "";
  if (!zdrojIdentita.startsWith("itrebon|")) {
    return `neplatná zdrojIdentita: ${k.nazev}`;
  }
  return {
    nazev: k.nazev,
    datumOd: k.datumOd,
    datumDo: k.datumDo,
    cas: k.cas,
    mistoNeboTyp: k.mistoNeboTyp,
    zdrojIdentita,
  };
}

function porovnatKandidaty(
  zParseru: readonly JktMezidokumentKandidat[],
  zJson: readonly JktMezidokumentKandidat[],
): string[] {
  const chyby: string[] = [];
  if (zParseru.length !== zJson.length) {
    chyby.push(`počet parser=${zParseru.length} json=${zJson.length}`);
  }
  const n = Math.max(zParseru.length, zJson.length);
  for (let i = 0; i < n; i++) {
    const a = zParseru[i];
    const b = zJson[i];
    if (!a || !b) {
      chyby.push(`index ${i}: chybí ${a ? "JSON" : "parser"}`);
      continue;
    }
    for (const klic of JKT_POLE) {
      if (a[klic] !== b[klic]) {
        chyby.push(
          `index ${i} ${klic}: parser=${JSON.stringify(a[klic])} json=${JSON.stringify(b[klic])}`,
        );
      }
    }
  }
  return chyby;
}

function rozdilIdentit(
  predchozi: readonly string[],
  nove: readonly string[],
): { noveIdentity: string[]; zmizeleIdentity: string[] } {
  const pred = new Set(predchozi);
  const ted = new Set(nove);
  return {
    noveIdentity: nove.filter((id) => !pred.has(id)),
    zmizeleIdentity: predchozi.filter((id) => !ted.has(id)),
  };
}

function identityZKandidatu(
  kandidati: readonly Pick<JktMezidokumentKandidat, "zdrojIdentita">[],
): string[] {
  return kandidati.map((k) => k.zdrojIdentita);
}

/**
 * Strojové vyhodnocení JKT obsahu. Nezapisuje soubor.
 * Počet kandidátů (18 / 20 / 24) sám o sobě není STOP ani KONTROLA.
 */
export function vyhodnotitJktObsah(vstup: {
  stranNacteno: number;
  stranOcekavano: number;
  zParseru: readonly BranaScanKandidat[];
  predchozi: readonly JktMezidokumentKandidat[];
  vytvoreno?: string;
}): JktVyhodnoceni {
  const prazdne = (duvod: string, stav: StavAsistovanehoZdroje): JktVyhodnoceni => ({
    stav,
    duvod,
    stranNacteno: vstup.stranNacteno,
    stranOcekavano: vstup.stranOcekavano,
    predchoziPocet: vstup.predchozi.length,
    novyPocet: 0,
    noveIdentity: [],
    zmizeleIdentity: identityZKandidatu(vstup.predchozi),
    dokument: null,
  });

  if (vstup.stranOcekavano !== JKT_OCEKAVANO_STRAN) {
    return prazdne(
      `očekáváno ${JKT_OCEKAVANO_STRAN} stran, sestaveno ${vstup.stranOcekavano}`,
      "STOP",
    );
  }
  if (vstup.stranNacteno !== vstup.stranOcekavano) {
    return prazdne(
      `nenačteny všechny strany (${vstup.stranNacteno}/${vstup.stranOcekavano})`,
      "STOP",
    );
  }

  const namapovane: JktMezidokumentKandidat[] = [];
  for (const k of vstup.zParseru) {
    const mapped = mapovatKandidata(k);
    if (typeof mapped === "string") {
      return prazdne(mapped, "STOP");
    }
    namapovane.push(mapped);
  }

  const dokument: JktMezidokument = {
    vytvoreno: vstup.vytvoreno ?? new Date().toISOString(),
    zdrojUrl: JKT_URL,
    kandidati: namapovane,
  };

  let overene: BranaScanKandidat[];
  try {
    overene = parsovatItrebonJktMezidokument(
      `${JSON.stringify(dokument, null, 2)}\n`,
    );
  } catch (chyba: unknown) {
    const text = chyba instanceof Error ? chyba.message : String(chyba);
    return prazdne(`nevalidní mezidokument: ${text}`, "STOP");
  }

  const zOvereneho: JktMezidokumentKandidat[] = [];
  for (const k of overene) {
    const mapped = mapovatKandidata(k);
    if (typeof mapped === "string") {
      return prazdne(mapped, "STOP");
    }
    zOvereneho.push(mapped);
  }
  const shoda = porovnatKandidaty(namapovane, zOvereneho);
  if (shoda.length > 0) {
    return prazdne(`parser → JSON není 1:1: ${shoda.join("; ")}`, "STOP");
  }

  const { noveIdentity, zmizeleIdentity } = rozdilIdentit(
    identityZKandidatu(vstup.predchozi),
    identityZKandidatu(namapovane),
  );
  const zaklad: Omit<JktVyhodnoceni, "stav" | "duvod"> = {
    stranNacteno: vstup.stranNacteno,
    stranOcekavano: vstup.stranOcekavano,
    predchoziPocet: vstup.predchozi.length,
    novyPocet: namapovane.length,
    noveIdentity,
    zmizeleIdentity,
    dokument,
  };

  if (namapovane.length === 0 && vstup.predchozi.length > 0) {
    return {
      ...zaklad,
      stav: "KONTROLA",
      duvod: "0 kandidátů proti předchozímu neprázdnému mezidokumentu",
    };
  }
  if (namapovane.length === MAX_KANDIDATU_JKT) {
    return {
      ...zaklad,
      stav: "KONTROLA",
      duvod: `přesně ${MAX_KANDIDATU_JKT} kandidátů — parser mohl ořezat další`,
    };
  }

  return { ...zaklad, stav: "OK", duvod: "mezidokument ověřen" };
}

function nepovoleneTrackedZmeny(povolene: readonly string[]): string[] {
  const vysledek = spawnSync("git", ["diff", "--name-only", "HEAD"], {
    encoding: "utf8",
  });
  if (vysledek.status !== 0) {
    throw new Error("git diff --name-only HEAD selhal.");
  }
  const soubory = (vysledek.stdout ?? "")
    .split(/\r?\n/)
    .map((radek) => radek.trim().replace(/\\/g, "/"))
    .filter((radek) => radek.length > 0);
  const dovolene = new Set(povolene.map((s) => s.replace(/\\/g, "/")));
  return soubory.filter((s) => !dovolene.has(s));
}

function spustitPrikaz(prikaz: string, args: string[]): string | null {
  const vysledek = spawnSync(prikaz, args, {
    encoding: "utf8",
    shell: true,
  });
  if (vysledek.status !== 0) {
    const vypis = `${vysledek.stdout ?? ""}${vysledek.stderr ?? ""}`.trim();
    return vypis || `${prikaz} ${args.join(" ")} skončil kódem ${vysledek.status}`;
  }
  return null;
}

function spustitJktVerifyATsc(): string | null {
  for (const skript of JKT_VERIFY) {
    const chyba = spustitPrikaz("npx", ["tsx", skript]);
    if (chyba) {
      return `${skript}: ${chyba}`;
    }
  }
  const tsc = spustitPrikaz("npx", ["tsc", "--noEmit"]);
  if (tsc) {
    return `tsc: ${tsc}`;
  }
  return null;
}

function vypisJkt(vyhodnoceni: JktVyhodnoceni): void {
  console.log(`\nJKT:`);
  console.log(
    `- stránky načteny: ${vyhodnoceni.stranNacteno}/${vyhodnoceni.stranOcekavano}`,
  );
  console.log(`- předchozí počet: ${vyhodnoceni.predchoziPocet}`);
  console.log(`- nový počet: ${vyhodnoceni.novyPocet}`);
  console.log(`- nové identity: ${vyhodnoceni.noveIdentity.length}`);
  console.log(`- zmizelé identity: ${vyhodnoceni.zmizeleIdentity.length}`);
  console.log(`- ${vyhodnoceni.duvod}`);
}

function nacistPredchoziJkt(cesta: string): JktMezidokumentKandidat[] {
  const nactene = nacistItrebonJktMezidokumentZeSouboru(cesta);
  const vysledek: JktMezidokumentKandidat[] = [];
  for (const k of nactene) {
    const mapped = mapovatKandidata(k);
    if (typeof mapped === "string") {
      throw new Error(mapped);
    }
    vysledek.push(mapped);
  }
  return vysledek;
}

function zapsatJktMezidokument(cesta: string, dokument: JktMezidokument): void {
  writeFileSync(cesta, `${JSON.stringify(dokument, null, 2)}\n`, "utf8");
}

function overitZapsanyJkt(cesta: string, schvalene: JktMezidokument): string | null {
  let zDisku: BranaScanKandidat[];
  try {
    zDisku = nacistItrebonJktMezidokumentZeSouboru(cesta);
  } catch (chyba: unknown) {
    const text = chyba instanceof Error ? chyba.message : String(chyba);
    return `uložený soubor nelze načíst: ${text}`;
  }
  const zDiskuMapped: JktMezidokumentKandidat[] = [];
  for (const k of zDisku) {
    const mapped = mapovatKandidata(k);
    if (typeof mapped === "string") {
      return mapped;
    }
    zDiskuMapped.push(mapped);
  }
  const chyby = porovnatKandidaty(schvalene.kandidati, zDiskuMapped);
  if (chyby.length > 0) {
    return `uložený soubor neodpovídá schválenému výsledku: ${chyby.join("; ")}`;
  }
  const surovy = JSON.parse(readFileSync(cesta, "utf8")) as JktMezidokument;
  if (surovy.vytvoreno !== schvalene.vytvoreno) {
    return "uložené vytvoreno nesedí";
  }
  if (surovy.zdrojUrl !== schvalene.zdrojUrl) {
    return "uložené zdrojUrl nesedí";
  }
  return null;
}

async function nacistJktZItrebone(): Promise<
  | { ok: true; stranNacteno: number; stranOcekavano: number; zParseru: BranaScanKandidat[] }
  | { ok: false; duvod: string }
> {
  const urlky = sestavItrebonKalendarUrlky(JKT_URL);
  if (urlky.length !== JKT_OCEKAVANO_STRAN) {
    return {
      ok: false,
      duvod: `sestavItrebonKalendarUrlky vrátil ${urlky.length}, očekáváno ${JKT_OCEKAVANO_STRAN}`,
    };
  }
  const sloucene: BranaScanKandidat[] = [];
  let nactenoStran = 0;
  for (const url of urlky) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; BranaReadOnly/1.0)",
          Accept: "text/html",
        },
      });
    } catch (chyba: unknown) {
      const text = chyba instanceof Error ? chyba.message : String(chyba);
      return { ok: false, duvod: `HTTP načtení selhalo (${url}): ${text}` };
    }
    if (!res.ok) {
      return { ok: false, duvod: `HTTP ${res.status} na ${url}` };
    }
    let html: string;
    try {
      html = await res.text();
    } catch (chyba: unknown) {
      const text = chyba instanceof Error ? chyba.message : String(chyba);
      return { ok: false, duvod: `čtení těla selhalo (${url}): ${text}` };
    }
    nactenoStran += 1;
    try {
      sloucene.push(...parsovatItrebonDivadloJkTyla(html));
    } catch (chyba: unknown) {
      const text = chyba instanceof Error ? chyba.message : String(chyba);
      return { ok: false, duvod: `parser selhal (${url}): ${text}` };
    }
  }
  return {
    ok: true,
    stranNacteno: nactenoStran,
    stranOcekavano: urlky.length,
    zParseru: deduplikovatScanKandidaty(sloucene),
  };
}

async function aktualizovatJkt(): Promise<JktVyhodnoceni> {
  const nepovolene = nepovoleneTrackedZmeny([JKT_MEZIDOKUMENT]);
  if (nepovolene.length > 0) {
    return {
      stav: "STOP",
      duvod: `nepovolené tracked změny: ${nepovolene.join(", ")}`,
      stranNacteno: 0,
      stranOcekavano: JKT_OCEKAVANO_STRAN,
      predchoziPocet: 0,
      novyPocet: 0,
      noveIdentity: [],
      zmizeleIdentity: [],
      dokument: null,
    };
  }

  let predchozi: JktMezidokumentKandidat[];
  try {
    predchozi = nacistPredchoziJkt(JKT_MEZIDOKUMENT);
  } catch (chyba: unknown) {
    const text = chyba instanceof Error ? chyba.message : String(chyba);
    return {
      stav: "STOP",
      duvod: `současný mezidokument nelze číst: ${text}`,
      stranNacteno: 0,
      stranOcekavano: JKT_OCEKAVANO_STRAN,
      predchoziPocet: 0,
      novyPocet: 0,
      noveIdentity: [],
      zmizeleIdentity: [],
      dokument: null,
    };
  }

  const nacteni = await nacistJktZItrebone();
  if (!nacteni.ok) {
    return {
      stav: "STOP",
      duvod: nacteni.duvod,
      stranNacteno: 0,
      stranOcekavano: JKT_OCEKAVANO_STRAN,
      predchoziPocet: predchozi.length,
      novyPocet: 0,
      noveIdentity: [],
      zmizeleIdentity: [],
      dokument: null,
    };
  }

  const vyhodnoceni = vyhodnotitJktObsah({
    stranNacteno: nacteni.stranNacteno,
    stranOcekavano: nacteni.stranOcekavano,
    zParseru: nacteni.zParseru,
    predchozi,
  });
  if (vyhodnoceni.stav === "STOP") {
    return vyhodnoceni;
  }

  const verifyChyba = spustitJktVerifyATsc();
  if (verifyChyba) {
    return { ...vyhodnoceni, stav: "STOP", duvod: verifyChyba, dokument: null };
  }

  if (vyhodnoceni.stav === "KONTROLA" || !vyhodnoceni.dokument) {
    return vyhodnoceni;
  }

  zapsatJktMezidokument(JKT_MEZIDOKUMENT, vyhodnoceni.dokument);
  const poZapisu = overitZapsanyJkt(JKT_MEZIDOKUMENT, vyhodnoceni.dokument);
  if (poZapisu) {
    return {
      ...vyhodnoceni,
      stav: "STOP",
      duvod: poZapisu,
      dokument: null,
    };
  }
  const poGit = nepovoleneTrackedZmeny([JKT_MEZIDOKUMENT]);
  if (poGit.length > 0) {
    return {
      ...vyhodnoceni,
      stav: "STOP",
      duvod: `po zápisu nepovolené tracked změny: ${poGit.join(", ")}`,
      dokument: null,
    };
  }
  return vyhodnoceni;
}

function vzorKandidat(id: string, nazev = `Akce ${id}`): BranaScanKandidat {
  return {
    nazev,
    datumOd: "2026-10-20",
    datumDo: "2026-10-20",
    cas: "19:00",
    mistoNeboTyp: "Divadlo J. K. Tyla",
    zdrojIdentita: `itrebon|${id}`,
  };
}

function assertFixture(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(`FAIL fixture: ${msg}`);
    process.exit(1);
  }
}

function spustitFixture(): void {
  const predchozi20 = Array.from({ length: 20 }, (_, i) =>
    mapovatKandidata(vzorKandidat(String(20000 + i))),
  ).filter((k): k is JktMezidokumentKandidat => typeof k !== "string");

  {
    const nove = predchozi20.slice(0, 18).map((k) => ({
      ...k,
    }));
    const zParseru: BranaScanKandidat[] = nove;
    const v = vyhodnotitJktObsah({
      stranNacteno: 12,
      stranOcekavano: 12,
      zParseru,
      predchozi: predchozi20,
    });
    assertFixture(v.stav === "OK", `20→18 má být OK, je ${v.stav}: ${v.duvod}`);
    assertFixture(v.novyPocet === 18, "nový počet 18");
    assertFixture(v.zmizeleIdentity.length === 2, "2 zmizelé");
    assertFixture(v.noveIdentity.length === 0, "0 nových");
    console.log("OK fixture 20→18 je OK");
  }

  {
    const extra = vzorKandidat("30001");
    const zParseru: BranaScanKandidat[] = [
      ...predchozi20.map((k) => ({ ...k })),
      extra,
      vzorKandidat("30002"),
      vzorKandidat("30003"),
      vzorKandidat("30004"),
    ];
    const v = vyhodnotitJktObsah({
      stranNacteno: 12,
      stranOcekavano: 12,
      zParseru,
      predchozi: predchozi20,
    });
    assertFixture(v.stav === "OK", `20→24 má být OK, je ${v.stav}: ${v.duvod}`);
    assertFixture(v.novyPocet === 24, "nový počet 24");
    assertFixture(v.noveIdentity.length === 4, "4 nové");
    console.log("OK fixture 20→24 je OK");
  }

  {
    const v = vyhodnotitJktObsah({
      stranNacteno: 11,
      stranOcekavano: 12,
      zParseru: predchozi20.map((k) => ({ ...k })),
      predchozi: predchozi20,
    });
    assertFixture(v.stav === "STOP", `11/12 má být STOP, je ${v.stav}`);
    assertFixture(v.dokument === null, "STOP nesmí nést dokument k zápisu");
    console.log("OK fixture 11/12 je STOP");
  }

  {
    const v = vyhodnotitJktObsah({
      stranNacteno: 12,
      stranOcekavano: 12,
      zParseru: [],
      predchozi: predchozi20,
    });
    assertFixture(v.stav === "KONTROLA", `0 proti 20 má být KONTROLA, je ${v.stav}`);
    assertFixture(
      v.dokument !== null,
      "KONTROLA má dokument v paměti, ale provoz ho nezapisuje",
    );
    console.log("OK fixture 0 proti neprázdnému je KONTROLA");
  }

  {
    const zParseru = Array.from({ length: MAX_KANDIDATU_JKT }, (_, i) =>
      vzorKandidat(String(40000 + i)),
    );
    const v = vyhodnotitJktObsah({
      stranNacteno: 12,
      stranOcekavano: 12,
      zParseru,
      predchozi: predchozi20,
    });
    assertFixture(v.stav === "KONTROLA", `40 má být KONTROLA, je ${v.stav}: ${v.duvod}`);
    console.log("OK fixture přesně 40 je KONTROLA");
  }

  {
    const v = vyhodnotitJktObsah({
      stranNacteno: 12,
      stranOcekavano: 12,
      zParseru: [
        vzorKandidat("111"),
        { ...vzorKandidat("111"), nazev: "Kopi" },
      ],
      predchozi: predchozi20,
    });
    assertFixture(v.stav === "STOP", `duplicita má být STOP, je ${v.stav}: ${v.duvod}`);
    console.log("OK fixture duplicitní identita je STOP");
  }

  {
    const v = vyhodnotitJktObsah({
      stranNacteno: 12,
      stranOcekavano: 12,
      zParseru: [{ ...vzorKandidat("111"), mistoNeboTyp: "Jiné místo" }],
      predchozi: predchozi20,
    });
    assertFixture(v.stav === "STOP", `špatné místo má být STOP, je ${v.stav}: ${v.duvod}`);
    console.log("OK fixture špatné místo je STOP");
  }

  {
    const tmp = mkdtempSync(path.join(tmpdir(), "brana-jkt-"));
    const cesta = path.join(tmp, "divadlo-jk-tyla-itrebon.json");
    const pred = [mapovatKandidata(vzorKandidat("111"))] as JktMezidokumentKandidat[];
    const v = vyhodnotitJktObsah({
      stranNacteno: 12,
      stranOcekavano: 12,
      zParseru: [vzorKandidat("222")],
      predchozi: pred,
      vytvoreno: "2026-08-18T12:00:00.000Z",
    });
    assertFixture(v.stav === "OK", `zápis fixture má být OK, je ${v.stav}`);
    assertFixture(v.dokument, "OK má dokument");
    zapsatJktMezidokument(cesta, v.dokument);
    const chyba = overitZapsanyJkt(cesta, v.dokument);
    assertFixture(chyba === null, `ověření zápisu: ${chyba}`);
    const puvodniNeexistuje = !predchozi20.some((k) => k.zdrojIdentita === "itrebon|222");
    assertFixture(puvodniNeexistuje, "tmp zápis není produkční mezidokument");
    console.log("OK fixture zápis jen do dočasného souboru");
  }

  {
    const v = vyhodnotitJktObsah({
      stranNacteno: 12,
      stranOcekavano: 12,
      zParseru: [vzorKandidat("222")],
      predchozi: predchozi20,
    });
    assertFixture(v.noveIdentity.includes("itrebon|222"), "nová identita 222");
    assertFixture(v.zmizeleIdentity.includes("itrebon|20000"), "zmizelá identita 20000");
    console.log("OK fixture nové / zmizelé identity");
  }

  console.log(
    `\nRegistrované asistované zdroje: ${ASISTOVANE_ZDROJE.map((z) => z.id).join(", ")}`,
  );
  console.log("Všechny fixture kontroly asistovaných zdrojů prošly.");
}

function vypisNapovedu(): void {
  console.log("Asistované zdroje BRÁNY");
  console.log("  npx tsx scripts/brana-asistovane-zdroje.ts --fixture");
  console.log("  npx tsx scripts/brana-asistovane-zdroje.ts --aktualizovat");
}

async function main(): Promise<void> {
  if (process.argv.includes("--fixture")) {
    spustitFixture();
    return;
  }
  if (!process.argv.includes("--aktualizovat")) {
    vypisNapovedu();
    process.exit(2);
  }

  console.log("ASISTOVANÉ ZDROJE — aktualizace");
  const vyhodnoceni = await aktualizovatJkt();
  console.log(`\nASISTOVANÉ ZDROJE: ${vyhodnoceni.stav}`);
  vypisJkt(vyhodnoceni);
  if (vyhodnoceni.stav === "OK") {
    console.log("- mezidokument ověřen a zapsán");
    process.exit(0);
  }
  if (vyhodnoceni.stav === "KONTROLA") {
    console.log("- současný mezidokument NEBYL přepsán");
    process.exit(2);
  }
  console.log("- současný mezidokument NEBYL přepsán");
  process.exit(1);
}

void main();
