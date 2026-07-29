import type { BranaPozadiVarianta } from "@/lib/brana/pozadi-varianty";
import { BRANA_POZADI_DEN_MASTER } from "@/lib/brana/konstanty";
import "./brana-pozadi.css";
import "./brana-pozadi-varianty.css";

type BranaPozadiProps = {
  varianta?: BranaPozadiVarianta;
};

function BranaPozadiMaster() {
  return (
    <div className="brana-pozadi" data-brana-denni-doba="den" aria-hidden>
      <div
        className="brana-pozadi-obraz"
        style={
          {
            "--brana-pozadi-master-url": `url("${BRANA_POZADI_DEN_MASTER}")`,
          } as React.CSSProperties
        }
      />
      <div className="brana-pozadi-modra-klid" />
    </div>
  );
}

function BranaPozadiProceduralni({ varianta }: { varianta: BranaPozadiVarianta }) {
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
          <filter
            id="brana-varianta1-sum"
            x="0%"
            y="0%"
            width="100%"
            height="100%"
          >
            <feTurbulence
              type="turbulence"
              baseFrequency="0.014 0.006"
              numOctaves="2"
              seed="7"
              result="vlny"
            />
            <feColorMatrix
              type="saturate"
              values="0"
              in="vlny"
              result="vlny-mon"
            />
            <feComponentTransfer in="vlny-mon">
              <feFuncA type="linear" slope="0.45" />
            </feComponentTransfer>
          </filter>
          <filter
            id="brana-varianta4-odraz"
            x="-5%"
            y="-5%"
            width="110%"
            height="110%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.006 0.002"
              numOctaves="3"
              seed="19"
              result="deformace"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="deformace"
              scale="14"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <div
        className="brana-pozadi"
        data-brana-denni-doba="den"
        data-pozadi-variant={String(varianta)}
        aria-hidden
      >
        <div className="brana-pozadi-zaklad" />
        <div className="brana-pozadi-hladina" />
        <div className="brana-pozadi-sum" />
        <div className="brana-pozadi-odraz" />
      </div>
    </>
  );
}

/**
 * Full-screen pozadí BRÁNY – master fotografie (výchozí) nebo dočasné procedurální varianty.
 */
export function BranaPozadi({ varianta }: BranaPozadiProps) {
  if (varianta) {
    return <BranaPozadiProceduralni varianta={varianta} />;
  }

  return <BranaPozadiMaster />;
}
