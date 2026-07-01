"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { VzkazTreboni } from "@/types";
import { smazatVzkazAdmin } from "@/app/admin/actions";

interface PropsAdminVzkazyTreboni {
  vzkazy: VzkazTreboni[];
}

function formatovatDatumCas(iso: string): { datum: string; cas: string } {
  const datumCas = new Date(iso);
  return {
    datum: datumCas.toLocaleDateString("cs-CZ"),
    cas: datumCas.toLocaleTimeString("cs-CZ", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

export function AdminVzkazyTreboni({ vzkazy }: PropsAdminVzkazyTreboni) {
  const router = useRouter();
  const [mazeId, setMazeId] = useState<string | null>(null);

  const handleSmazat = async (id: string) => {
    setMazeId(id);

    try {
      const vysledek = await smazatVzkazAdmin(id);
      if ("uspech" in vysledek && vysledek.uspech) {
        router.refresh();
      }
    } finally {
      setMazeId(null);
    }
  };

  return (
    <section className="space-y-4 border border-text-velmiJemny/20 p-4">
      <h2 className="text-sm font-light text-text-jemny">Vzkazy Třeboni</h2>

      <p className="text-xs text-text-velmiJemny">
        Celkem vzkazů:{" "}
        <span className="tabular-nums text-text">{vzkazy.length}</span>
      </p>

      {vzkazy.length === 0 ? (
        <p className="text-xs text-text-velmiJemny">Zatím žádné vzkazy.</p>
      ) : (
        <ul className="space-y-3">
          {vzkazy.map((vzkaz) => {
            const { datum, cas } = formatovatDatumCas(vzkaz.vytvoreno);

            return (
              <li
                key={vzkaz.id}
                className="border-b border-text-velmiJemny/10 pb-3 last:border-b-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-[11px] tabular-nums text-text-velmiJemny">
                      {datum} · {cas}
                    </p>
                    <p className="whitespace-pre-wrap text-sm font-light leading-relaxed text-text">
                      {vzkaz.text}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSmazat(vzkaz.id)}
                    disabled={mazeId === vzkaz.id}
                    className="flex-shrink-0 text-base leading-none opacity-60 transition-opacity hover:opacity-100 disabled:opacity-30"
                    aria-label="Smazat vzkaz"
                  >
                    🗑️
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
