/**
 * Úzké parsery KKC Roháč (Ticketportal venue 1203336 + SMSticket 5734).
 * Spuštění: npx tsx scripts/verify-brana-kkc-rohac-parser.ts
 * READ-ONLY předscan: npx tsx scripts/verify-brana-kkc-rohac-parser.ts --zivy
 */

import {
  aplikovatScanKandidatyNaUdalosti,
  type BranaScanAutomatickaUdalostVstup,
} from "../src/lib/brana/admin/scan-ceka-zapis";
import { parsovatUdalostiZeZdroje } from "../src/lib/brana/admin/zdroj-scan-parser";
import {
  BRANA_KKC_ROHAC_CO,
  BRANA_KKC_ROHAC_KDE,
  BRANA_KKC_ROHAC_MISTO,
  BRANA_KKC_ROHAC_POLOZKA,
  jeKkcRohacZdrojIdentita,
  jeKkcRohacZdrojUrl,
  jeSmsticketRohacZdrojUrl,
  jeTicketportalRohacZdrojUrl,
  najitKkcRohacKotvuId,
  parsovatSmsticketRohacVenue,
  parsovatTicketportalRohacVenue,
  sestavKkcRohacZdrojIdentitu,
} from "../src/lib/brana/admin/kkc-rohac";
import { sparovatVlastnictvimHlidaneKotvy } from "../src/lib/brana/admin/zdroj-scan-sparovani";
import {
  pridatNesparovaneDoNezarazenych,
  vychoziNezarazeneDokument,
} from "../src/lib/brana/admin/nezarazene";
import {
  BRANA_REDAKCNI_VSECHNY_VYCHOZI,
  vytvoritVychoziRedakcniPoradi,
  type BranaRedakcniPolozkaStav,
} from "../src/lib/brana/admin/redakcni-kostra";
import { sestavJazykBranyPoSparovani } from "../src/lib/brana/admin/jazyk-brany-po-sparovani";
import { rozlozAkci } from "../src/lib/brana/admin/akce-rozlozeni";
import { jeUdalostCelaMinula } from "../src/lib/brana/admin/konkretni-udalost";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    fail(msg);
  }
}

const TP_URL = "https://www.ticketportal.cz/venue/1203336";
const SMS_URL =
  "https://www.smsticket.cz/mista/5734-kongresove-a-kulturni-centrum-rohac-trebon";
const TEST_SLOT_ID = "test-slot";

function jazykRohac(): BranaRedakcniPolozkaStav["jazykVerejny"] {
  return {
    co: { rezim: "PEVNE", text: BRANA_KKC_ROHAC_CO },
    rozliseni: { rezim: "PEVNE", text: BRANA_KKC_ROHAC_KDE },
  };
}

function testSlotKotva(
  volby?: { bezJazyka?: boolean; pouzivat?: "ANO" | "NE" },
): BranaRedakcniPolozkaStav {
  return {
    id: TEST_SLOT_ID,
    polozka: BRANA_KKC_ROHAC_POLOZKA,
    pouzivat: volby?.pouzivat ?? "ANO",
    priorita: 6,
    subpriorita: 1,
    vyhled: "NE",
    vyhledSerie: true,
    poznamka: "",
    mimoKostru: true,
    jazykVerejny: volby?.bezJazyka ? null : jazykRohac(),
  };
}

function redakceSKotvou(
  volby?: { druhaKotva?: boolean; bezJazyka?: boolean },
): BranaRedakcniPolozkaStav[] {
  const polozky = [
    ...vytvoritVychoziRedakcniPoradi(),
    testSlotKotva(volby),
  ];
  if (!volby?.druhaKotva) {
    return polozky;
  }
  return polozky.map((p) =>
    p.id === "plaz-u-rybnika-svet"
      ? {
          ...p,
          polozka: BRANA_KKC_ROHAC_POLOZKA,
          pouzivat: "ANO" as const,
          jazykVerejny: jazykRohac(),
        }
      : p,
  );
}

const FIXTURE_TP = `<!DOCTYPE html>
<html><head><title>KKC Roháč | Ticketportal</title></head>
<body>
https://www.ticketportal.cz/venue/1203336
<a href="/venue/1203336">KKC Roháč</a>
<div class="ticket-date">
  <div class="day" itemprop="startDate" content="2026-10-02T19:00">pátek</div>
  <div class="time">19:00</div>
</div>
<div class="detail">
  <a href="/Event/12005754" class="event" itemprop="name">HELENA Forever </a>
  <a href="/venue/1203336" class="building"><span itemprop="name">KKC Roháč</span></a>
</div>
</body></html>`;

const FIXTURE_TP_CIZI_VENUE = `<!DOCTYPE html>
<html><head><title>Cizí | Ticketportal</title></head>
<body>
https://www.ticketportal.cz/venue/9999999
<a href="/venue/9999999">Jinde</a>
<div class="day" itemprop="startDate" content="2026-10-02T19:00">pátek</div>
<div class="time">19:00</div>
<a href="/Event/12005754" class="event" itemprop="name">HELENA Forever </a>
<a href="/venue/9999999" class="building">Jinde</a>
</body></html>`;

const FIXTURE_TP_DUPLICITA = `<!DOCTYPE html>
<html><head><title>KKC Roháč | Ticketportal</title></head>
<body>
https://www.ticketportal.cz/venue/1203336
<a href="/venue/1203336">KKC Roháč</a>
<div itemprop="startDate" content="2026-10-02T19:00"></div>
<div class="time">19:00</div>
<a href="/Event/1" class="event" itemprop="name">První </a>
<a href="/venue/1203336" class="building">KKC Roháč</a>
<div itemprop="startDate" content="2026-10-02T19:00"></div>
<div class="time">19:00</div>
<a href="/Event/2" class="event" itemprop="name">Druhá </a>
<a href="/venue/1203336" class="building">KKC Roháč</a>
</body></html>`;

const FIXTURE_SMS = `<!DOCTYPE html>
<html><head><title>Kongresové a kulturní centrum Roháč - vstupenky</title>
<link rel="canonical" href="https://www.smsticket.cz/mista/5734-kongresove-a-kulturni-centrum-rohac-trebon">
</head><body>
<div>
  <strong property="name">JOSEF VOJTEK: SHOW POKRAČUJE I Třeboň</strong>
  <link property="url" href="https://www.smsticket.cz/vstupenky/72765-josef-vojtek-show-pokracuje-i-trebon-kongresove-a-kulturni-centrum-rohac-trebon-charlie-band" />
  <link property="image" href="/cdn/events/2026/72765/315.jpg" />
  <div class="column2" property="startDate" content="2027-03-05T18:00:00.0000000Z">
    <small>pátek od 19:00</small>
    <strong>5.3.2027</strong>
  </div>
  <div class="column3" property="offers" typeof="Offer">${"x".repeat(800)}</div>
</div>
<div>
  <strong property="name">V&#225;noce Osmanyho Laffity</strong>
  <link property="url" href="https://www.smsticket.cz/vstupenky/71099-vanoce-osmanyho-laffity-kongresove-a-kulturni-centrum-rohac-trebon-osmany-laffita-eva-decastelo" />
  <link property="image" href="/cdn/events/2026/71099/315.jpg" />
  <div class="column2" property="startDate" content="2027-12-10T18:00:00.0000000Z">
    <small>pátek od 19:00</small>
    <strong>10.12.2027</strong>
  </div>
  <div class="column3" property="offers" typeof="Offer">${"y".repeat(800)}</div>
</div>
</body></html>`;

const FIXTURE_SMS_CAS_NESHODA = `<!DOCTYPE html>
<html><head>
<link rel="canonical" href="https://www.smsticket.cz/mista/5734-kongresove-a-kulturni-centrum-rohac-trebon">
</head><body>
<strong property="name">Špatný čas</strong>
<link property="url" href="https://www.smsticket.cz/vstupenky/1-test" />
<div property="startDate" content="2027-03-05T18:00:00.0000000Z">
  <small>pátek od 20:00</small>
</div>
</body></html>`;

const FIXTURE_SMS_DUPLICITA = `<!DOCTYPE html>
<html><head>
<link rel="canonical" href="https://www.smsticket.cz/mista/5734-kongresove-a-kulturni-centrum-rohac-trebon">
</head><body>
<strong property="name">První</strong>
<link property="url" href="https://www.smsticket.cz/vstupenky/1-prvni" />
<div property="startDate" content="2027-03-05T18:00:00.0000000Z">
  <small>pátek od 19:00</small>
</div>
<strong property="name">Druhá</strong>
<link property="url" href="https://www.smsticket.cz/vstupenky/2-druha" />
<div property="startDate" content="2027-03-05T18:00:00.0000000Z">
  <small>pátek od 19:00</small>
</div>
</body></html>`;

const FIXTURE_SMICHANE = `${FIXTURE_TP}
${FIXTURE_SMS}`;

const FIXTURE_SMS_CIZI = `<!DOCTYPE html>
<html><head>
<link rel="canonical" href="https://www.smsticket.cz/mista/1-jinde">
</head><body>
<strong property="name">Cizí sál</strong>
<link property="url" href="https://www.smsticket.cz/vstupenky/9-cizi" />
<div property="startDate" content="2027-03-05T18:00:00.0000000Z">
  <small>pátek od 19:00</small>
</div>
</body></html>`;

function overUrl(): void {
  assert(jeTicketportalRohacZdrojUrl(TP_URL), "TP URL");
  assert(
    jeTicketportalRohacZdrojUrl("https://ticketportal.cz/venue/1203336/"),
    "TP bez www",
  );
  assert(
    !jeTicketportalRohacZdrojUrl("https://www.ticketportal.cz/event/HELENA-Forever"),
    "TP event není venue",
  );
  assert(jeSmsticketRohacZdrojUrl(SMS_URL), "SMS URL");
  assert(
    !jeSmsticketRohacZdrojUrl("https://www.smsticket.cz/mista/1-jinde"),
    "SMS cizí místo",
  );
  assert(jeKkcRohacZdrojUrl(TP_URL) && jeKkcRohacZdrojUrl(SMS_URL), "oba zdroje");
  console.log("OK URL venue");
}

function overTicketportalFixture(): void {
  const k = parsovatTicketportalRohacVenue(FIXTURE_TP);
  assert(k.length === 1, `TP 1, je ${k.length}`);
  assert(k[0].nazev === "HELENA Forever", `TP název: ${k[0].nazev}`);
  assert(k[0].datumOd === "2026-10-02", `TP datum: ${k[0].datumOd}`);
  assert(k[0].cas === "19:00", `TP čas: ${k[0].cas}`);
  assert(k[0].mistoNeboTyp === BRANA_KKC_ROHAC_MISTO, "TP místo");
  assert(
    k[0].zdrojIdentita === "rohac|2026-10-02|19:00",
    `TP identita: ${k[0].zdrojIdentita}`,
  );
  assert(
    parsovatUdalostiZeZdroje(FIXTURE_TP, "text/html").length === 1,
    "TP přes parsovatUdalostiZeZdroje",
  );
  assert(parsovatTicketportalRohacVenue(FIXTURE_TP_CIZI_VENUE).length === 0, "TP cizí 0");
  assert(parsovatTicketportalRohacVenue(FIXTURE_TP_DUPLICITA).length === 0, "TP duplicita 0");
  assert(parsovatUdalostiZeZdroje(FIXTURE_SMICHANE, "text/html").length === 0, "smíšené HTML 0");
  console.log("OK Ticketportal fixture → HELENA Forever");
}

function overSmsticketFixture(): void {
  const k = parsovatSmsticketRohacVenue(FIXTURE_SMS);
  assert(k.length === 2, `SMS 2, je ${k.length}`);
  const vojtek = k.find((x) => x.nazev.includes("VOJTEK"));
  const osmany = k.find((x) => x.nazev.includes("Osmanyho"));
  assert(vojtek, "Vojtek");
  assert(osmany, "Osmany");
  assert(
    vojtek.nazev === "JOSEF VOJTEK: SHOW POKRAČUJE",
    `Vojtek název: ${vojtek.nazev}`,
  );
  assert(!vojtek.nazev.includes("Třeboň"), "Vojtek bez I Třeboň");
  assert(vojtek.datumOd === "2027-03-05", `Vojtek datum: ${vojtek.datumOd}`);
  assert(vojtek.cas === "19:00", `Vojtek čas: ${vojtek.cas}`);
  assert(
    vojtek.zdrojIdentita === "rohac|2027-03-05|19:00",
    `Vojtek identita: ${vojtek.zdrojIdentita}`,
  );
  assert(osmany.datumOd === "2027-12-10", `Osmany datum: ${osmany.datumOd}`);
  assert(osmany.cas === "19:00", `Osmany čas: ${osmany.cas}`);
  assert(
    osmany.nazev === "Vánoce Osmanyho Laffity",
    `Osmany název: ${osmany.nazev}`,
  );
  assert(osmany.mistoNeboTyp === BRANA_KKC_ROHAC_MISTO, "SMS místo");
  const ochrana = parsovatSmsticketRohacVenue(`<!DOCTYPE html>
<html><head>
<link rel="canonical" href="https://www.smsticket.cz/mista/5734-kongresove-a-kulturni-centrum-rohac-trebon">
</head><body>
<strong property="name">Čochtanova Třeboň</strong>
<link property="url" href="https://www.smsticket.cz/vstupenky/3-cochtanova" />
<div property="startDate" content="2027-01-01T18:00:00.0000000Z">
  <small>pátek od 19:00</small>
</div>
<strong property="name">Třeboň v názvu I show</strong>
<link property="url" href="https://www.smsticket.cz/vstupenky/4-uvnitr" />
<div property="startDate" content="2027-01-02T18:00:00.0000000Z">
  <small>sobota od 19:00</small>
</div>
</body></html>`);
  assert(
    ochrana.some((x) => x.nazev === "Čochtanova Třeboň"),
    "holé koncové Třeboň beze změny",
  );
  assert(
    ochrana.some((x) => x.nazev === "Třeboň v názvu I show"),
    "Třeboň uvnitř názvu beze změny",
  );
  assert(parsovatSmsticketRohacVenue(FIXTURE_SMS_CAS_NESHODA).length === 0, "SMS čas 0");
  assert(parsovatSmsticketRohacVenue(FIXTURE_SMS_CIZI).length === 0, "SMS cizí 0");
  assert(parsovatSmsticketRohacVenue(FIXTURE_SMS_DUPLICITA).length === 0, "SMS duplicita 0");
  console.log("OK SMSticket fixture → Vojtek + Osmany, čas 19:00");
}

function overJazykARenderer(): void {
  const polozky = redakceSKotvou();
  const kotvaId = najitKkcRohacKotvuId(polozky);
  assert(kotvaId === TEST_SLOT_ID, `kotva: ${kotvaId}`);
  const pravidlo = polozky.find((p) => p.id === kotvaId);
  const jazyk = sestavJazykBranyPoSparovani({
    polozka: pravidlo?.polozka ?? "",
    kandidatMisto: BRANA_KKC_ROHAC_MISTO,
    zdrojNazev: "Ticketportal Roháč",
    jazykVerejny: pravidlo?.jazykVerejny ?? null,
  });
  assert(jazyk.verejneCo === "Roháč", `CO: ${jazyk.verejneCo}`);
  assert(jazyk.verejneRozliseni === "KKC", `KDE: ${jazyk.verejneRozliseni}`);
  const r = rozlozAkci({
    mistoNeboTyp: jazyk.mistoNeboTyp,
    nazev: "HELENA Forever",
    cas: "19:00",
    verejneCo: jazyk.verejneCo,
    verejneRozliseni: jazyk.verejneRozliseni,
  });
  assert(r.typ === "Roháč", `renderer CO: ${r.typ}`);
  assert(r.misto === "KKC", `renderer KDE: ${r.misto}`);
  assert(r.nazev === "HELENA Forever", `renderer název: ${r.nazev}`);
  assert(r.cas === "19:00", `renderer čas: ${r.cas}`);
  assert(r.oddelovacPredMistem === " ", "mezera");
  console.log("OK jazyk Roháč / KKC a renderer");
}

function doScanVstupu(
  k: ReturnType<typeof parsovatTicketportalRohacVenue>[0],
  polozky: readonly BranaRedakcniPolozkaStav[],
): BranaScanAutomatickaUdalostVstup | null {
  const kotva = najitKkcRohacKotvuId(polozky);
  if (!kotva) {
    return null;
  }
  const sparovani = sparovatVlastnictvimHlidaneKotvy(polozky, [kotva], kotva);
  if (!sparovani.ok) {
    return null;
  }
  const pravidlo = polozky.find((p) => p.id === kotva);
  const jazyk = sestavJazykBranyPoSparovani({
    polozka: pravidlo?.polozka ?? "",
    kandidatMisto: k.mistoNeboTyp,
    zdrojNazev: "KKC Roháč",
    jazykVerejny: pravidlo?.jazykVerejny ?? null,
  });
  return {
    redakcniPolozkaId: sparovani.redakcniPolozkaId,
    datumOd: k.datumOd,
    datumDo: k.datumDo,
    cas: k.cas,
    mistoNeboTyp: jazyk.mistoNeboTyp,
    nazev: k.nazev,
    zdrojIdentita: k.zdrojIdentita,
    verejneCo: jazyk.verejneCo,
    verejneRozliseni: jazyk.verejneRozliseni,
  };
}

function scanKandidat(
  k: ReturnType<typeof parsovatTicketportalRohacVenue>[0],
): BranaScanAutomatickaUdalostVstup {
  const vstup = doScanVstupu(k, redakceSKotvou());
  if (!vstup) {
    fail("scanKandidat bez kotvy");
  }
  return vstup;
}

function overDeduplikaci(): void {
  const helena = parsovatTicketportalRohacVenue(FIXTURE_TP)[0];
  const smsHelena: typeof helena = {
    ...helena,
    nazev: "Helena Vondráčková jinak",
  };
  const prvni = aplikovatScanKandidatyNaUdalosti(
    [],
    [scanKandidat(helena)],
    "2026-08-01",
    jeUdalostCelaMinula,
  );
  assert(prvni.vysledek.pridano === 1, `první scan +1, je ${prvni.vysledek.pridano}`);
  assert(
    prvni.udalosti[0].redakcniPolozkaId === TEST_SLOT_ID,
    "kandidát nese existující id test-slot, ne kkc-rohac",
  );
  const druhyStejnyZdroj = aplikovatScanKandidatyNaUdalosti(
    prvni.udalosti,
    [scanKandidat(helena)],
    "2026-08-01",
    jeUdalostCelaMinula,
  );
  assert(
    druhyStejnyZdroj.vysledek.pridano === 0 &&
      druhyStejnyZdroj.vysledek.jizExistuje +
        druhyStejnyZdroj.vysledek.aktualizovano ===
        1,
    "opakovaný scan ne duplicita",
  );
  assert(druhyStejnyZdroj.udalosti.length === 1, "stále 1 karta");
  const zDruhéhoZdroje = aplikovatScanKandidatyNaUdalosti(
    prvni.udalosti,
    [scanKandidat(smsHelena)],
    "2026-08-01",
    jeUdalostCelaMinula,
  );
  assert(zDruhéhoZdroje.udalosti.length === 1, "oba zdroje = 1 karta");
  assert(
    zDruhéhoZdroje.udalosti[0].zdrojIdentita === "rohac|2026-10-02|19:00",
    "společná identita",
  );
  assert(
    jeKkcRohacZdrojIdentita(zDruhéhoZdroje.udalosti[0].zdrojIdentita ?? ""),
    "identita tvar",
  );
  console.log("OK identita + deduplikace");
}

function overOwnership(): void {
  const seed = vytvoritVychoziRedakcniPoradi();
  const helena = parsovatTicketportalRohacVenue(FIXTURE_TP)[0];
  assert(najitKkcRohacKotvuId(seed) === null, "seed bez KKC Roháč → 0 kotva");
  assert(
    najitKkcRohacKotvuId([
      ...seed,
      testSlotKotva({ pouzivat: "NE" }),
    ]) === null,
    "Položka KKC Roháč s Používat NE → 0 kotva",
  );
  assert(
    najitKkcRohacKotvuId(redakceSKotvou({ bezJazyka: true })) === TEST_SLOT_ID,
    "jazyk není podmínkou ownership",
  );
  assert(najitKkcRohacKotvuId(redakceSKotvou({ druhaKotva: true })) === null, "2 kotvy 0");
  const jedna = redakceSKotvou();
  const id = najitKkcRohacKotvuId(jedna);
  assert(id === TEST_SLOT_ID, "kotva = existující id test-slot, ne kkc-rohac");
  const ok = sparovatVlastnictvimHlidaneKotvy(jedna, [id], id);
  assert(ok.ok && ok.redakcniPolozkaId === TEST_SLOT_ID, "ownership");
  const jina = sparovatVlastnictvimHlidaneKotvy(jedna, ["kino-svetozor"], id);
  assert(!jina.ok, "cizí hlídaná kotva ne");

  const vstupyNula = [helena]
    .map((k) => doScanVstupu(k, seed))
    .filter((x): x is BranaScanAutomatickaUdalostVstup => x !== null);
  assert(vstupyNula.length === 0, "0 shod → 0 CEKA vstupů");
  const vstupyDve = [helena]
    .map((k) => doScanVstupu(k, redakceSKotvou({ druhaKotva: true })))
    .filter((x): x is BranaScanAutomatickaUdalostVstup => x !== null);
  assert(vstupyDve.length === 0, "2+ shod → 0 CEKA vstupů");
  const ceka = aplikovatScanKandidatyNaUdalosti(
    [],
    vstupyNula,
    "2026-08-19",
    jeUdalostCelaMinula,
  );
  assert(ceka.vysledek.pridano === 0 && ceka.udalosti.length === 0, "0 CEKA");
  const inbox = pridatNesparovaneDoNezarazenych(vychoziNezarazeneDokument(), {
    zdrojId: "rohac-test",
    zdrojNazev: "KKC Roháč",
    nesparovane: [],
    noveId: () => "x",
  });
  assert(inbox.otevrene.length === 0, "0 Nezařazených");
  console.log("OK ownership podle živého názvu, 0/2+ → 0 CEKA, 0 Nezařazených");
}

function overKatalog(): void {
  assert(
    BRANA_REDAKCNI_VSECHNY_VYCHOZI.length === 54,
    `katalog 54, je ${BRANA_REDAKCNI_VSECHNY_VYCHOZI.length}`,
  );
  assert(
    BRANA_REDAKCNI_VSECHNY_VYCHOZI.every((p) => p.id !== "kkc-rohac"),
    "katalog bez id kkc-rohac",
  );
  assert(
    BRANA_REDAKCNI_VSECHNY_VYCHOZI.every(
      (p) => p.polozka !== BRANA_KKC_ROHAC_POLOZKA,
    ),
    "katalog bez seedové Položky KKC Roháč",
  );
  console.log("OK katalog 54, bez kkc-rohac");
}

function overIdentituHelper(): void {
  assert(
    sestavKkcRohacZdrojIdentitu("2026-10-02", "19:00") ===
      "rohac|2026-10-02|19:00",
    "sestav identitu",
  );
  assert(!jeKkcRohacZdrojIdentita("ticketportal|12005754"), "cizí identita");
  console.log("OK identita helper");
}

async function zivyPredscan(): Promise<void> {
  const hlavicky = {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };
  const tpRes = await fetch(TP_URL, { headers: hlavicky });
  const smsRes = await fetch(SMS_URL, { headers: hlavicky });
  assert(tpRes.ok, `TP HTTP ${tpRes.status}`);
  assert(smsRes.ok, `SMS HTTP ${smsRes.status}`);
  const tpHtml = await tpRes.text();
  const smsHtml = await smsRes.text();
  const tp = parsovatTicketportalRohacVenue(tpHtml);
  const sms = parsovatSmsticketRohacVenue(smsHtml);
  const identita = new Map<string, { zdroj: string; k: (typeof tp)[0] }>();
  const srazit = (zdroj: string, k: (typeof tp)[0]) => {
    const id = k.zdrojIdentita ?? "";
    if (!identita.has(id)) {
      identita.set(id, { zdroj, k });
      return;
    }
    const prvni = identita.get(id);
    if (prvni) {
      identita.set(id, {
        zdroj: `${prvni.zdroj}+${zdroj}`,
        k: prvni.k,
      });
    }
  };
  for (const k of tp) {
    srazit("Ticketportal", k);
  }
  for (const k of sms) {
    srazit("SMSticket", k);
  }

  console.log(`ŽIVÝ PŘEDSCAN Ticketportal: ${tp.length}`);
  for (const k of tp) {
    console.log(
      `  datum=${k.datumOd} čas=${k.cas} název=${k.nazev} zdroj=Ticketportal zdrojIdentita=${k.zdrojIdentita} CO=${BRANA_KKC_ROHAC_CO} KDE=${BRANA_KKC_ROHAC_KDE}`,
    );
  }
  console.log(`ŽIVÝ PŘEDSCAN SMSticket: ${sms.length}`);
  for (const k of sms) {
    console.log(
      `  datum=${k.datumOd} čas=${k.cas} název=${k.nazev} zdroj=SMSticket zdrojIdentita=${k.zdrojIdentita} CO=${BRANA_KKC_ROHAC_CO} KDE=${BRANA_KKC_ROHAC_KDE}`,
    );
  }
  console.log(`UNIKÁTNÍ: ${identita.size}`);

  if (tp.length !== 1 || sms.length !== 2 || identita.size !== 3) {
    fail(
      `předscan očekává 1+2=3 unikátní, je TP ${tp.length} SMS ${sms.length} unikátní ${identita.size}`,
    );
  }
  const helena = tp[0];
  assert(helena.nazev === "HELENA Forever", `živé TP název: ${helena.nazev}`);
  assert(helena.datumOd === "2026-10-02" && helena.cas === "19:00", "živé TP datum/čas");
  const vojtek = sms.find((k) => k.datumOd === "2027-03-05");
  const osmany = sms.find((k) => k.datumOd === "2027-12-10");
  assert(vojtek?.cas === "19:00", "živé Vojtek 19:00");
  assert(osmany?.cas === "19:00", "živé Osmany 19:00");
  assert(
    vojtek?.nazev === "JOSEF VOJTEK: SHOW POKRAČUJE",
    `živé Vojtek název: ${vojtek?.nazev}`,
  );
  assert(
    osmany?.nazev === "Vánoce Osmanyho Laffity",
    `živé Osmany název: ${osmany?.nazev}`,
  );
  console.log("OK živý předscan 1+2=3");
}

overUrl();
overKatalog();
overIdentituHelper();
overTicketportalFixture();
overSmsticketFixture();
overJazykARenderer();
overDeduplikaci();
overOwnership();

if (process.argv.includes("--zivy")) {
  zivyPredscan().catch((chyba: unknown) => {
    fail(chyba instanceof Error ? chyba.message : String(chyba));
  });
} else {
  console.log("OK verify-brana-kkc-rohac-parser");
}
