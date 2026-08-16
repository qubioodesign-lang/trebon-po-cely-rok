"use client";

import { useState, useTransition } from "react";
import { ulozitBranaRedakcniPoradiAkce } from "@/app/brana/admin/actions";
import {
  BRANA_REDAKCNI_JAZYK_CO_MAX,
  BRANA_REDAKCNI_JAZYK_ROZLISENI_MAX,
  BRANA_REDAKCNI_POLOZKA_MAX,
  BRANA_REDAKCNI_POZNAMKA_MAX,
  type BranaJazykSlot,
  type BranaJazykSlotRezim,
  type BranaRedakcniJazykVerejny,
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

function vychoziSlot(): BranaJazykSlot {
  return { rezim: "NIC" };
}

function zajistiJazyk(
  jazyk: BranaRedakcniJazykVerejny | null,
): BranaRedakcniJazykVerejny {
  return (
    jazyk ?? {
      co: vychoziSlot(),
      rozliseni: vychoziSlot(),
    }
  );
}

function popisekSlotu(slot: BranaJazykSlot): string {
  if (slot.rezim === "PEVNE") {
    return slot.text;
  }
  if (slot.rezim === "Z_UDALOSTI") {
    return "z události";
  }
  return "—";
}

function zmenSlotRezim(
  slot: BranaJazykSlot,
  rezim: BranaJazykSlotRezim,
): BranaJazykSlot {
  if (rezim === "PEVNE") {
    return {
      rezim: "PEVNE",
      text: slot.rezim === "PEVNE" ? slot.text : "",
    };
  }
  if (rezim === "Z_UDALOSTI") {
    return { rezim: "Z_UDALOSTI" };
  }
  return { rezim: "NIC" };
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
  /** Aktivní ANO řádky – zamčené všechny redakční hodnoty; Používat zůstává */
  zamceno?: boolean;
  /** Vizuální prázdný řádek – nepatří do dat, neukládá se */
  pracovniRadek?: boolean;
}) {
  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <table className="w-full min-w-[64rem] table-fixed border-collapse text-left">
      <colgroup>
        <col className="w-[4.75rem]" />
        <col className="w-[16%]" />
        <col className="w-[5rem]" />
        <col className="w-[5.5rem]" />
        <col className="w-[4.5rem]" />
        <col className="w-[8.5rem]" />
        <col className="w-[11%]" />
        <col className="w-[11%]" />
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
          <th
            className={`${ODD} whitespace-nowrap py-2 px-1 text-sm font-medium text-text`}
          >
            Výhled jako
          </th>
          <th
            className={`${ODD} whitespace-nowrap py-2 px-1 text-sm font-medium text-text`}
          >
            CO BRÁNY
          </th>
          <th
            className={`${ODD} whitespace-nowrap py-2 px-1 text-sm font-medium text-text`}
          >
            KDE
          </th>
          <th className={`${ODD} py-2 pl-3 text-sm font-medium text-text`}>
            Poznámka
          </th>
        </tr>
      </thead>
      <tbody>
        {polozky.map((radek) => {
          const jazyk = radek.jazykVerejny;
          return (
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
              {zamceno ? (
                <span className="text-sm text-text">
                  {cisloNaText(radek.priorita) || "—"}
                </span>
              ) : (
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
              )}
            </td>
            <td className={`${ODD} py-2 px-1 align-top`}>
              {zamceno ? (
                <span className="text-sm text-text">
                  {cisloNaText(radek.subpriorita) || "—"}
                </span>
              ) : (
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
              )}
            </td>
            <td className={`${ODD} py-2 px-1 align-top`}>
              {zamceno ? (
                <span className="text-sm text-text">{radek.vyhled}</span>
              ) : (
                <select
                  className={VSTUP}
                  aria-label={`Výhled – ${radek.polozka}`}
                  value={radek.vyhled}
                  onChange={(e) => {
                    const vyhled: BranaRedakcniVyhled =
                      e.target.value === "NE" ? "NE" : "ANO";
                    onChange(radek.id, { vyhled });
                  }}
                >
                  <option value="ANO">ANO</option>
                  <option value="NE">NE</option>
                </select>
              )}
            </td>
            <td className={`${ODD} py-2 px-1 align-top`}>
              {zamceno ? (
                <span className="text-sm text-text">
                  {radek.vyhledSerie ? "Série" : "Jednotlivé události"}
                </span>
              ) : (
                <select
                  className={VSTUP}
                  aria-label={`Výhled jako – ${radek.polozka}`}
                  value={radek.vyhledSerie ? "serie" : "jednotlive"}
                  onChange={(e) => {
                    onChange(radek.id, {
                      vyhledSerie: e.target.value !== "jednotlive",
                    });
                  }}
                >
                  <option value="serie">Série</option>
                  <option value="jednotlive">Jednotlivé události</option>
                </select>
              )}
            </td>
            <td className={`${ODD} py-2 px-1 align-top`}>
              {jazyk === null ? (
                zamceno ? (
                  <span className="text-sm text-text-jemny">legacy</span>
                ) : (
                  <button
                    type="button"
                    className="text-sm text-text-jemny underline-offset-2 hover:underline"
                    onClick={() =>
                      onChange(radek.id, {
                        jazykVerejny: {
                          co: vychoziSlot(),
                          rozliseni: vychoziSlot(),
                        },
                      })
                    }
                  >
                    nastavit
                  </button>
                )
              ) : zamceno ? (
                <span className="text-sm text-text">
                  {popisekSlotu(jazyk.co)}
                </span>
              ) : (
                <div className="space-y-1">
                  <select
                    className={VSTUP}
                    aria-label={`CO režim – ${radek.polozka}`}
                    value={jazyk.co.rezim}
                    onChange={(e) => {
                      const aktualni = zajistiJazyk(radek.jazykVerejny);
                      onChange(radek.id, {
                        jazykVerejny: {
                          ...aktualni,
                          co: zmenSlotRezim(
                            aktualni.co,
                            e.target.value as BranaJazykSlotRezim,
                          ),
                        },
                      });
                    }}
                  >
                    <option value="PEVNE">pevné</option>
                    <option value="Z_UDALOSTI">z události</option>
                    <option value="NIC">nic</option>
                  </select>
                  {jazyk.co.rezim === "PEVNE" ? (
                    <input
                      type="text"
                      className={VSTUP}
                      aria-label={`CO text – ${radek.polozka}`}
                      value={jazyk.co.text}
                      maxLength={BRANA_REDAKCNI_JAZYK_CO_MAX}
                      onChange={(e) => {
                        const aktualni = zajistiJazyk(radek.jazykVerejny);
                        onChange(radek.id, {
                          jazykVerejny: {
                            ...aktualni,
                            co: {
                              rezim: "PEVNE",
                              text: e.target.value.slice(
                                0,
                                BRANA_REDAKCNI_JAZYK_CO_MAX,
                              ),
                            },
                          },
                        });
                      }}
                    />
                  ) : null}
                  <button
                    type="button"
                    className="text-xs text-text-jemny underline-offset-2 hover:underline"
                    onClick={() => onChange(radek.id, { jazykVerejny: null })}
                  >
                    legacy
                  </button>
                </div>
              )}
            </td>
            <td className={`${ODD} py-2 px-1 align-top`}>
              {jazyk === null ? (
                <span className="text-sm text-text-jemny">—</span>
              ) : zamceno ? (
                <span className="text-sm text-text">
                  {popisekSlotu(jazyk.rozliseni)}
                </span>
              ) : (
                <div className="space-y-1">
                  <select
                    className={VSTUP}
                    aria-label={`KDE režim – ${radek.polozka}`}
                    value={jazyk.rozliseni.rezim}
                    onChange={(e) => {
                      const aktualni = zajistiJazyk(radek.jazykVerejny);
                      onChange(radek.id, {
                        jazykVerejny: {
                          ...aktualni,
                          rozliseni: zmenSlotRezim(
                            aktualni.rozliseni,
                            e.target.value as BranaJazykSlotRezim,
                          ),
                        },
                      });
                    }}
                  >
                    <option value="PEVNE">pevné</option>
                    <option value="Z_UDALOSTI">z události</option>
                    <option value="NIC">nic</option>
                  </select>
                  {jazyk.rozliseni.rezim === "PEVNE" ? (
                    <input
                      type="text"
                      className={VSTUP}
                      aria-label={`KDE text – ${radek.polozka}`}
                      value={jazyk.rozliseni.text}
                      maxLength={BRANA_REDAKCNI_JAZYK_ROZLISENI_MAX}
                      onChange={(e) => {
                        const aktualni = zajistiJazyk(radek.jazykVerejny);
                        onChange(radek.id, {
                          jazykVerejny: {
                            ...aktualni,
                            rozliseni: {
                              rezim: "PEVNE",
                              text: e.target.value.slice(
                                0,
                                BRANA_REDAKCNI_JAZYK_ROZLISENI_MAX,
                              ),
                            },
                          },
                        });
                      }}
                    />
                  ) : null}
                </div>
              )}
            </td>
            <td className={`${ODD} py-2 pl-3 align-top`}>
              {zamceno ? (
                <span className="text-sm text-text">
                  {radek.poznamka.trim() || "—"}
                </span>
              ) : (
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
              )}
            </td>
          </tr>
          );
        })}
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
            <td className={`${ODD} py-2 px-1 align-top`}>
              <select className={VSTUP} disabled tabIndex={-1} value="" aria-hidden="true">
                <option value="" />
              </select>
            </td>
            <td className={`${ODD} py-2 px-1 align-top`} />
            <td className={`${ODD} py-2 px-1 align-top`} />
            <td className={`${ODD} py-2 pl-3 align-top`}>
              <input type="text" className={VSTUP} disabled tabIndex={-1} value="" readOnly aria-hidden="true" />
            </td>
          </tr>
        ) : null}
      </tbody>
      </table>
    </div>
  );
}
