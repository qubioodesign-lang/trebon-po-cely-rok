"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { AdminChyby, AdminData, DiagnozaBlob, Polozka } from "@/types";
import { sestavitUrlPolozky } from "@/lib/url-polozky";
import {
  prihlasitAdmin,
  odhlasitAdmin,
  nahratPolozku,
  prepnoutAktivniPolozky,
  smazatPolozkuAdmin,
  zmenitPopisPolozky,
  zmenitPoradiPolozek,
} from "@/app/admin/actions";

interface AdminPanelProps {
  jePrihlasen: boolean;
  data: AdminData | null;
  chyby: AdminChyby;
}

function BlokDiagnozy({ diagnoza }: { diagnoza: DiagnozaBlob }) {
  return (
    <div className="mx-auto max-w-sm rounded border border-amber-700/20 p-3 text-left font-mono text-[10px] leading-relaxed text-text-jemny">
      <p>diagnoza za běhu:</p>
      <p>vercel: {diagnoza.prostredi.vercel ? "ano" : "ne"}</p>
      <p>autentizace: {diagnoza.maAutentizaci ? "ano" : "ne"}</p>
      <p>node: {diagnoza.prostredi.nodeEnv}</p>
      <p>BLOB_STORE_ID: {diagnoza.promenne.BLOB_STORE_ID ? "ano" : "ne"}</p>
      <p>
        BLOB_READ_WRITE_TOKEN:{" "}
        {diagnoza.promenne.BLOB_READ_WRITE_TOKEN ? "ano" : "ne"}
      </p>
      <p>
        VERCEL_OIDC_TOKEN:{" "}
        {diagnoza.promenne.VERCEL_OIDC_TOKEN ? "ano" : "ne"}
      </p>
      <p>
        OIDC z hlavičky: {diagnoza.promenne.OIDC_Z_HEADERU ? "ano" : "ne"}
      </p>
      {diagnoza.nahledStoreId && <p>store: {diagnoza.nahledStoreId}</p>}
      {diagnoza.doporuceni && (
        <p className="mt-2 text-amber-700/90">{diagnoza.doporuceni}</p>
      )}
    </div>
  );
}

/**
 * Jednoduchá administrace chráněná heslem.
 * Data se načítají na serveru; metriky a stav úložiště se zobrazují vždy.
 */
export function AdminPanel({ jePrihlasen, data, chyby }: AdminPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [heslo, setHeslo] = useState("");
  const [chybaAkce, setChybaAkce] = useState("");
  const [nahrava, setNahrava] = useState(false);
  const posledniPlnePolozky = useRef<Polozka[]>([]);

  useEffect(() => {
    if (data?.polozky && data.polozky.length > 0) {
      posledniPlnePolozky.current = data.polozky;
    }
  }, [data?.polozky]);

  const maChybuNacitani = Boolean(chyby.uloziste || chyby.polozky);
  const polozkyZeServeru = data?.polozky ?? [];
  const polozky =
    polozkyZeServeru.length > 0
      ? polozkyZeServeru
      : maChybuNacitani
        ? posledniPlnePolozky.current
        : polozkyZeServeru;
  const metriky = data?.metriky ?? null;
  const trvaleUloziste = data?.trvaleUloziste ?? false;
  const diagnoza = data?.diagnoza ?? null;

  const obnovit = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const zpracovatChybuAkce = (vysledek: { chyba?: string; uspech?: boolean }) => {
    if ("chyba" in vysledek && vysledek.chyba) {
      setChybaAkce(vysledek.chyba);
      return false;
    }
    setChybaAkce("");
    return true;
  };

  const handlePrihlaseni = async (e: React.FormEvent) => {
    e.preventDefault();
    setChybaAkce("");

    const vysledek = await prihlasitAdmin(heslo);
    if ("uspech" in vysledek && vysledek.uspech) {
      setHeslo("");
      obnovit();
    } else {
      setChybaAkce(vysledek.chyba ?? "Neplatné heslo");
    }
  };

  const handleOdhlaseni = async () => {
    await odhlasitAdmin();
    obnovit();
  };

  const handleNahrani = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setNahrava(true);
    setChybaAkce("");

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const vysledek = await nahratPolozku(formData);
      if ("uspech" in vysledek && vysledek.uspech) {
        setChybaAkce("");
        form.reset();
        obnovit();
      } else if ("chyba" in vysledek && vysledek.chyba) {
        setChybaAkce(vysledek.chyba);
      }
    } catch (error) {
      setChybaAkce(
        error instanceof Error
          ? error.message
          : "Neočekávaná chyba server action při nahrávání"
      );
    }

    setNahrava(false);
  };

  const handlePrepnoutAktivni = async (id: string, aktivni: boolean) => {
    const vysledek = await prepnoutAktivniPolozky(id, !aktivni);
    if (zpracovatChybuAkce(vysledek)) obnovit();
  };

  const handleSmazat = async (id: string) => {
    if (!confirm("Opravdu smazat tuto položku?")) return;
    const vysledek = await smazatPolozkuAdmin(id);
    if (zpracovatChybuAkce(vysledek)) obnovit();
  };

  const handleZmenaPopisu = async (id: string, popis: string) => {
    const vysledek = await zmenitPopisPolozky(id, popis);
    if (!zpracovatChybuAkce(vysledek)) return;
    obnovit();
  };

  const handlePosun = async (index: number, smer: "nahoru" | "dolu") => {
    const noveIds = polozky.map((p) => p.id);
    const cil = smer === "nahoru" ? index - 1 : index + 1;
    if (cil < 0 || cil >= noveIds.length) return;

    [noveIds[index], noveIds[cil]] = [noveIds[cil], noveIds[index]];
    const vysledek = await zmenitPoradiPolozek(noveIds);
    if (zpracovatChybuAkce(vysledek)) obnovit();
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
          {chybaAkce && (
            <p className="text-center text-xs text-red-400">{chybaAkce}</p>
          )}
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

        {chybaAkce && (
          <div className="rounded border border-red-400/30 bg-red-50/50 p-3 text-center text-xs text-red-500">
            <p className="font-medium">chyba operace</p>
            <p className="mt-1">{chybaAkce}</p>
          </div>
        )}

        {(chyby.uloziste || chyby.polozky) && (
          <div className="rounded border border-red-400/30 bg-red-50/50 p-3 text-xs text-red-500">
            <p className="font-medium text-center">chyba načtení dat</p>
            {chyby.uloziste && <p className="mt-1">{chyby.uloziste}</p>}
            {chyby.polozky && chyby.polozky !== chyby.uloziste && (
              <p className="mt-1">{chyby.polozky}</p>
            )}
            {polozky.length > 0 && polozkyZeServeru.length === 0 && (
              <p className="mt-2 text-center text-text-jemny">
                zobrazen poslední známý seznam ({polozky.length} položek) – obnovte
                stránku po opravě
              </p>
            )}
          </div>
        )}

        {/* Stav úložiště – vždy viditelný */}
        <section className="space-y-2 text-center text-xs font-light">
          {trvaleUloziste ? (
            <p className="text-text-velmiJemny">
              trvalé úložiště aktivní – fotografie a změny se ukládají
            </p>
          ) : (
            <p className="text-amber-700/80">
              trvalé úložiště není plně aktivní – zápisy z administrace mohou
              selhat (viz diagnostika)
            </p>
          )}
          {diagnoza && <BlokDiagnozy diagnoza={diagnoza} />}
        </section>

        {/* Metriky – vždy viditelné */}
        <section className="space-y-3 border border-text-velmiJemny/20 p-4">
          <h2 className="text-sm font-light text-text-jemny">metriky</h2>
          {chyby.metriky && (
            <p className="text-xs text-red-400">
              chyba načtení metrik: {chyby.metriky}
            </p>
          )}
          {metriky ? (
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
          ) : (
            <p className="text-xs text-text-velmiJemny">data metrik nejsou k dispozici</p>
          )}
        </section>

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
          {chyby.polozky && !chyby.uloziste && (
            <p className="text-xs text-red-400">
              chyba načtení položek: {chyby.polozky}
            </p>
          )}
          {polozky.length === 0 && !maChybuNacitani && (
            <p className="text-xs text-text-velmiJemny">žádné položky v galerii</p>
          )}
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
