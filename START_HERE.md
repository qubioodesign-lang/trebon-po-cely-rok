# START_HERE.md

Vstupní bod pro návrat k projektu po delší pauze (týdny, měsíce).

---

## Co to je

**Třeboň po celý rok** je klidná webová galerie — jedna fotografie na obrazovce, ne mřížka náhledů. Lidé se sem vracejí pro vzpomínky, sdílí fotky, mohou si nechat posílat push upozornění.

| | |
|---|---|
| **Produkce** | https://www.trebonpocelyrok.cz |
| **Admin** | https://www.trebonpocelyrok.cz/admin |
| **Stack** | Next.js 15, React 19, TypeScript, Tailwind, Vercel Blob |
| **Data** | Jeden JSON (`data/uloziste.json`) + soubory ve Vercel Blob |

Projekt běží na Vercel Pro. Nasazení probíhá automaticky po pushi do `main`.

---

## Kam dál

Nejdřív si přečti tyto dva soubory — obsahují detail, který zde záměrně chybí:

| Dokument | K čemu slouží |
|---|---|
| **[PROJEKT_STAV.md](./PROJEKT_STAV.md)** | Technický stav, architektura dat, jak fungují fotky, push, zálohy a analytics |
| **[ROADMAP.md](./ROADMAP.md)** | Co je hotové a co je naplánováno |

Pro lokální spuštění a strukturu složek viz **[README.md](./README.md)**.  
Pro nasazení na Vercel viz **[DEPLOY-VERCEL.md](./DEPLOY-VERCEL.md)**.

---

## Aktuální priority

**Fáze projektu:** sběr reálných dat na produkci; několik týdnů bez větších zásahů do kódu.

### Vysoká priorita

1. **Test iPhone** — galerie, sdílení, PWA instalace, celkový UX na reálném zařízení
2. **Ověření iPhone push** — end-to-end: PWA → povolení → subscription → admin push → doručení
3. **Automatické zálohování** — plánované zálohy (cron / Vercel Cron), zatím jen ruční z adminu

### Střední priorita

- Staging prostředí (např. `test.trebonpocelyrok.cz`) s odděleným Blob Store
- Kontrolovaný workflow staging → produkce

### Co už funguje (neměnit bez důvodu)

Galerie, sdílení, admin, ruční zálohy, push na Androidu, analytics v1a + v1.1.

---

## Jak bezpečně pokračovat ve vývoji

### 1. Obnov kontext

```bash
git pull origin main
git log -10 --oneline
```

Přečti [PROJEKT_STAV.md](./PROJEKT_STAV.md) (sekce *Současný stav* a *Známá omezení*) a [ROADMAP.md](./ROADMAP.md).

### 2. Lokální prostředí

```bash
npm install
copy .env.example .env
npm run dev
```

- Lokálně se používá soubor `data/uloziste.json` (bez Blob tokenu).
- Tajné hodnoty drž v `.env` — **nikdy necommituj** `.env`, `.env.vercel` ani jiné soubory s klíči.
- VAPID klíče a `BLOB_READ_WRITE_TOKEN` pro produkční chování jsou ve Vercel dashboardu.

### 3. Před změnami, které sahají na data

- V adminu vytvoř **ruční zálohu** (ZIP do Blob `backups/manual/`).
- Staging zatím **neexistuje** — každý push do `main` jde rovnou na produkci.
- Destruktivní operace (obnova zálohy, hromadné mazání) testuj nejdřív lokálně.

### 4. Vývoj a nasazení

1. Větší změny dělej na feature větvi, ne přímo na `main`.
2. Otestuj lokálně (`npm run dev`, volitelně `npm run test:analytics`).
3. Po merge do `main` Vercel nasadí automaticky — ověř produkci a admin.
4. Pokud měníš strukturu `uloziste.json`, zkontroluj `src/lib/uloziste-normalizace.ts`.

### 5. Na co dát pozor

| Riziko | Opatření |
|---|---|
| Push do `main` = okamžitá produkce | Feature větev + lokální test |
| Jeden JSON pro celý stav | Záloha před většími zásahy; serializace zápisů už je v kódu |
| iPhone push vyžaduje PWA | Netestovat jako běžný web v Safari |
| Soubory s tajemstvími | `.env*`, tokeny — jen lokálně / ve Vercel env |

---

## Rychlé odkazy

- Repozitář: https://github.com/qubioodesign-lang/trebon-po-cely-rok
- Poslední dokumentace stavu: commit `41650c5` (PROJEKT_STAV.md, ROADMAP.md)

---

*Poslední aktualizace: červen 2026*
