"use client";

import React from "react";
import { AuthContext, useAuthState } from "@/hooks/use-auth";

/** Wrapper-komponent som gir autentiserings-kontekst til hele appen */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const authState = useAuthState();

  return (
    <AuthContext.Provider value={authState}>{children}</AuthContext.Provider>
  );
}
