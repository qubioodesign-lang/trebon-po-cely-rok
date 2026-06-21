# ROADMAP.md

Přehled dokončených a plánovaných funkcí projektu **Třeboň po celý rok**.

---

## HOTOVO

### Galerie
- [x] Prohlížení fotografií (swipe, šipky, klávesnice)
- [x] Jedna fotografie na obrazovce, plynulé přechody
- [x] Zachování pozice po návratu z podstránek (`sessionStorage`)
- [x] Skok na nejnovější fotku (`|←` na mobilu)
- [x] Otevření konkrétní fotky z URL (`/?polozka=<uuid>`)
- [x] Responzivní layout (mobil + desktop)
- [x] PWA — manifest, service worker, ikony

### Sdílení fotografií
- [x] Trvalé sdílecí URL podle UUID položky
- [x] Web Share API + fallback kopírování do schránky
- [x] Analytics parametr `z=sdileni` v odkazu

### Push notifikace Android
- [x] Registrace push subscription
- [x] Ukládání odběratelů do `uloziste.json`
- [x] Hromadné odeslání z administrace
- [x] Retry logika při kolizi zápisů
- [x] Synchronizace existující subscription při opětovné návštěvě

### Administrace
- [x] Přihlášení heslem, session cookie
- [x] Nahrání, popis, pořadí, skrytí, smazání položek
- [x] Nahrazení fotografie bez změny ID
- [x] Přehled legacy metrik
- [x] Odeslání push notifikace
- [x] Diagnostika Blob úložiště

### Ruční zálohy
- [x] Vytvoření ZIP zálohy (metadata + soubory + nastavení)
- [x] Uložení do Blob `backups/manual/`
- [x] Seznam, stažení a obnova z administrace

### Analytics zdrojů návštěv
- [x] QR, WhatsApp, Sdílení, Přímý, Ostatní
- [x] 1× záznam za session prohlížeče
- [x] Tabulka v administraci

### Analytics zařízení
- [x] Android, iPhone/iOS, Desktop, Ostatní — návštěvy
- [x] Android, iPhone/iOS, Desktop, Ostatní — push odběratelé
- [x] Bez ukládání User-Agentu, pouze agregované countery
- [x] Tabulky v administraci

### Analytics fotografií
- [x] Zobrazení a sdílení per fotografie
- [x] Tabulka s náhledem v administraci

---

## PLÁNOVÁNO

### Priorita vysoká

| Úkol | Popis |
|---|---|
| **Test iPhone** | Ověřit galerii, sdílení, PWA instalaci a celkový UX na reálném zařízení |
| **Ověření iPhone push notifikací** | End-to-end test: PWA → povolení → subscription → admin push → doručení |
| **Automatické zálohování** | Plánované zálohy (cron / Vercel Cron) bez ručního kliknutí v adminu |

### Priorita střední

| Úkol | Popis |
|---|---|
| **Staging prostředí** | Samostatná instance (např. `test.trebonpocelyrok.cz`) pro bezpečné testování |
| **Oddělený Blob Store pro staging** | Izolace dat — staging nesmí sahat na produkční fotky ani metriky |
| **Workflow staging → produkce** | Kontrolovaný postup nasazení změn (branch, preview, schválení) |

### Priorita nižší

| Úkol | Popis |
|---|---|
| **Univerzální šablona projektu** | Obecná verze galerie pro další města / projekty |
| **Export / import projektu** | Přenos celého projektu včetně dat mezi instancemi |
| **Více projektů ze stejného základu** | Multi-tenant architektura nebo fork workflow |

---

## Poznámky k roadmapě

- **Aktuální fáze:** sběr reálných dat na produkci po nasazení Analytics v1.1; několik týdnů bez větších zásahů do kódu.
- **Staging** — analýza hotová, implementace zatím ne (viz konverzace v repozitáři).
- **Video** — datový model připraven (`typ: video`), UI a upload nejsou v roadmapě s pevným termínem.

---

*Poslední aktualizace: červen 2026*
