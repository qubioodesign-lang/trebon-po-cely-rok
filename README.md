# Třeboň po celý rok

Digitální místo pro návraty. Ne fotogalerie — klidné místo, kam se lidé chtějí vracet.

## Technologie

- **Next.js 15** (App Router)
- **React 19** + **TypeScript**
- **Tailwind CSS**
- **JSON souborové úložiště** (`data/uloziste.json`) – bez nativních závislostí, funguje na Windows bez dalších nástrojů
- Připraveno pro **PWA** a push notifikace

## Rychlý start

Potřebujete pouze [Node.js](https://nodejs.org/) (LTS). Žádné Visual Studio Build Tools ani kompilace nativních modulů.

```bash
# Instalace závislostí
npm install

# Vytvoření .env souboru
copy .env.example .env
# Upravte ADMIN_HESLO a SESSION_TAJEMSTVI

# Vytvoření datového úložiště (volitelné – vytvoří se automaticky při prvním spuštění)
npm run db:init

# Volitelně: ukázková fotografie
npm run seed

# Spuštění vývojového serveru
npm run dev
```

Aplikace běží na [http://localhost:3000](http://localhost:3000).

Administrace: [http://localhost:3000/admin](http://localhost:3000/admin)

## Struktura projektu

```
src/
├── app/                    # Stránky a API routes
│   ├── page.tsx            # Hlavní galerie
│   ├── chci-se-vracet/     # Obrazovka pro upozornění
│   ├── dekujeme/           # Děkovací obrazovka
│   ├── admin/              # Administrace
│   └── api/                # REST API
├── components/             # React komponenty
├── hooks/                  # Vlastní hooky
├── lib/                    # Logika (úložiště, metriky, soubory)
└── types/                  # TypeScript typy
```

## Funkce

### Galerie
- Procházení tažením prstu nebo šipkami
- Jedna fotografie najednou, plynulé přechody
- Název „Třeboň po celý rok" přes fotografií
- Popis pod fotografií (malými písmeny, bez tečky)
- Odkaz „chci se vracet" pod každou fotografií

### Zachování pozice
Po návratu z obrazovek „chci se vracet" nebo „děkujeme" se uživatel vrátí na stejnou fotografii (sessionStorage).

### Datové úložiště

Data se ukládají do souboru `data/uloziste.json` (položky, metriky, push odběry). Pro první verzi je to nejjednodušší řešení – funguje na Windows, macOS i Linuxu bez kompilace. Při prvním spuštění aplikace se soubor vytvoří automaticky.

### Metriky
Sledované ukazatele:
- Počet návštěv a vracejících se návštěvníků
- Zobrazení fotografií, posuny vpřed a návraty zpět
- Procento návratů (klíčový ukazatel kvality obsahu)
- Kliknutí na „chci se vracet"
- Povolená push upozornění

### Push notifikace
- **Android**: standardní žádost o povolení
- **iPhone**: návod pro přidání webu na plochu (PWA)

Pro push notifikace vygenerujte VAPID klíče:
```bash
npx web-push generate-vapid-keys
```
A vložte je do `.env`.

### Administrace
Chráněná heslem (`ADMIN_HESLO` v `.env`):
- Nahrání fotografie nebo videa
- Zadání popisu
- Změna pořadí
- Skrytí / smazání položky
- Přehled metrik

### Budoucí video
Datový model podporuje typ `fotografie` | `video`. První verze používá pouze fotografie, ale architektura je připravena pro krátká videa bez nutnosti přepracování.

## PWA

Aplikace obsahuje:
- `manifest.json` pro instalaci na plochu
- Service worker (`public/sw.js`) pro offline cache a push
- Dynamicky generované ikony (písmeno T na krémovém pozadí)

## Vizuální styl

- Pozadí: `#FAF8F5` (teplá krémová)
- Text: `#2F2F2F` (tmavě šedá)
- Font: Inter
- Minimalistický, klidný, bez rušivých prvků

## Nasazení

```bash
npm run build
npm start
```

Pro produkci nastavte:
- `ADMIN_HESLO` — silné heslo pro administraci
- `SESSION_TAJEMSTVI` — náhodný řetěec min. 32 znaků
- `VAPID_VEREJNY_KLIC` a `VAPID_SOUKROMY_KLIC` — pro push notifikace

## Licence

Soukromý projekt.
