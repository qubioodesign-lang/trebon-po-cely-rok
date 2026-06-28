/**
 * Ladící pár prolnutí – adventní → Vánoční náměstí (stejné místo, jiný čas).
 * Používá se v seed skriptu a jako reference pro ruční upload v administraci.
 *
 * Soubory odkazují na produkční Blob; lokálně fungují přes veřejné URL.
 */
export const PROLNUTI_LADICI_PAR = {
  popis: "náměstí",
  /** první snímek – adventní */
  souborA:
    "https://8l4cdejsxuet11aj.public.blob.vercel-storage.com/uploads/4ee1ce2d-58ac-4e77-8ca7-a85115d0627a.jpg",
  /** druhý snímek – Vánoční náměstí */
  souborB:
    "https://8l4cdejsxuet11aj.public.blob.vercel-storage.com/uploads/bf48d6a7-a836-4334-8116-31c5a04dabf2.jpg",
} as const;
