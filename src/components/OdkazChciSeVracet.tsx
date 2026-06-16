"use client";

import Link from "next/link";
import { ulozitPoziciGalerie } from "@/lib/uloziste";
import { useMetriky } from "@/hooks/useMetriky";

interface PropsOdkazChciSeVracet {
  aktualniIndex: number;
}

/**
 * Nenápadný odkaz „chci se vracet“ pod každou fotografií.
 * Bez rámečku, bez ikon, bez marketingového charakteru.
 */
export function OdkazChciSeVracet({ aktualniIndex }: PropsOdkazChciSeVracet) {
  const { odeslat } = useMetriky();

  const handleKlik = () => {
    ulozitPoziciGalerie(aktualniIndex);
    odeslat("klik_chci_se_vracet");
  };

  return (
    <Link
      href="/chci-se-vracet"
      onClick={handleKlik}
      className="odkaz-jemny mt-3 inline-block"
    >
      chci se vracet
    </Link>
  );
}
