import {
  PWA_IKONA_AKCENT,
  PWA_IKONA_POZADI,
  PWA_IKONA_TEXT,
  meritkaPwaIkony,
} from "./konstanty";

type VariantaPwaIkony = "trebon" | "brana";

function ObsahPwaIkony({
  varianta,
  velikost,
}: {
  varianta: VariantaPwaIkony;
  velikost: number;
}) {
  const {
    pismenoT,
    brana,
    linkaSirka,
    linkaTloustka,
    mezeraTextLinka,
    branaMezery,
  } = meritkaPwaIkony(velikost);

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
        {varianta === "trebon" ? (
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
        ) : (
          <span
            style={{
              fontSize: brana,
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
              color: PWA_IKONA_TEXT,
              letterSpacing: `${branaMezery}em`,
              lineHeight: 1,
            }}
          >
            BRÁNA
          </span>
        )}
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
