import {
  BRANA_DLOUHODOBY_INTERVAL_VYCHOZI,
  BRANA_ZDROJE_RYTMUS_VYCHOZI,
  popisekDlouhodobehoIntervalu,
  popisekRychlehoRytmu,
} from "@/lib/brana/admin/zdroj";

/**
 * Informace o rytmu kontroly podle typu zdroje.
 * Dlouhodobý interval je pevně 14 dní (ne uživatelské nastavení).
 * Rychlý rytmus je pevný.
 */
export function BranaAdminZdrojeRytmus() {
  return (
    <div className="space-y-3" aria-label="Rytmus kontroly zdrojů">
      <div className="space-y-1.5">
        <h3 className="text-sm font-normal text-text-jemny">
          Dlouhodobé zdroje
        </h3>
        <p className="text-sm text-text">
          <span className="text-text-jemny">Kontrola:</span>{" "}
          {popisekDlouhodobehoIntervalu(BRANA_DLOUHODOBY_INTERVAL_VYCHOZI)}
        </p>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-sm font-normal text-text-jemny">
          Rychlé zdroje
        </h3>
        <p className="text-sm text-text">
          <span className="text-text-jemny">Kontrola:</span>{" "}
          {popisekRychlehoRytmu(BRANA_ZDROJE_RYTMUS_VYCHOZI.rychlyRytmus)}
        </p>
      </div>
    </div>
  );
}
