"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  pridatBranaRadarZalozkuAkce,
  smazatBranaRadarZalozkuAkce,
} from "@/app/brana/admin/actions";
import {
  BRANA_RADAR_ZALOZKY_MAX,
  normalizovatHttpAdresu,
  type BranaRadarZalozka,
} from "@/lib/brana/admin/radar-zalozky";

const VSTUP =
  "w-full border border-text-velmiJemny/25 bg-transparent px-1.5 py-1 text-sm text-text outline-none focus:border-text-jemny/50 disabled:opacity-50";

type Props = {
  pocatecni: BranaRadarZalozka[];
  uloziteniPovoleno: boolean;
};

/**
 * Osobní seznam odkazů na stránce RADAR.
 * Klik otevře adresu v nové záložce. Nic neskenuje.
 */
export function BranaAdminRadarZalozky({
  pocatecni,
  uloziteniPovoleno,
}: Props) {
  const router = useRouter();
  const [polozky, setPolozky] = useState(pocatecni);
  const [nazev, setNazev] = useState("");
  const [url, setUrl] = useState("");
  const [chyba, setChyba] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setPolozky(pocatecni);
  }, [pocatecni]);

  function pridat() {
    if (!uloziteniPovoleno || pending) {
      return;
    }
    setChyba(null);
    startTransition(async () => {
      const vysledek = await pridatBranaRadarZalozkuAkce({ nazev, url });
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      setNazev("");
      setUrl("");
      setPolozky((pred) => [
        vysledek.zalozka,
        ...pred.filter((p) => p.id !== vysledek.zalozka.id),
      ]);
      router.refresh();
    });
  }

  function smazat(polozka: BranaRadarZalozka) {
    if (pending) {
      return;
    }
    if (!window.confirm(`Smazat odkaz „${polozka.nazev}“?`)) {
      return;
    }
    setChyba(null);
    setPendingId(polozka.id);
    startTransition(async () => {
      const vysledek = await smazatBranaRadarZalozkuAkce(polozka.id);
      setPendingId(null);
      if (!vysledek.uspech) {
        setChyba(vysledek.chyba);
        return;
      }
      setPolozky((pred) => pred.filter((p) => p.id !== polozka.id));
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <h3
        id="brana-admin-radar-zalozky-nadpis"
        className="text-sm font-normal text-text"
      >
        Moje sledované weby
      </h3>

      <div className="grid max-w-xl gap-2">
        <label className="space-y-1 text-sm text-text">
          <span className="text-text-jemny">Název</span>
          <input
            type="text"
            className={VSTUP}
            value={nazev}
            maxLength={200}
            disabled={!uloziteniPovoleno || pending}
            onChange={(e) => setNazev(e.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm text-text">
          <span className="text-text-jemny">Webová adresa</span>
          <input
            type="text"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
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
        disabled={!uloziteniPovoleno || pending || polozky.length >= BRANA_RADAR_ZALOZKY_MAX}
        className="border border-text-velmiJemny/30 px-3 py-1.5 text-sm text-text disabled:opacity-50"
      >
        {pending && pendingId === null ? "Ukládám…" : "Přidat"}
      </button>

      {chyba ? (
        <p className="text-sm text-text" role="alert">
          {chyba}
        </p>
      ) : null}

      {polozky.length === 0 ? (
        <p className="text-sm text-text-jemny">Zatím tu není žádný sledovaný web.</p>
      ) : (
        <ul className="space-y-2">
          {polozky.map((polozka) => {
            const href = normalizovatHttpAdresu(polozka.url);
            const ceka = pending && pendingId === polozka.id;
            return (
              <li key={polozka.id} className="flex flex-wrap items-center gap-3">
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-text underline-offset-2 hover:underline"
                  >
                    {polozka.nazev}
                  </a>
                ) : (
                  <span className="text-sm text-text">{polozka.nazev}</span>
                )}
                <button
                  type="button"
                  onClick={() => smazat(polozka)}
                  disabled={pending}
                  className="text-xs font-light text-text-jemny underline-offset-2 hover:underline disabled:opacity-50"
                >
                  {ceka ? "Mažu…" : "Smazat"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
