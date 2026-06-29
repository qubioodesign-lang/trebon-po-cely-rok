import type { Polozka } from "@/types";
import { popisekTypu } from "./pomocne";
import {
  AdminFormularUpravy,
  type UpravaPolozkyStav,
} from "./AdminFormularUpravy";

interface PropsAdminPanelUpravy {
  polozka: Polozka | null;
  uprava: UpravaPolozkyStav | null;
  uklada: boolean;
  nahravaSnimek: "A" | "B" | "C" | null;
  onZmena: (zmena: Partial<UpravaPolozkyStav>) => void;
  onUlozit: () => void;
  onZrusit: () => void;
  onNahraditSnimek: (snimek: "A" | "B" | "C", soubor: File) => void;
}

export function AdminPanelUpravy({
  polozka,
  uprava,
  uklada,
  nahravaSnimek,
  onZmena,
  onUlozit,
  onZrusit,
  onNahraditSnimek,
}: PropsAdminPanelUpravy) {
  if (!polozka || !uprava) return null;

  return (
    <section className="space-y-3 border border-text-jemny/30 bg-krem-tmavsi/15 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-light text-text-jemny">úprava položky</h2>
        <p className="text-xs text-text-velmiJemny">
          {popisekTypu(polozka.typ)}
          {polozka.popis ? ` · ${polozka.popis}` : ""}
        </p>
      </div>

      <AdminFormularUpravy
        polozka={polozka}
        uprava={uprava}
        uklada={uklada}
        nahravaSnimek={nahravaSnimek}
        onZmena={onZmena}
        onUlozit={onUlozit}
        onZrusit={onZrusit}
        onNahraditSnimek={onNahraditSnimek}
      />
    </section>
  );
}
