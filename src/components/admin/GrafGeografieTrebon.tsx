"use client";

import { useState, type PointerEvent } from "react";
import {
  RASTR_GRAFU,
  indexZPozice,
  indexyPopiskuOsy,
  maximumHodnot,
  popisekBodu,
  popisekOkna,
  popisekOsy,
  posunVyber,
  souradniceBodu,
  stropOsy,
  textCisla,
  textPoctu,
  textProcenta,
  usekyHodnot,
} from "@/lib/brana/admin/analytika-zobrazeni";
import type {
  BodGeografieGrafu,
  GeografieGrafyAdmin,
  GeografieObdobi,
  GeografieObdobiPodklady,
} from "@/types";

const OBDOBI: ReadonlyArray<{ id: GeografieObdobi; label: string }> = [
  { id: 7, label: "7 dní" },
  { id: 30, label: "30 dní" },
  { id: 90, label: "90 dní" },
  { id: 365, label: "Rok" },
];

const VZHLED = [
  { nazev: "Třeboňsko", barva: "#1B3A4B", carka: undefined, klic: "trebonsko" },
  { nazev: "Mimo Třeboňsko", barva: "#C47A4A", carka: "7 4", klic: "mimo_trebonsko" },
  { nazev: "Neurčeno", barva: "#2E6B4F", carka: "2 3", klic: "neurceno" },
] as const;

/** Graf Geografie ve stejném vzhledu a ovládání jako na BRÁNĚ. */
export function GrafGeografieTrebon({ podklady }: { podklady: GeografieGrafyAdmin }) {
  const [obdobi, setObdobi] = useState<GeografieObdobi>(30);
  const data = podklady[obdobi];
  const merenaNula =
    data.soucty.trebonsko === 0 &&
    data.soucty.mimo_trebonsko === 0 &&
    data.soucty.neurceno === 0;
  const souhrn = VZHLED.map(
    (rada) =>
      `${rada.nazev} ${textPoctu(data.soucty[rada.klic])} (${textProcenta(data.procenta[rada.klic])})`,
  ).join(". ");

  return (
    <div className="min-w-0 max-w-full space-y-3">
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
      <p className="text-sm leading-snug text-text-jemny">
        {popisekOkna(data.okno, data.rozliseni)}
      </p>
      {merenaNula ? (
        <p className="text-sm leading-snug text-text-jemny">
          V tomto období zatím není žádná návštěva. Nula na grafu je naměřená nula.
        </p>
      ) : null}
      <GrafTela key={obdobi} data={data} souhrn={souhrn} />
    </div>
  );
}

function GrafTela({ data, souhrn }: { data: GeografieObdobiPodklady; souhrn: string }) {
  const krivky = VZHLED.map((rada) => ({
    nazev: rada.nazev,
    barva: rada.barva,
    carka: rada.carka,
    hodnoty: data.body.map((bod) => bod[rada.klic]),
  }));
  return (
    <GrafKrivek
      nadpis="Geografie"
      popis="Přibližná poloha internetového připojení podle ORP Třeboň, ne poloha osoby."
      souhrn={souhrn}
      body={data.body}
      krivky={krivky}
    />
  );
}

function GrafKrivek({
  nadpis,
  popis,
  souhrn,
  body,
  krivky,
}: {
  nadpis: string;
  popis: string;
  souhrn: string;
  body: readonly BodGeografieGrafu[];
  krivky: readonly {
    nazev: string;
    barva: string;
    carka?: string;
    hodnoty: (number | null)[];
  }[];
}) {
  const [vyber, setVyber] = useState(() => Math.max(0, body.length - 1));
  const index = body.length === 0 ? 0 : Math.min(vyber, body.length - 1);
  const stropGrafu = stropOsy(maximumHodnot(krivky.map((krivka) => krivka.hodnoty)));
  const plotH = RASTR_GRAFU.vyska - RASTR_GRAFU.horni - RASTR_GRAFU.dolni;
  const zaklad = RASTR_GRAFU.horni + plotH;
  const popisky = indexyPopiskuOsy(body.length);
  const bod = body[index];

  function vybratZUdalosti(udalost: PointerEvent<SVGSVGElement>): void {
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
              return <circle key={klic} cx={jediny?.x} cy={jediny?.y} r="3.5" fill={krivka.barva} />;
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
            {textPoctu(krivka.hodnoty[index] ?? null)}
          </p>
        ))}
      </div>
    </section>
  );
}
