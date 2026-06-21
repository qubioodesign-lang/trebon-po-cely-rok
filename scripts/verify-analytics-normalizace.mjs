/**
 * Ověření, že normalizace zachová analyticsAgregovane a že
 * opakovaný zápis metrik kumuluje hodnoty (nesmaže předchozí).
 *
 * Spuštění: node scripts/verify-analytics-normalizace.mjs
 */

function normalizovatUloziste(data) {
  return {
    polozky: data.polozky ?? [],
    metriky: data.metriky ?? [],
    metrikyAgregovane: data.metrikyAgregovane,
    analyticsAgregovane: data.analyticsAgregovane,
    pushOdbery: data.pushOdbery ?? [],
    verzeUloziste: data.verzeUloziste,
  };
}

function prazdnaPocitadlaZarizeni() {
  return { android: 0, iphone: 0, desktop: 0, ostatni: 0 };
}

function prazdneAnalytics() {
  return {
    navstevyPodleZdroje: {
      qr: 0,
      whatsapp: 0,
      sdileni: 0,
      primy: 0,
      ostatni: 0,
    },
    navstevyPodleZarizeni: prazdnaPocitadlaZarizeni(),
    pushOdberyPodleZarizeni: prazdnaPocitadlaZarizeni(),
    fotografie: {},
  };
}

function zajistitAnalytics(uloziste) {
  if (!uloziste.analyticsAgregovane) {
    uloziste.analyticsAgregovane = prazdneAnalytics();
  }
  const a = uloziste.analyticsAgregovane;
  if (!a.navstevyPodleZarizeni) a.navstevyPodleZarizeni = prazdnaPocitadlaZarizeni();
  if (!a.pushOdberyPodleZarizeni) a.pushOdberyPodleZarizeni = prazdnaPocitadlaZarizeni();
  return a;
}

function aplikovatAnalytics(uloziste, payload) {
  const analytics = zajistitAnalytics(uloziste);
  switch (payload.typ) {
    case "navsteva":
      if (payload.zdroj && analytics.navstevyPodleZdroje[payload.zdroj] !== undefined) {
        analytics.navstevyPodleZdroje[payload.zdroj] += 1;
      }
      if (payload.zarizeni && analytics.navstevyPodleZarizeni[payload.zarizeni] !== undefined) {
        analytics.navstevyPodleZarizeni[payload.zarizeni] += 1;
      }
      break;
    case "povoleno_upozorneni":
      if (payload.zarizeni && analytics.pushOdberyPodleZarizeni[payload.zarizeni] !== undefined) {
        analytics.pushOdberyPodleZarizeni[payload.zarizeni] += 1;
      }
      break;
    case "zobrazeni_fotografie":
      if (payload.polozkaId) {
        if (!analytics.fotografie[payload.polozkaId]) {
          analytics.fotografie[payload.polozkaId] = { zobrazeni: 0, sdileni: 0 };
        }
        analytics.fotografie[payload.polozkaId].zobrazeni += 1;
      }
      break;
    default:
      break;
  }
}

function aplikovatMetriky(uloziste, udalosti) {
  for (const u of udalosti) {
    aplikovatAnalytics(uloziste, u);
  }
}

function simulovatZapis(uloziste, udalosti) {
  const nacteno = normalizovatUloziste(structuredClone(uloziste));
  aplikovatMetriky(nacteno, udalosti);
  return nacteno;
}

// --- test: normalizace zachová analytics ---
const blobJson = {
  polozky: [{ id: "f1" }],
  metriky: [],
  metrikyAgregovane: { pocetNavstev: 5 },
  analyticsAgregovane: {
    navstevyPodleZdroje: { qr: 2, whatsapp: 0, sdileni: 1, primy: 3, ostatni: 0 },
    navstevyPodleZarizeni: { android: 4, iphone: 2, desktop: 10, ostatni: 1 },
    pushOdberyPodleZarizeni: { android: 1, iphone: 0, desktop: 0, ostatni: 0 },
    fotografie: { f1: { zobrazeni: 4, sdileni: 1 } },
  },
  pushOdbery: [],
  verzeUloziste: 10,
};

const normalizovano = normalizovatUloziste(blobJson);
if (!normalizovano.analyticsAgregovane) {
  console.error("FAIL: normalizovatUloziste zahodila analyticsAgregovane");
  process.exit(1);
}
if (normalizovano.analyticsAgregovane.navstevyPodleZdroje.qr !== 2) {
  console.error("FAIL: qr counter po normalizaci", normalizovano.analyticsAgregovane);
  process.exit(1);
}
if (normalizovano.analyticsAgregovane.navstevyPodleZarizeni.android !== 4) {
  console.error("FAIL: android counter po normalizaci", normalizovano.analyticsAgregovane);
  process.exit(1);
}

// --- test: dva zápisy za sebou kumulují ---
let stav = structuredClone(blobJson);

stav = simulovatZapis(stav, [
  { typ: "navsteva", zdroj: "qr", zarizeni: "iphone" },
  { typ: "zobrazeni_fotografie", polozkaId: "f1" },
]);

if (stav.analyticsAgregovane.navstevyPodleZdroje.qr !== 3) {
  console.error("FAIL: qr po 1. zápisu očekáváno 3, je", stav.analyticsAgregovane.navstevyPodleZdroje.qr);
  process.exit(1);
}
if (stav.analyticsAgregovane.navstevyPodleZarizeni.iphone !== 3) {
  console.error("FAIL: iphone po 1. zápisu očekáváno 3, je", stav.analyticsAgregovane.navstevyPodleZarizeni.iphone);
  process.exit(1);
}
if (stav.analyticsAgregovane.fotografie.f1.zobrazeni !== 5) {
  console.error("FAIL: zobrazeni po 1. zápisu očekáváno 5, je", stav.analyticsAgregovane.fotografie.f1.zobrazeni);
  process.exit(1);
}

stav = simulovatZapis(stav, [
  { typ: "zobrazeni_fotografie", polozkaId: "f1" },
  { typ: "zobrazeni_fotografie", polozkaId: "f2-new" },
  { typ: "povoleno_upozorneni", zarizeni: "android" },
]);

if (stav.analyticsAgregovane.navstevyPodleZarizeni.iphone !== 3) {
  console.error("FAIL: iphone po 2. zápisu nesmí klesnout", stav.analyticsAgregovane.navstevyPodleZarizeni.iphone);
  process.exit(1);
}
if (stav.analyticsAgregovane.pushOdberyPodleZarizeni.android !== 2) {
  console.error("FAIL: push android po 2. zápisu očekáváno 2, je", stav.analyticsAgregovane.pushOdberyPodleZarizeni.android);
  process.exit(1);
}

// --- test: stará data bez zařízení se doplní při čtení ---
const staraData = structuredClone(blobJson);
delete staraData.analyticsAgregovane.navstevyPodleZarizeni;
delete staraData.analyticsAgregovane.pushOdberyPodleZarizeni;
const doplneno = simulovatZapis(staraData, [{ typ: "navsteva", zdroj: "primy", zarizeni: "desktop" }]);
if (doplneno.analyticsAgregovane.navstevyPodleZarizeni.desktop !== 1) {
  console.error("FAIL: migrace chybějících počítadel zařízení", doplneno.analyticsAgregovane);
  process.exit(1);
}

// --- test: stará chyba (bez analytics v normalizaci) by resetovala ---
function staraNormalizace(data) {
  return {
    polozky: data.polozky ?? [],
    metriky: data.metriky ?? [],
    metrikyAgregovane: data.metrikyAgregovane,
    pushOdbery: data.pushOdbery ?? [],
    verzeUloziste: data.verzeUloziste,
  };
}

const seStarouChybou = (() => {
  const nacteno = staraNormalizace(structuredClone(blobJson));
  aplikovatMetriky(nacteno, [{ typ: "navsteva", zdroj: "qr" }]);
  return nacteno;
})();

if (seStarouChybou.analyticsAgregovane?.navstevyPodleZdroje?.qr === 1) {
  console.log("OK: reprodukce staré chyby – reset na 1 místo 3");
}

console.log("OK: normalizace zachovává analyticsAgregovane");
console.log("OK: opakované zápisy kumulují analytics countery včetně zařízení");
console.log("Výsledný stav:", JSON.stringify(stav.analyticsAgregovane, null, 2));
