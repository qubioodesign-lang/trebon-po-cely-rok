interface PropsAdminPotvrzeniSmazani {
  popis: string;
  probiha: boolean;
  onZrusit: () => void;
  onPotvrdit: () => void;
}

export function AdminPotvrzeniSmazani({
  popis,
  probiha,
  onZrusit,
  onPotvrdit,
}: PropsAdminPotvrzeniSmazani) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onZrusit}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-potvrzeni-smazani-nadpis"
        className="w-full max-w-sm border border-text-velmiJemny/30 bg-krem p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p
          id="admin-potvrzeni-smazani-nadpis"
          className="text-sm font-light text-text-jemny"
        >
          Opravdu smazat položku {popis}?
        </p>

        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onZrusit}
            disabled={probiha}
            className="tlacitko-klidne disabled:opacity-30"
          >
            Zrušit
          </button>
          <button
            type="button"
            onClick={onPotvrdit}
            disabled={probiha}
            className="text-xs text-red-400/80 disabled:opacity-30"
          >
            {probiha ? "mažu…" : "Smazat"}
          </button>
        </div>
      </div>
    </div>
  );
}
