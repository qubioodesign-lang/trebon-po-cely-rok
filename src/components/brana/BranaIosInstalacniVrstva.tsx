"use client";

import { useEffect, useState } from "react";
import {
  priZmeneIosInstalacniVrstvy,
  ziskatIosInstalacniVrstvu,
  zavritIosInstalacniVrstvu,
  type BranaIosInstalacniVarianta,
} from "@/lib/brana/ios-instalacni-vrstva";

type BranaIosInstalacniVrstvaProps = {
  nocRezim: boolean;
};

function textKroku(
  varianta: BranaIosInstalacniVarianta,
): { radek1: string; radek2: string } {
  if (varianta === "SAFARI") {
    return {
      radek1: "Klepněte na Sdílet",
      radek2: "Pak Přidat na plochu",
    };
  }

  return {
    radek1: "Otevřete BRÁNU v Safari",
    radek2: "Pak Sdílet → Přidat na plochu",
  };
}

export function BranaIosInstalacniVrstva({
  nocRezim,
}: BranaIosInstalacniVrstvaProps) {
  const [stav, setStav] = useState(ziskatIosInstalacniVrstvu);

  useEffect(() => {
    return priZmeneIosInstalacniVrstvy(() => {
      setStav(ziskatIosInstalacniVrstvu());
    });
  }, []);

  if (!stav.otevreno || !stav.varianta) {
    return null;
  }

  const { radek1, radek2 } = textKroku(stav.varianta);
  const trida = [
    "brana-ios-instalace-vrstva",
    nocRezim
      ? "brana-ios-instalace-vrstva--noc"
      : "brana-ios-instalace-vrstva--den",
  ].join(" ");

  return (
    <div
      className={trida}
      role="dialog"
      aria-modal="true"
      aria-labelledby="brana-ios-instalace-nadpis"
    >
      <button
        type="button"
        className="brana-ios-instalace-zavrit"
        aria-label="Zavřít"
        onClick={zavritIosInstalacniVrstvu}
      >
        <span aria-hidden>×</span>
      </button>

      <div className="brana-ios-instalace-obsah">
        <h2 id="brana-ios-instalace-nadpis" className="brana-ios-instalace-nadpis">
          Na plochu
        </h2>
        <p className="brana-ios-instalace-radek">{radek1}</p>
        <p className="brana-ios-instalace-radek">{radek2}</p>
      </div>
    </div>
  );
}
