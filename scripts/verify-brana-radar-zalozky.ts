/**
 * Osobní záložky RADARU: adresa, pořadí, limit 50, mazání.
 * Bez Blob zápisu. Spuštění:
 * npx tsx scripts/verify-brana-radar-zalozky.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import {
  BRANA_RADAR_ZALOZKY_BLOB_CESTA,
  BRANA_RADAR_ZALOZKY_MAX,
  normalizovatHttpAdresu,
  parsovatRadarZalozkyDokument,
  pridatPolozkuDoZalozekDokumentu,
  smazatPolozkuZeZalozekDokumentu,
  validovatRadarZalozkuVstup,
  vychoziRadarZalozkyDokument,
  type BranaRadarZalozka,
} from "../src/lib/brana/admin/radar-zalozky";

let selhalo = 0;

function assert(ok: boolean, popis: string): void {
  if (ok) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhalo += 1;
  console.error(`FAIL ${popis}`);
}

function polozka(
  id: string,
  nazev: string,
  url: string,
  pridanoAt = "2026-10-15T15:00:00.000Z",
): BranaRadarZalozka {
  return { id: `zalozka-${id}`, nazev, url, pridanoAt };
}

const FACEBOOK = "https://www.facebook.com/trebon";
const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

function overAdresy(): void {
  const fb = normalizovatHttpAdresu(FACEBOOK);
  assert(fb === `${FACEBOOK}/` || fb === FACEBOOK, "Facebook https projde");
  assert(
    normalizovatHttpAdresu("http://example.com/akce") ===
      "http://example.com/akce",
    "http projde",
  );
  assert(
    normalizovatHttpAdresu("  https://www.facebook.com/groups/1  ") ===
      "https://www.facebook.com/groups/1",
    "okolní mezery se ořežou",
  );

  for (const spatna of [
    "javascript:alert(1)",
    "data:text/html,ahoj",
    "https://user:pass@facebook.com/x",
    "https://user@facebook.com/x",
    "ftp://example.com",
    "//example.com",
    "www.facebook.com",
    "http://",
    "https://",
    "https://example.com/a b",
    "javascript:https://facebook.com",
  ]) {
    assert(normalizovatHttpAdresu(spatna) === null, `odmítnuto: ${spatna}`);
  }

  const vstup = validovatRadarZalozkuVstup({
    nazev: "Facebook Třeboň",
    url: FACEBOOK,
  });
  assert(vstup.ok && vstup.ok && vstup.hodnota.url.startsWith("https://"), "vstup Facebook");
  assert(!validovatRadarZalozkuVstup({ nazev: "", url: FACEBOOK }).ok, "prázdný název");
  assert(
    !validovatRadarZalozkuVstup({ nazev: "A", url: "" }).ok,
    "prázdná adresa",
  );
  assert(
    !validovatRadarZalozkuVstup({ nazev: "A", url: "javascript:alert(1)" }).ok,
    "vstup javascript",
  );
  assert(
    !validovatRadarZalozkuVstup({ nazev: "A".repeat(201), url: FACEBOOK }).ok,
    "dlouhý název",
  );
  assert(
    !validovatRadarZalozkuVstup({
      nazev: "A",
      url: `https://example.com/${"a".repeat(2000)}`,
    }).ok,
    "dlouhá adresa",
  );
}

function overSeznam(): void {
  const prazdny = vychoziRadarZalozkyDokument();
  const prvni = polozka(ID_A, "První", "https://a.example/");
  const druhy = polozka(ID_B, "Druhý", "https://b.example/");
  const poPrvnim = pridatPolozkuDoZalozekDokumentu(prazdny, prvni);
  assert(poPrvnim.ok, "přidání první");
  if (!poPrvnim.ok) return;
  const poDruhem = pridatPolozkuDoZalozekDokumentu(poPrvnim.dokument, druhy);
  assert(poDruhem.ok, "přidání druhé");
  if (!poDruhem.ok) return;
  assert(poDruhem.dokument.polozky[0]?.nazev === "Druhý", "nová je první");
  assert(poDruhem.dokument.polozky[1]?.nazev === "První", "starší zůstává za ní");

  const zpet = parsovatRadarZalozkyDokument(poDruhem.dokument);
  assert(zpet?.polozky.length === 2, "dokument se znovu načte");

  const smazano = smazatPolozkuZeZalozekDokumentu(poDruhem.dokument, druhy.id);
  assert(smazano.ok && smazano.ok && smazano.dokument.polozky.length === 1, "smazání");
  if (!smazano.ok) return;
  assert(smazano.dokument.polozky[0]?.id === prvni.id, "druhá položka zůstala");
  assert(
    !smazatPolozkuZeZalozekDokumentu(smazano.dokument, druhy.id).ok,
    "druhé smazání selže",
  );

  let dokument = vychoziRadarZalozkyDokument();
  for (let i = 0; i < BRANA_RADAR_ZALOZKY_MAX; i += 1) {
    const hex = i.toString(16).padStart(12, "0");
    const id = `00000000-0000-4000-8000-${hex}`;
    const dalsi = pridatPolozkuDoZalozekDokumentu(
      dokument,
      polozka(id, `Web ${i}`, `https://example.com/${i}`),
    );
    assert(dalsi.ok, `položka ${i + 1} projde`);
    if (!dalsi.ok) return;
    dokument = dalsi.dokument;
  }
  assert(dokument.polozky.length === 50, "limit 50 je plný");
  assert(
    dokument.polozky[0]?.nazev === "Web 49",
    "poslední přidaná je na začátku",
  );
  const navic = pridatPolozkuDoZalozekDokumentu(
    dokument,
    polozka(ID_A, "Navíc", "https://navic.example/"),
  );
  assert(!navic.ok, "51. adresa se neuloží");
  assert(dokument.polozky.length === 50, "plný dokument se nezměnil");

  const pretizene = {
    ...dokument,
    polozky: [...dokument.polozky, polozka(ID_B, "X", "https://x.example/")],
  };
  assert(parsovatRadarZalozkyDokument(pretizene) === null, "parser odmítne 51");
  assert(
    parsovatRadarZalozkyDokument({
      verzeUloziste: 1,
      polozky: [polozka(ID_A, "X", "javascript:alert(1)")],
    }) === null,
    "parser odmítne javascript",
  );
}

function overUlozisteJeOddelene(): void {
  const cesta: string = BRANA_RADAR_ZALOZKY_BLOB_CESTA;
  assert(cesta === "data/brana-radar-zalozky.json", "vlastní cesta blobu");
  assert(cesta !== "data/brana-radar.json", "není soubor nálezů");

  const uloziste = readFileSync(
    join("src/lib/brana/admin/radar-zalozky-uloziste.ts"),
    "utf8",
  );
  assert(uloziste.includes("data/brana-radar-zalozky.json") || uloziste.includes("BRANA_RADAR_ZALOZKY_BLOB_CESTA"), "úložiště používá vlastní cestu");
  assert(!uloziste.includes("data/brana-radar.json"), "úložiště nesahá na nálezy");
  assert(uloziste.includes("jeAdminPrihlasen"), "zápis i čtení hlídá přihlášení");
  assert(!uloziste.includes("zapsatRadarScan"), "scan se nevolá");
  assert(!uloziste.includes("pridatPolozkuDoUceni"), "Učení se nevolá");
  assert(uloziste.includes('access: "private"'), "blob je soukromý");
  assert(uloziste.includes("ifMatch"), "zápis používá etag");

  const akce = readFileSync(join("src/app/brana/admin/actions.ts"), "utf8");
  const teloPridat = akce.slice(
    akce.indexOf("export async function pridatBranaRadarZalozkuAkce"),
    akce.indexOf("export type BranaRadarZalozkaSmazatVysledek"),
  );
  assert(teloPridat.includes("jeAdminPrihlasen"), "akce přidat hlídá přihlášení");
  assert(!teloPridat.includes("skenovat"), "akce přidat nespouští scan");
  assert(!teloPridat.includes("Uceni"), "akce přidat nezapisuje Učení");
  assert(
    teloPridat.includes('revalidatePath("/brana/admin/sprava/radar")'),
    "akce přidat obnoví jen RADAR",
  );

  const stranka = readFileSync(
    join("src/app/brana/admin/sprava/radar/page.tsx"),
    "utf8",
  );
  const pridat = stranka.indexOf("<BranaAdminRadarPridat");
  const zalozky = stranka.indexOf("<BranaAdminRadarZalozky");
  assert(pridat > 0 && zalozky > pridat, "blok je pod formulářem + Přidat");

  const komponenta = readFileSync(
    join("src/components/brana/admin/BranaAdminRadarZalozky.tsx"),
    "utf8",
  );
  assert(komponenta.includes('target="_blank"'), "odkaz má target blank");
  assert(
    komponenta.includes('rel="noopener noreferrer"'),
    "odkaz má noopener noreferrer",
  );
  assert(komponenta.includes("normalizovatHttpAdresu"), "odkaz se znovu kontroluje");
}

overAdresy();
overSeznam();
overUlozisteJeOddelene();

if (selhalo > 0) {
  console.error(`SELHALO ${selhalo}`);
  process.exit(1);
}
console.log("OK verify-brana-radar-zalozky");
