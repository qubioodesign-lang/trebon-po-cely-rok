"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { smazatBranaVzkazAkce } from "@/app/brana/admin/actions";

type VzkazVSeznamu = {
  id: string;
  text: string;
  vytvoreno: string;
};

type BranaAdminVzkazyProps = {
  vzkazy: VzkazVSeznamu[];
  chyba: string | null;
};

function formatovatDatumCas(iso: string): string {
  const datum = new Date(iso);
  if (Number.isNaN(datum.getTime())) {
    return "neznámý čas";
  }

  return datum.toLocaleString("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BranaAdminVzkazy({
  vzkazy: vzkazyZServeru,
  chyba: chybaZServeru,
}: BranaAdminVzkazyProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [vzkazy, setVzkazy] = useState(vzkazyZServeru);
  const [mazeId, setMazeId] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(chybaZServeru);

  useEffect(() => {
    setVzkazy(vzkazyZServeru);
  }, [vzkazyZServeru]);

  const smazat = async (id: string) => {
    setMazeId(id);
    setChyba(null);

    try {
      const vysledek = await smazatBranaVzkazAkce(id);
      if (vysledek.uspech) {
        setVzkazy((predchozi) => predchozi.filter((vzkaz) => vzkaz.id !== id));
        startTransition(() => {
          router.refresh();
        });
        return;
      }

      setChyba(vysledek.chyba);
    } catch {
      setChyba("Vzkaz se nepodařilo smazat.");
    } finally {
      setMazeId(null);
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-light text-text-jemny">Vzkazy</h2>

      {chyba ? (
        <p className="text-sm text-text" role="alert">
          {chyba}
        </p>
      ) : null}

      {vzkazy.length === 0 && !chybaZServeru ? (
        <p className="text-sm font-light text-text-jemny">Žádné vzkazy.</p>
      ) : (
        <ul className="space-y-4">
          {vzkazy.map((vzkaz) => (
            <li
              key={vzkaz.id}
              className="border-b border-text-velmiJemny/15 pb-4 last:border-b-0"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-xs tabular-nums text-text-velmiJemny">
                    {formatovatDatumCas(vzkaz.vytvoreno)}
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm font-light leading-relaxed text-text">
                    {vzkaz.text}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void smazat(vzkaz.id)}
                  disabled={mazeId === vzkaz.id}
                  className="min-h-11 flex-shrink-0 border border-text-velmiJemny/30 px-3 py-1.5 text-sm text-text disabled:opacity-50"
                >
                  {mazeId === vzkaz.id ? "Mažu…" : "Smazat"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
