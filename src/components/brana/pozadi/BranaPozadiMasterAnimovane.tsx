"use client";

import { useEffect, useState } from "react";
import {
  BRANA_POZADI_DEN_MASTER,
  BRANA_POZADI_NOC_MASTER,
} from "@/lib/brana/konstanty";
import { BRANA_IKONA_POZADI } from "@/lib/pwa-ikony/brana-konstanty";

type BranaPozadiMasterAnimovaneProps = {
  nocRezim: boolean;
};

export function BranaPozadiMasterAnimovane({
  nocRezim,
}: BranaPozadiMasterAnimovaneProps) {
  const [pripraveno, setPripraveno] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setPripraveno(true);
    });

    return () => {
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      className="brana-pozadi"
      data-brana-denni-doba={nocRezim ? "noc" : "den"}
      data-brana-pozadi-pripraveno={pripraveno ? "true" : undefined}
      aria-hidden
    >
      <div
        className={`brana-pozadi-vrstva brana-pozadi-vrstva--den${nocRezim ? "" : " brana-pozadi-vrstva--viditelna"}`}
        style={
          {
            "--brana-pozadi-master-url": `url("${BRANA_POZADI_DEN_MASTER}")`,
          } as React.CSSProperties
        }
      >
        <div className="brana-pozadi-obraz" />
        <div
          className="brana-pozadi-modra-klid"
          style={{ backgroundColor: BRANA_IKONA_POZADI }}
        />
      </div>
      <div
        className={`brana-pozadi-vrstva brana-pozadi-vrstva--noc${nocRezim ? " brana-pozadi-vrstva--viditelna" : ""}`}
        style={
          {
            "--brana-pozadi-master-url": `url("${BRANA_POZADI_NOC_MASTER}")`,
          } as React.CSSProperties
        }
      >
        <div className="brana-pozadi-obraz" />
      </div>
    </div>
  );
}
