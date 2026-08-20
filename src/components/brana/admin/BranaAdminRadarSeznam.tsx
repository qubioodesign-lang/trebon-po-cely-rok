"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  pouzitBranaRadarStopuAkce,
  smazatBranaRadarStopuAkce,
} from "@/app/brana/admin/actions";
import {
  formatujRadarDatum,
  radarZdrojOdkaz,
  type BranaRadarPracovniStopa,
} from "@/lib/brana/admin/radar";

type Props = {
  pocatecniPracovni: BranaRadarPracovniStopa[];
};

function radekStopy(stopa: BranaRadarPracovniStopa): string {
  const casti = [
    formatujRadarDatum(stopa.datumOd),
    stopa.nazev,
    stopa.kde.trim() || null,
    stopa.cas.trim() || null,
  ].filter((c): c is string => Boolean(c));
  return casti.join(" · ");
}

/**
 * Pracovní inbox RADARU. Použít / Smazat nic nepublikují.
 */
export function BranaAdminRadarSeznam({ pocatecniPracovni }: Props) {
  const router = useRouter();
  const [pracovni, setPracovni] = useState(pocatecniPracovni);
  const [chyba, setChyba] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function poZmene(id: string) {
    setPracovni((pred) => pred.filter((s) => s.id !== id));
    router.refresh();
  }

  function pouzit(stopa: BranaRadarPracovniStopa) {
    setChyba(null);
    setPendingId(stopa.id);
    startTransition(async () => {
      const vysledek = await pouzitBranaRadarStopuAkce(stopa.id);
      setPendingId(null);
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      poZmene(stopa.id);
    });
  }

  function smazat(stopa: BranaRadarPracovniStopa) {
    if (
      !window.confirm(
        `Smazat nález „${stopa.nazev.trim()}“? Stejná stopa ze stejného RADAR vstupu se znovu neobjeví.`,
      )
    ) {
      return;
    }
    setChyba(null);
    setPendingId(stopa.id);
    startTransition(async () => {
      const vysledek = await smazatBranaRadarStopuAkce(stopa.id);
      setPendingId(null);
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      poZmene(stopa.id);
    });
  }

  if (pracovni.length === 0) {
    return (
      <p className="text-sm text-text-jemny">
        RADAR zatím nemá žádné pracovní stopy.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {chyba ? (
        <p className="text-sm text-text" role="alert">
          {chyba}
        </p>
      ) : null}
      <ul className="space-y-3">
        {pracovni.map((stopa) => {
          const odkaz = radarZdrojOdkaz(stopa.url);
          const ceka = pending && pendingId === stopa.id;
          return (
            <li key={stopa.id} className="space-y-1">
              <p className="text-sm text-text">{radekStopy(stopa)}</p>
              <div className="flex flex-wrap items-center gap-3">
                {odkaz ? (
                  <a
                    href={odkaz}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-light text-text-jemny underline-offset-2 hover:underline"
                  >
                    Zdroj
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => pouzit(stopa)}
                  disabled={ceka}
                  className="text-xs font-light text-text-jemny underline-offset-2 hover:underline disabled:opacity-50"
                >
                  {ceka ? "Ukládám…" : "Použít"}
                </button>
                <button
                  type="button"
                  onClick={() => smazat(stopa)}
                  disabled={ceka}
                  className="text-xs font-light text-text-jemny underline-offset-2 hover:underline disabled:opacity-50"
                >
                  {ceka ? "Ukládám…" : "Smazat"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
