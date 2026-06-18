"use client";

import Link from "next/link";
import {
  ulozitPoziciGalerie,
  ulozitPolozkuGalerie,
} from "@/lib/uloziste";
import { useMetriky } from "@/hooks/useMetriky";

interface PropsOdkazChciSeVracet {
  aktualniIndex: number;
  polozkaId: string;
}

/**
 * Nenápadný odkaz „chci se vracet“ pod každou fotografií.
 * Bez rámečku, bez ikon, bez marketingového charakteru.
 */
export function OdkazChciSeVracet({
  aktualniIndex,
  polozkaId,
}: PropsOdkazChciSeVracet) {
  const { odeslat } = useMetriky();

  const handleKlik = () => {
    ulozitPoziciGalerie(aktualniIndex);
    ulozitPolozkuGalerie(polozkaId);
    odeslat("klik_chci_se_vracet");
  };

  const href = `/chci-se-vracet?polozka=${encodeURIComponent(polozkaId)}`;

  return (
    <Link
      href={href}
      onClick={handleKlik}
      className="odkaz-jemny mt-3 inline-block"
    >
      chci se vracet
    </Link>
  );
}
