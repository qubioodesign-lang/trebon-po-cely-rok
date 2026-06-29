"use client";

import { useState } from "react";
import { nahratDesktopPozvankaFotografii } from "@/app/admin/actions";

interface PropsAdminDesktopPozvanka {
  fotografieUrl: string;
  maVlastniFotografii: boolean;
  onUlozeno?: () => void;
  onChyba?: (zprava: string) => void;
  onPotvrzeni?: (zprava: string) => void;
}

export function AdminDesktopPozvanka({
  fotografieUrl,
  maVlastniFotografii,
  onUlozeno,
  onChyba,
  onPotvrzeni,
}: PropsAdminDesktopPozvanka) {
  const [nahrava, setNahrava] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNahrava(true);
    onChyba?.("");

    const formData = new FormData(event.currentTarget);

    try {
      const vysledek = await nahratDesktopPozvankaFotografii(formData);
      if ("chyba" in vysledek && vysledek.chyba) {
        onChyba?.(vysledek.chyba);
        return;
      }

      onPotvrzeni?.("Desktopová fotografie byla nahrána.");
      onUlozeno?.();
      event.currentTarget.reset();
    } catch (error) {
      onChyba?.(
        error instanceof Error
          ? error.message
          : "Neočekávaná chyba při nahrávání desktopové fotografie"
      );
    } finally {
      setNahrava(false);
    }
  };

  return (
    <section className="space-y-3 border border-text-velmiJemny/20 p-4">
      <div>
        <h2 className="text-sm font-light text-text-jemny">Desktopová pozvánka</h2>
        <p className="mt-1 text-xs text-text-velmiJemny">
          Jedna fotografie pro desktopovou úvodní obrazovku. Není součástí galerie
          a na mobilu se nezobrazuje. Nové nahrání nahradí předchozí fotografii.
        </p>
      </div>

      <a
        href={fotografieUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block h-14 w-14 flex-shrink-0 overflow-hidden border border-text-velmiJemny/20 bg-krem-tmavsi"
        title="Otevřít fotografii"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fotografieUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      </a>

      <p className="text-xs text-text-velmiJemny">
        {maVlastniFotografii
          ? "Aktuálně je nastavena vlastní fotografie."
          : "Zatím se zobrazuje výchozí fotografie – nahrajte vlastní."}
      </p>

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3">
        <label className="block text-xs text-text-velmiJemny">
          fotografie (JPEG, PNG, WebP, AVIF)
          <input
            type="file"
            name="soubor"
            accept="image/jpeg,image/png,image/webp,image/avif"
            required
            className="mt-1 w-full text-xs text-text-jemny"
          />
        </label>
        <button
          type="submit"
          disabled={nahrava}
          className="tlacitko-klidne disabled:opacity-30"
        >
          {nahrava ? "nahrávání…" : "nahrát fotografii"}
        </button>
      </form>
    </section>
  );
}
