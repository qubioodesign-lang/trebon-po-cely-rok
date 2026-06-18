import { Suspense } from "react";
import { ObrazovkaChciSeVracet } from "@/components/ObrazovkaChciSeVracet";

/** Obrazovka „chci se vracet“ – klidná, centrovaná, teplé pozadí */
export default function StrankaChciSeVracet() {
  return (
    <Suspense fallback={null}>
      <ObrazovkaChciSeVracet />
    </Suspense>
  );
}
