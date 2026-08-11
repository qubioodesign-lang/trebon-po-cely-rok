# BRÁNA – Pracovní mapa zdrojů

Návratová mapa pro další návrh Zdrojů.

Zachycuje pouze to, co bylo v READ-ONLY průzkumu skutečně rozhodnuto / zjištěno.
Nevymýšlí nové zdroje ani nová redakční pravidla.

**Tento dokument není implementace.** Nemění Zdroje, Redakční pořadí, Kalendář ani aplikaci.

Stavy položek:

- `[ROZHODNUTO]` – závěr platí jako pracovní rozhodnutí
- `[PODMÍNĚNĚ]` – směr ano, finální režim ještě závisí na ověření / náhledu
- `[POZDĚJI]` – relevantní, ale ne pro první vlnu / teď neimplementovat
- `[NE]` – systematicky nesledovat (jako samostatný zdroj nebo jako typ obsahu)

---

## Společné principy zdrojů

1. Hlavní zdroj má pravdu.

2. Pasivní záloha hlavní zdroj průběžně nekontroluje, neopravuje jeho data a neslučuje jeho pole.

3. Záloha nastupuje při výpadku nebo prokazatelné mezeře.

4. U významné kotvy jsou dva zdroje žádoucí, ale ne dogma. U výrazné kotvy lze přidat třetí zdroj, pokud je prokazatelně potřeba (např. adventní trhy).

5. Jeden zdroj může pokrývat více položek Redakčního pořadí.

6. Významná samostatná série/festival s kvalitním vlastním webem má vlastní autoritu pro svůj program.

7. Široký městský zdroj pak není kontrolor stejné události.

8. Jedna událost = jedna událost BRÁNY, i když existuje ve více zdrojích.

9. Zdroj nemusí mít vysokou výtěžnost, pokud přináší unikátní lokální obsah.

10. Ne každý hodnotný obsah musí mít hned vlastní stabilní zdroj.

11. Horizont sběru není horizont publikace.

12. Horizont zdroje se neurčuje globálně: závisí na publikačním rytmu konkrétního zdroje.

13. 21denní checkpoint má nést maximum důležitých kotev.

14. Scan 2× týdně:
    - hlídá zdroje s krátkým horizontem,
    - zachycuje změny,
    - doplňuje lokální krátkodobé dění.

15. Pokud vypadne rychlé schvalování malých akcí, BRÁNA má dál fungovat díky páteřním kotvám.

16. Výpadek zásadní kotvy (např. kino) je pro BRÁNU problém, proto má být zdrojová odolnost kotev vyšší.

17. Redaktor nemá být hledač a korektor rozdílů mezi weby.

---

## Mapa skupin / kotev

### Kino Třeboň (Aurora + Světozor)

| Údaj | Hodnota |
|---|---|
| **Skupina / kotva** | Kino Třeboň – Aurora + Světozor |
| **Co BRÁNA chce** | Celý spolehlivě zveřejněný program projekcí |
| **Co BRÁNA nechce** | Domýšlení programu mimo zveřejněný web; (zatím) neřešíme tištěný vs digitální rozdíl aktivně |
| **Hlavní autoritativní zdroj** | `kinotrebon.cz` |
| **Pasivní záložní zdroj** | Zatím neurčen |
| **Třetí zdroj / výjimka** | — |
| **Horizont sběru** | Celý spolehlivě zveřejněný program na webu; pevný časový horizont neexistuje. Aktuálně cca 10 dní publikace (ověřeno: 24 projekcí, 11.–20. 8. 2026). 7denní veřejný horizont je dnes pokryt s rezervou. |
| **21denní checkpoint hlavní?** | Ne jako jediná cesta (web nyní nepublikuje 21 dní dopředu) |
| **Scan 2× týdně?** | Ano – důležitý, protože web publikuje jen krátký úsek |
| **Výhled** | Podle Redakčního pořadí |
| **Technické riziko** | Budoucí limit `MAX_KANDIDATU=40` (zatím se nemění); krátký digitální horizont |
| **Zdrojová mezera** | Uživatel má tištěný program kina na celý srpen → delší oficiální digitální zdroj zřejmě existuje a později jej chceme najít. Pasivní záloha kina zatím není určena. |
| **Stav** | `[ROZHODNUTO]` |

---

### Divadlo J. K. Tyla

| Údaj | Hodnota |
|---|---|
| **Skupina / kotva** | Divadlo J. K. Tyla – veřejný program |
| **Co BRÁNA chce** | Veřejný program JKT (představení / veřejné akce v divadle) |
| **Co BRÁNA nechce** | Pravidelné prohlídky budovy |
| **Hlavní autoritativní zdroj** | iTřeboň (pokrývá více pořadatelů) |
| **Pasivní záložní zdroj** | Zatím není pevně určen |
| **Třetí zdroj / výjimka** | Vlastní významné festivaly/série mohou mít vlastní autoritativní zdroj (viz Nocturna, TDF, Okolo…) |
| **Horizont sběru** | Pracovně cca 6 měsíců |
| **21denní checkpoint hlavní?** | Ano (dlouhý horizont umožňuje) |
| **Scan 2× týdně?** | Pojistka / doplněk |
| **Výhled** | Podle Redakčního pořadí |
| **Technické riziko** | iTřeboň: prázdné názvy části položek; nevymýšlet kreativní názvy |
| **Zdrojová mezera** | Pasivní záloha JKT zatím neurčena |
| **Stav** | `[ROZHODNUTO]` |

---

### Masarykovo náměstí – trhy / markety

| Údaj | Hodnota |
|---|---|
| **Skupina / kotva** | Masarykovo náměstí (kotva) – trhy / markety |
| **Co BRÁNA chce** | Trhy a markety na náměstí; typ/pořadatel nerozhoduje (městské trhy, MINT Market, Street Food, jarmark apod. mají vysokou relevanci). Adventní trhy = výrazná kotva. Den konání ano; čas není povinný. |
| **Co BRÁNA nechce** | Rozlišování podle pořadatele jako filtr relevance; samostatná „gastro větev“ jen kvůli Street Food |
| **Hlavní autoritativní zdroj** | VisitTřeboň |
| **Pasivní záložní zdroj** | iTřeboň |
| **Třetí zdroj / výjimka** | Pokud Visit + iTřeboň nepokryjí adventní trhy, třetí zdroj je opodstatněný |
| **Horizont sběru** | Celý zveřejněný dostupný plán |
| **21denní checkpoint hlavní?** | Ano |
| **Scan 2× týdně?** | Pojistka |
| **Výhled** | ANO (+ den konání ANO) |
| **Technické riziko** | — |
| **Zdrojová mezera** | Případné pokrytí adventních trhů (třetí zdroj pokud nutné) |
| **Stav** | `[ROZHODNUTO]` |

**Poznámka:** Street Food na náměstí je součást této kotvy – nevytvářet samostatnou gastro větev.

---

### Výlovy

| Údaj | Hodnota |
|---|---|
| **Skupina / kotva** | Výlovy (veřejné); Rožmberk = výrazná pevná kotva |
| **Co BRÁNA chce** | Celý oficiální výběr výlovů, které Rybářství Třeboň samo označí jako vhodné pro veřejnost |
| **Co BRÁNA nechce** | Jarní / běžné provozní výlovy automaticky |
| **Hlavní autoritativní zdroj** | `rybarstvi.cz` |
| **Pasivní záložní zdroj** | `trebonskykapr.cz` |
| **Třetí zdroj / výjimka** | — |
| **Horizont sběru** | Celý zveřejněný sezónní plán |
| **21denní checkpoint hlavní?** | Ano |
| **Scan 2× týdně?** | Pojistka |
| **Výhled** | Podle Redakčního pořadí |
| **Technické riziko** | Na stejné stránce může být aktuální rok + stará tabulka; rok musí být tvrdě validován |
| **Zdrojová mezera** | — |
| **Stav** | `[ROZHODNUTO]` |

---

### Významné městské akce

| Údaj | Hodnota |
|---|---|
| **Skupina / kotva** | Významné městské akce |
| **Co BRÁNA chce** | Silné / pevné kotvy města, mj.: Lázeňská Třeboň, Myslivecká Třeboň, Otevírání lázeňské sezóny, Historické slavnosti Jakuba Krčína, Třeboňská šlapka, Třeboňský (půl)maraton |
| **Co BRÁNA nechce** | Brát roční plán jako neměnnou pravdu bez možnosti pozdější změny termínu |
| **Hlavní autoritativní zdroj** | iTřeboň – roční kalendář / PDF + živý kalendář |
| **Pasivní záložní zdroj** | VisitTřeboň |
| **Třetí zdroj / výjimka** | U konkrétních akcí s vlastním webem může platit princip vlastní autority programu (např. maraton) |
| **Horizont sběru** | Celý zveřejněný roční plán |
| **21denní checkpoint hlavní?** | Ano |
| **Scan 2× týdně?** | Pojistka změny termínu (příklad: Šlapka – pozdější změna termínu) |
| **Výhled** | Podle Redakčního pořadí / ANO u série či celodenní kotvy dle pořadí |
| **Technické riziko** | Roční PDF vs pozdější realita; nutná pojistka změn |
| **Zdrojová mezera** | — |
| **Stav** | `[ROZHODNUTO]` |

---

### Třeboňská nocturna

| Údaj | Hodnota |
|---|---|
| **Skupina / kotva** | Třeboňská nocturna (festival / série) |
| **Co BRÁNA chce** | Výhled = festival/série; konkrétní den = konkrétní koncert |
| **Co BRÁNA nechce** | Aby široký městský zdroj kontroloval časy proti vlastnímu webu festivalu |
| **Hlavní autoritativní zdroj** | `trebonskanocturna.cz` |
| **Pasivní záložní zdroj** | iTřeboň |
| **Třetí zdroj / výjimka** | — |
| **Horizont sběru** | Program bývá dostupný měsíce dopředu |
| **21denní checkpoint hlavní?** | Ano |
| **Scan 2× týdně?** | Pojistka |
| **Výhled** | ANO (festival/série) |
| **Technické riziko** | — |
| **Zdrojová mezera** | — |
| **Stav** | `[ROZHODNUTO]` |

---

### Okolo Třeboně

| Údaj | Hodnota |
|---|---|
| **Skupina / kotva** | Okolo Třeboně (festival) |
| **Co BRÁNA chce** | Selektivní výběr z programu festivalu; vlastní web = autorita programu |
| **Co BRÁNA nechce** | Automaticky všech 40+ položek bez redakce; spoléhat na live program po festivalu (část se ořezává) |
| **Hlavní autoritativní zdroj** | `okolotrebone.cz` |
| **Pasivní záložní zdroj** | VisitTřeboň |
| **Třetí zdroj / výjimka** | — |
| **Horizont sběru** | Program měsíce dopředu; nasbírat včas před ořezáním live programu |
| **21denní checkpoint hlavní?** | Ano |
| **Scan 2× týdně?** | Pojistka / včasný sběr před ořezáním |
| **Výhled** | ANO (festival) |
| **Technické riziko** | Po festivalu se část live programu ořezává |
| **Zdrojová mezera** | — |
| **Stav** | `[ROZHODNUTO]` |

---

### TDF (Třeboňský divadelní festival)

| Údaj | Hodnota |
|---|---|
| **Skupina / kotva** | TDF – řídká série |
| **Co BRÁNA chce** | Výhled = série; konkrétní den = konkrétní představení |
| **Co BRÁNA nechce** | Model hustého festivalového týdne (TDF je spíš řídká série) |
| **Hlavní autoritativní zdroj** | `tdf.cz` |
| **Pasivní záložní zdroj** | VisitTřeboň |
| **Třetí zdroj / výjimka** | — |
| **Horizont sběru** | Měsíce dopředu (konkrétní program) |
| **21denní checkpoint hlavní?** | Ano |
| **Scan 2× týdně?** | Pojistka |
| **Výhled** | ANO (série) |
| **Technické riziko** | — |
| **Zdrojová mezera** | — |
| **Stav** | `[ROZHODNUTO]` |

---

### Galerie 105

| Údaj | Hodnota |
|---|---|
| **Skupina / kotva** | Galerie 105 (kulturní páteř centra) |
| **Co BRÁNA chce** | Vernisáže, workshopy, videoprojekce, setkání / programové momenty, vybrané momenty VIDIN |
| **Co BRÁNA nechce** | Samotný běh dlouhodobé výstavy |
| **Hlavní autoritativní zdroj** | `trebon105.cz/program` (filtr Galerie) |
| **Pasivní záložní zdroj** | iTřeboň |
| **Třetí zdroj / výjimka** | — |
| **Horizont sběru** | Typicky měsíce / týdny dle programu |
| **21denní checkpoint hlavní?** | Spíše ano |
| **Scan 2× týdně?** | Ano u hustých VIDIN |
| **Výhled** | Podle Redakčního pořadí |
| **Technické riziko** | Husté VIDINY = vyšší objem |
| **Zdrojová mezera** | — |
| **Stav** | `[ROZHODNUTO]` |

---

### Dům Štěpánka Netolického

| Údaj | Hodnota |
|---|---|
| **Skupina / kotva** | Dům Štěpánka Netolického |
| **Co BRÁNA chce** | Vernisáže, přednášky, skutečně mimořádné komentované akce, workshopy |
| **Co BRÁNA nechce** | Běžná expozice a běžný provoz |
| **Hlavní autoritativní zdroj** | Vlastní web / kalendář (`dumstepankanetolickeho.cz`) |
| **Pasivní záložní zdroj** | iTřeboň (může být důležitá kvůli technickému riziku) |
| **Třetí zdroj / výjimka** | — |
| **Horizont sběru** | Typicky týdny / měsíce |
| **21denní checkpoint hlavní?** | Spíše ano |
| **Scan 2× týdně?** | Pojistka |
| **Výhled** | Podle Redakčního pořadí |
| **Technické riziko** | WEDOS bot protection |
| **Zdrojová mezera** | — |
| **Stav** | `[ROZHODNUTO]` |

---

### Zámecká lékárna

| Údaj | Hodnota |
|---|---|
| **Skupina / kotva** | Zámecká lékárna |
| **Co BRÁNA chce** | Jen opravdu mimořádné večery, přednášky, jednorázové události a několik málo výjimečných termínů |
| **Co BRÁNA nechce** | Běžné denní prohlídky; automaticky „večerní = ANO“; „speciální“ akce opakovaná několikrát týdně celé léto (= turistická rutina) |
| **Hlavní autoritativní zdroj** | `zameckalekarnatrebon.cz` / měsíční program |
| **Pasivní záložní zdroj** | iTřeboň |
| **Třetí zdroj / výjimka** | — |
| **Horizont sběru** | Měsíční program |
| **21denní checkpoint hlavní?** | Spíše ano |
| **Scan 2× týdně?** | Pojistka |
| **Výhled** | Podle Redakčního pořadí |
| **Technické riziko** | Silný provozní šum; nutný přísný filtr |
| **Zdrojová mezera** | — |
| **Stav** | `[ROZHODNUTO]` |

---

### ZUŠ Třeboň

| Údaj | Hodnota |
|---|---|
| **Skupina / kotva** | ZUŠ Třeboň – stabilní sledovaný zdroj (není páteřní kotva) |
| **Co BRÁNA chce** | Veřejné koncerty, absolventské, vánoční akce, vernisáže, ZUŠ Open apod. |
| **Co BRÁNA nechce** | Interní provoz, zkoušky, přijímačky, výuku; akce mimo Třeboň běžně NE |
| **Hlavní autoritativní zdroj** | `zustrebon.cz`, především Plán práce |
| **Pasivní záložní zdroj** | iTřeboň |
| **Třetí zdroj / výjimka** | Třídní koncerty zatím podmíněně podle skutečné hodnoty/objemu |
| **Horizont sběru** | Plán práce + později doplněné termíny |
| **21denní checkpoint hlavní?** | Spíše ano |
| **Scan 2× týdně?** | Může doplnit později doplněné termíny |
| **Výhled** | Podle Redakčního pořadí |
| **Technické riziko** | Část termínů doplňována později |
| **Zdrojová mezera** | — |
| **Stav** | `[ROZHODNUTO]` (třídní koncerty `[PODMÍNĚNĚ]`) |

**Poznámka:** Vysoká mimosezónní hodnota.

---

### Knihovna Třeboň

| Údaj | Hodnota |
|---|---|
| **Skupina / kotva** | Knihovna |
| **Co BRÁNA chce** | Obsahově některé veřejné akce mohou projít schválením, pokud se objeví v iTřeboň / Nezařazených |
| **Co BRÁNA nechce** | Stabilní samostatný zdroj první vlny; zvláštní složitou zdrojovou cestu jen kvůli knihovně |
| **Hlavní autoritativní zdroj** | — (vlastní kalendář nyní slabý/prázdný) |
| **Pasivní záložní zdroj** | iTřeboň zachytí jen část |
| **Třetí zdroj / výjimka** | — |
| **Horizont sběru** | — |
| **21denní checkpoint hlavní?** | Ne jako páteř |
| **Scan 2× týdně?** | Ne kvůli knihovně jako zdroji |
| **Výhled** | Podle Redakčního pořadí (pokud se objeví jinde) |
| **Technické riziko** | Slabý vlastní kalendář |
| **Zdrojová mezera** | Vlastní web nefunguje jako spolehlivý program |
| **Stav** | `[POZDĚJI]` / `[NE]` jako stabilní zdroj první vlny |

---

### Sport – velké veřejné akce

| Údaj | Hodnota |
|---|---|
| **Skupina / kotva** | Sportovní události města (Třeboň / rybník Svět); některé mohou být kotvy |
| **Co BRÁNA chce** | Maraton, Běh kolem Světa, Dračí Svět, významné veslařské regaty a obdobné městské sportovní dění |
| **Co BRÁNA nechce** | Sportovní kalendář všeho; výsledky; tabulky; automaticky každé utkání |
| **Hlavní autoritativní zdroj** | Vlastní oficiální weby konkrétní akce mají přednost |
| **Pasivní záložní zdroj** | Široké městské zdroje (iTřeboň / Visit / Třeboňsko) dle akce |
| **Třetí zdroj / výjimka** | — |
| **Horizont sběru** | Typicky měsíce dopředu |
| **21denní checkpoint hlavní?** | Ano |
| **Scan 2× týdně?** | Pojistka |
| **Výhled** | Podle Redakčního pořadí / ANO u výrazné kotvy |
| **Technické riziko** | Různé weby pořadatelů |
| **Zdrojová mezera** | — |
| **Stav** | `[ROZHODNUTO]` |

---

### Sport – TJ Jiskra A-tým doma

| Údaj | Hodnota |
|---|---|
| **Skupina / kotva** | Fotbal TJ Jiskra – domácí utkání A-týmu |
| **Co BRÁNA chce** | Případně vybraná domácí utkání jako lokální zpestření („méně je více“) |
| **Co BRÁNA nechce** | Mládežnický fotbal a běžný mládežnický hokej systematicky; výjezdy; výsledky/tabulky jako cíl |
| **Hlavní autoritativní zdroj** | Zatím neuzavřeno finálně (v průzkumu: fotbalunas / krajský web) |
| **Pasivní záložní zdroj** | — |
| **Třetí zdroj / výjimka** | — |
| **Horizont sběru** | Sezónní rozpis; časy se mohou měnit |
| **21denní checkpoint hlavní?** | Spíše ne (týdenní rytmus + přesuny) |
| **Scan 2× týdně?** | Pokud by se zařadilo – spíše ano |
| **Výhled** | Podle Redakčního pořadí |
| **Technické riziko** | Agregátory; přesuny kick-off |
| **Zdrojová mezera** | Finální redakční pravidlo ještě není |
| **Stav** | `[PODMÍNĚNĚ]` – rozhodnout podle prvního reálného náhledu dne / počtu událostí. Objem cca 1–2 domácí / měsíc v sezoně. |

---

### Music Club Beseda

| Údaj | Hodnota |
|---|---|
| **Skupina / kotva** | Music Club Beseda – sledovaný mikrozdroj |
| **Co BRÁNA chce** | Pojmenované koncerty / akce |
| **Co BRÁNA nechce** | Běžná barová nabídka |
| **Hlavní autoritativní zdroj** | `besedaclub.cz` – Program |
| **Pasivní záložní zdroj** | — (zatím neuvedeno) |
| **Třetí zdroj / výjimka** | — |
| **Horizont sběru** | Část 21+ dní, část 7–20 dní |
| **21denní checkpoint hlavní?** | Částečně |
| **Scan 2× týdně?** | Ano – vhodný doplněk |
| **Výhled** | Podle Redakčního pořadí |
| **Technické riziko** | Smíšený předstih publikace |
| **Zdrojová mezera** | — |
| **Stav** | `[ROZHODNUTO]` |

---

### Bar Rondo

| Údaj | Hodnota |
|---|---|
| **Skupina / kotva** | Bar Rondo |
| **Co BRÁNA chce** | (Později) konkrétní pojmenované / mimořádné večery – ne každý otevřený večer |
| **Co BRÁNA nechce** | Implementaci teď; běžný provoz baru; vysoká frekvence bez silného filtru |
| **Hlavní autoritativní zdroj** | Skutečný program hlavně Facebook |
| **Pasivní záložní zdroj** | Web `rondobartrebon.cz` = vizitka, ne kalendář |
| **Třetí zdroj / výjimka** | — |
| **Horizont sběru** | Z veřejného webu nelze spolehlivě změřit |
| **21denní checkpoint hlavní?** | Ne |
| **Scan 2× týdně?** | Až bude technická cesta – ano; teď neimplementovat |
| **Výhled** | Podle Redakčního pořadí (později) |
| **Technické riziko** | Závislost na Facebooku; vysoká četnost → nutný silný filtr |
| **Zdrojová mezera** | Stabilní technická cesta k programu chybí |
| **Stav** | `[POZDĚJI]` – obsahově relevantní kandidát, **neimplementovat** |

---

### Harmonie / Adéla (lázeňské taneční večery)

| Údaj | Hodnota |
|---|---|
| **Skupina / kotva** | Restaurace Harmonie (Aurora) / Adéla (Berta) |
| **Co BRÁNA chce** | — |
| **Co BRÁNA nechce** | Samostatné zdroje pravidelných tanečních večerů; pravidelný lázeňský program jako rutina (lázeňští hosté jej mají přímo v lázních) |
| **Hlavní autoritativní zdroj** | — |
| **Pasivní záložní zdroj** | — |
| **Třetí zdroj / výjimka** | — |
| **Horizont sběru** | — |
| **21denní checkpoint hlavní?** | — |
| **Scan 2× týdně?** | — |
| **Výhled** | — |
| **Technické riziko** | — |
| **Zdrojová mezera** | — |
| **Stav** | `[NE]` |

---

### Ostende (jako podnik)

| Údaj | Hodnota |
|---|---|
| **Skupina / kotva** | Pláž Ostende jako podnik |
| **Co BRÁNA chce** | Skutečné významné události na místě zachytávat přes pořadatele / široké zdroje (např. Zavírání sezony přes Okolo Třeboně) |
| **Co BRÁNA nechce** | Sledovat Ostende jako podnik / gastro zdroj |
| **Hlavní autoritativní zdroj** | — (místo, ne zdroj) |
| **Pasivní záložní zdroj** | — |
| **Třetí zdroj / výjimka** | Události přes pořadatele / městské zdroje |
| **Horizont sběru** | — |
| **21denní checkpoint hlavní?** | — |
| **Scan 2× týdně?** | — |
| **Výhled** | — |
| **Technické riziko** | — |
| **Zdrojová mezera** | — |
| **Stav** | `[NE]` jako podnik; události jinde |

---

### Street Food (samostatná gastro větev)

| Údaj | Hodnota |
|---|---|
| **Skupina / kotva** | Street Food jako samostatná gastro větev |
| **Co BRÁNA chce** | Pokrytí přes kotvu Masarykovo náměstí |
| **Co BRÁNA nechce** | Samostatnou gastro větev jen kvůli Street Food |
| **Hlavní autoritativní zdroj** | — (viz Masarykovo náměstí / Visit + iTřeboň; City Event může být praktický vstup, ale ne nová větev) |
| **Pasivní záložní zdroj** | — |
| **Třetí zdroj / výjimka** | — |
| **Horizont sběru** | — |
| **21denní checkpoint hlavní?** | — |
| **Scan 2× týdně?** | — |
| **Výhled** | — |
| **Technické riziko** | — |
| **Zdrojová mezera** | — |
| **Stav** | `[NE]` jako samostatná větev; obsah už pod MN |

---

### Sport – mládež (fotbal / hokej)

| Údaj | Hodnota |
|---|---|
| **Skupina / kotva** | Mládežnický fotbal / běžný mládežnický hokej |
| **Co BRÁNA chce** | — |
| **Co BRÁNA nechce** | Systematické sledování |
| **Hlavní autoritativní zdroj** | — |
| **Pasivní záložní zdroj** | — |
| **Třetí zdroj / výjimka** | — |
| **Horizont sběru** | — |
| **21denní checkpoint hlavní?** | — |
| **Scan 2× týdně?** | — |
| **Výhled** | — |
| **Technické riziko** | — |
| **Zdrojová mezera** | — |
| **Stav** | `[NE]` |

---

## Rychlý přehled stavů

| Stav | Položky |
|---|---|
| `[ROZHODNUTO]` | Kino; JKT; MN trhy; Výlovy; Významné městské akce; Nocturna; Okolo Třeboně; TDF; Galerie 105; DSN; Zámecká lékárna; ZUŠ (jádro); Sport – velké akce; Beseda |
| `[PODMÍNĚNĚ]` | TJ Jiskra A-tým doma; ZUŠ třídní koncerty |
| `[POZDĚJI]` | Knihovna jako stabilní zdroj 1. vlny; Rondo |
| `[NE]` | Harmonie/Adéla jako zdroje; Ostende jako podnik; Street Food jako samostatná gastro větev; mládežnický fotbal/hokej systematicky |

---

## Otevřené otázky před implementací Zdrojů

- Najít případný delší oficiální digitální program Kina Třeboň, protože tištěný program existuje na celý srpen.
- Vybrat pasivní záložní zdroj Kina.
- Vybrat pasivní záložní zdroj JKT.
- Vyřešit případný třetí zdroj adventních trhů.
- Ověřit technickou cestu k DSN přes WEDOS.
- Později rozhodnout Jiskru A podle reálného náhledu.
- Později řešit sociální zdroje typu Rondo.
- Neimplementovat knihovnu jako zvláštní zdroj první vlny.

---

*Dokument vytvořen jako pracovní mapa z dosavadních READ-ONLY průzkumů. Žádná implementace.*
