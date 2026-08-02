import QRCode from "qrcode";

import { BRANA_POPIS } from "@/lib/brana/konstanty";
import {
  BRANA_DESKTOP_ADRESA,
  BRANA_DESKTOP_QR_URL,
  BRANA_DESKTOP_QR_VELIKOST_PX,
} from "@/lib/brana/desktop-pozvanka";

export async function BranaDesktopInformacniPanel() {
  const qrSvg = await QRCode.toString(BRANA_DESKTOP_QR_URL, {
    type: "svg",
    margin: 0,
    width: BRANA_DESKTOP_QR_VELIKOST_PX,
    color: { dark: "#FFFFFF", light: "#00000000" },
  });

  return (
    <aside className="brana-desktop-informace" aria-label="Informace o BRÁNĚ">
      <div className="brana-desktop-informace-obsah">
        <header className="brana-desktop-informace-hlavicka">
          <h1 className="brana-desktop-informace-nadpis">BRÁNA do Třeboně</h1>
          <p className="brana-desktop-informace-popis">{BRANA_POPIS}</p>
        </header>

        <div className="brana-desktop-informace-qr-blok">
          <div
            className="brana-desktop-informace-qr"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
            aria-label={`QR kód pro ${BRANA_DESKTOP_QR_URL}`}
            role="img"
          />
          <p className="brana-desktop-informace-adresa">{BRANA_DESKTOP_ADRESA}</p>
        </div>

        <p className="brana-desktop-informace-poznamka">
          BRÁNA je vytvořena pro mobilní telefon.
        </p>
      </div>
    </aside>
  );
}
