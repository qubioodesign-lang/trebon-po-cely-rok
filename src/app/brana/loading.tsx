import { BranaPozadi } from "@/components/brana/pozadi/BranaPozadi";

/** Klidný přechod mezi veřejnými stránkami BRÁNY – stejné pozadí, bez rušivých prvků. */
export default function BranaLoading() {
  return (
    <>
      <BranaPozadi />
      <main className="relative z-[1] flex min-h-dvh flex-1 flex-col brana-verejna--den">
        <div className="brana-obrazovka" aria-hidden />
      </main>
    </>
  );
}
