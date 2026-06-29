"use client";

import { useSyncExternalStore } from "react";
import { jeDiagTest2 } from "@/lib/diag-inicializace";
import { DiagInicializaceBootScript } from "./DiagInicializaceBootScript";
import { DiagInicializaceOverlay } from "./DiagInicializaceOverlay";

function subscribe() {
  return () => {};
}

/** Diagnostika inicializace – jen s ?test=2 */
export function DiagInicializaceGate() {
  const aktivni = useSyncExternalStore(
    subscribe,
    jeDiagTest2,
    () => false
  );

  if (!aktivni) return null;

  return (
    <>
      <DiagInicializaceBootScript />
      <DiagInicializaceOverlay />
    </>
  );
}
