import {
  PWA_IKONA_TEXT,
  PWA_IKONA_BRANA_MEZERY,
} from "./konstanty";
import { meritkaBranaIkony, BRANA_IKONA_POZADI, BRANA_IKONA_AKCENT } from "./brana-konstanty";
import { meritkaTrebonIkony, TREBON_IKONA_POZADI } from "./trebon-konstanty";

type VariantaPwaIkony = "trebon" | "brana";

/** Absolutní metriky linky – shodné s vykreslením ikony BRÁNY */
function meritkaBranaLinkyAbsolutni(velikost: number) {
  const { text, linkaSirka, mezeraTextLinka, linkaTloustka, posunDolu } =
    meritkaBranaIkony(velikost);

  return {
    x: Math.round((velikost - linkaSirka) / 2),
    y: posunDolu + text + mezeraTextLinka,
    width: linkaSirka,
    height: linkaTloustka,
    color: BRANA_IKONA_AKCENT,
  };
}

function ObsahTrebonIkony({ velikost }: { velikost: number }) {
  const { text, posunDolu } = meritkaTrebonIkony(velikost);
  const linka = meritkaBranaLinkyAbsolutni(velikost);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: TREBON_IKONA_POZADI,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: posunDolu,
        }}
      >
        <span
          style={{
            fontSize: text,
            fontFamily: "Inter, sans-serif",
            fontWeight: 600,
            color: PWA_IKONA_TEXT,
            lineHeight: 1,
          }}
        >
          T
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          left: linka.x,
          top: linka.y,
          width: linka.width,
          height: linka.height,
          backgroundColor: linka.color,
        }}
      />
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
