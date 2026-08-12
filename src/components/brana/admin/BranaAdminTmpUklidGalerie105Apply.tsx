"use client";

import { useState, useTransition } from "react";
import { aplikovatUklidGalerie105VystavyCekaAkce } from "@/app/brana/admin/actions";
import { BRANA_UKLID_GALERIE_105_VYSTAV_OCEKAVANY_POCET } from "@/lib/brana/admin/uklid-galerie-105-vystavy";

/**
 * DOČASNÉ: jednorázové tlačítko APPLY úklidu Galerie 105.
 * Zobrazit jen když preview fail-closed prošlo.
 */
export function BranaAdminTmpUklidGalerie105Apply() {
  const [pending, startTransition] = useTransition();
  const [zprava, setZprava] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);

  function aplikovat() {
    setZprava(null);
    setChyba(null);
    const ok = window.confirm(
      `Jednorázově vyřadit přesně ${BRANA_UKLID_GALERIE_105_VYSTAV_OCEKAVANY_POCET} CEKA výstav Galerie 105 (VYRAZENO, bez mazání)?`,
    );
    if (!ok) {
      return;
    }
    startTransition(async () => {
      const vysledek = await aplikovatUklidGalerie105VystavyCekaAkce();
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      setZprava(
        [
          `APPLY OK: změněno ${vysledek.zmeneno}`,
          `CEKA výstavy po = ${vysledek.cekaVystavyPo}`,
          `VYRAZENO výstavy = ${vysledek.vyrazenoVystavyPo}`,
          `Akce CEKA před/po = ${vysledek.akceCekaPred}/${vysledek.akceCekaPo}`,
          `scanKlic zachován = ${vysledek.scanKlicZachovan ? "ANO" : "NE"}`,
        ].join(" · "),
      );
    });
  }

  return (
    <div className="mt-8 space-y-3 border-t border-text-velmiJemny/20 pt-6">
      <p className="text-sm font-medium text-text">Fáze 2 – APPLY</p>
      <p className="max-w-2xl text-sm text-text-jemny">
        Znovu načte produkční data, ověří přesně{" "}
        {BRANA_UKLID_GALERIE_105_VYSTAV_OCEKAVANY_POCET} / 0 Akcí, pak jedním
        zápisem nastaví stav VYRAZENO (bez hard delete).
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={aplikovat}
        className="border border-text-velmiJemny/40 px-3 py-1.5 text-sm text-text disabled:opacity-50"
      >
        {pending
          ? "Probíhá úklid…"
          : `Vyřadit ${BRANA_UKLID_GALERIE_105_VYSTAV_OCEKAVANY_POCET} výstav Galerie 105`}
      </button>
      {chyba ? (
        <p className="text-sm text-text" role="alert">
          {chyba}
        </p>
      ) : null}
      {zprava ? (
        <p className="text-sm text-text" role="status">
          {zprava}
        </p>
      ) : null}
    </div>
  );
}
