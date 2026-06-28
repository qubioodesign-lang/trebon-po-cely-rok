import type { PolozkaVerejna } from "@/types";

/** Preload první snímku (a druhého u prolnutí) – v HTML hned, bez čekání na JS */
export function PreloadPocatecniFotografie({
  polozka,
}: {
  polozka: PolozkaVerejna;
}) {
  if (polozka.typ === "prolnuti") {
    const urls = polozka.urls ?? [];
    if (urls.length === 0) return null;
    return (
      <>
        {urls.map((url, index) => (
          <link
            key={url}
            rel="preload"
            as="image"
            href={url}
            fetchPriority={index === 0 ? "high" : undefined}
          />
        ))}
      </>
    );
  }

  if (polozka.url) {
    return (
      <link rel="preload" as="image" href={polozka.url} fetchPriority="high" />
    );
  }

  return null;
}
