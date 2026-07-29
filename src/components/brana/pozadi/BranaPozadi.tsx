import "./brana-pozadi.css";

/**
 * Procedurální full-screen pozadí BRÁNY.
 * V této etapě pouze denní režim; noc přijde stejným systémem proměnných.
 */
export function BranaPozadi() {
  return (
    <>
      <svg
        aria-hidden
        className="pointer-events-none absolute h-0 w-0"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter
            id="brana-jemny-sum"
            x="0%"
            y="0%"
            width="100%"
            height="100%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.0011 0.026"
              numOctaves="3"
              seed="11"
              result="sum"
            />
            <feColorMatrix
              type="saturate"
              values="0"
              in="sum"
              result="sum-mon"
            />
            <feComponentTransfer in="sum-mon">
              <feFuncA type="linear" slope="0.28" />
            </feComponentTransfer>
          </filter>
        </defs>
      </svg>

      <div className="brana-pozadi" data-brana-denni-doba="den" aria-hidden>
        <div className="brana-pozadi-zaklad" />
        <div className="brana-pozadi-hladina" />
        <div className="brana-pozadi-sum" />
        <div className="brana-pozadi-odraz" />
      </div>
    </>
  );
}
