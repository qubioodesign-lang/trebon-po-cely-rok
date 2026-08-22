"use client";

import { useState, useTransition } from "react";
import {
  nacistSeznamBranaZalohAkce,
  vytvoritBranaZalohuAkce,
} from "@/app/brana/admin/actions";
import { formatovatVelikost } from "@/lib/brana/admin/zaloha/pomocne";
import type { BranaZalohaInfo } from "@/lib/brana/admin/zaloha/typy";

const TLACITKO =
  "border border-text-velmiJemny/30 px-3 py-1.5 text-sm text-text disabled:opacity-50";

type BranaAdminZalohyProps = {
  pocatecniZalohy: BranaZalohaInfo[];
  pocatecniChyba: string | null;
};

function formatovatDatum(iso: string): string {
  const datum = new Date(iso);
  if (Number.isNaN(datum.getTime())) {
    return iso;
  }
  return datum.toLocaleString("cs-CZ", {
    timeZone: "Europe/Prague",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function BranaAdminZalohy({
  pocatecniZalohy,
  pocatecniChyba,
}: BranaAdminZalohyProps) {
  const [zalohy, setZalohy] = useState(pocatecniZalohy);
  const [chyba, setChyba] = useState(pocatecniChyba);
  const [uspech, setUspech] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const obnovitSeznam = async () => {
    const vysledek = await nacistSeznamBranaZalohAkce();
    if (!vysledek.uspech) {
      setChyba(vysledek.chyba);
      return;
    }
    setZalohy(vysledek.zalohy);
  };

  const handleVytvorit = () => {
    setChyba(null);
    setUspech(null);
    startTransition(async () => {
      const vysledek = await vytvoritBranaZalohuAkce();
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      setUspech(
        `Záloha byla vytvořena (${formatovatVelikost(vysledek.zaloha.velikost)}).`,
      );
      await obnovitSeznam();
    });
  };

  const handleStahnout = (pathname: string) => {
    const url = `/api/brana/admin/zaloha/stahnout?pathname=${encodeURIComponent(pathname)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <section className="space-y-6" aria-labelledby="brana-admin-sekce-nadpis">
      <div className="space-y-2">
        <h2
          id="brana-admin-sekce-nadpis"
          className="brana-nadpis-sekce text-text"
        >
          Záloha
        </h2>
        <p className="brana-text-jemny">
          Ruční záloha pěti JSON dokumentů BRÁNY v soukromém úložišti. Neobsahuje
          RADAR, PWA ani data Třeboně.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={TLACITKO}
          disabled={pending}
          onClick={handleVytvorit}
        >
          {pending ? "Pracuji…" : "Vytvořit zálohu"}
        </button>
      </div>

      <div className="space-y-1 text-sm text-red-700">
        <p>Obnova — zatím nepoužívat</p>
        <p>Obnovu živých dat provedeme pouze jako samostatně ověřený bezpečnostní krok.</p>
      </div>

      {uspech ? <p className="text-sm text-text">{uspech}</p> : null}
      {chyba ? <p className="text-sm text-red-700">{chyba}</p> : null}

      {zalohy.length === 0 ? (
        <p className="brana-text-jemny">Zatím žádné zálohy.</p>
      ) : (
        <ul className="space-y-4">
          {zalohy.map((zaloha) => (
            <li
              key={zaloha.pathname}
              className="space-y-2 border-b border-text-velmiJemny/15 pb-4"
            >
              <div className="text-sm text-text">
                <p>
                  {formatovatDatum(zaloha.vytvoreno)}
                  {zaloha.typ === "zachrana" ? " · záchranná" : ""}
                </p>
                <p className="brana-text-jemny">
                  {formatovatVelikost(zaloha.velikost)} · {zaloha.nazev}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className={TLACITKO}
                  disabled={pending}
                  onClick={() => handleStahnout(zaloha.pathname)}
                >
                  Stáhnout
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
