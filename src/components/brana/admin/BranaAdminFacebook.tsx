"use client";

import { useState } from "react";
import { nahratBranaFacebookNahledAkce } from "@/app/brana/admin/actions";

type HotovyOdkaz = {
  odkaz: string;
  nahledUrl: string;
};

/** Samostatné nahrání snímku pro facebookový odkaz. Vzkazy nemění. */
export function BranaAdminFacebook() {
  const [soubor, setSoubor] = useState<File | null>(null);
  const [probiha, setProbiha] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [hotovo, setHotovo] = useState<HotovyOdkaz | null>(null);
  const [hlaska, setHlaska] = useState<string | null>(null);

  const nahrat = async () => {
    if (!soubor || probiha) return;

    setProbiha(true);
    setChyba(null);
    setHotovo(null);
    setHlaska(null);

    try {
      const vysledek = await nahratBranaFacebookNahledAkce(soubor);
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      setHotovo({
        odkaz: vysledek.odkaz,
        nahledUrl: vysledek.nahledUrl,
      });
    } catch {
      setChyba("Obrázek se nepodařilo nahrát. Odkaz nebyl vytvořen.");
    } finally {
      setProbiha(false);
    }
  };

  const kopirovat = async () => {
    if (!hotovo) return;
    setHlaska(null);
    try {
      await navigator.clipboard.writeText(hotovo.odkaz);
      setHlaska("Odkaz zkopírován");
    } catch {
      setHlaska("Odkaz se nepodařilo zkopírovat do schránky.");
    }
  };

  return (
    <section className="mt-10 space-y-4 border-t border-text-velmiJemny/20 pt-8">
      <h2 className="text-sm font-light text-text-jemny">Facebook</h2>

      <label className="block space-y-2 text-sm font-light text-text">
        <span>Nahrát obrázek</span>
        <input
          type="file"
          accept="image/png,image/jpeg"
          disabled={probiha}
          onChange={(udalost) => {
            setSoubor(udalost.target.files?.[0] ?? null);
            setHotovo(null);
            setChyba(null);
            setHlaska(null);
          }}
          className="block w-full text-sm text-text-jemny file:mr-3 file:border file:border-text-velmiJemny/30 file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:text-text"
        />
      </label>

      <button
        type="button"
        onClick={() => void nahrat()}
        disabled={!soubor || probiha}
        className="min-h-11 border border-text-velmiJemny/30 px-3 py-1.5 text-sm text-text disabled:opacity-50"
      >
        {probiha ? "Nahrávám…" : "Nahrát obrázek"}
      </button>

      {chyba ? (
        <p className="text-sm text-text" role="alert">
          {chyba}
        </p>
      ) : null}

      {hotovo ? (
        <div className="space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hotovo.nahledUrl}
            alt="Náhled nahraného obrázku pro Facebook"
            className="max-h-80 w-auto max-w-full object-contain"
          />
          <p className="break-all text-xs text-text-velmiJemny">{hotovo.odkaz}</p>
          <button
            type="button"
            onClick={() => void kopirovat()}
            className="min-h-11 border border-text-velmiJemny/30 px-3 py-1.5 text-sm text-text"
          >
            Odkaz pro Facebook
          </button>
          {hlaska ? <p className="text-sm font-light text-text-jemny">{hlaska}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
