import type { PolozkaVerejna } from "@/types";
import { maViceRadkuPopisu } from "@/lib/popis-radky";
import { GalerieKritickyCss } from "./GalerieKritickyCss";
import { LinkaPodPopisem } from "./LinkaPodPopisem";
import { ZobrazeniPolozkyServer } from "./ZobrazeniPolozkyServer";

function tridyPopisuGalerie(
  popis: string,
  tono: "mobil" | "desktop",
): string {
  const barva = tono === "mobil" ? "text-white/90" : "text-text-jemny";
  const zaklad = `text-sm font-light tracking-wide ${barva}`;
  if (!maViceRadkuPopisu(popis)) {
    return zaklad;
  }
  return `${zaklad} max-w-[240px] whitespace-pre leading-[1.625]`;
}

interface PropsGaleriePocatecniServer {
  polozka: PolozkaVerejna;
  aktualniIndex: number;
  pocetPolozek: number;
}

/** Statické šipky – stejný vzhled jako v GalerieHlavni, bez interakce */
function SipkaVlevo() {
  return (
    <svg
      className="h-[1.35rem] w-[1.35rem] shrink-0 text-white/75"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M16 4L6 12L16 20"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SipkaVpravo() {
  return (
    <svg
      className="h-[1.35rem] w-[1.35rem] shrink-0 text-white/75"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 4L18 12L8 20"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SipkaNaZacatek() {
  return (
    <svg
      className="h-[1.35rem] w-[1.625rem] shrink-0 text-white/75"
      viewBox="0 0 20 24"
      fill="none"
      aria-hidden="true"
    >
      <path d="M3 4V20" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <path
        d="M16 4L7 12L16 20"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Celá počáteční galerie v HTML – stejné rozvržení jako GalerieHlavni.
 * Po hydrataci klienta se odstraní (#trebon-ssr-galerie).
 */
export function GaleriePocatecniServer({
  polozka,
  aktualniIndex,
  pocetPolozek,
}: PropsGaleriePocatecniServer) {
  const hrefChciSeVracet = `/chci-se-vracet?polozka=${encodeURIComponent(polozka.id)}`;

  return (
    <>
      <GalerieKritickyCss />
      <div
        id="trebon-ssr-galerie"
        className="fixed inset-0 z-[10] h-dvh max-h-dvh w-full overflow-hidden overscroll-none bg-krem-tmavsi md:static md:z-auto md:h-auto md:max-h-none md:min-h-dvh"
      >
        <div className="relative h-full w-full touch-none md:h-[70dvh] md:touch-auto">
          <div className="relative isolate h-full w-full">
            <div className="trebon-galerie-foto absolute inset-0 z-0">
              <ZobrazeniPolozkyServer polozka={polozka} />
            </div>

            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-[8] h-40 md:hidden"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(0, 0, 0, 0.65) 0%, rgba(0, 0, 0, 0.35) 50%, rgba(0, 0, 0, 0) 100%)",
              }}
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-[8] h-52 md:hidden"
              style={{
                background:
                  "linear-gradient(to top, rgba(0, 0, 0, 0.65) 0%, rgba(0, 0, 0, 0.35) 50%, rgba(0, 0, 0, 0) 100%)",
              }}
              aria-hidden="true"
            />

            <div className="absolute inset-x-0 top-0 z-20 px-6 pt-8 text-center md:bg-gradient-to-b md:from-black/30 md:to-transparent md:pb-16">
              <h1 className="trebon-horni-napis">
                Třeboň po celý rok
              </h1>
            </div>

            <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center px-6 pb-[calc(2.75rem+env(safe-area-inset-bottom,0px))] text-center md:hidden">
              <p className={tridyPopisuGalerie(polozka.popis, "mobil")}>
                {polozka.popis}
              </p>
              <div className="relative my-3 flex w-full items-center justify-center">
                {aktualniIndex >= 1 && (
                  <div className="absolute left-[2%] top-1/2 -translate-y-1/2" aria-hidden="true">
                    <SipkaNaZacatek />
                  </div>
                )}
                {aktualniIndex > 0 && (
                  <div className="absolute left-[14%] top-1/2 -translate-y-1/2" aria-hidden="true">
                    <SipkaVlevo />
                  </div>
                )}
                <LinkaPodPopisem />
                {aktualniIndex < pocetPolozek - 1 && (
                  <div className="absolute right-[5%] top-1/2 -translate-y-1/2" aria-hidden="true">
                    <SipkaVpravo />
                  </div>
                )}
              </div>
              <div className="[&_.odkaz-jemny]:text-white/75">
                <a href={hrefChciSeVracet} className="odkaz-jemny mt-3 inline-block">
                  chci se vracet
                </a>
              </div>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-[calc((2.75rem+env(safe-area-inset-bottom,0px))/2-0.6875rem)] z-20 flex justify-center md:hidden">
              <div className="pointer-events-auto -translate-y-1/2">
                <span className="inline-block text-[0.6875rem] font-light tracking-wide text-white/60">
                  sdílet
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden flex-col items-center px-6 py-8 text-center md:flex">
          <p className={tridyPopisuGalerie(polozka.popis, "desktop")}>
            {polozka.popis}
          </p>
          <a href={hrefChciSeVracet} className="odkaz-jemny mt-3 inline-block">
            chci se vracet
          </a>
          <span className="mt-2.5 inline-block text-[0.6875rem] font-light tracking-wide text-text-velmiJemny/55">
            sdílet
          </span>
        </div>
      </div>
    </>
  );
}
