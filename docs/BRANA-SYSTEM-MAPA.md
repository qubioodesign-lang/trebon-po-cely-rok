# BRÁNA — technická mapa systému

## 0. Stav dokumentu

| | |
|---|---|
| Datum vytvoření | 11. 8. 2026 |
| HEAD commit | `c8fdf96234d64697475fbd2eb9161787e1583422` |
| origin/main | shodný s HEAD |
| Upozornění | Jde o snapshot aktuálního stavu. Po dalších commitech nemusí být aktuální. |

---

## 1. BRÁNA v jedné mapě

```
                    ┌─────────────────────────────────────────┐
                    │            VEŘEJNÁ BRÁNA                │
                    │  Dnes · Zítra · Víkend · 7 dní · Výhled │
                    └────────────────┬────────────────────────┘
                                     │ čte
                                     ▼
                 ┌──────────────────────────────────────┐
                 │   verejne-schvalene-pohledy.ts        │
                 │   (projekce SCHVALENO + Používat ANO) │
                 └──────────┬───────────────┬───────────┘
                            │               │
                 čte Blob   │               │  čte Blob
                            ▼               ▼
        ┌─────────────────────┐   ┌──────────────────────────┐
        │ Konkrétní události  │   │   Redakční pořadí        │
        │ (Kalendář/Výhled)   │   │   (52 položek)           │
        │ data/brana-konkretni│   │   data/brana-redakcni-    │
        │ -udalosti.json      │   │   poradi.json            │
        └────┬────────────────┘   └──────────────────────────┘
             │                              ▲
             │ zapisuje                     │ čte
             │                              │
     ┌───────┴──────────────────────────────┴────────┐
     │             ADMINISTRACE BRÁNY                 │
     │  Správa · Redakční pořadí · Kalendář · Výhled  │
     │  Zdroje · Nezařazené · Upozornění · Analytika  │
     └──────────┬─────────────────────────────────────┘
                │ spouští
                ▼
     ┌──────────────────────────────────┐
     │         SCAN PIPELINE            │
     │  zdroj URL → fetch → parser →   │
     │  matching → CEKA_NA_SCHVALENI   │
     │  nebo → Nezařazené (NO-MATCH)   │
     └─────────────────────────────────┘
```

---

## 2. Veřejná BRÁNA

### Pohledy [HOTOVO]

| Pohled | Route | Stránka | Data |
|--------|-------|---------|------|
| Dnes | `/brana` | `"dnes"` | Události aktuálního dne |
| Zítra | `/brana/zitra` | `"zitra"` | Události zítřejšího dne |
| Víkend | `/brana/vikend` | `"vikend"` | So + Ne (nebo jen Ne, pokud je neděle) |
| 7 dní | `/brana/7-dni` | `"7-dni"` | 7 dnů od zítřka |
| Výhled | `/brana/vyhled` | `"vyhled"` | Budoucí události mimo 7denní okno, Výhled=ANO |

Každá stránka je tenký wrapper nad `BranaVerejnaStranka` (`src/components/brana/BranaVerejnaStranka.tsx`).

### Datový tok [HOTOVO]

1. `BranaVerejnaStranka` volá `nactiVerejneSchvalenePohledovaData(stranka)`.
2. Ta paralelně načte z PRIVATE Blobu:
   - konkrétní události (`data/brana-konkretni-udalosti.json`)
   - redakční pořadí (`data/brana-redakcni-poradi.json`) přes `nacistRedakcniPoradiProScheduler()`
3. Projekce přes `projektujSchvaleneDoVerejnehoPohledu()`:
   - filtr: `stavSchvaleni === "SCHVALENO"`, `!jeUkazkovaUdalost(u)`, `pouzivat === "ANO"`
   - pro denní pohledy: `dnyTrvaniUdalosti(u).includes(isoDen)` — vícedenní se zobrazí v každém dni
   - pro Výhled: `maVyhledAno()` + `datumOd >= dnes` + mimo 7denní okno
4. Výsledek: `BranaSdilenaPohledovaData { akce[], bloky[][], vyhledDatumy[], vyhledPredelIndex }`
5. Předá se do `BranaObrazovka` k vykreslení.

### Řazení [HOTOVO]

- Denní pohledy: `seradUdalostiDne()` — Priorita → Subpriorita z Redakčního pořadí; ruční události podle `rucniPoziceVDni`.
- Výhled: chronologicky podle `datumOd`, pak podle `id`.

### Časová logika [HOTOVO]

- Veškerá datumová logika v `Europe/Prague` (`src/lib/brana/cas.ts`).
- `BranaDatum = { rok, mesic, den }`.
- Klíčové: `dnesVPraze()`, `zitraVPraze()`, `pridatDny()`, `aktualniVikendVPraze()`.
- Časové kotvy: `src/lib/brana/casova-kotva.ts` — popisky pro scroll pohledy.

### Renderer [CHRÁNIT]

`BranaObrazovka.tsx` — hlavní UI shell:
- Header: „BRÁNA do Třeboně", obálka/vzkaz, sdílení.
- Navigační záložky: Dnes / Zítra / Víkend / 7 dní / Výhled.
- Časová kotva (scrollovatelná u víceblokových pohledů).
- Seznam akcí s denními předěly.
- Patička: odkaz „Třeboň po celý rok →", timestamp aktualizace.

### Veřejný Vzkaz [HOTOVO]

Route `/brana/vzkaz` — formulář pro návštěvníky.

---

## 3. Administrace

### Přehled sekcí [HOTOVO]

| Sekce | Route | Účel |
|-------|-------|------|
| Dashboard | `/brana/admin` | Hlavní vstup |
| Správa | `/brana/admin/sprava` | Hub pro podstránky |
| Redakční pořadí | `.../sprava/redakcni-poradi` | Tabulka 52 položek |
| Kalendář | `.../sprava/kalendar` | Projekce událostí do dnů + ruční zápis |
| Výhled | `.../sprava/vyhled` | Náhled budoucích schválených |
| Zdroje | `.../sprava/zdroje` | Správa URL zdrojů + spouštění scanu |
| Nezařazené | `.../sprava/nezarazene` | Inbox nesparovaných nálezů |
| Upozornění | `.../sprava/upozorneni` | Push notifikace |
| Záloha | `.../sprava/zaloha` | Záloha (placeholder) |
| Analytika | `/brana/admin/analytika` | Analytika |

### Autentizace [HOTOVO]

Všechny admin cesty chráněny `jeAdminPrihlasen()` (`src/lib/autentizace.ts`).

### Server actions [HOTOVO]

Soubor: `src/app/brana/admin/actions.ts` — 18+ exportovaných akcí.

Klíčové:
- `ulozitBranaRedakcniPoradiAkce` — uloží celé Redakční pořadí
- `pridatRucniKonkretniUdalostAkce` — ruční přidání události
- `upravitRucniKonkretniUdalostAkce` — úprava ruční události
- `smazatRucniKonkretniUdalostAkce` — smazání ruční události
- `schvalitKonkretniUdalostAkce` — schválení jedné CEKA události
- `schvalitKontroluAkce` — hromadné schválení sestavených CEKA
- `upravitAutomatickouCekaUdalostAkce` — úprava obsahu auto CEKA
- `vyrazitAutomatickouCekaUdalostAkce` — CEKA → VYRAZENO
- `skenovatBranaZdrojAkce` — ruční spuštění scanu jednoho zdroje
- `smazatBranaNezarazenyNalezAkce` — smazání nesparovaného nálezu
- `pridatBranaZdrojAkce` / `upravitBranaZdrojAkce` / `smazatBranaZdrojAkce`
- `oznacitPosledniScanDokoncenAkce` — odemkne ruční zápis v Kalendáři

---

## 4. Redakční pořadí

### Datový model [HOTOVO]

Soubor: `src/lib/brana/admin/redakcni-kostra.ts`

```
BranaRedakcniPolozkaStav {
  id: string               // stabilní identifikátor (nikdy se nemění)
  polozka: string           // editovatelný zobrazovaný název (max 100 znaků)
  pouzivat: "ANO" | "NE"   // aktivní / neaktivní
  priorita: number | null   // 0–999 (řazení v rámci dne)
  subpriorita: number | null // 0–999 (sekundární řazení)
  vyhled: "ANO" | "NE"     // zda se zobrazí ve Výhledu
  poznamka: string          // max 200 znaků
  mimoKostru: boolean       // true = mimo první kostru
}
```

### Katalog [HOTOVO]

- 22 položek `BRANA_REDAKCNI_KOSTRA` (Používat ANO) — stálá první kostra.
- 30 položek `BRANA_REDAKCNI_MIMO_KOSTRA` (Používat NE) — zásobník.
- Celkem 52 položek s pevným pořadím.

### Výhled ANO/NE [HOTOVO]

- Typ: `BranaRedakcniVyhled = "ANO" | "NE"` (bez `null`).
- Výchozí pro nové/neurčené:
  - `kino-aurora` → ANO
  - `trebonsky-divadelni-festival` → ANO
  - `statni-zamek-trebon` → ANO
  - všechna ostatní → NE
- Legacy normalizace: starý Blob s `null` → při čtení převeden na explicitní hodnotu podle mapy výše (`vychoziVyhledProId()`).

### Validace [HOTOVO]

Soubor: `src/lib/brana/admin/redakcni-poradi-validace.ts`

- `validovatRedakcniPoradiVstup(vstup, { legacyVyhled? })`:
  - Při čtení starého Blobu (`legacyVyhled: true`): null/neplatné → legacy výchozí.
  - Při save (`legacyVyhled: false`, výchozí): null/neplatné → **validační chyba**.
- `sloucitUlozeneSKostrou(ulozene)`: tolerantní merge starých dat s katalogem (vždy legacy).
- Vyžaduje přesně 52 položek se správnými id.

### Úložiště [HOTOVO]

Soubor: `src/lib/brana/admin/redakcni-poradi-uloziste.ts`

- **Blob cesta**: `data/brana-redakcni-poradi.json`
- **Čtení**: `nacistRedakcniPoradi()` (admin), `nacistRedakcniPoradiProScheduler()` (cron/scheduler)
- **Zápis**: `ulozitRedakcniPoradi(polozky)` — přepis celého dokumentu
- Při neexistujícím Blobu → výchozí kostra (editovatelná, nevytváří se automaticky)

### Kdo čte Redakční pořadí [HOTOVO]

- Admin Kalendář → řazení událostí + Schválit kontrolu
- Admin Výhled → filtr Výhled=ANO
- Admin Redakční pořadí → UI tabulka
- Veřejné pohledy → řazení + Používat + Výhled filtr
- Scan pipeline → matching kandidátů na pravidla

---

## 5. Kalendář

### Úložiště konkrétních událostí [HOTOVO]

Soubor: `src/lib/brana/admin/konkretni-udalosti-uloziste.ts`

- **Blob cesta**: `data/brana-konkretni-udalosti.json`
- Dokument: `{ verzeUloziste: 1, posledniScanDokoncen: boolean, udalosti: BranaKonkretniUdalost[] }`

### Datový model události [HOTOVO]

Soubor: `src/lib/brana/admin/konkretni-udalost.ts`

```
BranaKonkretniUdalost {
  id: string                          // "rucni-<UUID>" nebo "auto-<UUID>"
  redakcniPolozkaId: string | null    // null = ruční, string = vazba na Redakční pořadí
  datumOd: string                     // ISO YYYY-MM-DD
  datumDo: string                     // ISO YYYY-MM-DD (stejné = jednodenní)
  cas: string                         // HH:mm
  mistoNeboTyp: string
  nazev: string
  rucniPoziceVDni: number | null      // pozice ruční události v dni (null u automatických)
  stavSchvaleni: BranaStavSchvaleni   // stav schválení
  scanKlic?: string                   // obsahový klíč pro deduplikaci
}

BranaStavSchvaleni = "CEKA_NA_SCHVALENI" | "SCHVALENO" | "VYRAZENO"
```

### Rozdíl: scanovaná vs. ruční událost [HOTOVO]

| Vlastnost | Scanovaná | Ruční |
|-----------|-----------|-------|
| `id` | `auto-<UUID>` | `rucni-<UUID>` |
| `redakcniPolozkaId` | string (neprázdný) | `null` |
| `rucniPoziceVDni` | `null` | číslo ≥ 0 |
| `scanKlic` | přítomný | chybí |
| Počáteční stav | `CEKA_NA_SCHVALENI` | `SCHVALENO` |
| Výhled | podle Redakčního pořadí | nikdy (nemá vazbu) |

### `scanKlic` [HOTOVO]

Deterministický klíč: `redakcniPolozkaId\0datumOd\0cas\0nazev(lowercase)`.
Slouží k deduplikaci při opakovaném scanu.

### Projekce do dnů [HOTOVO]

`projektujKalendarDny()`:
- Vícedenní událost se zobrazí v každém dni rozsahu.
- VYRAZENO se vylučuje.
- Řazení: Priorita → Subpriorita; ruční události vkládány podle `rucniPoziceVDni`.

### Kontrolní blok [HOTOVO]

Soubor: `src/lib/brana/admin/kontrolni-blok.ts`

- 7denní rezerva (veřejné „7 dní") + 21denní kontrolní blok (konfigurovatelný interval).
- `sestavIdProSchvalitKontrolu()` — sestaví CEKA id pro „Schválit kontrolu": 21denní blokové CEKA + Výhled CEKA (bez blízkého okna).
- `spocitejPrazdneDnyKontrolnihoBloku()` — počet dnů bez relevantního pokrytí.
- `doplnPrazdneDnyDoKalendare()` — přidá prázdné dny, označí `jePrazdnyKontrolniDen`.

### Prázdné dny / řádky „0" [HOTOVO]

Prázdné dny kontrolního bloku zobrazené v UI. Nejsou Blob záznamy — jsou generované projkcí.
`jePrazdnyKontrolniDen = true` → den bez událostí v kontrolním období.

---

## 6. Výhled

### Není samostatné úložiště [HOTOVO]

Výhled je **pohled** (projekce) nad stejnými konkrétními událostmi jako Kalendář.

### Z jakých událostí vzniká [HOTOVO]

- `projektujVyhledPodleRoku()` (`konkretni-udalost.ts`):
  - `stavSchvaleni !== "VYRAZENO"`
  - `redakcniPolozkaId !== null` (ruční nejdou do Výhledu)
  - `maVyhledAno(redakcniPolozkaId)` → Výhled=ANO v Redakčním pořadí
  - `maDatumOdPatritDoVyhledu(datumOd)` → mimo 7denní okno, v budoucnosti

### Admin Výhled [HOTOVO]

Soubor: `src/app/brana/admin/sprava/vyhled/page.tsx`

- Bere jen Blob události (ne ukázkové).
- Projekce přes `projektujVyhledPodleRoku()` se stejnou logikou.
- Výsledek: skupiny podle roku, chronologicky seřazené.

### Veřejný Výhled [HOTOVO]

- Součást `verejne-schvalene-pohledy.ts`.
- Stejný filtr + navíc `stavSchvaleni === "SCHVALENO"` a `pouzivat === "ANO"`.
- Rozdělení na bloky: aktuální rok / příští rok.

---

## 7. Zdroje

### Datový model [HOTOVO]

```
BranaZdroj {
  id: string
  nazev: string
  typ: "DLOUHODOBY" | "RYCHLY"
  url: string
}
```

### Úložiště [HOTOVO]

- **Zdroje**: `data/brana-zdroje.json` — CRUD přes `zdroje-uloziste.ts`
- **Nastavení**: `data/brana-zdroje-nastaveni.json` — `{ dlouhodobyIntervalDni: 14|21|30 }` (výchozí 21)

### UI [HOTOVO]

`src/app/brana/admin/sprava/zdroje/page.tsx` + `BranaAdminZdrojeSeznam.tsx`

- Přidat / Upravit / Smazat zdroj.
- Tlačítko „Skenovat" u každého zdroje.

### Vazba na scan [HOTOVO]

Každý zdroj identifikován `id`. Scan bere URL zdroje, načte, parsuje, matchuje.

### Aktuálně funkční zdroje [NEOVĚŘENO]

Z kódu: parser podporuje JSON-LD schema.org + kinotrebon.cz HTML.
Produkční stav zdrojů (kolik jich je, URL) — bez Blob přístupu neověřitelné.
Ze známého kontextu: scan Kino Třeboň (`https://www.kinotrebon.cz/`) je funkční, vrátil 24 položek.

---

## 8. Scan a parsery

### Pipeline [HOTOVO]

Soubor: `src/lib/brana/admin/skenovat-zdroj.ts`

```
Zdroj (URL)
  → HTTP fetch (SSRF ochrana, 15s timeout, 1.5MB limit, 5 redirectů)
    → Parser (JSON-LD nebo kinotrebon.cz HTML)
      → Kandidáti (max 40, deduplikace)
        → Matching na Redakční pořadí (sparovatSRedakcniPolozkou)
          ├─ MATCH → CEKA_NA_SCHVALENI v Kalendáři
          │    + jazyk-brany-po-sparovani (normalizace mistoNeboTyp)
          └─ NO-MATCH → Nezařazené (inbox)
```

Dvě varianty: admin (`skenovatZnamyZdroj`) a scheduler (`skenovatZnamyZdrojProScheduler`).

### Parsery [HOTOVO]

Soubor: `src/lib/brana/admin/zdroj-scan-parser.ts`

1. **JSON-LD schema.org Event**: procházení `@graph`, `itemListElement`; extrakce name, startDate, endDate, location, doorTime.
2. **kinotrebon.cz HTML**: specializovaný parser pro šablonu Colosseum (`.section-event`, `heading-time`, `button-tickets-websale`); rozlišení Aurora vs. Světozor podle `KINOSÁL LÁZEŇSKÝ DŮM AURORA`.

### Matching [HOTOVO]

Soubor: `src/lib/brana/admin/zdroj-scan-sparovani.ts`

- Jen pravidla s Používat=ANO.
- Skóre: přesná shoda polozka (100) > přesná shoda poznámka (90) > substring ≥5 znaků (70).
- Nejednoznačnost (dva stejné skóry) → NO-MATCH.

### Deduplikace [HOTOVO]

`jeDuplicitniAutomatickaUdalost()`:
1. Primárně podle `scanKlic`.
2. Fallback: `redakcniPolozkaId + datumOd + cas + nazev`.

### Co se děje při opakovaném scanu [HOTOVO]

- Duplicitní (podle scanKlic) → přeskočena.
- Nová → CEKA_NA_SCHVALENI.
- Nesparovaná → do Nezařazených.
- Dříve nesparované, nyní sparované → vyřešeny (zmizí z Nezařazených).

### Co se stane při změně existující události [ROZPRACOVÁNO]

Pokud scan přinese událost se stejným `scanKlic` ale jiným obsahem → deduplikace ji považuje za existující, přeskočí.
Automatická aktualizace obsahu existujících událostí není implementována.

### Co se stane při zrušení události [ROZPRACOVÁNO]

Scan neumí detekovat zrušení — pokud URL událost nevrátí, stávající záznam v Blobu zůstává.

### Co systém zatím neumí

- Automatická aktualizace obsahu již nascanovaných událostí.
- Detekce zrušených/odstraněných událostí.
- Plánovaný automatický scheduler (cron varianty existují, ale konfigurace cronu neověřena).

---

## 9. Schvalování a publikace

### Stavový automat [HOTOVO]

```
Scan → CEKA_NA_SCHVALENI
         │
    ┌────┴────┐
    ▼         ▼
SCHVALENO   VYRAZENO
(veřejné)   (skryté, dedup paměť)
```

Ruční událost → rovnou `SCHVALENO`.

### Jak vznikne CEKA_NA_SCHVALENI [HOTOVO]

- Každá nová automatická událost ze scanu.

### Co znamená SCHVALENO [HOTOVO]

- Událost je viditelná ve veřejné BRÁNĚ (pokud splňuje datumový filtr, Používat=ANO, Výhled=ANO pro Výhled pohled).

### Co udělá schválení [HOTOVO]

- `schvalitKonkretniUdalostAkce(id)` → změní `stavSchvaleni` na `SCHVALENO`.
- `schvalitKontroluAkce(ids)` → hromadně schválí seznam CEKA id.

### Jak se událost dostane do veřejné BRÁNY [HOTOVO]

`stavSchvaleni === "SCHVALENO"` + `pouzivat === "ANO"` (z Redakčního pořadí) + datumový filtr pohledu.

### Hromadné schválení [HOTOVO]

„Schválit kontrolu" — tlačítko v Kalendáři, schválí sestavený seznam (`sestavIdProSchvalitKontrolu`).

### Okamžité publikování ruční události [HOTOVO]

Ruční událost je okamžitě `SCHVALENO` → viditelná v denních pohledech.

### VYRAZENO [HOTOVO]

- Událost zůstává v Blobu (pro deduplikaci), ale neprochází do veřejných pohledů.
- Administrace ji zobrazuje jako vyřazenou.

---

## 10. Ruční události

### Přidání [HOTOVO]

- Inline formulář v Kalendáři (ne modal, ne nová stránka).
- Dostupné jen po `posledniScanDokoncen === true`.
- Pole: datumOd, datumDo, čas, mistoNeboTyp, nazev, místo v dni.
- `id = "rucni-<UUID>"`, `redakcniPolozkaId = null`, `stavSchvaleni = "SCHVALENO"`.
- `rucniPoziceVDni` = číslo volené redaktorem (0 = před první automatickou, N = za N-tou).

### Úprava [HOTOVO]

- Tlačítko „Upravit" u ruční události.
- Aktualizuje obsah, zachovává id.

### Smazání [HOTOVO]

- Tlačítko „Smazat" u ruční události (jen u `redakcniPolozkaId === null`).
- Confirm dialog → filtruje ze seznamu v Blobu podle id.
- Nemění Redakční pořadí ani Výhled.
- Nespouští scan.

---

## 11. Data a úložiště

Všechna úložiště používají Vercel Blob (PRIVATE, `access: "private"`).

| Blob cesta | Obsah | Čtení | Zápis |
|---|---|---|---|
| `data/brana-redakcni-poradi.json` | 52 položek Redakčního pořadí | Admin, scheduler, veřejné pohledy | Admin (Uložit změny) |
| `data/brana-konkretni-udalosti.json` | Konkrétní události + stav scanu | Admin, veřejné pohledy | Admin (ruční CRUD, schválení, scan) |
| `data/brana-zdroje.json` | Seznam zdrojů (URL, typ) | Admin, scheduler | Admin (CRUD zdrojů) |
| `data/brana-zdroje-nastaveni.json` | Interval kontroly (14/21/30 dní) | Admin | Admin |
| `data/brana-nezarazene.json` | Nesparované nálezy + odmítnuté klíče | Admin, scan | Scan pipeline, admin (smazat) |
| `data/brana-upozorneni-nastaveni.json` | Push notifikace nastavení | Admin | Admin |

Env proměnné: `BLOB_BRANA_ADMIN_STORE_ID`, `BLOB_BRANA_ADMIN_READ_WRITE_TOKEN` (přes `env-blob-brana-admin.ts`).

---

## 12. PWA — Přidat BRÁNU na plochu [CHRÁNIT]

### Manifest [HOTOVO]

Soubor: `public/brana/manifest.webmanifest`

| Pole | Hodnota |
|------|---------|
| id | `https://brana.trebonpocelyrok.cz/` |
| name | `Brána do Třeboně` |
| short_name | `Třeboň` |
| start_url | `/` |
| scope | `/` |
| display | `standalone` |
| orientation | `portrait` |
| theme_color | `#144C8C` |
| background_color | `#4585C5` |

### Service Worker [HOTOVO]

- **BRÁNA SW**: `public/brana/sw.js` — registrace přes `src/lib/brana/service-worker.ts`.
  - Scope: `/` (subdoména) nebo `/brana/` (hlavní doména).
  - Network-only strategie (žádná cache), `skipWaiting` + `clients.claim`.
  - Web Push handler (fallback titulek „BRÁNA").

- **Třeboň SW**: `public/sw.js` — registrace přes `src/lib/service-worker.ts`.
  - Network-first + cache fallback (`trebon-v11`).
  - Samostatný, nekonfliktní.

### CTA (výzva k instalaci) [HOTOVO]

Soubor: `src/lib/brana/vyzva-plocha.ts`, `src/components/brana/BranaVyzvaPlocha.tsx`

- Zobrazí se po 8 sekundách + přepnutí pohledu (engagement signál).
- Session-only dismiss (module state, žádný localStorage).

### Platformní větve [HOTOVO]

Soubor: `src/lib/brana/pwa-instalacni-stav.ts`

| Platforma | Cesta |
|-----------|-------|
| Android + BIP prompt | Nativní install dialog |
| Android vložený prohlížeč (Custom Tab) | Chrome intent URL |
| iOS Safari | iOS instalační vrstva (Sdílet → Přidat na plochu) |
| iOS jiný prohlížeč | Odkaz na otevření v Safari |
| Desktop | Skryto |

### Včasné zachycení BIP [CHRÁNIT]

`public/brana/pwa-instalace-vcasna.js` — synchronní `beforeInteractive` skript zachytí `beforeinstallprompt` před hydratací Reactu.

### Ikony [HOTOVO]

| Route | Velikost | Varianta |
|-------|----------|----------|
| `/brana/icon` | 192×192 | brana |
| `/brana/apple-icon` | 512×512 | brana |
| `/pwa-launcher-icon` | 512×512 | trebon |
| `/pwa-splash-icon` | 512×512 | trebon splash |

---

## 13. Navigace a chráněné veřejné funkce [CHRÁNIT]

### Klikací navigace [HOTOVO]

Záložky Dnes / Zítra / Víkend / 7 dní / Výhled — Next.js `<Link>`.

### Swipe [HOTOVO]

Soubor: `src/components/brana/BranaSwipeObsah.tsx`

- Touch events: `touchstart` → `touchmove` (rozhodnutí horizontální vs. vertikální, práh 10px) → `touchend` (min vzdálenost 50px).
- Při swipe: `router.push()` na sousední stránku (`sousedniBranaStranka()`).
- Přechodová animace: innerHTML snapshot + CSS `translate3d` (360ms, `cubic-bezier(0.4, 0, 0.2, 1)`).
- Respektuje `prefers-reduced-motion`.
- Přeskakuje interaktivní elementy (a, button, input).

### URL / history [HOTOVO]

Next.js `useRouter().push()`. Cesty rozlišeny podle hostu (subdoména vs. hlavní doména) přes `branaZakladniCesta()`.

### Scroll [HOTOVO]

- Administrace: přirozený document scroll.
- Veřejná BRÁNA: `BranaKotvaScrollProvider` aktualizuje popisek časové kotvy při scrollu přes denní předěly.

### Sdílení [HOTOVO]

Tlačítko v headeru `BranaObrazovka` — Web Share API.

### Odkaz „Třeboň po celý rok" [CHRÁNIT]

Patička veřejné BRÁNY — odkaz na hlavní doménu (různá URL podle hostu).

### Middleware [CHRÁNIT]

`src/middleware.ts` — přepisuje clean paths na subdoémně `brana.trebonpocelyrok.cz`:
- `/` → `/brana`, `/zitra` → `/brana/zitra`, atd.
- `/admin*` → `/brana/admin*`
- Hlavička `Service-Worker-Allowed: /` pro `/brana/sw.js`.

---

## 14. Co je dnes rozpracované

| Oblast | Stav | Poznámka |
|--------|------|----------|
| Scheduler (automatický cron scan) | [ROZPRACOVÁNO] | Cron varianty funkcí existují (`*ProScheduler`), konfigurace cronu neověřena z kódu |
| Záloha | [ROZPRACOVÁNO] | Stránka existuje, funkčnost zálohy/exportu neověřena |
| Analytika | [ROZPRACOVÁNO] | Stránka existuje, rozsah neověřen |
| Upozornění (push) | [HOTOVO] | UI + push subscription + test push existují |
| Aktualizace obsahu existujících scanovaných událostí | [NEEXISTUJE] | Scan přeskočí duplicitní scanKlic |
| Detekce zrušených událostí | [NEEXISTUJE] | Stávající záznamy zůstávají |

---

## 15. Co dnes systém neumí / není bezpečné předpokládat

1. **Automatická aktualizace obsahu**: pokud se na zdroji změní čas/název události se stejným scanKlic, stávající záznam v Blobu zůstane starý.
2. **Detekce zrušení**: pokud událost zmizí ze zdroje, BRÁNA ji neodstraní.
3. **Více zdrojů na jednu položku**: matching je 1:1 (kandidát → jedna redakční položka).
4. **Produkční obsah Blobu**: bez secrets nelze ověřit konkrétní uložená data (id, scanKlic, redakcniPolozkaId).
5. **Scheduler konfigurace**: cron endpoint existuje v kódu, ale jeho nasazení (Vercel cron / externí trigger) nebylo ověřeno z repozitáře.

---

## 16. Regresní hranice — na co nesahat bez výslovného zadání

| Oblast | Důvod |
|--------|-------|
| `BranaObrazovka.tsx` | Hlavní renderer veřejné BRÁNY — swipe, navigace, layout |
| `BranaSwipeObsah.tsx` | Swipe gesta — prahy a animace |
| `BranaVyzvaPlocha.tsx` | PWA CTA — platformní větve |
| `pwa-instalace-vcasna.js` | BIP zachycení před hydratací |
| `manifest.webmanifest` | PWA identita — start_url, scope |
| `public/brana/sw.js` | Service worker — registrace, scope |
| `middleware.ts` | Subdoménové přepisy + SW header |
| `verejne-schvalene-pohledy.ts` | Filtrační a projekční logika veřejných pohledů |
| `cas.ts` | Časová logika Europe/Prague |
| `konkretni-udalosti-uloziste.ts` | Blob CRUD + deduplikace |
| `redakcni-kostra.ts` | Typ + 52 položek + legacy normalizace |
| Schvalovací stavy (CEKA/SCHVALENO/VYRAZENO) | Stavový automat |
| `kontrolni-blok.ts` | 21denní kontrolní blok + Schválit kontrolu |
| `jazyk-brany-po-sparovani.ts` | Normalizace jazyka po matchingu |

---

## 17. Klíčové soubory a jejich role

### Veřejná BRÁNA

| Soubor | Role |
|--------|------|
| `src/components/brana/BranaObrazovka.tsx` | Hlavní UI shell |
| `src/components/brana/BranaSwipeObsah.tsx` | Swipe navigace |
| `src/components/brana/BranaVerejnaStranka.tsx` | Server component — načtení dat |
| `src/lib/brana/verejne-schvalene-pohledy.ts` | Projekce SCHVALENO → veřejná data |
| `src/lib/brana/pohledy-data.ts` | Sdílené typy pohledů |
| `src/lib/brana/cas.ts` | Časová logika Europe/Prague |
| `src/lib/brana/casova-kotva.ts` | Popisky časových kotev |
| `src/lib/brana/navigace-stranky.ts` | Definice stránek, sousedé pro swipe |
| `src/lib/brana/cesty.ts` | URL cesty, subdoména/hlavní doména |

### Administrace

| Soubor | Role |
|--------|------|
| `src/app/brana/admin/actions.ts` | Všechny server actions (18+) |
| `src/lib/brana/admin/redakcni-kostra.ts` | Model Redakčního pořadí |
| `src/lib/brana/admin/redakcni-poradi-validace.ts` | Validace + legacy normalizace |
| `src/lib/brana/admin/redakcni-poradi-uloziste.ts` | Blob read/write Redakčního pořadí |
| `src/lib/brana/admin/konkretni-udalost.ts` | Model + projekce Kalendáře a Výhledu |
| `src/lib/brana/admin/konkretni-udalosti-uloziste.ts` | Blob CRUD událostí + scan zápis |
| `src/lib/brana/admin/kontrolni-blok.ts` | Kontrolní blok, Schválit kontrolu |
| `src/lib/brana/admin/skenovat-zdroj.ts` | Scan pipeline |
| `src/lib/brana/admin/zdroj-scan-parser.ts` | Parsery (JSON-LD + kinotrebon HTML) |
| `src/lib/brana/admin/zdroj-scan-sparovani.ts` | Matching na Redakční pořadí |
| `src/lib/brana/admin/jazyk-brany-po-sparovani.ts` | Jazyková normalizace |
| `src/lib/brana/admin/nezarazene.ts` | Model Nezařazených |
| `src/lib/brana/admin/nezarazene-uloziste.ts` | Blob read/write Nezařazených |
| `src/lib/brana/admin/ukazkove-udalosti.ts` | Ukázková data (4 demo události) |
| `src/lib/brana/admin/rucni-udalost-validace.ts` | Validace ručních událostí |
| `src/lib/brana/admin/sekce.ts` | Definice admin sekcí |

### PWA

| Soubor | Role |
|--------|------|
| `public/brana/manifest.webmanifest` | PWA manifest |
| `public/brana/sw.js` | BRÁNA service worker |
| `public/brana/pwa-instalace-vcasna.js` | Včasné BIP zachycení |
| `src/lib/brana/vyzva-plocha.ts` | CTA logika (zdvořilostní zpoždění) |
| `src/lib/brana/pwa-instalacni-stav.ts` | Platformní detekce |
| `src/lib/brana/pwa-instalace.ts` | BIP prompt handling |
| `src/components/brana/BranaVyzvaPlocha.tsx` | CTA UI |

---

## 18. Rychlý návrat do projektu

> **Pokud navazuješ na BRÁNU, nejdřív věz toto:**
>
> 1. **BRÁNA** je veřejný kulturní program města Třeboně dostupný na `brana.trebonpocelyrok.cz` s pěti pohledy (Dnes / Zítra / Víkend / 7 dní / Výhled) a administrací na `/brana/admin`.
>
> 2. **Data tečou jedním směrem**: Zdroje → Scan → Parser → Matching → Konkrétní události (Blob) → Schválení → Veřejné pohledy.
>
> 3. **Dvě hlavní úložiště**: Redakční pořadí (52 katalogových položek, řazení, Výhled ANO/NE) a Konkrétní události (scanované + ruční, stavy CEKA/SCHVALENO/VYRAZENO).
>
> 4. **Veřejné pohledy** jsou read-only projekce: filtrují `SCHVALENO` + `Používat=ANO` + datumové okno.
>
> 5. **Scan pipeline**: URL → HTTP fetch → JSON-LD nebo kinotrebon.cz HTML parser → matching na Redakční pořadí → CEKA_NA_SCHVALENI. Nespárované → Nezařazené.
>
> 6. **PWA „Přidat BRÁNU na plochu"** je funkční a ověřená. Má tři platformní větve (Android BIP, Chrome intent, iOS). Včasné BIP zachycení před hydratací je kritické. **Nesahej na to.**
>
> 7. **Swipe navigace** má přesné prahy (50px, 10px) a CSS transition. **Nesahej na to.**
>
> 8. **Výhled** je `"ANO" | "NE"` (bez null). Starý Blob s null se normalizuje při čtení (legacy kompatibilita). Nový save přijímá jen ANO/NE.
>
> 9. **Middleware** přepisuje cesty na subdoéně. `Service-Worker-Allowed: /` hlavička je kritická pro registraci SW s širším scope.
>
> 10. **Nikdy nespouštěj scan, nečti produkční Blob ani neexportuj secrets bez výslovného zadání.**
