import {
  PWA_IKONA_AKCENT,
  PWA_IKONA_POZADI,
  PWA_IKONA_TEXT,
  PWA_IKONA_BRANA_MEZERY,
  meritkaPwaIkony,
} from "./konstanty";
import { meritkaBranaIkony, BRANA_IKONA_POZADI, BRANA_IKONA_AKCENT } from "./brana-konstanty";

type VariantaPwaIkony = "trebon" | "brana";

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

  const { pismenoT, linkaSirka, linkaTloustka, mezeraTextLinka } =
    meritkaPwaIkony(velikost);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: PWA_IKONA_POZADI,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: pismenoT,
            fontFamily: "Inter, sans-serif",
            fontWeight: 600,
            color: PWA_IKONA_TEXT,
            lineHeight: 1,
          }}
        >
          T
        </span>
        <div
          style={{
            width: linkaSirka,
            height: linkaTloustka,
            marginTop: mezeraTextLinka,
            backgroundColor: PWA_IKONA_AKCENT,
          }}
        />
      </div>
    </div>
  );
}

export function vykreslitPwaIkony(
  varianta: VariantaPwaIkony,
  velikost: number,
) {
  return <ObsahPwaIkony varianta={varianta} velikost={velikost} />;
}
