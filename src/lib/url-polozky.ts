/** Sestaví veřejnou URL položky (Blob URL nebo lokální /uploads/) */
export function sestavitUrlPolozky(soubor: string): string {
  if (soubor.startsWith("http://") || soubor.startsWith("https://")) {
    return soubor;
  }
  return `/uploads/${soubor}`;
}
