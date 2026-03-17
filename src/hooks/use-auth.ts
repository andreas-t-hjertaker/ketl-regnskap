"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { User as FirebaseUser } from "firebase/auth";
import {
  onAuthChange,
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
  resetPassword,
} from "@/lib/firebase/auth";
import type { User } from "@/types";

type AuthContextType = {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signInGoogle: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
};

// Eksporter context slik at provider-komponenten kan bruke den
export const AuthContext = createContext<AuthContextType | null>(null);

/** Hook for å hente autentiseringsstatus og funksjoner */
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth må brukes innenfor en AuthProvider");
  }
  return ctx;
}

/** Hook som bare brukes av AuthProvider internt */
export function useAuthState() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange((fbUser) => {
      setFirebaseUser(fbUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Konverter Firebase-bruker til vår brukertype
  const user: User | null = firebaseUser
    ? {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        emailVerified: firebaseUser.emailVerified,
      }
    : null;

  const signInGoogle = useCallback(async () => {
    await signInWithGoogle();
  }, []);

  const signInEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmail(email, password);
  }, []);

  const signUpEmail = useCallback(async (email: string, password: string) => {
    await signUpWithEmail(email, password);
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOutUser();
  }, []);

  const handleResetPassword = useCallback(async (email: string) => {
    await resetPassword(email);
  }, []);

  return {
    user,
    firebaseUser,
    loading,
    signInGoogle,
    signInEmail,
    signUpEmail,
    signOut: handleSignOut,
    resetPassword: handleResetPassword,
  };
}
