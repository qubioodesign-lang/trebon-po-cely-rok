import { headers } from "next/headers";
import { BranaAdminObal } from "@/components/brana/admin/BranaAdminObal";
import { jeAdminPrihlasen } from "@/lib/autentizace";

const POCET_RADKU = 30;

/** Správa → Kalendář – pracovní plocha redaktora (řádky dnů + dvě orientační linky) */
export default async function StrankaBranaAdminKalendar() {
  if (!(await jeAdminPrihlasen())) {
    return null;
  }

  const host = (await headers()).get("host");

  return (
    <BranaAdminObal
      host={host}
      aktivniCast="sprava"
      aktivniSpravaSekce="kalendar"
    >
      <section
        className="flex min-h-0 flex-1 flex-col space-y-3 bg-white"
        aria-labelledby="brana-admin-kalendar-nadpis"
      >
        <h2
          id="brana-admin-kalendar-nadpis"
          className="shrink-0 text-base font-normal text-neutral-800"
        >
          Pracovní kalendář
        </h2>

        <div
          className="relative min-h-[calc(100dvh-11rem)] flex-1 bg-white"
          role="region"
          aria-label="Pracovní kalendář"
        >
          <div className="absolute inset-0 flex flex-col">
            {Array.from({ length: POCET_RADKU }, (_, index) => (
              <div
                key={index}
                className="min-h-11 flex-1 border-b border-neutral-200/55"
                aria-hidden="true"
              />
            ))}
          </div>

          {/* Orientační značky – čitelnější kontrast, stále střídmé */}
          <div
            className="pointer-events-none absolute inset-x-0 top-[12.5%] z-10 flex items-center gap-3"
            role="separator"
            aria-label="Zítra se publikuje"
          >
            <div className="h-[1.5px] flex-1 bg-neutral-500/70" />
            <span className="shrink-0 text-[0.625rem] font-normal tracking-[0.12em] text-neutral-600">
              ZÍTRA SE PUBLIKUJE
            </span>
            <div className="h-[1.5px] flex-1 bg-neutral-500/70" />
          </div>

          <div
            className="pointer-events-none absolute inset-x-0 top-[28.125%] z-10 flex items-center gap-3"
            role="separator"
            aria-label="Schváleno k publikaci"
          >
            <div className="h-[1.5px] flex-1 bg-neutral-500/70" />
            <span className="shrink-0 text-[0.625rem] font-normal tracking-[0.12em] text-neutral-600">
              SCHVÁLENO K PUBLIKACI
            </span>
            <div className="h-[1.5px] flex-1 bg-neutral-500/70" />
          </div>
        </div>
      </section>
    </BranaAdminObal>
  );
}
