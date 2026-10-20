/**
 * Správcovské upozornění na nový vzkaz Třeboně.
 * Spuštění: npx tsx scripts/verify-trebon-vzkaz-push.ts
 *
 * Jen simulovaná subscription a nahrazené odeslání. Bez Blobu a bez skutečného push.
 */

import { readFileSync } from "fs";
import { join } from "path";
import {
  TREBON_SPRAVCE_SW_CESTA,
  TREBON_SPRAVCE_SW_SCOPE,
  TREBON_TESTOVACI_PUSH_PAYLOAD,
  TREBON_TEST_NEPLATNA_SUBSCRIPTION,
  TREBON_VZKAZ_UPOZORNENI_PAYLOAD,
  odeslatTrebonSpravceUpozorneniS,
  odeslatTrebonTestovaciUpozorneniS,
  validovatTrebonSpravceSubscription,
  type ZavislostiTrebonSpravceUpozorneni,
} from "../src/lib/trebon-spravce-upozorneni";

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
  endpoint: "https://push.example.test/trebon-spravce",
  expirationTime: null,
  keys: { p256dh: "simulovany-p256dh", auth: "simulovany-auth" },
};

const navstevnicka = {
  endpoint: "https://push.example.test/navstevnik",
  expirationTime: null,
  keys: { p256dh: "jiny-p256dh", auth: "jiny-auth" },
};

const textVzkazu = "tajný text návštěvníka, který nesmí odejít v push";

function zavislosti(pred: {
  nacist?: ZavislostiTrebonSpravceUpozorneni["nacist"];
  odeslat?: ZavislostiTrebonSpravceUpozorneni["odeslat"];
}): { deps: ZavislostiTrebonSpravceUpozorneni; odeslani: unknown[] } {
  const odeslani: unknown[] = [];
  return {
    odeslani,
    deps: {
      nacist:
        pred.nacist ??
        (async () => ({
          ok: true as const,
          dokument: {
            upozorneniAktivni: true,
            pushSubscription: subscription,
          },
        })),
      odeslat:
        pred.odeslat ??
        (async (jedna, payload) => {
          odeslani.push({ endpoint: jedna.endpoint, payload });
          return { uspech: true };
        }),
    },
  };
}

async function hlavni(): Promise<void> {
  assert(
    JSON.stringify(TREBON_VZKAZ_UPOZORNENI_PAYLOAD) ===
      JSON.stringify({ title: "Třeboň po celý rok", body: "Vzkaz" }),
    "payload je jen titulek Třeboň po celý rok a tělo Vzkaz",
  );
  assert(
    !JSON.stringify(TREBON_VZKAZ_UPOZORNENI_PAYLOAD).includes(textVzkazu),
    "payload neobsahuje text vzkazu",
  );
  assert(
    TREBON_SPRAVCE_SW_CESTA === "/admin/sw.js" &&
      TREBON_SPRAVCE_SW_SCOPE === "/admin/",
    "správcovský worker má cestu /admin/sw.js a scope /admin/",
  );

  const platna = validovatTrebonSpravceSubscription(subscription);
  assert(platna.ok, "platná subscription projde validací");
  assert(
    !validovatTrebonSpravceSubscription([subscription, navstevnicka]).ok,
    "seznam návštěvnických odběrů se jako správcovská subscription nepřijme",
  );
  assert(
    !validovatTrebonSpravceSubscription({ endpoint: subscription.endpoint }).ok,
    "subscription bez klíčů se odmítne",
  );

  const uspech = zavislosti({});
  const poprve = await odeslatTrebonSpravceUpozorneniS(uspech.deps);
  const podruhe = await odeslatTrebonSpravceUpozorneniS(uspech.deps);
  assert(
    poprve.stav === "odeslan" && podruhe.stav === "odeslan",
    "každý pokus se odešle zvlášť",
  );
  assert(uspech.odeslani.length === 2, "dva vzkazy znamenají dva pokusy");
  assert(
    JSON.stringify(uspech.odeslani) ===
      JSON.stringify([
        { endpoint: subscription.endpoint, payload: TREBON_VZKAZ_UPOZORNENI_PAYLOAD },
        { endpoint: subscription.endpoint, payload: TREBON_VZKAZ_UPOZORNENI_PAYLOAD },
      ]),
    "odesílá se jen správcovská subscription a přesný payload",
  );
  assert(
    !JSON.stringify(uspech.odeslani).includes(navstevnicka.endpoint),
    "návštěvnický endpoint se nepoužije",
  );

  const vypnuto = zavislosti({
    nacist: async () => ({
      ok: true,
      dokument: { upozorneniAktivni: false, pushSubscription: subscription },
    }),
  });
  assert(
    (await odeslatTrebonSpravceUpozorneniS(vypnuto.deps)).stav === "neposlan" &&
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
    (await odeslatTrebonSpravceUpozorneniS(bezSubscription.deps)).stav ===
      "neposlan" && bezSubscription.odeslani.length === 0,
    "chybějící subscription push neodešle",
  );

  const neplatna = zavislosti({
    nacist: async () => ({
      ok: true,
      dokument: {
        upozorneniAktivni: true,
        pushSubscription: {
          endpoint: "",
          expirationTime: null,
          keys: { p256dh: "", auth: "" },
        },
      },
    }),
  });
  assert(
    (await odeslatTrebonSpravceUpozorneniS(neplatna.deps)).stav === "neposlan" &&
      neplatna.odeslani.length === 0,
    "neplatná subscription push neodešle a nemaže se",
  );

  const selhaniNacteni = zavislosti({
    nacist: async () => ({ ok: false }),
  });
  assert(
    (await odeslatTrebonSpravceUpozorneniS(selhaniNacteni.deps)).stav ===
      "neposlan",
    "selhání načtení push neodešle",
  );

  const selhaniSite = zavislosti({
    odeslat: async () => ({ uspech: false }),
  });
  assert(
    (await odeslatTrebonSpravceUpozorneniS(selhaniSite.deps)).stav === "neposlan",
    "neúspěšné odeslání vrátí neposlan a nevyhodí chybu",
  );

  const vyjimka = zavislosti({
    odeslat: async () => {
      throw new Error("simulované selhání push");
    },
  });
  assert(
    (await odeslatTrebonSpravceUpozorneniS(vyjimka.deps)).stav === "neposlan",
    "výjimka push se pohltí jako neposlan",
  );

  assert(
    JSON.stringify(TREBON_TESTOVACI_PUSH_PAYLOAD) ===
      JSON.stringify({
        title: "Třeboň po celý rok",
        body: "Testovací upozornění funguje.",
      }),
    "testovací payload má vlastní text a není to text vzkazu",
  );

  const testOdeslani: unknown[] = [];
  const testUspech = await odeslatTrebonTestovaciUpozorneniS({
    prihlasen: true,
    nacist: async () => ({
      ok: true,
      dokument: { upozorneniAktivni: true, pushSubscription: subscription },
    }),
    odeslat: async (jedna, payload) => {
      testOdeslani.push({ endpoint: jedna.endpoint, payload });
      return { uspech: true };
    },
  });
  assert(
    testUspech.uspech === true &&
      JSON.stringify(testOdeslani) ===
        JSON.stringify([
          {
            endpoint: subscription.endpoint,
            payload: TREBON_TESTOVACI_PUSH_PAYLOAD,
          },
        ]),
    "test odešle jeden push jen na správcovskou subscription Třeboně",
  );

  const testNeprihlasen = await odeslatTrebonTestovaciUpozorneniS({
    prihlasen: false,
    nacist: async () => ({
      ok: true,
      dokument: { upozorneniAktivni: true, pushSubscription: subscription },
    }),
    odeslat: async () => ({ uspech: true }),
  });
  assert(
    !testNeprihlasen.uspech && testNeprihlasen.chyba === "Nejste přihlášeni.",
    "test bez přihlášení nic neodešle",
  );

  const testVypnuto = await odeslatTrebonTestovaciUpozorneniS({
    prihlasen: true,
    nacist: async () => ({
      ok: true,
      dokument: { upozorneniAktivni: false, pushSubscription: subscription },
    }),
    odeslat: async () => ({ uspech: true }),
  });
  assert(
    !testVypnuto.uspech &&
      testVypnuto.chyba ===
        "Upozornění jsou vypnutá. Nejdřív je zapněte na tomto telefonu.",
    "vypnutý odběr test neodešle",
  );

  const testNeplatnyEndpoint = await odeslatTrebonTestovaciUpozorneniS({
    prihlasen: true,
    nacist: async () => ({
      ok: true,
      dokument: { upozorneniAktivni: true, pushSubscription: subscription },
    }),
    odeslat: async () => ({ uspech: false, statusCode: 410 }),
  });
  assert(
    !testNeplatnyEndpoint.uspech &&
      testNeplatnyEndpoint.chyba === TREBON_TEST_NEPLATNA_SUBSCRIPTION,
    "404/410 vrátí doporučení vypnout a znovu zapnout a subscription nemaže",
  );

  const testSelhani = await odeslatTrebonTestovaciUpozorneniS({
    prihlasen: true,
    nacist: async () => ({
      ok: true,
      dokument: { upozorneniAktivni: true, pushSubscription: subscription },
    }),
    odeslat: async () => {
      throw new Error("simulace");
    },
  });
  assert(
    !testSelhani.uspech &&
      testSelhani.chyba === "Testovací upozornění se nepodařilo odeslat.",
    "jiné selhání testu má srozumitelné hlášení",
  );

  const koren = join(__dirname, "..");
  const cist = (cesta: string) => readFileSync(join(koren, cesta), "utf8");

  const route = cist("src/app/api/vzkaz/route.ts");
  const poUlozeni = route.slice(route.indexOf("await pridatVzkaz"));
  const predAfter = poUlozeni.split("after(")[0] ?? "";
  assert(
    poUlozeni.startsWith("await pridatVzkaz") &&
      poUlozeni.includes("after(") &&
      poUlozeni.indexOf("after(") <
        poUlozeni.indexOf("return NextResponse.json({ uspech: true })") &&
      !predAfter.includes("odeslatTrebonSpravceUpozorneniNaVzkaz"),
    "odpověď se vrací hned po uložení a push je až v after()",
  );
  assert(
    !route.includes("odeslatPushNotifikaceVsem") &&
      !route.includes("pushOdbery"),
    "uložení vzkazu nevolá návštěvnickou rozesílku",
  );

  const nove = [
    "src/lib/trebon-spravce-upozorneni.ts",
    "src/lib/trebon-spravce-upozorneni-odeslani.ts",
    "src/lib/trebon-spravce-upozorneni-uloziste.ts",
    "src/app/admin/spravce-upozorneni-actions.ts",
    "src/lib/trebon-spravce-upozorneni-klient.ts",
    "src/components/admin/AdminSpravceUpozorneni.tsx",
    "public/admin/sw.js",
  ]
    .map(cist)
    .join("\n");
  assert(!nove.includes(textVzkazu), "zdroj upozornění neobsahuje ukázkový text vzkazu");
  assert(
    !nove.includes("pushOdbery") &&
      !nove.includes("odeslatPushNotifikaceVsem") &&
      !nove.includes("brana-upozorneni-nastaveni") &&
      !nove.includes("BLOB_BRANA_ADMIN"),
    "správcovské upozornění Třeboně nečte návštěvnické odběry ani úložiště BRÁNY",
  );
  const uloziste = cist("src/lib/trebon-spravce-upozorneni-uloziste.ts");
  assert(
    uloziste.includes("data/trebon-spravce-vzkaz-upozorneni.json") &&
      uloziste.includes("jeAdminPrihlasen"),
    "subscription je v samostatném souboru a zápis vyžaduje přihlášení",
  );
  const bezTokenuNacteni = uloziste.slice(
    uloziste.indexOf("async function nacistText"),
    uloziste.indexOf("await get("),
  );
  const bezTokenuZapisu = uloziste.slice(
    uloziste.indexOf("async function zapsat"),
    uloziste.indexOf("await put("),
  );
  assert(
    uloziste.includes("process.env.TREBON_SPRAVCE_BLOB_READ_WRITE_TOKEN") &&
      uloziste.includes('access: "private"') &&
      uloziste.includes("useCache: false") &&
      !uloziste.includes("ziskatVolbyBlobAsync") &&
      !uloziste.includes("ziskatVolbyBranaAdminBlob") &&
      !uloziste.includes("BLOB_STORE_ID") &&
      !uloziste.includes("process.env.BLOB_READ_WRITE_TOKEN") &&
      !uloziste.includes("BLOB_BRANA_ADMIN") &&
      bezTokenuNacteni.includes("if (!token)") &&
      bezTokenuNacteni.includes("return null") &&
      !bezTokenuNacteni.includes("await get(") &&
      bezTokenuZapisu.includes("if (!token)") &&
      bezTokenuZapisu.includes("throw new Error") &&
      !bezTokenuZapisu.includes("await put("),
    "chybějící nový token nepadá zpět do veřejného store ani do store BRÁNY",
  );
  const importySkriptu = cist("scripts/verify-trebon-vzkaz-push.ts").slice(
    0,
    cist("scripts/verify-trebon-vzkaz-push.ts").indexOf("let selhalo"),
  );
  assert(
    !importySkriptu.includes("@vercel/blob") &&
      !importySkriptu.includes("trebon-spravce-upozorneni-uloziste"),
    "ověřovací skript nevolá Blob a nemůže zapisovat do produkce",
  );
  assert(
    !cist("src/lib/trebon-spravce-upozorneni-odeslani.ts").includes("delete") &&
      !cist("src/lib/trebon-spravce-upozorneni.ts").includes("smazat"),
    "neplatná subscription se při odeslání nemaže",
  );

  const klient = cist("src/lib/trebon-spravce-upozorneni-klient.ts");
  const ui = cist("src/components/admin/AdminSpravceUpozorneni.tsx");
  assert(
    klient.includes("Notification.requestPermission") &&
      klient.includes("register(") &&
      klient.includes("TREBON_SPRAVCE_SW_SCOPE") &&
      !klient.includes('register("/sw.js")') &&
      !klient.includes("serviceWorker.ready"),
    "odběr vzniká na registraci /admin/, ne na galerijním workeru",
  );
  const predZapnutim = ui.slice(0, ui.indexOf("async function zapnout"));
  const odZapnuti = ui.slice(ui.indexOf("async function zapnout"));
  assert(
    ui.includes("onClick={() => void zapnout()}") &&
      !predZapnutim.includes("prihlasitTrebonSpravcePush()") &&
      odZapnuti.includes("await prihlasitTrebonSpravcePush()") &&
      !ui.includes("requestPermission"),
    "povolení oznámení se žádá až po kliknutí",
  );
  assert(
    ui.includes("Zapnout upozornění na tomto telefonu") &&
      ui.includes("Vypnout upozornění na tomto telefonu") &&
      ui.includes("Poslat testovací upozornění") &&
      ui.includes("aktivni ? (") &&
      ui.includes("odeslatTrebonTestovaciUpozorneniAkce"),
    "aktivní odběr ukazuje vypnutí a test, neaktivní jen zapnutí",
  );
  const testAkce = cist("src/app/admin/spravce-upozorneni-actions.ts");
  const teloTestAkce = testAkce.slice(
    testAkce.indexOf("export async function odeslatTrebonTestovaciUpozorneniAkce"),
  );
  assert(
    teloTestAkce.includes("jeAdminPrihlasen") &&
      teloTestAkce.includes("odeslatTrebonTestovaciUpozorneni") &&
      !teloTestAkce.includes("pridatVzkaz") &&
      !teloTestAkce.includes("odeslatBranaTestovaciPush") &&
      !teloTestAkce.includes("odeslatPushNotifikaceVsem") &&
      !teloTestAkce.includes("vypnoutTrebonSpravceUpozorneni"),
    "testovací akce je jen pro přihlášeného správce a nemaže odběr",
  );

  const sw = cist("public/admin/sw.js");
  assert(
    sw.includes("notificationclick") &&
      sw.includes("event.notification.close()") &&
      !sw.includes("openWindow") &&
      !sw.includes("addEventListener(\"fetch\""),
    "kliknutí oznámení nic neotevírá a worker nepřebírá síť galerie",
  );

  const galerieSw = cist("public/sw.js");
  assert(
    galerieSw.includes('tag: "trebon-novinka"') &&
      galerieSw.includes('clients.openWindow("/")') &&
      !galerieSw.includes("/admin/sw.js"),
    "veřejný service worker galerie zůstal beze změny",
  );
  assert(
    cist("src/lib/service-worker.ts").includes('register("/sw.js")') &&
      !cist("src/lib/service-worker.ts").includes("/admin/sw.js") &&
      !cist("src/components/RegistracePWA.tsx").includes("requestPermission") &&
      !cist("src/components/VzkazTreboni.tsx").includes("Notification"),
    "návštěvník není vyzýván k povolení oznámení",
  );

  const branaRoute = cist("src/app/api/brana/vzkaz/route.ts");
  const branaSw = cist("public/brana/sw.js");
  assert(
    branaRoute.includes('title: "BRÁNA"') === false &&
      branaRoute.includes("odeslatUpozorneniNaNovyVzkaz") &&
      branaRoute.includes("after(") &&
      branaSw.includes('let title = "BRÁNA"') &&
      branaSw.includes('let body = "V administraci BRÁNY je nové upozornění."') &&
      !branaSw.includes('title = "Třeboň po celý rok"'),
    "BRÁNA a její service worker zůstaly na svém upozornění",
  );

  const manifest = cist("public/manifest.json");
  assert(
    manifest.includes('"start_url": "/"') && !manifest.includes("/admin/sw.js"),
    "instalace PWA dál míří na úvod galerie",
  );

  if (selhalo > 0) {
    console.error(`Selhalo kontrol: ${selhalo}`);
    process.exit(1);
  }
  console.log("Všechny kontroly správcovského upozornění Třeboně prošly.");
}

void hlavni();
