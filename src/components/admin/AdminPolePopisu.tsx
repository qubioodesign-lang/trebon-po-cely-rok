"use client";

import { useEffect, useState } from "react";
import {
  HLASKA_DLOUHY_RADEK,
  HLASKA_MAX_RADKU,
  MAX_RADKU_POPISU,
  maPrilisDlouhyRadek,
  navrhnoutZmenuPopisu,
  prekrocilMaxRadku,
  radkyPopisu,
} from "@/lib/popis-radky";

interface PropsAdminPolePopisu {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (popis: string) => void;
  className?: string;
}

/**
 * Textarea popisu – Enter = nový řádek, max 4, kontrola šířky řádku.
 * Vždy řízená, aby odmítnutý 5. řádek nevrátil DOM do nežádoucího stavu.
 */
export function AdminPolePopisu({
  name = "popis",
  value,
  defaultValue = "",
  onChange,
  className = "w-full border border-text-velmiJemny/30 bg-transparent px-3 py-2 text-sm text-text outline-none focus:border-text-jemny/50",
}: PropsAdminPolePopisu) {
  const [vnitrni, setVnitrni] = useState(value ?? defaultValue);
  const popis = value !== undefined ? value : vnitrni;
  const [hlaskaMaxRadku, setHlaskaMaxRadku] = useState<string | null>(null);
  const [hlaskaSirka, setHlaskaSirka] = useState<string | null>(() =>
    maPrilisDlouhyRadek(popis) ? HLASKA_DLOUHY_RADEK : null,
  );

  useEffect(() => {
    if (value !== undefined) {
      setVnitrni(value);
    }
  }, [value]);

  const nastavPopis = (kandidat: string) => {
    const vysledek = navrhnoutZmenuPopisu(popis, kandidat);
    if (value === undefined) {
      setVnitrni(vysledek.popis);
    }
    onChange?.(vysledek.popis);
    setHlaskaMaxRadku(vysledek.hlaskaMaxRadku);
    setHlaskaSirka(vysledek.hlaskaSirka);
  };

  return (
    <div className="space-y-1">
      <textarea
        name={name}
        rows={MAX_RADKU_POPISU}
        value={popis}
        onChange={(e) => nastavPopis(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") {
            return;
          }
          if (radkyPopisu(popis).length >= MAX_RADKU_POPISU) {
            e.preventDefault();
            setHlaskaMaxRadku(HLASKA_MAX_RADKU);
          }
        }}
        onPaste={(e) => {
          const vlozeny = e.clipboardData.getData("text");
          const el = e.currentTarget;
          const start = el.selectionStart ?? popis.length;
          const end = el.selectionEnd ?? popis.length;
          const kandidat = popis.slice(0, start) + vlozeny + popis.slice(end);
          if (prekrocilMaxRadku(kandidat)) {
            e.preventDefault();
            setHlaskaMaxRadku(HLASKA_MAX_RADKU);
            setHlaskaSirka(
              maPrilisDlouhyRadek(popis) ? HLASKA_DLOUHY_RADEK : null,
            );
          }
        }}
        placeholder="popis (malými písmeny, bez tečky)"
        className={`${className} min-h-[5.5rem] resize-y whitespace-pre`}
      />
      {hlaskaMaxRadku ? (
        <p className="text-[10px] font-light text-text-jemny">{hlaskaMaxRadku}</p>
      ) : null}
      {hlaskaSirka ? (
        <p className="text-[10px] font-light text-text-jemny">{hlaskaSirka}</p>
      ) : null}
    </div>
  );
}
