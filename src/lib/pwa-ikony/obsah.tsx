import {
  PWA_IKONA_TEXT,
  PWA_IKONA_BRANA_MEZERY,
} from "./konstanty";
import { meritkaBranaIkony, BRANA_IKONA_POZADI, BRANA_IKONA_AKCENT } from "./brana-konstanty";

type VariantaPwaIkony = "trebon" | "brana";

/** Dočasná diagnostická ikona – pozadí BRÁNY + upravená linka */
function meritkaDiagnostickaLinkaTrebon(velikost: number) {
  const { text, mezeraTextLinka, linkaTloustka, posunDolu } =
    meritkaBranaIkony(velikost);

  const puvodniY = posunDolu + text + mezeraTextLinka;

  return {
    puvodniY,
    y: puvodniY - linkaTloustka,
    x: linkaTloustka,
    width: velikost - 2 * linkaTloustka,
    height: linkaTloustka,
    marginTop: mezeraTextLinka - linkaTloustka,
    spacerHeight: text,
    posunDolu,
  };
}

function ObsahTrebonIkony({ velikost }: { velikost: number }) {
  const { spacerHeight, marginTop, width, height, posunDolu } =
    meritkaDiagnostickaLinkaTrebon(velikost);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        backgroundColor: BRANA_IKONA_POZADI,
        paddingTop: posunDolu,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div style={{ height: spacerHeight, width: 1 }} />
        <div
          style={{
            width,
            height,
            marginTop,
            backgroundColor: BRANA_IKONA_AKCENT,
          }}
        />
      </div>
    </div>
  );
}

function ObsahBranaIkony({ velikost }: { velikost: number }) {
  const { text, linkaSirka, mezeraTextLinka, linkaTloustka, posunDolu } =
    meritkaBranaIkony(velikost);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        backgroundColor: BRANA_IKONA_POZADI,
        paddingTop: posunDolu,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: text,
            fontFamily: "Inter, sans-serif",
            fontWeight: 600,
            color: PWA_IKONA_TEXT,
            letterSpacing: `${PWA_IKONA_BRANA_MEZERY}em`,
            lineHeight: 1,
          }}
        >
          BRÁNA
        </span>
        <div
          style={{
            width: linkaSirka,
            height: linkaTloustka,
            marginTop: mezeraTextLinka,
            backgroundColor: BRANA_IKONA_AKCENT,
          }}
        />
      </div>
    </div>
  );
}

function ObsahPwaIkony({
  varianta,
  velikost,
}: {
  varianta: VariantaPwaIkony;
  velikost: number;
}) {
  if (varianta === "brana") {
    return <ObsahBranaIkony velikost={velikost} />;
  }

  return <ObsahTrebonIkony velikost={velikost} />;
}

export function vykreslitPwaIkony(
  varianta: VariantaPwaIkony,
  velikost: number,
) {
  return <ObsahPwaIkony varianta={varianta} velikost={velikost} />;
}
