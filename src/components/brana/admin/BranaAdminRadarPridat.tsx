"use client";

import { useState, useTransition } from "react";
import { pridatRucniRadarNalezAkce } from "@/app/brana/admin/actions";

const VSTUP =
  "w-full border border-text-velmiJemny/25 bg-transparent px-1.5 py-1 text-sm text-text outline-none focus:border-text-jemny/50 disabled:opacity-50";

type Props = {
  uloziteniPovoleno: boolean;
};

/**
 * Ruční výzkumný nález. Ukládá se jen do historie RADARU.
 * Nic nezapisuje do Kalendáře ani do pracovního inboxu.
 */
export function BranaAdminRadarPridat({ uloziteniPovoleno }: Props) {
  const [datumOd, setDatumOd] = useState("");
  const [cas, setCas] = useState("");
  const [nazev, setNazev] = useState("");
  const [kde, setKde] = useState("");
  const [url, setUrl] = useState("");
  const [chyba, setChyba] = useState<string | null>(null);
  const [zprava, setZprava] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function vycistit() {
    setDatumOd("");
    setCas("");
    setNazev("");
    setKde("");
    setUrl("");
  }

  function pridat() {
    if (!uloziteniPovoleno || pending) {
      return;
    }
    setChyba(null);
    setZprava(null);
    startTransition(async () => {
      const vysledek = await pridatRucniRadarNalezAkce({
        datumOd,
        cas,
        nazev,
        kde,
        url,
      });
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      vycistit();
      setZprava("Nález uložen pro budoucí analýzu.");
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-normal text-text">+ Přidat</p>
      <div className="grid max-w-xl gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-sm text-text">
          <span className="text-text-jemny">Datum *</span>
          <input
            type="date"
            className={VSTUP}
            value={datumOd}
            disabled={!uloziteniPovoleno || pending}
            onChange={(e) => setDatumOd(e.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm text-text">
          <span className="text-text-jemny">Čas</span>
          <input
            type="time"
            className={VSTUP}
            value={cas}
            disabled={!uloziteniPovoleno || pending}
            onChange={(e) => setCas(e.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm text-text sm:col-span-2">
          <span className="text-text-jemny">CO / název *</span>
          <input
            type="text"
            className={VSTUP}
            value={nazev}
            maxLength={200}
            disabled={!uloziteniPovoleno || pending}
            onChange={(e) => setNazev(e.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm text-text sm:col-span-2">
          <span className="text-text-jemny">KDE</span>
          <input
            type="text"
            className={VSTUP}
            value={kde}
            maxLength={200}
            disabled={!uloziteniPovoleno || pending}
            onChange={(e) => setKde(e.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm text-text sm:col-span-2">
          <span className="text-text-jemny">Zdroj / URL</span>
          <input
            type="text"
            className={VSTUP}
            value={url}
            maxLength={2000}
            disabled={!uloziteniPovoleno || pending}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
      </div>
      <button
        type="button"
        onClick={pridat}
        disabled={!uloziteniPovoleno || pending}
        className="border border-text-velmiJemny/30 px-3 py-1.5 text-sm text-text disabled:opacity-50"
      >
        {pending ? "Ukládám…" : "Přidat"}
      </button>
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
    </div>
  );
}
