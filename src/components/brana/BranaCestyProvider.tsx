"use client";

import { createContext, useContext, type ReactNode } from "react";

const BranaHostContext = createContext<string | null>(null);

type BranaCestyProviderProps = {
  host: string | null;
  children: ReactNode;
};

/** Předává hostname z requestu do klientských hooků pro správné SSR na subdoméně. */
export function BranaCestyProvider({ host, children }: BranaCestyProviderProps) {
  return (
    <BranaHostContext.Provider value={host}>{children}</BranaHostContext.Provider>
  );
}

export function useBranaHostFromContext(): string | null {
  return useContext(BranaHostContext);
}
