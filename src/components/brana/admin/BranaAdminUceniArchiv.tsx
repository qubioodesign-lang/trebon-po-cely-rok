"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { vyprazdnitBranaUceniArchivAkce } from "@/app/brana/admin/actions";
import { formatovatVelikost } from "@/lib/brana/admin/zaloha/pomocne";
import {
  formatujUceniDatum,
  uceniZdrojOdkaz,
  type BranaUceniPolozka,
} from "@/lib/brana/admin/uceni";

const TLACITKO =
  "border border-text-velmiJemny/30 px-3 py-1.5 text-sm text-text disabled:opacity-50";

type Props = {
  polozky: BranaUceniPolozka[];
  pocet: number;
  obdobi: { od: string; do: string } | null;
  velikostBajtu: number;
  chybaCteni: string | null;
};

function radekPolozky(polozka: BranaUceniPolozka): string {
  const casti = [
    formatujUceniDatum(polozka.datumOd),
    polozka.cas.trim() || null,
    polozka.nazev,
    polozka.kde.trim() || null,
  ].filter((c): c is string => Boolean(c));
  return casti.join(" · ");
}

/**
 * Archiv Učení – pouze čtení, stažení a vyprázdnění.
 * Needituje Kalendář ani RADAR.
 */
export function BranaAdminUceniArchiv({
  polozky,
  pocet,
  obdobi,
  velikostBajtu,
  chybaCteni,
}: Props) {
  const router = useRouter();
  const [chyba, setChyba] = useState<string | null>(chybaCteni);
  const [zprava, setZprava] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function stahnout() {
    window.open(
      "/api/brana/admin/uceni/stahnout",
      "_blank",
      "noopener,noreferrer",
    );
  }

  function vyprazdnit() {
    if (
      !window.confirm(
        "Vyprázdnit celý archiv Učení? Tato akce smaže jen archiv Učení, nikoli Kalendář ani RADAR.",
      )
    ) {
      return;
    }
    setChyba(null);
    setZprava(null);
    startTransition(async () => {
      const vysledek = await vyprazdnitBranaUceniArchivAkce();
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      setZprava("Archiv Učení je prázdný.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-sm text-text">
        <p>
          Položek: <span className="text-text">{pocet}</span>
        </p>
        {obdobi ? (
          <p className="text-text-jemny">
            Období: {formatujUceniDatum(obdobi.od)} –{" "}
            {formatujUceniDatum(obdobi.do)}
          </p>
        ) : (
          <p className="text-text-jemny">Období: —</p>
        )}
        <p className="text-text-jemny">
          Velikost: {formatovatVelikost(velikostBajtu)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={TLACITKO}
          disabled={pending}
          onClick={stahnout}
        >
          Stáhnout archiv
        </button>
        <button
          type="button"
          className={`${TLACITKO} text-red-800`}
          disabled={pending || pocet === 0}
          onClick={vyprazdnit}
        >
          {pending ? "Pracuji…" : "Vyprázdnit archiv"}
        </button>
      </div>

      {zprava ? (
        <p className="text-sm text-text" role="status">
          {zprava}
        </p>
      ) : null}
      {chyba ? (
        <p className="text-sm text-text" role="alert">
          {chyba}
        </p>
      ) : null}

      {polozky.length === 0 ? (
        <p className="text-sm text-text-jemny">
          Archiv Učení je zatím prázdný. Nové položky se přidají po Použít /
          + Přidat v RADARu a po Přidat událost v Kalendáři.
        </p>
      ) : (
        <ul className="space-y-3">
          {polozky.map((polozka) => {
            const odkaz = uceniZdrojOdkaz(polozka.url);
            return (
              <li key={polozka.id} className="space-y-1">
                <p className="text-sm text-text">{radekPolozky(polozka)}</p>
                {odkaz ? (
                  <a
                    href={odkaz}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-light text-text-jemny underline-offset-2 hover:underline"
                  >
                    Zdroj
                  </a>
                ) : polozka.url.trim() ? (
                  <p className="text-xs text-text-jemny">{polozka.url.trim()}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
