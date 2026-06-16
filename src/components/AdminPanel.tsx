"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminData, Polozka } from "@/types";
import { sestavitUrlPolozky } from "@/lib/url-polozky";
import {
  prihlasitAdmin,
  odhlasitAdmin,
  nahrátPolozku,
  prepnoutAktivniPolozky,
  smazatPolozkuAdmin,
  zmenitPopisPolozky,
  zmenitPoradiPolozek,
} from "@/app/admin/actions";

interface AdminPanelProps {
  jePrihlasen: boolean;
  data: AdminData | null;
  chybaNacitani?: string | null;
}

/**
 * Jednoduchá administrace chráněná heslem.
 * Data se načítají na serveru (Blob OIDC); mutace přes server actions.
 */
export function AdminPanel({
  jePrihlasen,
  data,
  chybaNacitani,
}: AdminPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [heslo, setHeslo] = useState("");
  const [chyba, setChyba] = useState("");
  const [nahrava, setNahrava] = useState(false);

  const polozky = data?.polozky ?? [];
  const metriky = data?.metriky ?? null;
  const trvaleUloziste = data?.trvaleUloziste ?? null;
  const diagnoza = data?.diagnoza ?? null;

  const obnovit = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const handlePrihlaseni = async (e: React.FormEvent) => {
    e.preventDefault();
    setChyba("");

    const vysledek = await prihlasitAdmin(heslo);
    if ("uspech" in vysledek && vysledek.uspech) {
      setHeslo("");
      obnovit();
    } else {
      setChyba(vysledek.chyba ?? "Neplatné heslo");
    }
  };

  const handleOdhlaseni = async () => {
    await odhlasitAdmin();
    obnovit();
  };

  const handleNahrani = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setNahrava(true);
    setChyba("");

    const formData = new FormData(e.currentTarget);
    const vysledek = await nahrátPolozku(formData);

    if ("uspech" in vysledek && vysledek.uspech) {
      e.currentTarget.reset();
      obnovit();
    } else if ("chyba" in vysledek) {
      setChyba(vysledek.chyba ?? "Chyba při nahrávání");
    }

    setNahrava(false);
  };

  const handlePrepnoutAktivni = async (id: string, aktivni: boolean) => {
    await prepnoutAktivniPolozky(id, !aktivni);
    obnovit();
  };

  const handleSmazat = async (id: string) => {
    if (!confirm("Opravdu smazat tuto položku?")) return;
    await smazatPolozkuAdmin(id);
    obnovit();
  };

  const handleZmenaPopisu = async (id: string, popis: string) => {
    await zmenitPopisPolozky(id, popis);
    obnovit();
  };

  const handlePosun = async (index: number, smer: "nahoru" | "dolu") => {
    const noveIds = polozky.map((p) => p.id);
    const cil = smer === "nahoru" ? index - 1 : index + 1;
    if (cil < 0 || cil >= noveIds.length) return;

    [noveIds[index], noveIds[cil]] = [noveIds[cil], noveIds[index]];
    await zmenitPoradiPolozek(noveIds);
    obnovit();
  };

  if (!jePrihlasen) {
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

        {(pending || nahrava) && (
          <p className="text-center text-xs text-text-velmiJemny">obnovuji…</p>
        )}

        {chybaNacitani && (
          <p className="text-center text-xs text-red-400">
            chyba načtení: {chybaNacitani}
          </p>
        )}

        {chyba && (
          <p className="text-center text-xs text-red-400">{chyba}</p>
        )}

        {trvaleUloziste === false && (
          <div className="space-y-2 text-center text-xs font-light text-amber-700/80">
            <p>
              trvalé úložiště není aktivní – nastavte Vercel Blob (viz
              DEPLOY-VERCEL.md)
            </p>
            {diagnoza && (
              <div className="mx-auto max-w-sm rounded border border-amber-700/20 p-3 text-left font-mono text-[10px] leading-relaxed text-text-jemny">
                <p>diagnoza za běhu:</p>
                <p>vercel: {diagnoza.prostredi.vercel ? "ano" : "ne"}</p>
                <p>autentizace: {diagnoza.maAutentizaci ? "ano" : "ne"}</p>
                <p>node: {diagnoza.prostredi.nodeEnv}</p>
                <p>
                  BLOB_STORE_ID:{" "}
                  {diagnoza.promenne.BLOB_STORE_ID ? "ano" : "ne"}
                </p>
                <p>
                  BLOB_READ_WRITE_TOKEN:{" "}
                  {diagnoza.promenne.BLOB_READ_WRITE_TOKEN ? "ano" : "ne"}
                </p>
                <p>
                  VERCEL_OIDC_TOKEN:{" "}
                  {diagnoza.promenne.VERCEL_OIDC_TOKEN ? "ano" : "ne"}
                </p>
                <p>
                  OIDC z hlavičky:{" "}
                  {diagnoza.promenne.OIDC_Z_HEADERU ? "ano" : "ne"}
                </p>
                {diagnoza.nahledStoreId && (
                  <p>store: {diagnoza.nahledStoreId}</p>
                )}
                {diagnoza.doporuceni && (
                  <p className="mt-2 text-amber-700/90">{diagnoza.doporuceni}</p>
                )}
              </div>
            )}
          </div>
        )}

        {trvaleUloziste === true && (
          <p className="text-center text-xs font-light text-text-velmiJemny">
            trvalé úložiště aktivní – fotografie a změny se ukládají
          </p>
        )}

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
              <span>
                kliknutí &bdquo;chci se vracet&ldquo;:{" "}
                {metriky.pocetKliknutiChciSeVracet}
              </span>
              <span>povolená upozornění: {metriky.pocetPovolenychUpozorneni}</span>
            </div>
          </section>
        )}

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

        <section className="space-y-3">
          <h2 className="text-sm font-light text-text-jemny">
            položky ({polozky.length})
          </h2>
          {polozky.map((polozka: Polozka, index: number) => (
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
                  onClick={() =>
                    handlePrepnoutAktivni(polozka.id, polozka.aktivni)
                  }
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
