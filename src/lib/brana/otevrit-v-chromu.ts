/** Aktuální URL stránky včetně cesty a query parametrů. */
export function aktualniStrankaUrl(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.href;
}
