# PROJEKT_STAV.md

Dokument pro rychlé pochopení projektu novým vývojářem nebo AI.

---

## Název projektu

**Třeboň po celý rok** (`trebon-po-cely-rok`)

---

## Hlavní myšlenka projektu

Digitální místo pro návraty do Třeboně — klidná webová galerie, kam se lidé vracejí pro vzpomínky. Není to klasická fotogalerie s mřížkou náhledů, ale jedna fotografie na obrazovce, plynulé procházení a jemná interakce (swipe, šipky, sdílení, push upozornění).

---

## Produkční URL

- **Hlavní web:** https://www.trebonpocelyrok.cz
- **Alternativa (Vercel):** https://trebon-po-cely-rok.vercel.app

---

## Administrace URL

- https://www.trebonpocelyrok.cz/admin
- Přihlášení heslem (`ADMIN_HESLO` v env proměnných)
- Session přes `SESSION_TAJEMSTVI` (JWT cookie)

---

## Použité technologie

| Vrstva | Technologie |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS |
| Hosting | Vercel |
| Úložiště dat | Vercel Blob — metadata v `data/uloziste.json`, soubory v `uploads/` |
| Lokální vývoj | Soubor `data/uloziste.json` (bez Blob tokenu) |
| Push | Web Push API, `web-push`, VAPID klíče, service worker (`public/sw.js`) |
| PWA | `manifest.json`, instalace na plochu, offline cache |
| Zálohy | ZIP (`fflate`) ukládaný do Blob pod `backups/manual/` |
| Autentizace admin | `jose` (JWT session cookie) |

**Bez externích analytics služeb.** Metriky běží vlastním kódem přes `/api/metriky`.

---

## Struktura dat

Centrální soubor **`data/uloziste.json`** (produkčně ve Vercel Blob):

```json
{
  "polozky": [ /* galerie */ ],
  "metriky": [],  /* deprecated – migrováno do metrikyAgregovane */
  "metrikyAgregovane": { /* globální countery chování */ },
  "analyticsAgregovane": { /* analytics v1a + v1.1 */ },
  "pushOdbery": [ /* Web Push subscriptions */ ],
  "verzeUloziste": 123
}
```

### Položka galerie (`Polozka`)

- `id` — trvalé UUID (sdílecí odkazy, metriky)
- `typ` — `fotografie` | `video` (video zatím nepoužito)
- `soubor` — URL v Blob nebo lokální cesta
- `popis`, `datumPorizeni`, `datumPublikace`, `poradi`, `aktivni`

### Klíčové knihovny

| Soubor | Účel |
|---|---|
| `src/lib/uloziste-dat.ts` | Načtení/zápis dat, serializace zápisů, retry při kolizi |
| `src/lib/uloziste-blob.ts` | Blob get/put, veřejné čtení metadat |
| `src/lib/uloziste-normalizace.ts` | Normalizace JSON — zachová všechna agregovaná pole |
| `src/lib/metriky.ts` | Legacy metriky + batch zápis |
| `src/lib/analytics.ts` | Analytics agregace a souhrn pro admin |
| `src/lib/zaloha/` | Ruční zálohy a obnova |

---

## Jak fungují fotografie

1. **Nahrání** — admin nahraje soubor → uloží se do Blob `uploads/<uuid>.jpg` → metadata do `polozky[]`.
2. **Zobrazení** — veřejná galerie na `/` načte `/api/polozky`, seřadí podle `poradi` + `datumPublikace`.
3. **Prohlížení** — jedna fotka, swipe/šipky, pozice v `sessionStorage`.
4. **Sdílení** — trvalý odkaz `/?polozka=<uuid>&z=sdileni` (parametr `z` slouží i pro analytics).
5. **Nahrazení fotografie** — admin může vyměnit soubor bez změny `id` (zachová pořadí, metriky, sdílecí odkazy).
6. **Skrytí / smazání** — `aktivni: false` nebo odstranění položky + souboru z Blob.

---

## Jak fungují push notifikace

1. Uživatel na `/chci-se-vracet` požádá o upozornění.
2. **Android** — systémová žádost → service worker → subscription → POST `/api/push/odber`.
3. **iPhone** — bez PWA zobrazí návod „Přidat na plochu“; push vyžaduje nainstalovanou PWA.
4. Subscription se ukládá do `pushOdbery[]` v `uloziste.json`.
5. Admin může odeslat hromadnou notifikaci (titulek/text z `src/lib/push-notifikace.ts`).
6. Zápisy push odběru mají retry logiku kvůli souběžným zápisům metrik.

**Env:** `VAPID_VEREJNY_KLIC`, `VAPID_SOUKROMY_KLIC`, `VAPID_EMAIL`

---

## Jak fungují zálohy

- **Ruční záloha** z administrace → ZIP obsahuje:
  - `data/uloziste.json` (všechna metadata včetně metrik a analytics)
  - všechny soubory z `uploads/`
  - `manifest.json` (web manifest)
  - `settings/project.json` (netajná konfigurace push)
- ZIP se uloží do Blob: `backups/manual/<timestamp>.zip`
- **Seznam / stažení / obnova** — z admin panelu; obnova přepíše metadata a soubory (destructive operace)
- Záloha **neobsahuje** tajné env proměnné (VAPID private key apod.)

---

## Jak fungují analytics

Vlastní systém bez cookies a bez ukládání User-Agentu. Data jsou **pouze agregované countery** v `analyticsAgregovane`.

### v1a — zdroje a fotografie

| Událost | Co se počítá |
|---|---|
| `navsteva` + `zdroj` | QR, WhatsApp, Sdílení, Přímý, Ostatní (1× za session) |
| `zobrazeni_fotografie` | Počet zobrazení per `polozkaId` |
| `sdileni_fotografie` | Počet sdílení per `polozkaId` |

Detekce zdroje: URL parametry (`?z=qr`, `?z=wa`, `?polozka=…&z=sdileni`) a referrer.

### v1.1 — zařízení

| Událost | Co se počítá |
|---|---|
| `navsteva` + `zarizeni` | Android, iPhone/iOS, Desktop, Ostatní (1× za session) |
| `povoleno_upozorneni` + `zarizeni` | Zařízení push odběratele |

Detekce zařízení probíhá **v prohlížeči** (`src/lib/zarizeni-navstevnika.ts`); na server jde jen kategorie.

### Zápis metrik

- Klient dávkuje události (`useMetriky`) → POST `/api/metriky`
- Jeden Blob zápis na dávku (get → uprav → put s retry)
- Admin zobrazuje souhrn v sekci **analytics**

### Legacy metriky (`metrikyAgregovane`)

Globální countery: návštěvy, zobrazení, posuny, návraty, kliknutí „chci se vracet“, povolená upozornění, vracející se návštěvníci.

**Test:** `npm run test:analytics`

---

## Současný stav projektu

| Oblast | Stav |
|---|---|
| Galerie (produkce) | ✅ Běží |
| Sdílení fotografií | ✅ Běží |
| Push Android | ✅ Běží |
| Push iPhone | ⚠️ Vyžaduje PWA, ne plně otestováno |
| Administrace | ✅ Plně funkční |
| Ruční zálohy | ✅ Nasazeno |
| Analytics v1a + v1.1 | ✅ Nasazeno (commit `a364adf`) |
| Automatické zálohy | ❌ Neimplementováno |
| Staging prostředí | ❌ Neimplementováno (jen návrh) |

Produkce běží na Vercel Pro s Blob úložištěm. Projekt je ve fázi **sběru reálných dat** před delším testováním na iPhonu.

---

## Známá omezení

1. **iPhone push** — funguje až po přidání webu na plochu (PWA); UX je jiné než na Androidu.
2. **Souběžné zápisy** — při vysoké zátěži může POST `/api/metriky` občas vrátit 500 (kolize verze); data se často přesto uloží.
3. **Analytics zařízení** — historická data se nedoplňují zpětně; countery rostou od nasazení v1.1.
4. **Žádná databáze** — celý stav v jednom JSON; vhodné pro stovky položek, ne pro masivní scale.
5. **Video** — datový model připraven, UI a upload ne.
6. **Staging** — chybí; testování probíhá přímo na produkci nebo lokálně.
7. **Blob CDN prodleva** — ověření zápisu může krátce hlásit starší verzi.

---

## Poslední významné změny

| Commit | Popis |
|---|---|
| `a364adf` | Analytics v1.1 — zařízení návštěvníků a push odběratelů |
| `e0f930c` | Oprava ztráty `analyticsAgregovane` při normalizaci úložiště |
| `42bfd9f` | Analytics v1a — zdroje návštěv, zobrazení/sdílení per fotka |
| `86d5aab` | Ruční zálohování galerie do Blob |
| `eb69fc1` | Synchronizace existující push subscription při otevření stránky |
| `4581e20` | Zpevnění ukládání push odběru proti kolizím zápisů |

---

*Poslední aktualizace: červen 2026*
