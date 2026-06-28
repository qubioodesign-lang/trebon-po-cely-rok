import { PROLNUTI_SIPKA_FADE_MS } from "@/lib/prolnuti-konstanty";

/** Jemná kruhová šipka pro ruční přehrání prolnutí – střed obrazovky */
export function SipkaPrehratProlnuti({
  viditelna,
  onClick,
}: {
  viditelna: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Přehrát prolnutí znovu"
      className="flex h-9 w-9 items-center justify-center border-none bg-transparent p-0 outline-none"
      style={{
        opacity: viditelna ? 1 : 0,
        transition: `opacity ${PROLNUTI_SIPKA_FADE_MS}ms ease-out`,
        pointerEvents: viditelna ? "auto" : "none",
      }}
    >
      <svg
        className="h-[0.8125rem] w-[0.8125rem] text-white"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        style={{
          filter: "drop-shadow(0 1px 2.5px rgba(0, 0, 0, 0.28))",
        }}
      >
        <path
          d="M12 4a8 8 0 1 1-7.75 6.1"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <path
          d="M4.25 4v3.5H7.75"
          stroke="currentColor"
          strokeWidth="1.25"
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
}
