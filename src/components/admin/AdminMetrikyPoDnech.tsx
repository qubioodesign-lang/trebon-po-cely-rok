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
  usekyHodnot,
} from "@/lib/brana/admin/analytika-zobrazeni";
import type {
  BodMetrikDne,
  KlicMetrikDne,
  MetrikyDnuObdobi,
  MetrikyDnuObdobiPodklady,
  MetrikyPoDnechGrafy,
} from "@/types";

const OBDOBI: ReadonlyArray<{ id: MetrikyDnuObdobi; label: string }> = [
  { id: 7, label: "7 dní" },
  { id: 30, label: "30 dní" },
  { id: 90, label: "90 dní" },
  { id: 365, label: "Rok" },
];

const RADY: ReadonlyArray<{
  klic: KlicMetrikDne;
  nazev: string;
  barva: string;
  carka?: string;
}> = [
  { klic: "navstevy", nazev: "Návštěvy", barva: "#1B3A4B" },
  { klic: "navstevniciNovi", nazev: "Noví", barva: "#2E6B4F" },
  { klic: "navstevniciVracejici", nazev: "Vracející se", barva: "#C47A4A", carka: "7 4" },
  { klic: "navstevyZIkony", nazev: "Z ikony", barva: "#6B5B7A", carka: "2 3" },
  { klic: "klikChciSeVracet", nazev: "Chci se vracet", barva: "#8C3A3A" },
  { klic: "klikPridatNaPlochu", nazev: "Přidat na plochu", barva: "#3D6B8C", carka: "4 3" },
];

function textZmeny(hodnota: number | null): string {
  if (hodnota === null) {
    return "bez srovnání";
  }
  const znamenko = hodnota > 0 ? "+" : "";
  return `${znamenko}${textCisla(hodnota)} %`;
}

function formatData(iso: string): string {
  const [rok, mesic, den] = iso.split("-");
  return `${Number(den)}. ${Number(mesic)}. ${rok}`;
}

/** Samostatná časová řada. Nepřesouvá celoživotní karty nad ní. */
export function AdminMetrikyPoDnech({
  podklady,
}: {
  podklady: MetrikyPoDnechGrafy | undefined;
}) {
  const [obdobi, setObdobi] = useState<MetrikyDnuObdobi>(7);
  const data = podklady?.[obdobi];

  return (
    <section className="space-y-4 border-t border-text-velmiJemny/20 pt-8">
      <div className="space-y-2 text-center">
        <h2 className="text-lg font-medium text-text">Vývoj v čase</h2>
        <p className="mx-auto max-w-xl text-sm font-light leading-snug text-text-jemny">
          Jeden člověk se v jednom pražském dni počítá jen jednou. První návštěva v životě je
          nový návštěvník, další den je vracející se. Druhá návštěva téhož dne zvýší návštěvy,
          ne počet lidí. Denní součty nejsou totéž co celoživotní karty výše.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Období časové analytiky">
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

      {data ? <Obdobi data={data} /> : (
        <p className="text-center text-sm text-text-jemny">Měření ještě nezačalo.</p>
      )}
    </section>
  );
}

function Obdobi({ data }: { data: MetrikyDnuObdobiPodklady }) {
  const souhrn = RADY.map((rada) => `${rada.nazev} ${textPoctu(data.soucty[rada.klic])}`).join(". ");
  const mereniNezacalo = data.merenoOd === null;

  return (
    <div className="min-w-0 max-w-full space-y-3">
      <p className="text-center text-sm leading-snug text-text-jemny">
        {popisekOkna(data.okno, data.rozliseni)}
      </p>
      {mereniNezacalo ? (
        <p className="text-center text-sm leading-snug text-text-jemny">
          Měření začne první zaznamenanou návštěvou nebo kliknutím. Dny předtím se nezobrazují jako nula.
        </p>
      ) : (
        <p className="text-center text-sm leading-snug text-text-jemny">
          Měřeno od {formatData(data.merenoOd ?? "")}. Dny před tímto datem nejsou měřené.
          Chybějící den po začátku je nula.
        </p>
      )}
      <Porovnani data={data} />
      <GrafTela key={data.obdobi} data={data} souhrn={souhrn} />
    </div>
  );
}

function Porovnani({ data }: { data: MetrikyDnuObdobiPodklady }) {
  if (data.obdobi === 365) {
    return (
      <p className="text-center text-sm leading-snug text-text-jemny">
        Rok je po měsících, bez porovnání s předchozím obdobím.
      </p>
    );
  }

  if (!data.zmenaProcent || !data.predchoziOkno || !data.souctyPredchozi) {
    return (
      <p className="text-center text-sm leading-snug text-text-jemny">
        Porovnání s předchozím obdobím se ukáže, až budou obě období celá po začátku měření.
      </p>
    );
  }

  const zmeny = data.zmenaProcent;
  const predchozi = data.souctyPredchozi;
  return (
    <p className="text-center text-sm leading-snug text-text">
      Proti {formatData(data.predchoziOkno.od)} – {formatData(data.predchoziOkno.do)}:{" "}
      {RADY.map((rada) => `${rada.nazev} ${textZmeny(zmeny[rada.klic])} (předtím ${textPoctu(predchozi[rada.klic])})`).join(". ")}
      .
    </p>
  );
}

function GrafTela({ data, souhrn }: { data: MetrikyDnuObdobiPodklady; souhrn: string }) {
  const krivky = RADY.map((rada) => ({
    nazev: rada.nazev,
    barva: rada.barva,
    carka: rada.carka,
    hodnoty: data.body.map((bod) => bod[rada.klic]),
  }));

  return (
    <GrafKrivek
      nadpis="Pět ukazatelů"
      popis="Návštěvy, noví a vracející se lidé, návštěvy z ikony a dvě kliknutí."
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
  body: readonly BodMetrikDne[];
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
    const ctm = udalost.currentTarget.getScreenCTM();
    if (!ctm) {
      return;
    }
    let bodSvg: DOMPoint;
    try {
      bodSvg = new DOMPoint(udalost.clientX, udalost.clientY).matrixTransform(ctm.inverse());
    } catch {
      return;
    }
    if (
      !Number.isFinite(bodSvg.x) ||
      !Number.isFinite(bodSvg.y) ||
      bodSvg.x < 0 ||
      bodSvg.y < 0 ||
      bodSvg.x > RASTR_GRAFU.sirka ||
      bodSvg.y > RASTR_GRAFU.vyska
    ) {
      return;
    }
    setVyber(indexZPozice(bodSvg.x, body.length));
  }

  return (
    <div className="min-w-0 max-w-full space-y-3">
      <div className="space-y-1 text-center">
        <h3 className="text-base font-medium text-text">{nadpis}</h3>
        <p className="text-sm leading-snug text-text-jemny">{popis}</p>
        <p className="text-sm leading-snug text-text">{souhrn}</p>
      </div>
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2">
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
      <div className="space-y-1 text-center text-sm leading-snug text-text" aria-live="polite">
        <p className="font-medium">{bod ? popisekBodu(bod) : "Bez údajů"}</p>
        {krivky.map((krivka) => (
          <p key={krivka.nazev}>
            <span className="text-text-jemny">{krivka.nazev}: </span>
            {textPoctu(krivka.hodnoty[index] ?? null)}
          </p>
        ))}
      </div>
    </div>
  );
}
