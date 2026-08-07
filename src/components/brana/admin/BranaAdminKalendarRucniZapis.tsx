"use client";

import { useMemo, useState, useTransition } from "react";
import {
  oznacitPosledniScanDokoncenAkce,
  pridatRucniKonkretniUdalostAkce,
} from "@/app/brana/admin/actions";
import type { BranaKonkretniUdalost } from "@/lib/brana/admin/konkretni-udalost";
import { popisekVolbyPozice } from "@/lib/brana/admin/konkretni-udalost";

const VSTUP =
  "w-full border border-text-velmiJemny/25 bg-transparent px-1.5 py-1 text-sm text-text outline-none focus:border-text-jemny/50";

type VolbaPozice = {
  hodnota: number;
  popisek: string;
};

type Props = {
  posledniScanDokoncen: boolean;
  automatickePodleDne: Record<string, BranaKonkretniUdalost[]>;
};

function sestavVolbyPozice(
  automaticke: readonly BranaKonkretniUdalost[],
): VolbaPozice[] {
  const volby: VolbaPozice[] = [{ hodnota: 0, popisek: "Na začátek" }];
  automaticke.forEach((udalost, index) => {
    const jePosledni = index === automaticke.length - 1;
    volby.push({
      hodnota: index + 1,
      popisek: jePosledni
        ? "Na konec"
        : `Za: ${popisekVolbyPozice(udalost)}`,
    });
  });
  return volby;
}

/**
 * Výjimečný ruční zápis přímo v Kalendáři.
 * Dostupný pouze po dokončení posledního scanu.
 */
export function BranaAdminKalendarRucniZapis({
  posledniScanDokoncen,
  automatickePodleDne,
}: Props) {
  const [otevreno, setOtevreno] = useState(false);
  const [datumOd, setDatumOd] = useState("");
  const [datumDo, setDatumDo] = useState("");
  const [cas, setCas] = useState("");
  const [mistoNeboTyp, setMistoNeboTyp] = useState("");
  const [nazev, setNazev] = useState("");
  const [rucniPoziceVDni, setRucniPoziceVDni] = useState(0);
  const [chyba, setChyba] = useState<string | null>(null);
  const [zprava, setZprava] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const volbyPozice = useMemo(() => {
    const den = datumOd.trim();
    const automaticke = den ? (automatickePodleDne[den] ?? []) : [];
    return sestavVolbyPozice(automaticke);
  }, [automatickePodleDne, datumOd]);

  function resetovatFormular() {
    setDatumOd("");
    setDatumDo("");
    setCas("");
    setMistoNeboTyp("");
    setNazev("");
    setRucniPoziceVDni(0);
  }

  function zavrit() {
    setOtevreno(false);
    resetovatFormular();
    setChyba(null);
  }

  function ulozit() {
    setChyba(null);
    setZprava(null);
    startTransition(async () => {
      const vysledek = await pridatRucniKonkretniUdalostAkce({
        datumOd,
        datumDo: datumDo || datumOd,
        cas,
        mistoNeboTyp,
        nazev,
        rucniPoziceVDni,
      });
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      setZprava("Událost uložena");
      zavrit();
    });
  }

  function oznacitScan() {
    setChyba(null);
    setZprava(null);
    startTransition(async () => {
      const vysledek = await oznacitPosledniScanDokoncenAkce();
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      setZprava("Poslední scan označen jako dokončený");
    });
  }

  if (!posledniScanDokoncen) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-text-jemny">
          Ruční zápis je dostupný až po dokončení posledního scanu.
        </p>
        <button
          type="button"
          onClick={oznacitScan}
          disabled={pending}
          className="text-sm font-light text-text-jemny underline-offset-2 hover:underline disabled:opacity-50"
        >
          {pending ? "Ukládám…" : "Označit poslední scan jako dokončený"}
        </button>
        {chyba ? (
          <p className="text-sm text-text" role="alert">
            {chyba}
          </p>
        ) : null}
        {zprava ? (
          <p className="text-sm text-text-jemny" role="status">
            {zprava}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!otevreno ? (
        <button
          type="button"
          onClick={() => {
            setChyba(null);
            setZprava(null);
            setOtevreno(true);
          }}
          className="text-sm font-light text-text-jemny underline-offset-2 hover:underline"
        >
          Přidat událost
        </button>
      ) : (
        <div className="space-y-3 border-b border-text-velmiJemny/15 pb-4">
          <p className="text-sm font-normal text-text">Přidat událost</p>
          <div className="grid max-w-xl gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-text">
              <span className="text-text-jemny">Datum OD</span>
              <input
                type="date"
                className={VSTUP}
                value={datumOd}
                onChange={(e) => {
                  const v = e.target.value;
                  setDatumOd(v);
                  if (!datumDo || datumDo < v) {
                    setDatumDo(v);
                  }
                  setRucniPoziceVDni(0);
                }}
              />
            </label>
            <label className="space-y-1 text-sm text-text">
              <span className="text-text-jemny">Datum DO</span>
              <input
                type="date"
                className={VSTUP}
                value={datumDo}
                onChange={(e) => setDatumDo(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm text-text">
              <span className="text-text-jemny">Čas</span>
              <input
                type="time"
                className={VSTUP}
                value={cas}
                onChange={(e) => setCas(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm text-text sm:col-span-2">
              <span className="text-text-jemny">Místo v dni</span>
              <select
                className={VSTUP}
                value={String(rucniPoziceVDni)}
                onChange={(e) => setRucniPoziceVDni(Number(e.target.value))}
              >
                {volbyPozice.map((volba) => (
                  <option key={`${volba.hodnota}-${volba.popisek}`} value={volba.hodnota}>
                    {volba.popisek}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm text-text sm:col-span-2">
              <span className="text-text-jemny">CO / místo nebo typ</span>
              <input
                type="text"
                className={VSTUP}
                value={mistoNeboTyp}
                maxLength={100}
                onChange={(e) => setMistoNeboTyp(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm text-text sm:col-span-2">
              <span className="text-text-jemny">Název</span>
              <input
                type="text"
                className={VSTUP}
                value={nazev}
                maxLength={200}
                onChange={(e) => setNazev(e.target.value)}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={ulozit}
              disabled={pending}
              className="border border-text-velmiJemny/30 px-3 py-1.5 text-sm text-text disabled:opacity-50"
            >
              {pending ? "Ukládám…" : "Uložit"}
            </button>
            <button
              type="button"
              onClick={zavrit}
              disabled={pending}
              className="text-sm font-light text-text-jemny underline-offset-2 hover:underline disabled:opacity-50"
            >
              Zrušit
            </button>
          </div>
        </div>
      )}
      {chyba ? (
        <p className="text-sm text-text" role="alert">
          {chyba}
        </p>
      ) : null}
      {zprava ? (
        <p className="text-sm text-text-jemny" role="status">
          {zprava}
        </p>
      ) : null}
    </div>
  );
}
