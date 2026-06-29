import type { Polozka } from "@/types";

function formatovatDatumPublikace(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

interface PropsAdminPosledniPublikace {
  polozka: Polozka | null;
  pushOdeslano: boolean;
  odesilaPush: boolean;
  onOdeslatPush: (id: string) => void;
}

export function AdminPosledniPublikace({
  polozka,
  pushOdeslano,
  odesilaPush,
  onOdeslatPush,
}: PropsAdminPosledniPublikace) {
  return (
    <section className="space-y-3 rounded border border-text-velmiJemny/25 bg-krem-tmavsi/25 p-4">
      <h2 className="text-sm font-light text-text-jemny">poslední publikace</h2>

      {!polozka ? (
        <p className="text-xs text-text-velmiJemny">
          v galerii není žádná aktivní položka
        </p>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1 text-sm">
            <p className="text-text">{polozka.popis || "—"}</p>
            <p className="text-xs text-text-velmiJemny">
              publikováno: {formatovatDatumPublikace(polozka.datumPublikace)}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p
              className={`text-xs ${
                pushOdeslano ? "text-text-jemny" : "text-amber-700/85"
              }`}
            >
              {pushOdeslano
                ? "✓ Upozornění odesláno"
                : "⚠ Čeká na odeslání upozornění"}
            </p>

            <button
              type="button"
              onClick={() => onOdeslatPush(polozka.id)}
              disabled={odesilaPush || pushOdeslano}
              className="tlacitko-klidne shrink-0 disabled:opacity-30"
            >
              {odesilaPush ? "odesílám…" : "Odeslat upozornění"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export const KLIC_SESSION_PUSH_ODESLANO = "trebon_push_odeslano_polozka_id";
