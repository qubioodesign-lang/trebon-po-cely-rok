import Link from "next/link";
import {
  BRANA_ADMIN_HLAVNI_CASTI,
  BRANA_ADMIN_NAZEV,
  BRANA_ADMIN_SPRAVA_SEKCE,
  branaAdminCesta,
  type BranaAdminHlavniCast,
  type BranaAdminSpravaSekce,
} from "@/lib/brana/admin";

type BranaAdminObalProps = {
  host: string | null;
  aktivniCast: BranaAdminHlavniCast;
  aktivniSpravaSekce?: BranaAdminSpravaSekce;
  children: React.ReactNode;
};

/**
 * Společný obal administrace BRÁNY.
 * Hlavní přepínač Správa / Analytika + podsekce Správy.
 * Bez business logiky – jen navigační kostra pro další vývoj.
 */
export function BranaAdminObal({
  host,
  aktivniCast,
  aktivniSpravaSekce,
  children,
}: BranaAdminObalProps) {
  return (
    <>
      <header className="brana-admin-hlavicka space-y-3">
        <h1 className="brana-admin-nadpis">{BRANA_ADMIN_NAZEV.toLowerCase()}</h1>

        <nav
          className="flex flex-wrap gap-4"
          aria-label="Hlavní části administrace"
        >
          {BRANA_ADMIN_HLAVNI_CASTI.map((cast) => {
            const aktivni = cast.id === aktivniCast;
            const href =
              cast.id === "sprava"
                ? branaAdminCesta(host, "sprava", "kalendar")
                : branaAdminCesta(host, "analytika");

            return (
              <Link
                key={cast.id}
                href={href}
                className={
                  aktivni
                    ? "text-sm font-medium text-text"
                    : "text-sm font-light text-text-jemny"
                }
                aria-current={aktivni ? "page" : undefined}
              >
                {cast.label}
              </Link>
            );
          })}
        </nav>

        {aktivniCast === "sprava" ? (
          <nav
            className="flex flex-wrap gap-4 border-t border-text-velmiJemny/15 pt-3"
            aria-label="Sekce správy"
          >
            {BRANA_ADMIN_SPRAVA_SEKCE.map((sekce) => {
              const aktivni = sekce.id === aktivniSpravaSekce;
              const href = branaAdminCesta(host, "sprava", sekce.segment);

              return (
                <Link
                  key={sekce.id}
                  href={href}
                  className={
                    aktivni
                      ? "text-sm font-medium text-text"
                      : "text-sm font-light text-text-jemny"
                  }
                  aria-current={aktivni ? "page" : undefined}
                >
                  {sekce.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </header>

      <main className="brana-obal flex flex-1 flex-col">{children}</main>
    </>
  );
}
