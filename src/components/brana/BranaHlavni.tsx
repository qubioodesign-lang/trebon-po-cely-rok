import type { BranaPozadiVarianta } from "@/lib/brana/pozadi-varianty";
import { BranaObrazovka } from "./BranaObrazovka";
import { BranaPozadi } from "./pozadi/BranaPozadi";

type BranaHlavniProps = {
  variantaPozadi?: BranaPozadiVarianta;
};

/** Vstupní obrazovka projektu Brána – /brana */
export function BranaHlavni({ variantaPozadi }: BranaHlavniProps) {
  return (
    <>
      <BranaPozadi varianta={variantaPozadi} />
      <main className="relative z-[1] flex flex-1 flex-col">
        <BranaObrazovka />
      </main>
    </>
  );
}
