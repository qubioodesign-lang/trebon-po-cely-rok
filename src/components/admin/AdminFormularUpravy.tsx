import type { Polozka } from "@/types";
import { sestavitUrlPolozky } from "@/lib/url-polozky";

export interface UpravaPolozkyStav {
  popis: string;
  datumPorizeni: string;
  aktivni: boolean;
}

interface PropsAdminFormularUpravy {
  polozka: Polozka;
  uprava: UpravaPolozkyStav;
  uklada: boolean;
  nahravaSnimek: "A" | "B" | "C" | null;
  onZmena: (zmena: Partial<UpravaPolozkyStav>) => void;
  onUlozit: () => void;
  onZrusit: () => void;
  onNahraditSnimek: (snimek: "A" | "B" | "C", soubor: File) => void;
}

function NahraditSnimekProlnuti({
  popisek,
  cestaSouboru,
  nahrava,
  onVybrat,
}: {
  popisek: string;
  cestaSouboru: string;
  nahrava: boolean;
  onVybrat: (soubor: File) => void;
}) {
  return (
    <label className="block space-y-1.5 text-xs text-text-velmiJemny">
      <span>{popisek}</span>
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sestavitUrlPolozky(cestaSouboru)}
          alt=""
          className="h-12 w-12 flex-shrink-0 bg-krem-tmavsi object-cover"
        />
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          disabled={nahrava}
          className="min-w-0 flex-1 text-xs text-text-jemny disabled:opacity-30"
          onChange={(e) => {
            const soubor = e.target.files?.[0];
            e.target.value = "";
            if (soubor) onVybrat(soubor);
          }}
        />
      </div>
      {nahrava && (
        <span className="text-[10px] text-text-velmiJemny">nahrávám…</span>
      )}
    </label>
  );
}

export function AdminFormularUpravy({
  polozka,
  uprava,
  uklada,
  nahravaSnimek,
  onZmena,
  onUlozit,
  onZrusit,
  onNahraditSnimek,
}: PropsAdminFormularUpravy) {
  const maZmenu =
    uprava.popis !== polozka.popis ||
    (uprava.datumPorizeni || "") !== (polozka.datumPorizeni?.slice(0, 10) ?? "") ||
    uprava.aktivni !== polozka.aktivni;

  return (
    <div className="space-y-3">
      <label className="block space-y-1 text-xs text-text-velmiJemny">
        popis
        <input
          type="text"
          value={uprava.popis}
          onChange={(e) => onZmena({ popis: e.target.value })}
          className="w-full border border-text-velmiJemny/30 bg-transparent px-3 py-2 text-sm text-text outline-none focus:border-text-jemny/50"
        />
      </label>

      <label className="block space-y-1 text-xs text-text-velmiJemny">
        datum pořízení
        <input
          type="date"
          value={uprava.datumPorizeni}
          onChange={(e) => onZmena({ datumPorizeni: e.target.value })}
          className="w-full border border-text-velmiJemny/30 bg-transparent px-3 py-2 text-sm text-text outline-none focus:border-text-jemny/50"
        />
      </label>

      <label className="flex items-center gap-2 text-xs text-text-jemny">
        <input
          type="checkbox"
          checked={uprava.aktivni}
          onChange={(e) => onZmena({ aktivni: e.target.checked })}
          className="h-3.5 w-3.5 accent-text"
        />
        viditelné v galerii
      </label>

      {polozka.typ === "prolnuti" && polozka.soubory && (
        <div className="space-y-3 rounded border border-text-velmiJemny/15 p-3">
          <p className="text-xs text-text-velmiJemny">výměna snímků prolnutí</p>
          <NahraditSnimekProlnuti
            popisek="fotografie A"
            cestaSouboru={polozka.soubory[0]}
            nahrava={nahravaSnimek === "A"}
            onVybrat={(soubor) => onNahraditSnimek("A", soubor)}
          />
          <NahraditSnimekProlnuti
            popisek="fotografie B"
            cestaSouboru={polozka.soubory[1]}
            nahrava={nahravaSnimek === "B"}
            onVybrat={(soubor) => onNahraditSnimek("B", soubor)}
          />
          {polozka.soubory.length > 2 && (
            <NahraditSnimekProlnuti
              popisek="fotografie C"
              cestaSouboru={polozka.soubory[2]}
              nahrava={nahravaSnimek === "C"}
              onVybrat={(soubor) => onNahraditSnimek("C", soubor)}
            />
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onUlozit}
          disabled={!maZmenu || uklada}
          className="tlacitko-klidne disabled:opacity-30"
        >
          {uklada ? "ukládám…" : "uložit změny"}
        </button>
        <button
          type="button"
          onClick={onZrusit}
          disabled={uklada}
          className="text-xs text-text-velmiJemny disabled:opacity-30"
        >
          Zrušit
        </button>
      </div>
    </div>
  );
}
