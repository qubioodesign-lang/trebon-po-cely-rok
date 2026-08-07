"use client";

import { useState, useTransition } from "react";
import { ulozitBranaRedakcniPoradiAkce } from "@/app/brana/admin/actions";
import {
  BRANA_REDAKCNI_POLOZKA_MAX,
  BRANA_REDAKCNI_POZNAMKA_MAX,
  type BranaRedakcniPolozkaStav,
  type BranaRedakcniPouzivat,
  type BranaRedakcniVyhled,
} from "@/lib/brana/admin/redakcni-kostra";

/** Jemné svislé oddělení – stejný tón jako vodorovné linky administrace */
const ODD = "border-l border-text-velmiJemny/15";

const VSTUP =
  "w-full border border-text-velmiJemny/25 bg-transparent px-1.5 py-1 text-sm text-text outline-none focus:border-text-jemny/50 disabled:opacity-60";

type Props = {
  pocatecniPolozky: BranaRedakcniPolozkaStav[];
};

function cisloNaText(hodnota: number | null): string {
  return hodnota === null ? "" : String(hodnota);
}

function textNaCislo(hodnota: string): number | null {
  const trim = hodnota.trim();
  if (trim === "") {
    return null;
  }
  const cislo = Number(trim);
  if (!Number.isInteger(cislo)) {
    return null;
  }
  return cislo;
}

export function BranaAdminRedakcniPoradi({ pocatecniPolozky }: Props) {
  const [polozky, setPolozky] =
    useState<BranaRedakcniPolozkaStav[]>(pocatecniPolozky);
  const [zprava, setZprava] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function aktualizovat(
    id: string,
    zmena: Partial<BranaRedakcniPolozkaStav>,
  ) {
    setZprava(null);
    setChyba(null);
    setPolozky((predchozi) =>
      predchozi.map((radek) =>
        radek.id === id
          ? {
              ...radek,
              ...zmena,
              id: radek.id,
              mimoKostru: radek.mimoKostru,
            }
          : radek,
      ),
    );
  }

  function ulozit() {
    setZprava(null);
    setChyba(null);
    startTransition(async () => {
      const vysledek = await ulozitBranaRedakcniPoradiAkce(polozky);
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      setPolozky(vysledek.polozky);
      setZprava("Uloženo");
    });
  }

  /** Sekce podle aktuálního Používat – ne podle historického katalogu */
  const aktivni = polozky.filter((p) => p.pouzivat === "ANO");
  const pracovni = polozky.filter((p) => p.pouzivat === "NE");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={ulozit}
          disabled={pending}
          className="border border-text-velmiJemny/30 px-3 py-1.5 text-sm text-text disabled:opacity-50"
        >
          {pending ? "Ukládám…" : "Uložit změny"}
        </button>
        {zprava ? (
          <p className="text-sm text-text-jemny" role="status">
            {zprava}
          </p>
        ) : null}
        {chyba ? (
          <p className="text-sm text-text" role="alert">
            {chyba}
          </p>
        ) : null}
      </div>

      <RedakcniTabulka polozky={aktivni} onChange={aktualizovat} zamceno />

      <div className="space-y-3">
        <h3 className="text-base font-normal text-text">MIMO PRVNÍ KOSTRU</h3>
        <RedakcniTabulka
          polozky={pracovni}
          onChange={aktualizovat}
          pracovniRadek
        />
      </div>
    </div>
  );
}

function RedakcniTabulka({
  polozky,
  onChange,
  zamceno = false,
  pracovniRadek = false,
}: {
  polozky: BranaRedakcniPolozkaStav[];
  onChange: (
    id: string,
    zmena: Partial<BranaRedakcniPolozkaStav>,
  ) => void;
  /** Aktivní ANO řádky – zamčená pouze Položka */
  zamceno?: boolean;
  /** Vizuální prázdný řádek – nepatří do dat, neukládá se */
  pracovniRadek?: boolean;
}) {
  return (
    <table className="w-full table-fixed border-collapse text-left">
      <colgroup>
        <col className="w-[4.75rem]" />
        <col className="w-[30%]" />
        <col className="w-[5rem]" />
        <col className="w-[6.5rem]" />
        <col className="w-[4.5rem]" />
        <col />
      </colgroup>
      <thead>
        <tr className="border-b border-text-velmiJemny/25">
          <th className="whitespace-nowrap py-2 pr-2 text-sm font-medium text-text">
            Používat
          </th>
          <th className="py-2 pr-3 pl-1 text-sm font-medium text-text">
            Položka
          </th>
          <th
            className={`${ODD} whitespace-nowrap py-2 px-1 text-sm font-medium text-text`}
          >
            Priorita
          </th>
          <th
            className={`${ODD} whitespace-nowrap py-2 px-1 text-sm font-medium text-text`}
          >
            Subpriorita
          </th>
          <th
            className={`${ODD} whitespace-nowrap py-2 px-1 text-sm font-medium text-text`}
          >
            Výhled
          </th>
          <th className={`${ODD} py-2 pl-3 text-sm font-medium text-text`}>
            Poznámka
          </th>
        </tr>
      </thead>
      <tbody>
        {polozky.map((radek) => (
          <tr key={radek.id} className="border-b border-text-velmiJemny/15">
            <td className="py-2 pr-2 align-top">
              <select
                className={VSTUP}
                aria-label={`Používat – ${radek.polozka}`}
                value={radek.pouzivat}
                onChange={(e) =>
                  onChange(radek.id, {
                    pouzivat: e.target.value as BranaRedakcniPouzivat,
                  })
                }
              >
                <option value="ANO">ANO</option>
                <option value="NE">NE</option>
              </select>
            </td>
            <td className="py-2 pr-3 pl-1 align-top text-sm text-text">
              {zamceno ? (
                radek.polozka
              ) : (
                <input
                  type="text"
                  className={VSTUP}
                  aria-label={`Položka – ${radek.id}`}
                  value={radek.polozka}
                  maxLength={BRANA_REDAKCNI_POLOZKA_MAX}
                  onChange={(e) =>
                    onChange(radek.id, {
                      polozka: e.target.value.slice(0, BRANA_REDAKCNI_POLOZKA_MAX),
                    })
                  }
                />
              )}
            </td>
            <td className={`${ODD} py-2 px-1 align-top`}>
              <input
                type="text"
                inputMode="numeric"
                className={VSTUP}
                aria-label={`Priorita – ${radek.polozka}`}
                value={cisloNaText(radek.priorita)}
                maxLength={3}
                placeholder=""
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "").slice(0, 3);
                  onChange(radek.id, {
                    priorita: textNaCislo(raw),
                  });
                }}
              />
            </td>
            <td className={`${ODD} py-2 px-1 align-top`}>
              <input
                type="text"
                inputMode="numeric"
                className={VSTUP}
                aria-label={`Subpriorita – ${radek.polozka}`}
                value={cisloNaText(radek.subpriorita)}
                maxLength={3}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "").slice(0, 3);
                  onChange(radek.id, {
                    subpriorita: textNaCislo(raw),
                  });
                }}
              />
            </td>
            <td className={`${ODD} py-2 px-1 align-top`}>
              <select
                className={VSTUP}
                aria-label={`Výhled – ${radek.polozka}`}
                value={radek.vyhled ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  const vyhled: BranaRedakcniVyhled =
                    v === "ANO" || v === "NE" ? v : null;
                  onChange(radek.id, { vyhled });
                }}
              >
                <option value="" />
                <option value="ANO">ANO</option>
                <option value="NE">NE</option>
              </select>
            </td>
            <td className={`${ODD} py-2 pl-3 align-top`}>
              <input
                type="text"
                className={VSTUP}
                aria-label={`Poznámka – ${radek.polozka}`}
                value={radek.poznamka}
                maxLength={BRANA_REDAKCNI_POZNAMKA_MAX}
                onChange={(e) => {
                  onChange(radek.id, {
                    poznamka: e.target.value.slice(0, BRANA_REDAKCNI_POZNAMKA_MAX),
                  });
                }}
              />
            </td>
          </tr>
        ))}
        {pracovniRadek ? (
          <tr className="border-b border-text-velmiJemny/15" aria-hidden="true">
            <td className="py-2 pr-2 align-top">
              <select className={VSTUP} disabled tabIndex={-1} value="" aria-hidden="true">
                <option value="" />
              </select>
            </td>
            <td className="py-2 pr-3 pl-1 align-top text-sm text-text" />
            <td className={`${ODD} py-2 px-1 align-top`}>
              <input type="text" className={VSTUP} disabled tabIndex={-1} value="" readOnly aria-hidden="true" />
            </td>
            <td className={`${ODD} py-2 px-1 align-top`}>
              <input type="text" className={VSTUP} disabled tabIndex={-1} value="" readOnly aria-hidden="true" />
            </td>
            <td className={`${ODD} py-2 px-1 align-top`}>
              <select className={VSTUP} disabled tabIndex={-1} value="" aria-hidden="true">
                <option value="" />
              </select>
            </td>
            <td className={`${ODD} py-2 pl-3 align-top`}>
              <input type="text" className={VSTUP} disabled tabIndex={-1} value="" readOnly aria-hidden="true" />
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}
