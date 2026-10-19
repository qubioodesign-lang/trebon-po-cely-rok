import Link from "next/link";

/** Drobné „i“ vlevo dole, stejně velké jako informační ikona BRÁNY. */
export function OdkazInformace() {
  return (
    <Link
      href="/informace"
      className="fixed z-[25] flex items-start justify-start text-white/70 no-underline md:hidden"
      style={{
        left: "1rem",
        bottom: "env(safe-area-inset-bottom, 0px)",
        width: "2.75rem",
        height: "2.75rem",
      }}
      aria-label="Informace"
    >
      <svg
        className="mt-[0.05rem] block h-[0.8rem] w-[0.8rem]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5.5" strokeLinecap="round" />
        <circle cx="12" cy="7.6" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    </Link>
  );
}
