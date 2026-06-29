import QRCode from "qrcode";

import { DESKTOP_POZVANKA_URL_MOBILNIHO_WEBU } from "@/lib/desktop-pozvanka";

interface PropsDesktopPozvanka {
  fotografieUrl: string;
}

export async function DesktopPozvanka({ fotografieUrl }: PropsDesktopPozvanka) {
  const qrSvg = await QRCode.toString(DESKTOP_POZVANKA_URL_MOBILNIHO_WEBU, {
    type: "svg",
    margin: 0,
    width: 280,
    color: { dark: "#FFFFFF", light: "#00000000" },
  });

  return (
    <div className="fixed inset-0 z-50 hidden min-h-dvh w-full flex-col overflow-hidden md:flex">
      <img
        src={fotografieUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        aria-hidden
        fetchPriority="high"
      />

      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-black/55 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/45 to-transparent"
        aria-hidden
      />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-between px-10 py-16 text-center text-white">
        <header className="max-w-md space-y-3">
          <h1 className="text-[1.75rem] font-normal leading-snug tracking-tight">
            Třeboň po celý rok
          </h1>
          <p className="text-[0.9375rem] font-normal leading-relaxed text-white/85">
            Každý den malý návrat do Třeboně.
          </p>
        </header>

        <div className="flex translate-y-[6dvh] flex-col items-center gap-6">
          <div
            className="h-[280px] w-[280px] [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
            aria-label={`QR kód pro ${DESKTOP_POZVANKA_URL_MOBILNIHO_WEBU}`}
            role="img"
          />
          <p className="text-[1.3125rem] font-normal tracking-wide text-white/90">
            trebonpocelyrok.cz
          </p>
        </div>

        <footer>
          <p className="text-[0.75rem] font-normal text-white/65">
            Projekt je vytvořen pro mobilní telefon.
          </p>
        </footer>
      </div>
    </div>
  );
}
