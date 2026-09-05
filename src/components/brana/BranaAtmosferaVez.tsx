type BranaAtmosferaVezProps = {
  className?: string;
};

/**
 * Jednoduchá bílá konturová silueta věže — lokální kotva Atmosféry.
 * Informaci nese text; věž není piktogram k rozluštění.
 */
export function BranaAtmosferaVez({ className }: BranaAtmosferaVezProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 28 40"
      width="28"
      height="40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <g
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* základna */}
        <line x1="3" y1="38.5" x2="25" y2="38.5" />
        {/* tělo — spodní blok */}
        <rect x="7" y="24" width="14" height="14.5" />
        {/* obloukový vchod */}
        <path d="M12.5 38.5 V32.5 A1.5 1.5 0 0 1 15.5 32.5 V38.5" />
        {/* střední patro */}
        <rect x="8.5" y="14" width="11" height="10" />
        {/* okénko */}
        <path d="M14 17.5 V21" />
        {/* střecha */}
        <path d="M8.5 14 L14 4.5 L19.5 14" />
        {/* křížek */}
        <line x1="14" y1="4.5" x2="14" y2="1.5" />
        <line x1="12.2" y1="2.8" x2="15.8" y2="2.8" />
      </g>
    </svg>
  );
}
