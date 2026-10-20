/**
 * Upozornění na nový vzkaz BRÁNY.
 * Spuštění: npx tsx scripts/verify-brana-vzkaz-push.ts
 *
 * Jen simulovaná subscription a nahrazené odeslání. Bez Blobu a bez skutečného push.
 */

import { readFileSync } from "fs";
import { join } from "path";
import {
  BRANA_VZKAZ_UPOZORNENI_PAYLOAD,
  dokoncitUlozeniVzkazu,
  odeslatUpozorneniNaNovyVzkazS,
  type ZavislostiUpozorneniNaVzkaz,
} from "../src/lib/brana/vzkaz/upozorneni-po-ulozeni";

let selhalo = 0;
function assert(ok: boolean, popis: string): void {
  if (ok) {
    console.log(`OK  ${popis}`);
    return;
  }
  selhalo += 1;
  console.error(`FAIL ${popis}`);
}

const subscription = {
  endpoint: "https://push.example.test/simulace",
  expirationTime: null,
  keys: { p256dh: "simulovany-p256dh", auth: "simulovany-auth" },
};

const textVzkazu = "tajný text návštěvníka, který nesmí odejít v push";

function zavislosti(pred: {
  maKonfiguraci?: boolean;
  nacist?: ZavislostiUpozorneniNaVzkaz["nacist"];
  validovat?: ZavislostiUpozorneniNaVzkaz["validovat"];
  odeslat?: ZavislostiUpozorneniNaVzkaz["odeslat"];
}): { deps: ZavislostiUpozorneniNaVzkaz; odeslani: unknown[] } {
  const odeslani: unknown[] = [];
  return {
    odeslani,
    deps: {
      maKonfiguraci: () => pred.maKonfiguraci ?? true,
      nacist:
        pred.nacist ??
        (async () => ({
          ok: true as const,
          dokument: {
            upozorneniAktivni: true,
            pushSubscription: subscription,
          },
        })),
      validovat:
        pred.validovat ??
        (() => ({ ok: true as const, pushSubscription: subscription })),
      odeslat:
        pred.odeslat ??
        (async (_subscription, payload) => {
          odeslani.push(payload);
          return { uspech: true };
        }),
    },
  };
}

async function hlavni(): Promise<void> {
  assert(
    JSON.stringify(BRANA_VZKAZ_UPOZORNENI_PAYLOAD) ===
      JSON.stringify({ title: "BRÁNA", body: "Vzkaz" }),
    "payload je jen titulek BRÁNA a tělo Vzkaz",
  );
  assert(
    !JSON.stringify(BRANA_VZKAZ_UPOZORNENI_PAYLOAD).includes(textVzkazu),
    "payload neobsahuje text vzkazu",
  );

  const uspech = zavislosti({});
  const poprve = await odeslatUpozorneniNaNovyVzkazS(uspech.deps);
  const podruhe = await odeslatUpozorneniNaNovyVzkazS(uspech.deps);
  assert(poprve.stav === "odeslan" && podruhe.stav === "odeslan", "každý pokus se odešle zvlášť");
  assert(uspech.odeslani.length === 2, "dva uložené vzkazy znamenají dva pokusy, bez denního razítka");
  assert(
    JSON.stringify(uspech.odeslani[0]) ===
      JSON.stringify(BRANA_VZKAZ_UPOZORNENI_PAYLOAD),
    "odeslaný payload je přesně BRÁNA / Vzkaz",
  );

  const vypnuto = zavislosti({
    nacist: async () => ({
      ok: true,
      dokument: { upozorneniAktivni: false, pushSubscription: subscription },
    }),
  });
  assert(
    (await odeslatUpozorneniNaNovyVzkazS(vypnuto.deps)).stav === "neposlan" &&
      vypnuto.odeslani.length === 0,
    "vypnutá upozornění push neodešlou",
  );

  const bezSubscription = zavislosti({
    nacist: async () => ({
      ok: true,
      dokument: { upozorneniAktivni: true, pushSubscription: null },
    }),
  });
  assert(
    (await odeslatUpozorneniNaNovyVzkazS(bezSubscription.deps)).stav ===
      "neposlan" && bezSubscription.odeslani.length === 0,
    "chybějící subscription push neodešle",
  );

  const neplatna = zavislosti({
    validovat: () => ({ ok: false, chyba: "simulace" }),
  });
  assert(
    (await odeslatUpozorneniNaNovyVzkazS(neplatna.deps)).stav === "neposlan" &&
      neplatna.odeslani.length === 0,
    "neplatná subscription push neodešle",
  );

  const selhaniSite = zavislosti({
    odeslat: async (_subscription, payload) => {
      uspech.odeslani.push(payload);
      return { uspech: false };
    },
  });
  assert(
    (await odeslatUpozorneniNaNovyVzkazS(selhaniSite.deps)).stav === "neposlan",
    "neúspěšné odeslání vrátí neposlan a nevyhodí chybu",
  );

  const vyjimka = zavislosti({
    odeslat: async () => {
      throw new Error("simulované selhání push");
    },
  });
  assert(
    (await odeslatUpozorneniNaNovyVzkazS(vyjimka.deps)).stav === "neposlan",
    "výjimka push se pohltí jako neposlan",
  );

  let ulozeno = 0;
  let pushPoUlozeni = 0;
  await dokoncitUlozeniVzkazu({
    ulozit: async () => {
      ulozeno += 1;
    },
    upozornit: async () => {
      pushPoUlozeni += 1;
    },
  });
  assert(ulozeno === 1 && pushPoUlozeni === 1, "úspěšné uložení spustí jeden pokus o push");

  let pushPoSelhaniUlozeni = 0;
  let ulozeniSpadlo = false;
  try {
    await dokoncitUlozeniVzkazu({
      ulozit: async () => {
        throw new Error("simulace: vzkaz se neuložil");
      },
      upozornit: async () => {
        pushPoSelhaniUlozeni += 1;
      },
    });
  } catch {
    ulozeniSpadlo = true;
  }
  assert(
    ulozeniSpadlo && pushPoSelhaniUlozeni === 0,
    "neúspěšné uložení push nespustí",
  );

  let poradUlozeno = false;
  await dokoncitUlozeniVzkazu({
    ulozit: async () => {
      poradUlozeno = true;
    },
    upozornit: async () => {
      throw new Error("simulované selhání po uložení");
    },
  });
  assert(poradUlozeno, "selhání push neruší už uložený vzkaz ani úspěšné dokončení");

  const koren = join(__dirname, "..");
  const cist = (cesta: string) => readFileSync(join(koren, cesta), "utf8");
  const nove = [
    "src/lib/brana/vzkaz/upozorneni-po-ulozeni.ts",
    "src/lib/brana/admin/odeslat-vzkaz-upozorneni.ts",
    "src/app/api/brana/vzkaz/route.ts",
  ].map(cist).join("\n");
  assert(!nove.includes("ulozitPosledniUpozorneni"), "nový vzkaz nezapisuje razítka skenů");
  assert(!nove.includes(textVzkazu), "zdroj upozornění neobsahuje ukázkový text vzkazu");

  const route = cist("src/app/api/brana/vzkaz/route.ts");
  const poUlozeni = route.slice(route.indexOf("await pridatBranaVzkaz"));
  const predAfter = poUlozeni.split("after(")[0] ?? "";
  assert(
    poUlozeni.startsWith("await pridatBranaVzkaz") &&
      poUlozeni.includes("after(") &&
      poUlozeni.indexOf("after(") <
        poUlozeni.indexOf("return NextResponse.json({ uspech: true })") &&
      !predAfter.includes("odeslatUpozorneniNaNovyVzkaz") &&
      !route.includes("dokoncitUlozeniVzkazu"),
    "odpověď se vrací hned po uložení a push je až v after()",
  );

  let ulozenoPredOdpovedi = false;
  let pushHotovoPredOdpovedi = false;
  const odlozenyPush = (async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
    pushHotovoPredOdpovedi = true;
  })();
  await (async () => {
    ulozenoPredOdpovedi = true;
  })();
  const odpoved = { uspech: true as const };
  assert(
    ulozenoPredOdpovedi &&
      odpoved.uspech === true &&
      pushHotovoPredOdpovedi === false,
    "úspěšná odpověď nečeká na dokončení odloženého push",
  );
  await odlozenyPush;
  assert(pushHotovoPredOdpovedi, "odložený push se po odpovědi ještě dokončí");

  const potvrzeni = cist(
    "src/components/brana/vzkaz/BranaVzkazPotvrzeniListek.tsx",
  );
  const formular = cist("src/components/brana/vzkaz/BranaVzkazFormular.tsx");
  assert(
    potvrzeni.includes('const POTVRZENI_TEXT = "Vzkaz doputoval"') &&
      potvrzeni.includes("const MS_KRESLENI_SRDC = 1_250") &&
      potvrzeni.includes("const MS_PAUZA_PRED_SRCEM = 400") &&
      formular.includes('setStav("uspech")') &&
      !formular.includes("after("),
    "text, srdíčko a načasování potvrzení zůstaly ve formuláři",
  );

  const sw = cist("public/brana/sw.js");
  assert(
    sw.includes('let body = "V administraci BRÁNY je nové upozornění."') &&
      !sw.includes("Vzkaz"),
    "service worker zůstal beze změny",
  );

  const skeny = [
    "src/lib/brana/admin/odeslat-rychle-upozorneni-automaticky.ts",
    "src/lib/brana/admin/odeslat-pravidelne-upozorneni-automaticky.ts",
    "src/lib/brana/admin/odeslat-asistovane-upozorneni-automaticky.ts",
  ].map(cist).join("\n");
  assert(
    skeny.includes("Rychlá kontrola ke schválení") &&
      skeny.includes("Pravidelná kontrola ke schválení") &&
      skeny.includes("ulozitPosledniUpozorneniRychleProScheduler") &&
      !skeny.includes('body: "Vzkaz"'),
    "upozornění po scanech zůstala na svých textech a razítkách",
  );

  if (selhalo > 0) {
    console.error(`Selhalo kontrol: ${selhalo}`);
    process.exit(1);
  }
  console.log("Všechny kontroly upozornění na vzkaz prošly.");
}

void hlavni();
