# Nasazení na Vercel – průvodce krok za krokem

Tento průvodce vás provede prvním testovacím nasazením pro mobilní testování.

## Co funguje na Vercelu (test)

- Galerie, tažení prstem, šipky
- Obrazovky „chci se vracet" a „děkujeme"
- PWA / HTTPS
- Ukázková fotografie z `data/uloziste-deploy.json`

## Co na Vercelu nefunguje (zatím)

- Nahrávání nových fotografií v administraci
- Trvalé ukládání metrik a úprav

---

## Krok 1 – Příprava projektu ✅

Projekt je připraven. Změny:

- `data/uloziste-deploy.json` – seed data pro Vercel (v gitu)
- `public/uploads/vzorova-fotografie.svg` – ukázková fotografie (v gitu)
- Úložiště na Vercelu běží jen pro čtení

---

## Krok 2 – Git repozitář

V terminálu ve složce projektu:

```bash
git init
git add .
git commit -m "Příprava pro testovací deploy na Vercel"
```

---

## Krok 3 – GitHub

1. Otevřete [github.com/new](https://github.com/new)
2. Název repozitáře: `trebon-po-cely-rok`
3. **Private** nebo Public – dle preference
4. **Nevytvářejte** README, .gitignore ani licenci (už existují)
5. Po vytvoření spusťte (nahraďte `VASE-USERNAME`):

```bash
git branch -M main
git remote add origin https://github.com/VASE-USERNAME/trebon-po-cely-rok.git
git push -u origin main
```

---

## Krok 4 – Vercel

1. [vercel.com](https://vercel.com) → přihlášení přes GitHub
2. **Add New → Project**
3. Import repozitáře `trebon-po-cely-rok`
4. Nastavení nechte default (Next.js)

### Environment Variables

| Název | Hodnota |
|---|---|
| `ADMIN_HESLO` | vaše heslo pro /admin |
| `SESSION_TAJEMSTVI` | náhodný řetěec min. 32 znaků |

5. Klikněte **Deploy**

---

## Krok 5 – Test na mobilu

Po deployi (1–2 min) otevřete URL typu:

```
https://trebon-po-cely-rok.vercel.app
```

Zkontrolujte tažení, popis pod fotografií a odkaz „chci se vracet".

---

## Řešení problémů

**Prázdná galerie** – zkontrolujte, že v repu jsou soubory `data/uloziste-deploy.json` a `public/uploads/vzorova-fotografie.svg`.

**Build selhal** – spusťte lokálně `npm run build` a opravte chyby před push.

**Admin neukládá** – na Vercelu je to očekávané u testovací verze.
