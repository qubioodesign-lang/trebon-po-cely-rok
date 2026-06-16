"use client";

import { useState, useEffect, useCallback } from "react";
import type { Polozka, MetrikySouhrn } from "@/types";
import { sestavitUrlPolozky } from "@/lib/url-polozky";

/**
 * Jednoduchá administrace chráněná heslem.
 * Umožňuje správu fotografií, videí a zobrazení metrik.
 */
export function AdminPanel() {
  const [prihlasen, setPrihlasen] = useState<boolean | null>(null);
  const [heslo, setHeslo] = useState("");
  const [chyba, setChyba] = useState("");
  const [polozky, setPolozky] = useState<Polozka[]>([]);
  const [metriky, setMetriky] = useState<MetrikySouhrn | null>(null);
  const [nahrava, setNahrava] = useState(false);
  const [trvaleUloziste, setTrvaleUloziste] = useState<boolean | null>(null);

  const nacistData = useCallback(async () => {
    const response = await fetch("/api/admin/polozky");
    if (response.ok) {
      const data = await response.json();
      setPolozky(data.polozky);
      setMetriky(data.metriky);
      setTrvaleUloziste(data.trvaleUloziste ?? false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/admin/prihlaseni")
      .then((r) => r.json())
      .then((data) => {
        setPrihlasen(data.prihlasen);
        if (data.prihlasen) nacistData();
      });
  }, [nacistData]);

  const handlePrihlaseni = async (e: React.FormEvent) => {
    e.preventDefault();
    setChyba("");

    const response = await fetch("/api/admin/prihlaseni", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ heslo }),
    });

    if (response.ok) {
      setPrihlasen(true);
      nacistData();
    } else {
      setChyba("Neplatné heslo");
    }
  };

  const handleOdhlaseni = async () => {
    await fetch("/api/admin/prihlaseni", { method: "DELETE" });
    setPrihlasen(false);
    setPolozky([]);
    setMetriky(null);
  };

  const handleNahrani = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setNahrava(true);

    const formData = new FormData(e.currentTarget);
    const response = await fetch("/api/admin/polozky", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      e.currentTarget.reset();
      await nacistData();
    }

    setNahrava(false);
  };

  const handlePrepnoutAktivni = async (id: string, aktivni: boolean) => {
    await fetch("/api/admin/polozky", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, aktivni: !aktivni }),
    });
    await nacistData();
  };

  const handleSmazat = async (id: string) => {
    if (!confirm("Opravdu smazat tuto položku?")) return;

    await fetch("/api/admin/polozky", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await nacistData();
  };

  const handleZmenaPopisu = async (id: string, popis: string) => {
    await fetch("/api/admin/polozky", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, popis }),
    });
  };

  const handlePosun = async (index: number, smer: "nahoru" | "dolu") => {
    const noveIds = polozky.map((p) => p.id);
    const cil = smer === "nahoru" ? index - 1 : index + 1;
    if (cil < 0 || cil >= noveIds.length) return;

    [noveIds[index], noveIds[cil]] = [noveIds[cil], noveIds[index]];

    await fetch("/api/admin/polozky", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poradiIds: noveIds }),
    });
    await nacistData();
  };

  if (prihlasen === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-krem">
        <p className="text-sm text-text-jemny">načítání…</p>
      </div>
    );
  }

  if (!prihlasen) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-krem px-6">
        <form onSubmit={handlePrihlaseni} className="w-full max-w-xs space-y-4">
          <h1 className="text-center text-lg font-light text-text">
            administrace
          </h1>
          <input
            type="password"
            value={heslo}
            onChange={(e) => setHeslo(e.target.value)}
            placeholder="heslo"
            className="w-full border border-text-velmiJemny/30 bg-transparent px-4 py-2 text-sm text-text outline-none focus:border-text-jemny/50"
          />
          {chyba && <p className="text-center text-xs text-red-400">{chyba}</p>}
          <button type="submit" className="tlacitko-klidne w-full">
            přihlásit se
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-krem px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-light text-text">administrace</h1>
          <button onClick={handleOdhlaseni} className="odkaz-jemny">
            odhlásit se
          </button>
        </div>

        {trvaleUloziste === false && (
          <p className="text-center text-xs font-light text-amber-700/80">
            trvalé úložiště není aktivní – nastavte Vercel Blob (viz DEPLOY-VERCEL.md)
          </p>
        )}

        {trvaleUloziste === true && (
          <p className="text-center text-xs font-light text-text-velmiJemny">
            trvalé úložiště aktivní – fotografie a změny se ukládají
          </p>
        )}

        {/* Metriky */}
        {metriky && (
          <section className="space-y-3 border border-text-velmiJemny/20 p-4">
            <h2 className="text-sm font-light text-text-jemny">metriky</h2>
            <div className="grid grid-cols-2 gap-2 text-xs text-text-velmiJemny">
              <span>návštěvy: {metriky.pocetNavstev}</span>
              <span>vracející se: {metriky.pocetVracejicichSeNavstevniku}</span>
              <span>zobrazení fotografií: {metriky.pocetZobrazeniFotografii}</span>
              <span>posuny vpřed: {metriky.pocetPosunuVpred}</span>
              <span>návraty zpět: {metriky.pocetNavratuZpet}</span>
              <span>procento návratů: {metriky.procentoNavratu}%</span>
              <span>kliknutí &bdquo;chci se vracet&ldquo;: {metriky.pocetKliknutiChciSeVracet}</span>
              <span>povolená upozornění: {metriky.pocetPovolenychUpozorneni}</span>
            </div>
          </section>
        )}

        {/* Nahrání nové položky */}
        <section className="space-y-3 border border-text-velmiJemny/20 p-4">
          <h2 className="text-sm font-light text-text-jemny">nahrát položku</h2>
          <form onSubmit={handleNahrani} className="space-y-3">
            <input
              type="file"
              name="soubor"
              accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm"
              required
              className="w-full text-xs text-text-jemny"
            />
            <input
              type="text"
              name="popis"
              placeholder="popis (malými písmeny, bez tečky)"
              className="w-full border border-text-velmiJemny/30 bg-transparent px-3 py-2 text-sm text-text outline-none"
            />
            <input
              type="date"
              name="datumPorizeni"
              className="w-full border border-text-velmiJemny/30 bg-transparent px-3 py-2 text-sm text-text outline-none"
            />
            <button type="submit" disabled={nahrava} className="tlacitko-klidne">
              {nahrava ? "nahrávání…" : "nahrát"}
            </button>
          </form>
        </section>

        {/* Seznam položek */}
        <section className="space-y-3">
          <h2 className="text-sm font-light text-text-jemny">
            položky ({polozky.length})
          </h2>
          {polozky.map((polozka, index) => (
            <div
              key={polozka.id}
              className={`flex items-center gap-3 border border-text-velmiJemny/20 p-3 ${
                !polozka.aktivni ? "opacity-40" : ""
              }`}
            >
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => handlePosun(index, "nahoru")}
                  disabled={index === 0}
                  className="text-xs text-text-velmiJemny disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => handlePosun(index, "dolu")}
                  disabled={index === polozky.length - 1}
                  className="text-xs text-text-velmiJemny disabled:opacity-30"
                >
                  ↓
                </button>
              </div>

              <div className="h-12 w-12 flex-shrink-0 overflow-hidden bg-krem-tmavsi">
                {polozka.typ === "fotografie" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sestavitUrlPolozky(polozka.soubor)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-xs text-text-velmiJemny">
                    video
                  </span>
                )}
              </div>

              <input
                type="text"
                defaultValue={polozka.popis}
                onBlur={(e) => handleZmenaPopisu(polozka.id, e.target.value)}
                className="flex-1 border-none bg-transparent text-sm text-text outline-none"
              />

              <div className="flex flex-col gap-1">
                <button
                  onClick={() => handlePrepnoutAktivni(polozka.id, polozka.aktivni)}
                  className="text-xs text-text-velmiJemny"
                >
                  {polozka.aktivni ? "skrýt" : "zobrazit"}
                </button>
                <button
                  onClick={() => handleSmazat(polozka.id)}
                  className="text-xs text-red-400/70"
                >
                  smazat
                </button>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
