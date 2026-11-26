/**
 * Pozvánka BRÁNY na první prolnutí. Jen umělé položky a čtení zdrojáků.
 * Spuštění: npm run test:brana-pozvanka
 */

import fs from "node:fs";
import path from "node:path";
import type { Polozka } from "../src/types";
import {
  DELKA_OKNA_ROTACE_MS,
  polozkyVerejneGalerie,
  vysledekRucnihoPresunu,
  vysledekUpravyPolozky,
} from "../src/lib/rotace-prolnuti";
import {
  LIMIT_CTENI_POZVANKY_MS,
  odkazNaTrebonSPolozkou,
  pozvankaZVerejnychPolozek,
  TEXT_POZVANKY_TREBON,
} from "../src/lib/brana/pozvanka-prolnuti";
import {
  jePreruseni,
  sPevnymStropem,
  volbyFetchSSignalem,
  volbyGetSSignalem,
} from "../src/lib/signal-cteni";

const KOREN = process.cwd();
const DEN = DELKA_OKNA_ROTACE_MS;
const T0 = Date.parse("2026-03-01T15:00:00.000Z");

let selhani = 0;

function overit(podminka: boolean, popis: string): void {
  if (podminka) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhani += 1;
  console.error(`FAIL  ${popis}`);
}

function prolnuti(
  id: string,
  poradi: number,
  popis: string,
  aktivni = true,
  snimky = 2,
): Polozka {
  return {
    id,
    typ: "prolnuti",
    soubory: Array.from(
      { length: snimky },
      (_, index) => `/uploads/${id}-${index}.jpg`,
    ),
    popis,
    datumPorizeni: null,
    datumPublikace: "2026-01-02T00:00:00.000Z",
    poradi,
    aktivni,
  };
}

function textovaStranka(id: string, poradi: number, popis: string): Polozka {
  return {
    id,
    typ: "fotografie",
    soubor: `/uploads/${id}.jpg`,
    popis,
    datumPorizeni: null,
    datumPublikace: "2026-01-01T00:00:00.000Z",
    poradi,
    aktivni: true,
  };
}

function pozvanka(polozky: Polozka[], rotaceOd: string | undefined, now: number) {
  return pozvankaZVerejnychPolozek(
    polozkyVerejneGalerie(polozky, rotaceOd, now),
  );
}

const popisA = "První řádek\nDruhý řádek";
const rada = [
  prolnuti("A", 0, popisA),
  textovaStranka("text", 1, "Textová stránka"),
  prolnuti("B", 2, "Druhé prolnutí"),
  prolnuti("C", 3, "Třetí prolnutí"),
];

const bezRotace = pozvanka(rada, undefined, T0);
overit(bezRotace?.id === "A", "bez rotace je první viditelné prolnutí A");
overit(bezRotace?.popis === popisA, "popis se předává beze změny včetně zalomení");
overit(!bezRotace?.popis.includes("<"), "výběr do popisu nevkládá HTML");

const poDvouOknech = pozvanka(rada, new Date(T0).toISOString(), T0 + 2 * DEN);
overit(
  poDvouOknech?.id === "C",
  "po dvou 24hodinových oknech je první prolnutí C",
);
overit(
  poDvouOknech?.popis === "Třetí prolnutí",
  "rotace mění i popis, který se ukáže",
);

const presun = vysledekRucnihoPresunu(
  rada,
  undefined,
  "B",
  "pripnout",
  T0,
);
overit(typeof presun === "object", "ruční připnutí projde");
if (typeof presun === "object") {
  const poPresunu = pozvanka(presun.polozky, presun.rotaceOd, T0);
  overit(poPresunu?.id === "B", "připnutí posune na začátek prolnutí B");
  overit(poPresunu?.popis === "Druhé prolnutí", "po připnutí se bere popis B");
}

const uprava = vysledekUpravyPolozky(
  rada,
  new Date(T0).toISOString(),
  "A",
  { popis: "Nový\ntext" },
  T0 + 60_000,
);
overit(uprava !== null, "změna popisu projde");
if (uprava) {
  const poUprave = pozvanka(uprava.polozky, uprava.rotaceOd, T0 + 60_000);
  overit(poUprave?.id === "A", "samotný text neotočí pořadí");
  overit(poUprave?.popis === "Nový\ntext", "nový popis se převezme celé");
}

const skryte = pozvanka(
  [prolnuti("skryte", 0, "Neukázat", false), prolnuti("viditelne", 1, "Vidět")],
  undefined,
  T0,
);
overit(skryte?.id === "viditelne", "skryté prolnutí se přeskakuje");

const neplatne = pozvanka(
  [prolnuti("kratke", 0, "Málo snímků", true, 1), prolnuti("platne", 1, "Platné")],
  undefined,
  T0,
);
overit(neplatne?.id === "platne", "neplatné prolnutí se přeskakuje");

const textDruhy = pozvanka(
  [
    prolnuti("prvni", 0, "Úvodní prolnutí"),
    textovaStranka("text-2", 1, "Textová úvodní stránka"),
  ],
  undefined,
  T0,
);
overit(
  textDruhy?.id === "prvni" && textDruhy.popis === "Úvodní prolnutí",
  "textová stránka na druhém místě se nebere místo prvního prolnutí",
);

const textPrvni = pozvanka(
  [
    textovaStranka("text-1", 0, "Textová úvodní stránka"),
    prolnuti("az-druhe", 1, "Až prolnutí"),
  ],
  undefined,
  T0,
);
overit(
  textPrvni?.id === "az-druhe",
  "když je textová stránka první, bere se až první prolnutí",
);

overit(
  pozvanka([prolnuti("prazdne", 0, "   \n  ")], undefined, T0) === null,
  "prázdný popis nedá pozvánku",
);
overit(
  pozvanka([textovaStranka("jen-text", 0, "Jen text")], undefined, T0) === null,
  "bez prolnutí není co ukázat",
);

const absolutni = "https://www.trebonpocelyrok.cz";
const relativni = "/";
overit(
  odkazNaTrebonSPolozkou(absolutni, "A") ===
    "https://www.trebonpocelyrok.cz?polozka=A",
  "na subdoméně se k absolutní adrese přidá polozka",
);
overit(
  odkazNaTrebonSPolozkou(relativni, "A") === "/?polozka=A",
  "na stejné doméně se k / přidá polozka",
);
overit(
  odkazNaTrebonSPolozkou(absolutni, null) === absolutni,
  "bez popisu zůstává absolutní adresa beze změny",
);
overit(
  odkazNaTrebonSPolozkou(relativni, undefined) === relativni,
  "bez popisu zůstává relativní adresa beze změny",
);
overit(
  odkazNaTrebonSPolozkou(absolutni, "a b") ===
    "https://www.trebonpocelyrok.cz?polozka=a%20b",
  "id v adrese se kóduje",
);

const zakladGet = { access: "public" as const };
overit(
  jePreruseni(new DOMException("x", "AbortError")) === false,
  "bez signálu se chyba get() dál bere jako důvod k náhradnímu čtení",
);
overit(volbyGetSSignalem(zakladGet) === zakladGet, "get bez signálu nemění volby");
const signal = new AbortController().signal;
const getSeSignalem = volbyGetSSignalem(zakladGet, signal);
overit(getSeSignalem.abortSignal === signal, "get dostane abortSignal");
overit(!("abortSignal" in zakladGet), "původní volby get zůstávají bez signálu");

const zakladFetch: RequestInit = { cache: "no-store" };
overit(
  volbyFetchSSignalem(zakladFetch) === zakladFetch,
  "fetch bez signálu nemění volby",
);
const fetchSeSignalem = volbyFetchSSignalem(zakladFetch, signal);
overit(fetchSeSignalem.signal === signal, "fetch dostane signal");

async function overitLimit(): Promise<void> {
  const rychlyZacatek = performance.now();
  const rychly = await sPevnymStropem(LIMIT_CTENI_POZVANKY_MS, async () => ({
    popis: "hotovo",
    id: "1",
  }));
  overit(
    rychly?.popis === "hotovo" && performance.now() - rychlyZacatek < 200,
    "úspěšné čtení se nečeká do limitu",
  );

  const chybaZacatek = performance.now();
  const poChybe = await sPevnymStropem(LIMIT_CTENI_POZVANKY_MS, async () => {
    throw new Error("úložiště");
  });
  overit(
    poChybe === null && performance.now() - chybaZacatek < 200,
    "chyba čtení vrací null hned",
  );

  const visiciZacatek = performance.now();
  const poViseni = await sPevnymStropem(
    LIMIT_CTENI_POZVANKY_MS,
    () => new Promise(() => undefined),
  );
  const viseniMs = performance.now() - visiciZacatek;
  overit(poViseni === null, "neodpovídající úložiště vrací null");
  overit(
    viseniMs >= LIMIT_CTENI_POZVANKY_MS - 50 &&
      viseniMs < LIMIT_CTENI_POZVANKY_MS + 400,
    `strop čekání drží i když přerušení signálu nic neudělá (${Math.round(viseniMs)} ms)`,
  );

  const retezZacatek = performance.now();
  const poRezi = await sPevnymStropem(LIMIT_CTENI_POZVANKY_MS, async (behSignal) => {
    await new Promise<void>((resolve, reject) => {
      const casovac = setTimeout(resolve, 500);
      behSignal.addEventListener("abort", () => {
        clearTimeout(casovac);
        reject(new DOMException("přerušeno", "AbortError"));
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { popis: "pozdě", id: "x" };
  });
  const retezMs = performance.now() - retezZacatek;
  overit(poRezi === null, "náhradní krok po limitu už výsledek nevrátí");
  overit(
    retezMs < LIMIT_CTENI_POZVANKY_MS + 400,
    `celá operace včetně náhradního kroku nepřekročí strop (${Math.round(retezMs)} ms)`,
  );
}

function textSouboru(relativne: string): string {
  return fs.readFileSync(path.join(KOREN, relativne), "utf8");
}

const obrazovka = textSouboru("src/components/brana/BranaObrazovka.tsx");
const pocetKliku = obrazovka.split("onClick={zaznamenatKlikNaTrebon}").length - 1;
overit(pocetKliku === 1, "proklik má jedinou obsluhu na celém odkazu");
overit(
  obrazovka.includes(TEXT_POZVANKY_TREBON) ||
    obrazovka.includes("TEXT_POZVANKY_TREBON"),
  "stálý text je Nakouknout do Třeboně",
);
overit(
  obrazovka.includes("{pozvankaProlnuti.popis}"),
  "popis se vykresluje jako textový uzel",
);
overit(
  !obrazovka.includes("dangerouslySetInnerHTML"),
  "zápatí neskládá popis jako HTML",
);
overit(
  obrazovka.includes("brana-scroll-rezerva") &&
    obrazovka.includes("brana-pata--dnes-zitra"),
  "rezerva rolování a rozlišení Dnes/Zítra zůstávají",
);

const css = textSouboru("src/app/brana/brana.css");
overit(
  css.includes("min-height: calc(100dvh - 12rem - 26dvh);"),
  "výška rezervy rolování se nemění",
);
overit(
  css.includes(".brana-pata--dnes-zitra::before"),
  "volné místo nad odkazem u Dnes a Zítra zůstává",
);
overit(css.includes("white-space: pre-wrap"), "zalomení popisu zůstává ve stylu");
overit(!css.includes(".brana-pata-odkaz-hlavni::after"), "odkaz už nemá podtržení");

const stranky = [
  "src/app/brana/page.tsx",
  "src/app/brana/zitra/page.tsx",
  "src/app/brana/vikend/page.tsx",
  "src/app/brana/7-dni/page.tsx",
  "src/app/brana/vyhled/page.tsx",
];
for (const stranka of stranky) {
  overit(
    textSouboru(stranka).includes("BranaVerejnaStranka"),
    `${stranka} používá společnou veřejnou stránku`,
  );
}

const verejna = textSouboru("src/components/brana/BranaVerejnaStranka.tsx");
const startPozvanky = verejna.indexOf("const pozvankaPromise = nacistPozvankuPrvnihoProlnuti()");
overit(
  startPozvanky >= 0 &&
    startPozvanky < verejna.indexOf("await searchParams") &&
    startPozvanky < verejna.indexOf("await nactiVerejnaDataDnesSPoctemAkciNaVikend"),
  "čtení galerie startuje dřív než ostatní čekání BRÁNY",
);

overitLimit()
  .then(() => {
    if (selhani > 0) {
      console.error(`\n${selhani} kontrol selhalo`);
      process.exit(1);
    }
    console.log("\nVšechny kontroly pozvánky prošly.");
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
