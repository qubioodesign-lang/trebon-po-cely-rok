import { PROLNUTI_SIPKA_FADE_MS } from "@/lib/prolnuti-konstanty";

/** Jemná kruhová šipka pro ruční přehrání prolnutí – střed obrazovky */
export function SipkaPrehratProlnuti({
  viditelna,
  onClick,
  fadeMs = PROLNUTI_SIPKA_FADE_MS,
}: {
  viditelna: boolean;
  onClick: () => void;
  fadeMs?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Přehrát prolnutí znovu"
      className="relative flex h-11 w-11 items-center justify-center border-none bg-transparent p-0 outline-none"
      style={{
        opacity: viditelna ? 1 : 0,
        transition: `opacity ${fadeMs}ms ease-out`,
        pointerEvents: viditelna ? "auto" : "none",
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[2.75rem] w-[2.75rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: "rgba(232, 232, 232, 0.78)",
          boxShadow:
            "0 0 0 1px rgba(255, 255, 255, 0.42), 0 2px 10px rgba(0, 0, 0, 0.18)",
        }}
      />
      <svg
        className="relative z-[1] h-[1.375rem] w-[1.375rem] text-white"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        style={{
          filter: "drop-shadow(0 1px 4px rgba(0, 0, 0, 0.45))",
        }}
      >
        <path
          d="M12 4a8 8 0 1 1-7.75 6.1"
          stroke="currentColor"
          strokeWidth="2.15"
          strokeLinecap="round"
        />
        <path
          d="M4.25 4v3.5H7.75"
          stroke="currentColor"
          strokeWidth="2.15"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export interface ProlnutiOvladani {
  zobrazitSipku: boolean;
  prehratZnovu: () => void;
  faze: "cekani" | "prolinuti" | "dokonceno";
  /** Inkrement při startu prolínání A→B – restart animace bodu na lince */
  behProlnuti: number;
}
