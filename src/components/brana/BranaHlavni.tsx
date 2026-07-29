import { BranaObrazovka } from "./BranaObrazovka";
import { BranaPozadi } from "./pozadi/BranaPozadi";

/** Vstupní obrazovka projektu Brána – /brana */
export function BranaHlavni() {
  return (
    <>
      <BranaPozadi />
      <main className="relative z-[1] flex flex-1 flex-col">
        <BranaObrazovka />
      </main>
    </>
  );
}
