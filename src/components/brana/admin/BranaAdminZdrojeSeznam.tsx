"use client";

import { useMemo, useState, useTransition } from "react";
import {
  pridatBranaZdrojAkce,
  skenovatBranaZdrojAkce,
  smazatBranaZdrojAkce,
  upravitBranaZdrojAkce,
} from "@/app/brana/admin/actions";
import {
  BRANA_ZDROJ_NAZEV_MAX,
  BRANA_ZDROJ_URL_MAX,
  BRANA_ZDROJ_REZIM_SCANU_VYCHOZI,
  doplnVychoziPoleZdroje,
  popisekRezimuScanu,
  popisekTypuZdroje,
  type BranaZdroj,
  type BranaZdrojRezimScanu,
  type BranaZdrojTyp,
} from "@/lib/brana/admin/zdroj";

const VSTUP =
  "w-full border border-text-velmiJemny/25 bg-transparent px-1.5 py-1 text-sm text-text outline-none focus:border-text-jemny/50 disabled:opacity-50";

/** Aktivní položka Redakčního pořadí pro výběr hlídaných kotev */
export type BranaZdrojKotvaVolba = {
  id: string;
  polozka: string;
  /** Volitelný text rozlišení (PEVNE), jen orientace */
  rozliseni: string | null;
};

type Props = {
  zdroje: BranaZdroj[];
  /** Používat=ANO položky z Redakčního pořadí */
  kotvyVolby: BranaZdrojKotvaVolba[];
  /** false při chybě čtení Blobu – formulář a akce se nezobrazí */
  zapisPovolen: boolean;
  chybaCteni?: string | null;
};

type FormularStav = {
  nazev: string;
  typ: BranaZdrojTyp;
  url: string;
  rezimScanu: BranaZdrojRezimScanu;
  hlidaneRedakcniPolozkaIds: string[];
};

const PRAZDNY: FormularStav = {
  nazev: "",
  typ: "DLOUHODOBY",
  url: "",
  rezimScanu: BRANA_ZDROJ_REZIM_SCANU_VYCHOZI,
  hlidaneRedakcniPolozkaIds: [],
};

/**
 * Inline správa produkčního seznamu známých zdrojů
 * a ruční Skenovat u konkrétního zdroje (bez dávky / scheduleru).
 */
export function BranaAdminZdrojeSeznam({
  zdroje: pocatecniZdroje,
  kotvyVolby,
  zapisPovolen,
  chybaCteni = null,
}: Props) {
  const [zdroje, setZdroje] = useState(() =>
    pocatecniZdroje.map((z) => doplnVychoziPoleZdroje(z)),
  );
  const [otevreno, setOtevreno] = useState(false);
  const [editovaneId, setEditovaneId] = useState<string | null>(null);
  const [formular, setFormular] = useState<FormularStav>(PRAZDNY);
  const [chyba, setChyba] = useState<string | null>(chybaCteni);
  const [zprava, setZprava] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [skenovaneId, setSkenovaneId] = useState<string | null>(null);

  const kotvyPodleId = useMemo(() => {
    const m = new Map<string, BranaZdrojKotvaVolba>();
    for (const k of kotvyVolby) {
      m.set(k.id, k);
    }
    return m;
  }, [kotvyVolby]);

  function resetovatFormular() {
    setEditovaneId(null);
    setFormular(PRAZDNY);
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

  function otevritUpravu(zdroj: BranaZdroj) {
    const z = doplnVychoziPoleZdroje(zdroj);
    setChyba(null);
    setZprava(null);
    setEditovaneId(z.id);
    setFormular({
      nazev: z.nazev,
      typ: z.typ,
      url: z.url,
      rezimScanu: z.rezimScanu,
      hlidaneRedakcniPolozkaIds: z.hlidaneRedakcniPolozkaIds,
    });
    setOtevreno(true);
  }

  function prepnoutKotvu(id: string) {
    setFormular((f) => {
      const ma = f.hlidaneRedakcniPolozkaIds.includes(id);
      return {
        ...f,
        hlidaneRedakcniPolozkaIds: ma
          ? f.hlidaneRedakcniPolozkaIds.filter((x) => x !== id)
          : [...f.hlidaneRedakcniPolozkaIds, id],
      };
    });
  }

  function ulozit() {
    if (!zapisPovolen) {
      return;
    }
    setChyba(null);
    setZprava(null);
    const vstup = {
      nazev: formular.nazev,
      typ: formular.typ,
      url: formular.url,
      rezimScanu: formular.rezimScanu,
      hlidaneRedakcniPolozkaIds: formular.hlidaneRedakcniPolozkaIds,
    };
    startTransition(async () => {
      const vysledek = editovaneId
        ? await upravitBranaZdrojAkce(editovaneId, vstup)
        : await pridatBranaZdrojAkce(vstup);
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      const ulozeny = doplnVychoziPoleZdroje(vysledek.zdroj);
      setZdroje((predchozi) => {
        if (editovaneId) {
          return predchozi.map((z) => (z.id === editovaneId ? ulozeny : z));
        }
        return [...predchozi, ulozeny];
      });
      setZprava(editovaneId ? "Zdroj upraven" : "Zdroj uložen");
      zavrit();
    });
  }

  function smazat(zdroj: BranaZdroj) {
    if (!zapisPovolen) {
      return;
    }
    const potvrzeno = window.confirm(
      `Smazat zdroj „${zdroj.nazev.trim()}“?`,
    );
    if (!potvrzeno) {
      return;
    }
    setChyba(null);
    setZprava(null);
    startTransition(async () => {
      const vysledek = await smazatBranaZdrojAkce(zdroj.id);
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      setZdroje((predchozi) => predchozi.filter((z) => z.id !== zdroj.id));
      if (editovaneId === zdroj.id) {
        zavrit();
      }
      setZprava("Zdroj smazán");
    });
  }

  function skenovat(zdroj: BranaZdroj) {
    if (!zapisPovolen) {
      return;
    }
    setChyba(null);
    setZprava(null);
    setSkenovaneId(zdroj.id);
    startTransition(async () => {
      try {
        const vysledek = await skenovatBranaZdrojAkce(zdroj.id);
        if (!vysledek.uspech) {
          setChyba(vysledek.chyba);
          return;
        }
        setZprava(
          `Nalezeno: ${vysledek.nalezeno} · Přidáno do Kalendáře: ${vysledek.pridanoDoKalendare} · Již existuje: ${vysledek.jizExistuje} · Nezařazeno: ${vysledek.nezarazeno}`,
        );
      } finally {
        setSkenovaneId(null);
      }
    });
  }

  const dlouhodobe = zdroje.filter((z) => z.typ === "DLOUHODOBY");
  const rychle = zdroje.filter((z) => z.typ === "RYCHLY");

  return (
    <div className="space-y-4">
      {chybaCteni && !zapisPovolen ? (
        <p className="text-sm text-text" role="alert">
          {chybaCteni}
        </p>
      ) : null}

      {zapisPovolen && !otevreno ? (
        <button
          type="button"
          onClick={otevritPridani}
          className="text-sm font-light text-text-jemny underline-offset-2 hover:underline"
        >
          Přidat zdroj
        </button>
      ) : null}

      {zapisPovolen && otevreno ? (
        <div className="space-y-3 border-b border-text-velmiJemny/15 pb-4">
          <p className="text-sm font-normal text-text">
            {editovaneId ? "Upravit zdroj" : "Přidat zdroj"}
          </p>
          <div className="grid max-w-xl gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-text sm:col-span-2">
              <span className="text-text-jemny">Název</span>
              <input
                type="text"
                className={VSTUP}
                value={formular.nazev}
                maxLength={BRANA_ZDROJ_NAZEV_MAX}
                disabled={pending}
                onChange={(e) =>
                  setFormular((f) => ({ ...f, nazev: e.target.value }))
                }
              />
            </label>
            <label className="space-y-1 text-sm text-text">
              <span className="text-text-jemny">Typ</span>
              <select
                className={VSTUP}
                value={formular.typ}
                disabled={pending}
                onChange={(e) =>
                  setFormular((f) => ({
                    ...f,
                    typ: e.target.value as BranaZdrojTyp,
                  }))
                }
              >
                <option value="DLOUHODOBY">Dlouhodobý</option>
                <option value="RYCHLY">Rychlý</option>
              </select>
            </label>
            <label className="space-y-1 text-sm text-text">
              <span className="text-text-jemny">Režim scanu</span>
              <select
                className={VSTUP}
                value={formular.rezimScanu}
                disabled={pending}
                onChange={(e) =>
                  setFormular((f) => ({
                    ...f,
                    rezimScanu: e.target.value as BranaZdrojRezimScanu,
                  }))
                }
              >
                <option value="BEZNY">Běžný</option>
                <option value="HLIDANE_KOTVY">Hlídané kotvy</option>
              </select>
            </label>
            <label className="space-y-1 text-sm text-text sm:col-span-2">
              <span className="text-text-jemny">URL</span>
              <input
                type="url"
                className={VSTUP}
                value={formular.url}
                maxLength={BRANA_ZDROJ_URL_MAX}
                disabled={pending}
                placeholder="https://"
                onChange={(e) =>
                  setFormular((f) => ({ ...f, url: e.target.value }))
                }
              />
            </label>
          </div>

          {formular.rezimScanu === "HLIDANE_KOTVY" ? (
            <div className="max-w-xl space-y-2">
              <p className="text-sm text-text-jemny">
                Hlídané kotvy — celý program zdroje se nepřebírá. Do Kalendáře
                jdou jen jasné shody s vybranými položkami Redakčního pořadí.
              </p>
              {kotvyVolby.length === 0 ? (
                <p className="text-sm text-text-velmiJemny">
                  Žádné aktivní položky Redakčního pořadí.
                </p>
              ) : (
                <ul className="max-h-56 space-y-1 overflow-y-auto border border-text-velmiJemny/15 p-2">
                  {kotvyVolby.map((kotva) => {
                    const checked =
                      formular.hlidaneRedakcniPolozkaIds.includes(kotva.id);
                    return (
                      <li key={kotva.id}>
                        <label className="flex cursor-pointer items-start gap-2 text-sm text-text">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={checked}
                            disabled={pending}
                            onChange={() => prepnoutKotvu(kotva.id)}
                          />
                          <span>
                            <span>{kotva.polozka}</span>
                            {kotva.rozliseni ? (
                              <span className="text-text-jemny">
                                {" "}
                                · {kotva.rozliseni}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}

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

      {(
        [
          { nadpis: "Dlouhodobé", polozky: dlouhodobe },
          { nadpis: "Rychlé", polozky: rychle },
        ] as const
      ).map((skupina) => (
        <div
          key={skupina.nadpis}
          className="space-y-2"
          role="region"
          aria-label={skupina.nadpis}
        >
          <h3 className="text-sm font-normal text-text-jemny">
            {skupina.nadpis}
          </h3>
          {skupina.polozky.length === 0 ? (
            <p className="text-sm text-text-velmiJemny">Žádné zdroje</p>
          ) : (
            <ul className="space-y-2">
              {skupina.polozky.map((zdroj) => {
                const z = doplnVychoziPoleZdroje(zdroj);
                const kotvyPopis =
                  z.rezimScanu === "HLIDANE_KOTVY"
                    ? z.hlidaneRedakcniPolozkaIds
                        .map((id) => kotvyPodleId.get(id)?.polozka ?? id)
                        .join(", ")
                    : "";
                return (
                  <li key={z.id} className="space-y-0.5 text-sm text-text">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <span>{z.nazev}</span>
                      <span className="text-text-velmiJemny">
                        {popisekTypuZdroje(z.typ)}
                      </span>
                      <span className="text-text-velmiJemny">
                        {popisekRezimuScanu(z.rezimScanu)}
                        {z.rezimScanu === "HLIDANE_KOTVY"
                          ? ` (${z.hlidaneRedakcniPolozkaIds.length})`
                          : ""}
                      </span>
                    </div>
                    <p className="break-all text-text-jemny">{z.url}</p>
                    {z.rezimScanu === "HLIDANE_KOTVY" ? (
                      <p className="text-text-jemny">
                        {z.hlidaneRedakcniPolozkaIds.length === 0
                          ? "Žádné hlídané kotvy — scan nic nezapíše."
                          : `Kotvy: ${kotvyPopis}`}
                      </p>
                    ) : null}
                    {zapisPovolen ? (
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => skenovat(z)}
                          disabled={pending}
                          className="text-xs font-light text-text-jemny underline-offset-2 hover:underline disabled:opacity-50"
                        >
                          {skenovaneId === z.id && pending
                            ? "Skenuji…"
                            : "Skenovat"}
                        </button>
                        <button
                          type="button"
                          onClick={() => otevritUpravu(z)}
                          disabled={pending}
                          className="text-xs font-light text-text-jemny underline-offset-2 hover:underline disabled:opacity-50"
                        >
                          Upravit
                        </button>
                        <button
                          type="button"
                          onClick={() => smazat(z)}
                          disabled={pending}
                          className="text-xs font-light text-text-jemny underline-offset-2 hover:underline disabled:opacity-50"
                        >
                          Smazat
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
