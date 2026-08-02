"use client";

import { useMemo } from "react";
import {
  branaNavigace,
  branaOdkazNaTrebon,
  branaVerejnaCesta,
  type BranaInterniStranka,
} from "./cesty";
import { useBranaHostFromContext } from "@/components/brana/BranaCestyProvider";

function useEffectiveBranaHost(): string | null {
  const contextHost = useBranaHostFromContext();

  if (contextHost) {
    return contextHost.split(":")[0];
  }

  if (typeof window === "undefined") {
    return null;
  }

  return window.location.hostname;
}

export function useBranaHost(): string | null {
  return useEffectiveBranaHost();
}

export function useBranaNavigace() {
  const host = useEffectiveBranaHost();

  return useMemo(() => branaNavigace(host), [host]);
}

export function useBranaVerejnaCesta(stranka: BranaInterniStranka) {
  const host = useEffectiveBranaHost();

  return useMemo(() => branaVerejnaCesta(stranka, host), [stranka, host]);
}

export function useBranaOdkazNaTrebon() {
  const host = useEffectiveBranaHost();

  return useMemo(() => branaOdkazNaTrebon(host), [host]);
}
