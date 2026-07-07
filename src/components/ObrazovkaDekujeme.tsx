"use client";

import Link from "next/link";
import { useChovaniNavstevnika } from "@/hooks/useChovaniNavstevnika";

/**
 * Děkovací obrazovka – stejná atmosféra, bez ikon úspěchu.
 * Pozice galerie se obnoví automaticky ze sessionStorage.
 */
export function ObrazovkaDekujeme() {
  useChovaniNavstevnika("chci_se_vracet");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-krem px-8 py-16">
      <div className="max-w-sm space-y-8 text-center">
        <div className="space-y-4 text-sm font-light leading-relaxed tracking-wide text-text-jemny">
          <p>Děkujeme.</p>
          <p>
            Občas vám dáme vědět,
            <br />
            že na vás čeká další malý kousek Třeboně.
          </p>
        </div>

        <Link href="/" className="odkaz-jemny inline-block">
          zpět k fotografiím
        </Link>
      </div>
    </div>
  );
}
