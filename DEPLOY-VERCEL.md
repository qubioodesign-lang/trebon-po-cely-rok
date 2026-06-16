# Nasazení na Vercel – průvodce

## Trvalé ukládání fotografií (Vercel Blob)

Projekt ukládá fotografie a metadata do **Vercel Blob**. Data přežijí redeploy i nové nasazení.

---

## Krok 1 – Aktualizace kódu lokálně

V terminálu ve složce projektu:

```bash
npm install
npm run build
```

Build musí skončit bez chyby.

---

## Krok 2 – Commit a push na GitHub

```bash
git add .
git commit -m "Trvalé ukládání fotografií přes Vercel Blob"
git push
```

---

## Krok 3 – Vytvoření Blob úložiště na Vercel

1. Otevřete [vercel.com/dashboard](https://vercel.com/dashboard)
2. V horní liště: **Storage** → **Create Database**
3. Vyberte **Blob** → **Continue**
4. Název: `trebon-fotografie` (libovolný)
5. Region: nejbližší (např. Frankfurt)
6. **Create**

---

## Krok 4 – Propojení Blob s projektem

1. Po vytvoření klikněte **Connect Project**
2. Vyberte projekt **trebon-po-cely-rok**
3. Zaškrtněte **Production**, **Preview**, **Development**
4. **Connect**

Vercel automaticky přidá proměnnou `BLOB_READ_WRITE_TOKEN` do projektu.

---

## Krok 5 – Redeploy

1. V projektu → **Deployments**
2. U posledního deploye: **⋯** → **Redeploy**
3. Počkejte na dokončení (1–2 min)

---

## Krok 6 – Ověření v administraci

1. Otevřete `https://vase-adresa.vercel.app/admin`
2. Přihlaste se
3. Mělo by být vidět: **„trvalé úložiště aktivní – fotografie a změny se ukládají"**
4. Nahrajte testovací fotografii
5. Obnovte stránku – fotografie musí zůstat

---

## Krok 7 – Nahrání 21 fotografií

1. V administraci nahrajte fotografie **po jedné**
2. U každé doplňte popis (malými písmeny, bez tečky)
3. Šipkami ↑ ↓ nastavte pořadí
4. Po nahrání všech otevřete galerii na mobilu a ověřte

**Tip:** Fotografie zmenšete před nahráním (např. pod 2 MB), aby nahrávání bylo rychlé.

---

## Lokální vývoj s Blob (volitelné)

Pro testování nahrávání i lokálně:

1. Vercel dashboard → Blob store → **.env.local** tab → zkopírujte token
2. Do `.env.local` přidejte:

```
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

3. `npm run dev` – nahrávání půjde do stejného Blob úložiště

---

## Řešení problémů

**„trvalé úložiště není aktivní"** – Blob není propojený s projektem. Opakujte kroky 3–5.

**Nahrávání selže (500)** – zkontrolujte Vercel → Project → Settings → Environment Variables, zda existuje `BLOB_READ_WRITE_TOKEN`.

**Fotografie se nenačte** – v prohlížeči zkontrolujte konzoli; URL musí směřovat na `*.public.blob.vercel-storage.com`.

**Po redeployi data zmizí** – Blob není propojený, nebo nahrávání proběhlo před krokem 4.
