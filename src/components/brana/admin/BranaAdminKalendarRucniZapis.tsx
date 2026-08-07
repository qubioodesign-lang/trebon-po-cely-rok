"use client";

import { useMemo, useState, useTransition } from "react";
import {
  oznacitPosledniScanDokoncenAkce,
  pridatRucniKonkretniUdalostAkce,
  smazatRucniKonkretniUdalostAkce,
  upravitRucniKonkretniUdalostAkce,
} from "@/app/brana/admin/actions";
import { rozlozAkci } from "@/lib/brana/admin/akce-rozlozeni";
import type {
  BranaKalendarDen,
  BranaKonkretniUdalost,
} from "@/lib/brana/admin/konkretni-udalost";
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
  dny: BranaKalendarDen[];
  /** false při chybě čtení Blobu – formulář a akce se nezobrazí */
  rucniZapisPovolen: boolean;
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

function OrientacniLinka({
  popisek,
  ariaLabel,
}: {
  popisek: string;
  ariaLabel: string;
}) {
  return (
    <div
      className="brana-admin-kalendar-orientace"
      role="separator"
      aria-label={ariaLabel}
    >
      <div className="brana-admin-kalendar-orientace-linka" />
      <span className="brana-admin-kalendar-orientace-popisek">{popisek}</span>
      <div className="brana-admin-kalendar-orientace-linka" />
    </div>
  );
}

function SeznamDnu({
  dny,
  rucniAkce,
  pending,
  onUpravit,
  onSmazat,
}: {
  dny: BranaKalendarDen[];
  rucniAkce: boolean;
  pending: boolean;
  onUpravit: (udalost: BranaKonkretniUdalost) => void;
  onSmazat: (udalost: BranaKonkretniUdalost) => void;
}) {
  return (
    <div role="region" aria-label="Pracovní kalendář">
      {dny.map((den, index) => (
        <div key={den.isoDen}>
          <article className="brana-admin-kalendar-den">
            <h3 className="brana-admin-kalendar-datum">{den.datumLabel}</h3>
            <div>
              {den.udalosti.length > 0 ? (
                <ul className="brana-admin-seznam-akci">
                  {den.udalosti.map((udalost) => {
                    const { typ, misto, nazev } = rozlozAkci({
                      mistoNeboTyp: udalost.mistoNeboTyp,
                      nazev: udalost.nazev,
                      cas: udalost.cas,
                    });
                    const jeRucni = udalost.redakcniPolozkaId === null;
                    return (
                      <li key={`${udalost.id}-${den.isoDen}`}>
                        <div className="brana-admin-akce-obsah">
                          <div className="brana-admin-akce-radek">
                            <span className="brana-admin-akce-typ">{typ}</span>
                            {misto ? (
                              <span className="brana-admin-akce-misto">
                                {" "}
                                {misto}
                              </span>
                            ) : null}
                          </div>
                          {nazev ? (
                            <span className="brana-admin-akce-nazev">
                              {nazev}
                            </span>
                          ) : null}
                          {rucniAkce && jeRucni ? (
                            <div className="mt-0.5 flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={() => onUpravit(udalost)}
                                disabled={pending}
                                className="text-xs font-light text-text-jemny underline-offset-2 hover:underline disabled:opacity-50"
                              >
                                Upravit
                              </button>
                              <button
                                type="button"
                                onClick={() => onSmazat(udalost)}
                                disabled={pending}
                                className="text-xs font-light text-text-jemny underline-offset-2 hover:underline disabled:opacity-50"
                              >
                                Smazat
                              </button>
                            </div>
                          ) : null}
                        </div>
                        <span className="brana-admin-akce-cas">{udalost.cas}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="min-h-11" aria-hidden="true" />
              )}
            </div>
          </article>

          {index === 0 ? (
            <OrientacniLinka
              popisek="ZÍTRA SE PUBLIKUJE"
              ariaLabel="Zítra se publikuje"
            />
          ) : null}
          {index === 1 ? (
            <OrientacniLinka
              popisek="SCHVÁLENO K PUBLIKACI"
              ariaLabel="Schváleno k publikaci"
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

/**
 * Výjimečný ruční zápis přímo v Kalendáři (přidat / upravit / smazat).
 * Dostupný pouze po dokončení posledního scanu.
 */
export function BranaAdminKalendarRucniZapis({
  posledniScanDokoncen,
  automatickePodleDne,
  dny,
  rucniZapisPovolen,
}: Props) {
  const [otevreno, setOtevreno] = useState(false);
  const [editovaneId, setEditovaneId] = useState<string | null>(null);
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

  const muzeEditovat =
    rucniZapisPovolen && posledniScanDokoncen;

  function resetovatFormular() {
    setEditovaneId(null);
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

  function otevritPridani() {
    setChyba(null);
    setZprava(null);
    resetovatFormular();
    setOtevreno(true);
  }

  function otevritUpravu(udalost: BranaKonkretniUdalost) {
    if (udalost.redakcniPolozkaId !== null) {
      return;
    }
    setChyba(null);
    setZprava(null);
    setEditovaneId(udalost.id);
    setDatumOd(udalost.datumOd);
    setDatumDo(udalost.datumDo);
    setCas(udalost.cas);
    setMistoNeboTyp(udalost.mistoNeboTyp);
    setNazev(udalost.nazev);
    // 0 = Na začátek – nesmí se ztratit přes truthy kontrolu
    setRucniPoziceVDni(
      udalost.rucniPoziceVDni === null || udalost.rucniPoziceVDni === undefined
        ? 0
        : udalost.rucniPoziceVDni,
    );
    setOtevreno(true);
  }

  function ulozit() {
    setChyba(null);
    setZprava(null);
    const vstup = {
      datumOd,
      datumDo: datumDo || datumOd,
      cas,
      mistoNeboTyp,
      nazev,
      rucniPoziceVDni,
    };
    startTransition(async () => {
      const vysledek = editovaneId
        ? await upravitRucniKonkretniUdalostAkce(editovaneId, vstup)
        : await pridatRucniKonkretniUdalostAkce(vstup);
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      setZprava(editovaneId ? "Událost upravena" : "Událost uložena");
      zavrit();
    });
  }

  function smazat(udalost: BranaKonkretniUdalost) {
    if (udalost.redakcniPolozkaId !== null) {
      return;
    }
    const potvrzeno = window.confirm(
      `Smazat ruční událost „${udalost.nazev.trim() || udalost.mistoNeboTyp.trim()}“?`,
    );
    if (!potvrzeno) {
      return;
    }
    setChyba(null);
    setZprava(null);
    startTransition(async () => {
      const vysledek = await smazatRucniKonkretniUdalostAkce(udalost.id);
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      if (editovaneId === udalost.id) {
        zavrit();
      }
      setZprava("Událost smazána");
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

  return (
    <div className="space-y-3">
      {rucniZapisPovolen && !posledniScanDokoncen ? (
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
        </div>
      ) : null}

      {muzeEditovat && !otevreno ? (
        <button
          type="button"
          onClick={otevritPridani}
          className="text-sm font-light text-text-jemny underline-offset-2 hover:underline"
        >
          Přidat událost
        </button>
      ) : null}

      {muzeEditovat && otevreno ? (
        <div className="space-y-3 border-b border-text-velmiJemny/15 pb-4">
          <p className="text-sm font-normal text-text">
            {editovaneId ? "Upravit událost" : "Přidat událost"}
          </p>
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
                onChange={(e) => {
                  const cislo = Number(e.target.value);
                  if (Number.isInteger(cislo) && cislo >= 0) {
                    setRucniPoziceVDni(cislo);
                  }
                }}
              >
                {volbyPozice.map((volba) => (
                  <option
                    key={`${volba.hodnota}-${volba.popisek}`}
                    value={String(volba.hodnota)}
                  >
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
      ) : null}

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

      <SeznamDnu
        dny={dny}
        rucniAkce={muzeEditovat}
        pending={pending}
        onUpravit={otevritUpravu}
        onSmazat={smazat}
      />
    </div>
  );
}
