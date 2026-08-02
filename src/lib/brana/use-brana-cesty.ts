"use client";

import { useMemo } from "react";
import {
  branaNavigace,
  branaOdkazNaTrebon,
  branaVerejnaCesta,
  type BranaInterniStranka,
} from "./cesty";

function branaHost(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.location.hostname;
}

export function useBranaHost(): string | null {
  return branaHost();
}

export function useBranaNavigace() {
  const host = branaHost();

  return useMemo(() => branaNavigace(host), [host]);
}

export function useBranaVerejnaCesta(stranka: BranaInterniStranka) {
  const host = branaHost();

  return useMemo(() => branaVerejnaCesta(stranka, host), [stranka, host]);
}

export function useBranaOdkazNaTrebon() {
  const host = branaHost();

  return useMemo(() => branaOdkazNaTrebon(host), [host]);
}
