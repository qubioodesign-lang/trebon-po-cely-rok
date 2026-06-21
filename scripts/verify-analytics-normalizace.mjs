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

function prazdneAnalytics() {
  return {
    navstevyPodleZdroje: {
      qr: 0,
      whatsapp: 0,
      sdileni: 0,
      primy: 0,
      ostatni: 0,
    },
    fotografie: {},
  };
}

function zajistitAnalytics(uloziste) {
  if (!uloziste.analyticsAgregovane) {
    uloziste.analyticsAgregovane = prazdneAnalytics();
  }
  return uloziste.analyticsAgregovane;
}

function aplikovatAnalytics(uloziste, payload) {
  const analytics = zajistitAnalytics(uloziste);
  switch (payload.typ) {
    case "navsteva":
      if (payload.zdroj && analytics.navstevyPodleZdroje[payload.zdroj] !== undefined) {
        analytics.navstevyPodleZdroje[payload.zdroj] += 1;
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

// --- test: dva zápisy za sebou kumulují ---
let stav = structuredClone(blobJson);

stav = simulovatZapis(stav, [
  { typ: "navsteva", zdroj: "qr" },
  { typ: "zobrazeni_fotografie", polozkaId: "f1" },
]);

if (stav.analyticsAgregovane.navstevyPodleZdroje.qr !== 3) {
  console.error("FAIL: qr po 1. zápisu očekáváno 3, je", stav.analyticsAgregovane.navstevyPodleZdroje.qr);
  process.exit(1);
}
if (stav.analyticsAgregovane.fotografie.f1.zobrazeni !== 5) {
  console.error("FAIL: zobrazeni po 1. zápisu očekáváno 5, je", stav.analyticsAgregovane.fotografie.f1.zobrazeni);
  process.exit(1);
}

stav = simulovatZapis(stav, [
  { typ: "zobrazeni_fotografie", polozkaId: "f1" },
  { typ: "zobrazeni_fotografie", polozkaId: "f2-new" },
]);

if (stav.analyticsAgregovane.navstevyPodleZdroje.qr !== 3) {
  console.error("FAIL: qr po 2. zápisu nesmí klesnout, je", stav.analyticsAgregovane.navstevyPodleZdroje.qr);
  process.exit(1);
}
if (stav.analyticsAgregovane.fotografie.f1.zobrazeni !== 6) {
  console.error("FAIL: f1 zobrazeni po 2. zápisu očekáváno 6, je", stav.analyticsAgregovane.fotografie.f1.zobrazeni);
  process.exit(1);
}
if (stav.analyticsAgregovane.fotografie["f2-new"]?.zobrazeni !== 1) {
  console.error("FAIL: f2-new chybí po 2. zápisu");
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
console.log("OK: opakované zápisy kumulují analytics countery");
console.log("Výsledný stav:", JSON.stringify(stav.analyticsAgregovane, null, 2));
