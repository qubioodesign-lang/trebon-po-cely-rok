"use client";

import { useEffect, useState } from "react";
import type { ProlnutiCasovaniNastaveni } from "@/lib/prolnuti-casovani";
import { ulozitNastaveniProlnutiAdmin } from "@/app/admin/actions";

const POLE_NASTAVENI: {
  klic: keyof ProlnutiCasovaniNastaveni;
  popisek: string;
  min?: number;
  max?: number;
}[] = [
  {
    klic: "cekaniPredStartemMs",
    popisek: "začátek prolnutí (čekání před startem)",
  },
  { klic: "delkaProlnutiMs", popisek: "délka prolnutí" },
  { klic: "prekrytiProlnutiMs", popisek: "překrytí mezi kroky prolnutí" },
  {
    klic: "nastupPoslednihoSnimkuMs",
    popisek: "nástup posledního snímku (3 fotky)",
    min: 1500,
    max: 5000,
  },
  {
    klic: "prodlevaPredPoslednimKrokemMs",
    popisek: "spuštění posledního kroku po nástupu druhé fotky (3 fotky)",
    min: 1500,
    max: 5000,
  },
  { klic: "replayZpozdeniMs", popisek: "zobrazení replay (prodleva)" },
  { klic: "replayFadeMs", popisek: "fade-in replay" },
];

interface PropsAdminNastaveniProlnuti {
  casovani: ProlnutiCasovaniNastaveni;
  onUlozeno?: () => void;
  onChyba?: (zprava: string) => void;
  onPotvrzeni?: (zprava: string) => void;
}

export function AdminNastaveniProlnuti({
  casovani,
  onUlozeno,
  onChyba,
  onPotvrzeni,
}: PropsAdminNastaveniProlnuti) {
  const [formular, setFormular] = useState<ProlnutiCasovaniNastaveni>(casovani);
  const [uklada, setUklada] = useState(false);

  useEffect(() => {
    setFormular(casovani);
  }, [casovani]);

  const handleUlozit = async () => {
    setUklada(true);
    onChyba?.("");

    try {
      const vysledek = await ulozitNastaveniProlnutiAdmin(formular);
      if ("chyba" in vysledek && vysledek.chyba) {
        onChyba?.(vysledek.chyba);
        return;
      }

      onPotvrzeni?.("Nastavení prolnutí bylo uloženo.");
      onUlozeno?.();
    } catch (error) {
      onChyba?.(
        error instanceof Error
          ? error.message
          : "Neočekávaná chyba při ukládání nastavení prolnutí"
      );
    } finally {
      setUklada(false);
    }
  };

  return (
    <section className="space-y-3 border border-text-velmiJemny/20 p-4">
      <div>
        <h2 className="text-sm font-light text-text-jemny">nastavení prolnutí</h2>
        <p className="mt-1 text-xs text-text-velmiJemny">
          Časy se ukládají trvale a galerie je použije pro všechna prolnutí.
        </p>
      </div>

      <div className="space-y-3">
        {POLE_NASTAVENI.map(({ klic, popisek, min = 0, max }) => (
          <label
            key={klic}
            className="flex flex-col gap-1 text-xs text-text-velmiJemny sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="text-text-jemny">{popisek}</span>
            <input
              type="number"
              min={min}
              max={max}
              step={50}
              value={formular[klic]}
              onChange={(e) =>
                setFormular((predchozi) => ({
                  ...predchozi,
                  [klic]: Number(e.target.value),
                }))
              }
              className="w-full border border-text-velmiJemny/30 bg-transparent px-3 py-2 text-sm text-text outline-none focus:border-text-jemny/50 sm:max-w-[8rem]"
            />
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void handleUlozit()}
        disabled={uklada}
        className="tlacitko-klidne disabled:opacity-30"
      >
        {uklada ? "ukládám…" : "Uložit nastavení"}
      </button>
    </section>
  );
}
