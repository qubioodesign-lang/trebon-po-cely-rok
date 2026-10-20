"use client";

import { useState } from "react";
import type {
  BodPoctuGrafu,
  BodProchazeniGrafu,
  BranaAnalytikaGrafObdobi,
  PodkladyGrafuBrany,
} from "@/lib/brana/analytika/grafy";
import { BRANA_ANALYTIKA_POHLEDY, type BranaAnalytikaPohled } from "@/lib/brana/analytika/model";
import {
  RASTR_GRAFU,
  indexZPozice,
  indexyPopiskuOsy,
  maximumHodnot,
  podilyDvou,
  popisekBodu,
  popisekOkna,
  popisekOsy,
  posunVyber,
  souradniceBodu,
  stropOsy,
  textCisla,
  textPoctu,
  textProcenta,
  textProchazeniBodu,
  textProchazeniObdobi,
  textZmeny,
  usekyHodnot,
} from "@/lib/brana/admin/analytika-zobrazeni";

const OBDOBI: ReadonlyArray<{ id: BranaAnalytikaGrafObdobi; label: string }> = [
  { id: 7, label: "7 dní" },
  { id: 30, label: "30 dní" },
  { id: 90, label: "90 dní" },
  { id: 365, label: "Rok" },
];

const POHLEDY: ReadonlyArray<{ id: BranaAnalytikaPohled; nazev: string }> = [
  { id: "dnes", nazev: "Dnes" },
  { id: "zitra", nazev: "Zítra" },
  { id: "vikend", nazev: "Víkend" },
  { id: "7-dni", nazev: "7 dní" },
  { id: "vyhled", nazev: "Výhled" },
];

const VZHLED = [
  { barva: "#1B3A4B", carka: undefined },
  { barva: "#C47A4A", carka: "7 4" },
  { barva: "#2E6B4F", carka: "2 3" },
  { barva: "#6A4C93", carka: "9 3 2 3" },
  { barva: "#A33B3B", carka: "2 2 6 2" },
] as const;

type Krivka = {
  nazev: string;
  barva: string;
  carka?: string;
  hodnoty: (number | null)[];
  poznamka: (index: number) => string | null;
};

export function BranaAdminAnalytikaGrafy({
  podklady,
}: {
  podklady: Record<BranaAnalytikaGrafObdobi, PodkladyGrafuBrany>;
}) {
  const [obdobi, setObdobi] = useState<BranaAnalytikaGrafObdobi>(30);
  const data = podklady[obdobi];
  const prazdne = data.navstevnost.soucet === 0;

  return (
    <div className="min-w-0 max-w-full space-y-8">
      <div className="space-y-3">
        <h2 className="brana-nadpis-sekce text-text">Analytika</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Období">
          {OBDOBI.map((volba) => {
            const aktivni = volba.id === obdobi;
            return (
              <button
                key={volba.id}
                type="button"
                aria-pressed={aktivni}
                onClick={() => setObdobi(volba.id)}
                className={
                  aktivni
                    ? "min-h-11 rounded-sm border border-text/40 px-3 text-sm font-medium text-text"
                    : "min-h-11 rounded-sm border border-text-velmiJemny/30 px-3 text-sm font-light text-text-jemny"
                }
              >
                {volba.label}
              </button>
            );
          })}
        </div>
        <p className="brana-text-jemny">{popisekOkna(data.okno, data.rozliseni)}</p>
        {prazdne ? (
          <p className="brana-text-jemny">
            V tomto období zatím není žádná návštěva. Nula na grafu je naměřená nula.
          </p>
        ) : null}
      </div>

      <GrafNavstevnosti key={obdobi} data={data} />
      <GrafDvou
        key={`navratovost-${obdobi}`}
        nadpis="Návratovost"
        popis="Značka v tomto prohlížeči, ne unikátní osoba. Návštěva bez značky není v ani jedné skupině."
        souhrn={`Noví ${textPoctu(data.navratovost.soucetNovi)}. Vracející se ${textPoctu(data.navratovost.soucetVracejici)}.`}
        body={data.navratovost.novi}
        krivky={[
          krivkaPoctu("Noví", 0, data.navratovost.novi),
          krivkaPoctu("Vracející se", 1, data.navratovost.vracejici),
        ]}
      />
      <GrafSpusteni key={`spusteni-${obdobi}`} data={data} />
      <GrafZarizeni key={`zarizeni-${obdobi}`} data={data} />
      <GrafGeografie key={`geografie-${obdobi}`} data={data} />
      <GrafPohledu
        key={`kalendar-${obdobi}`}
        nadpis="Kalendář"
        popis="Součet prvního a dalších otevření pohledu."
        data={data}
        hodnoty={(pohled) => data.kalendar.rady[pohled].map((bod) => bod.hodnota)}
        souhrn={POHLEDY.map(
          (pohled) => `${pohled.nazev} ${textPoctu(data.kalendar.soucty[pohled.id])}`,
        ).join(". ")}
        detail={(pohled, index) => textPoctu(data.kalendar.rady[pohled][index]?.hodnota ?? null)}
      />
      <GrafProchazeni key={`prochazeni-${obdobi}`} data={data} />
      <GrafDvou
        key={`sdileni-${obdobi}`}
        nadpis="Sdílení"
        popis="Stisknutí Sdílet je pokus o odeslání, ne potvrzené doručení. Příchod je nová návštěva ze sdíleného odkazu."
        souhrn={`Stisknutí ${textPoctu(data.sdileni.soucetKlik)}. Příchody ${textPoctu(data.sdileni.soucetPrichod)}.`}
        body={data.sdileni.klik}
        krivky={[
          krivkaPoctu("Stisknutí Sdílet", 0, data.sdileni.klik),
          krivkaPoctu("Příchody ze sdílení", 1, data.sdileni.prichod),
        ]}
      />
      <GrafDvou
        key={`trebon-${obdobi}`}
        nadpis="Třeboň po celý rok"
        popis="Počet kliknutí na odkaz v zápatí BRÁNY. Není to počet osob ani dokončená návštěva cílového webu. Měření začíná nasazením této funkce; starší nuly nejsou důkaz nulového zájmu."
        souhrn={`Kliknutí ${textPoctu(data.proklikTrebon.soucet)}.`}
        body={data.proklikTrebon.klik}
        krivky={[krivkaPoctu("Kliknutí", 0, data.proklikTrebon.klik)]}
      />
      <GrafDvou
        key={`qr-${obdobi}`}
        nadpis="QR"
        popis="QR desktop je část QR celkem. Součty se nesčítají."
        souhrn={`QR celkem ${textPoctu(data.qr.soucetCelkem)}. QR desktop ${textPoctu(data.qr.soucetDesktop)}.`}
        body={data.qr.celkem}
        krivky={[
          krivkaPoctu("QR celkem", 0, data.qr.celkem),
          krivkaPoctu("QR desktop", 1, data.qr.desktop),
        ]}
      />
    </div>
  );
}

function krivkaPoctu(nazev: string, poradi: number, body: readonly BodPoctuGrafu[]): Krivka {
  const vzhled = VZHLED[poradi] ?? VZHLED[0];
  return {
    nazev,
    barva: vzhled.barva,
    carka: vzhled.carka,
    hodnoty: body.map((bod) => bod.hodnota),
    poznamka: (index) => textPoctu(body[index]?.hodnota ?? null),
  };
}

function GrafNavstevnosti({ data }: { data: PodkladyGrafuBrany }) {
  const predchozi = data.navstevnost.predchozi;
  const krivky = [krivkaPoctu("Aktuální období", 0, data.navstevnost.aktualni)];
  if (predchozi) {
    krivky.push({
      ...krivkaPoctu("Předchozí období", 1, predchozi),
      poznamka: (index) => {
        const bod = predchozi[index];
        if (!bod) {
          return null;
        }
        return `${popisekBodu(bod)}: ${textPoctu(bod.hodnota)}`;
      },
    });
  }
  const souhrn = [
    `Celkem ${textPoctu(data.navstevnost.soucet)}.`,
    predchozi ? `Předchozí období ${textPoctu(data.navstevnost.soucetPredchozi)}.` : null,
    textZmeny(data.navstevnost.zmenaProcent, predchozi !== null),
  ]
    .filter((radek): radek is string => radek !== null)
    .join(" ");

  return (
    <GrafKrivek
      nadpis="Návštěvnost"
      popis="Aktuální období a stejně dlouhé období před ním. U roku jen aktuální měsíce."
      souhrn={souhrn}
      body={data.navstevnost.aktualni}
      krivky={krivky}
    />
  );
}

function GrafSpusteni({ data }: { data: PodkladyGrafuBrany }) {
  const podily = podilyDvou(data.spusteni.soucetIkona, data.spusteni.soucetProhlizec);
  const souhrn = `Ikona ${textPoctu(data.spusteni.soucetIkona)}${podily.prvni === null ? "" : ` (${textProcenta(podily.prvni)})`}. Prohlížeč ${textPoctu(data.spusteni.soucetProhlizec)}${podily.druhy === null ? "" : ` (${textProcenta(podily.druhy)})`}.`;
  return (
    <GrafDvou
      nadpis="Způsob spuštění"
      popis="Podíly jsou ze součtů celého vybraného období."
      souhrn={podily.prvni === null ? `${souhrn} Podíl nelze spočítat.` : souhrn}
      body={data.spusteni.ikona}
      krivky={[
        krivkaPoctu("Ikona", 0, data.spusteni.ikona),
        krivkaPoctu("Prohlížeč", 1, data.spusteni.prohlizec),
      ]}
    />
  );
}

function formatDenMereni(iso: string): string {
  const [rok, mesic, den] = iso.split("-");
  return `${Number(den)}. ${Number(mesic)}. ${rok}`;
}

function krivkaZarizeni(nazev: string, poradi: number, body: readonly BodPoctuGrafu[]): Krivka {
  return {
    ...krivkaPoctu(nazev, poradi, body),
    poznamka: (index) => {
      const bod = body[index];
      if (!bod || bod.hodnota === null) {
        return "ještě se nesledovalo";
      }
      return textPoctu(bod.hodnota);
    },
  };
}

function GrafZarizeni({ data }: { data: PodkladyGrafuBrany }) {
  const mereniOd = data.zarizeni.mereniOd;
  const soucty = data.zarizeni.soucty;
  const procenta = data.zarizeni.procenta;
  const zasahujePred = Boolean(mereniOd && data.okno.od < mereniOd);
  const popis = !mereniOd
    ? "Zařízení se zatím nesledují."
    : zasahujePred
      ? `Zařízení se sledují až od ${formatDenMereni(mereniOd)}. Dny před tímto datem v grafu chybí a nejsou to naměřené nuly.`
      : `Zařízení se sledují od ${formatDenMereni(mereniOd)}. Podíly jsou jen z návštěv, u kterých se zařízení měřilo.`;
  const maPodily = procenta.android !== null;
  const souhrn = maPodily
    ? [
        `Android ${textPoctu(soucty.android)} (${textProcenta(procenta.android)})`,
        `iPhone / iOS ${textPoctu(soucty.ios)} (${textProcenta(procenta.ios)})`,
        `Počítač ${textPoctu(soucty.pocitac)} (${textProcenta(procenta.pocitac)})`,
        `Ostatní ${textPoctu(soucty.ostatni)} (${textProcenta(procenta.ostatni)})`,
      ].join(". ")
    : "Ve vybraném období není žádná měřená návštěva.";

  return (
    <GrafDvou
      nadpis="Zařízení"
      popis={popis}
      souhrn={souhrn}
      body={data.zarizeni.android}
      krivky={[
        krivkaZarizeni("Android", 0, data.zarizeni.android),
        krivkaZarizeni("iPhone / iOS", 1, data.zarizeni.ios),
        krivkaZarizeni("Počítač", 2, data.zarizeni.pocitac),
        krivkaZarizeni("Ostatní", 3, data.zarizeni.ostatni),
      ]}
    />
  );
}

function GrafGeografie({ data }: { data: PodkladyGrafuBrany }) {
  const soucty = data.geografie.soucty;
  const procenta = data.geografie.procenta;
  const radky = [
    ["Třeboňsko", soucty.trebonsko, procenta.trebonsko],
    ["Mimo Třeboňsko", soucty.mimo_trebonsko, procenta.mimo_trebonsko],
    ["Neurčeno", soucty.neurceno, procenta.neurceno],
  ] as const;
  return (
    <GrafDvou
      nadpis="Geografie"
      popis="Přibližná poloha internetového připojení podle ORP Třeboň, ne poloha osoby."
      souhrn={radky
        .map(([nazev, pocet, podil]) => `${nazev} ${textPoctu(pocet)} (${textProcenta(podil)})`)
        .join(". ")}
      body={data.geografie.trebonsko}
      krivky={[
        krivkaPoctu("Třeboňsko", 0, data.geografie.trebonsko),
        krivkaPoctu("Mimo Třeboňsko", 1, data.geografie.mimo_trebonsko),
        krivkaPoctu("Neurčeno", 2, data.geografie.neurceno),
      ]}
    />
  );
}

function GrafPohledu({
  nadpis,
  popis,
  souhrn,
  data,
  hodnoty,
  detail,
}: {
  nadpis: string;
  popis: string;
  souhrn: string;
  data: PodkladyGrafuBrany;
  hodnoty: (pohled: BranaAnalytikaPohled) => (number | null)[];
  detail: (pohled: BranaAnalytikaPohled, index: number) => string;
}) {
  const krivky = POHLEDY.map((pohled, poradi) => {
    const vzhled = VZHLED[poradi] ?? VZHLED[0];
    return {
      nazev: pohled.nazev,
      barva: vzhled.barva,
      carka: vzhled.carka,
      hodnoty: hodnoty(pohled.id),
      poznamka: (index: number) => detail(pohled.id, index),
    };
  });
  return (
    <GrafKrivek
      nadpis={nadpis}
      popis={popis}
      souhrn={souhrn}
      body={data.kalendar.rady[BRANA_ANALYTIKA_POHLEDY[0]]}
      krivky={krivky}
    />
  );
}

function GrafProchazeni({ data }: { data: PodkladyGrafuBrany }) {
  const krivky = POHLEDY.map((pohled, poradi) => {
    const vzhled = VZHLED[poradi] ?? VZHLED[0];
    const rada = data.prochazeni.rady[pohled.id];
    return {
      nazev: pohled.nazev,
      barva: vzhled.barva,
      carka: vzhled.carka,
      hodnoty: rada.map((bod) => bod.procento),
      poznamka: (index: number) => textProchazeniBodu(rada[index] ?? prazdnyProchazeni()),
    };
  });
  return (
    <GrafKrivek
      nadpis="Procházení Kalendáře"
      popis="Procento dosažení konce jen u seznamů, které vyžadovaly posouvání. Součet období je poměr součtů, ne průměr procent."
      souhrn={POHLEDY.map((pohled) =>
        textProchazeniObdobi(pohled.nazev, data.prochazeni.soucty[pohled.id]),
      ).join(". ")}
      body={data.prochazeni.rady.dnes}
      krivky={krivky}
      strop={100}
      jednotka="%"
    />
  );
}

function prazdnyProchazeni(): BodProchazeniGrafu {
  return {
    od: "",
    do: "",
    rok: 0,
    mesic: 1,
    den: null,
    pocetDnu: 0,
    nedostupnychDnu: 0,
    delsi: null,
    konec: null,
    procento: null,
  };
}

function GrafDvou(props: {
  nadpis: string;
  popis: string;
  souhrn: string;
  body: readonly BodPoctuGrafu[];
  krivky: Krivka[];
}) {
  return <GrafKrivek {...props} />;
}

function GrafKrivek({
  nadpis,
  popis,
  souhrn,
  body,
  krivky,
  strop,
  jednotka = "",
}: {
  nadpis: string;
  popis: string;
  souhrn: string;
  body: readonly Pick<BodPoctuGrafu, "od" | "do" | "den" | "rok" | "mesic" | "pocetDnu">[];
  krivky: readonly Krivka[];
  strop?: number;
  jednotka?: string;
}) {
  const [vyber, setVyber] = useState(() => Math.max(0, body.length - 1));
  const index = body.length === 0 ? 0 : Math.min(vyber, body.length - 1);
  const stropGrafu = strop ?? stropOsy(maximumHodnot(krivky.map((krivka) => krivka.hodnoty)));
  const plotH = RASTR_GRAFU.vyska - RASTR_GRAFU.horni - RASTR_GRAFU.dolni;
  const zaklad = RASTR_GRAFU.horni + plotH;
  const popisky = indexyPopiskuOsy(body.length);
  const bod = body[index];

  function vybratZUdalosti(udalost: React.PointerEvent<SVGSVGElement>): void {
    const rect = udalost.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }
    const x = ((udalost.clientX - rect.left) / rect.width) * RASTR_GRAFU.sirka;
    setVyber(indexZPozice(x, body.length));
  }

  return (
    <section className="min-w-0 max-w-full space-y-3 border-t border-text-velmiJemny/20 pt-6">
      <div className="space-y-1">
        <h3 className="text-base font-medium text-text">{nadpis}</h3>
        <p className="text-sm leading-snug text-text-jemny">{popis}</p>
        <p className="text-sm leading-snug text-text">{souhrn}</p>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {krivky.map((krivka) => (
          <li key={krivka.nazev} className="flex items-center gap-2 text-sm text-text">
            <svg width="28" height="8" viewBox="0 0 28 8" aria-hidden="true">
              <line
                x1="1"
                y1="4"
                x2="27"
                y2="4"
                stroke={krivka.barva}
                strokeWidth="2"
                strokeDasharray={krivka.carka}
              />
            </svg>
            {krivka.nazev}
          </li>
        ))}
      </ul>
      <svg
        viewBox={`0 0 ${RASTR_GRAFU.sirka} ${RASTR_GRAFU.vyska}`}
        className="block h-44 w-full max-w-full touch-pan-y"
        role="img"
        aria-label={nadpis}
        tabIndex={0}
        onPointerDown={vybratZUdalosti}
        onPointerMove={vybratZUdalosti}
        onKeyDown={(udalost) => {
          if (udalost.key === "ArrowLeft") {
            udalost.preventDefault();
            setVyber((aktualni) => posunVyber(aktualni, -1, body.length));
          }
          if (udalost.key === "ArrowRight") {
            udalost.preventDefault();
            setVyber((aktualni) => posunVyber(aktualni, 1, body.length));
          }
        }}
      >
        {[0, 0.5, 1].map((pomer) => {
          const y = RASTR_GRAFU.horni + plotH - pomer * plotH;
          const hodnota = stropGrafu * pomer;
          return (
            <g key={pomer}>
              <line
                x1={RASTR_GRAFU.levy}
                x2={RASTR_GRAFU.sirka - RASTR_GRAFU.pravy}
                y1={y}
                y2={y}
                stroke="#E4E0DA"
                strokeWidth="1"
              />
              <text x={RASTR_GRAFU.levy - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#6B6B6B">
                {textCisla(hodnota)}
                {jednotka}
              </text>
            </g>
          );
        })}
        {krivky.map((krivka) =>
          usekyHodnot(krivka.hodnoty).map((usek) => {
            const bodyUseku = usek.map((poradi) => {
              const hodnota = krivka.hodnoty[poradi] ?? 0;
              return souradniceBodu(poradi, body.length, hodnota, stropGrafu);
            });
            const klic = `${krivka.nazev}-${usek[0]}`;
            if (bodyUseku.length === 1) {
              const jediny = bodyUseku[0];
              return (
                <circle
                  key={klic}
                  cx={jediny?.x}
                  cy={jediny?.y}
                  r="3.5"
                  fill={krivka.barva}
                />
              );
            }
            return (
              <polyline
                key={klic}
                points={bodyUseku.map((souradnice) => `${souradnice.x},${souradnice.y}`).join(" ")}
                fill="none"
                stroke={krivka.barva}
                strokeWidth="2"
                strokeDasharray={krivka.carka}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          }),
        )}
        {bod ? (
          <line
            x1={souradniceBodu(index, body.length, 0, stropGrafu).x}
            x2={souradniceBodu(index, body.length, 0, stropGrafu).x}
            y1={RASTR_GRAFU.horni}
            y2={zaklad}
            stroke="#1B3A4B"
            strokeOpacity="0.35"
            strokeWidth="1"
          />
        ) : null}
        {krivky.map((krivka) => {
          const hodnota = krivka.hodnoty[index];
          if (hodnota === null || hodnota === undefined) {
            return null;
          }
          const souradnice = souradniceBodu(index, body.length, hodnota, stropGrafu);
          return (
            <circle
              key={`${krivka.nazev}-vyber`}
              cx={souradnice.x}
              cy={souradnice.y}
              r="4"
              fill="#FAF8F5"
              stroke={krivka.barva}
              strokeWidth="2"
            />
          );
        })}
        {popisky.map((poradi) => {
          const popisek = body[poradi];
          if (!popisek) {
            return null;
          }
          const x = souradniceBodu(poradi, body.length, 0, stropGrafu).x;
          return (
            <text key={poradi} x={x} y={RASTR_GRAFU.vyska - 8} textAnchor="middle" fontSize="10" fill="#6B6B6B">
              {popisekOsy(popisek)}
            </text>
          );
        })}
      </svg>
      <div className="space-y-1 text-sm leading-snug text-text" aria-live="polite">
        <p className="font-medium">{bod ? popisekBodu(bod) : "Bez údajů"}</p>
        {krivky.map((krivka) => (
          <p key={krivka.nazev}>
            <span className="text-text-jemny">{krivka.nazev}: </span>
            {krivka.poznamka(index) ?? "nedostupné"}
          </p>
        ))}
      </div>
    </section>
  );
}
