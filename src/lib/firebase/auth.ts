"use client";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  type User,
  type Unsubscribe,
} from "firebase/auth";
import { app } from "./config";

export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();

/** Logg inn med Google-popup */
export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

/** Logg inn med e-post og passord */
export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

/** Opprett ny bruker med e-post og passord */
export async function signUpWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

/** Logg ut */
export async function signOutUser() {
  return signOut(auth);
}

/** Send e-post for tilbakestilling av passord */
export async function resetPassword(email: string) {
  return sendPasswordResetEmail(auth, email);
}

/** Lytt på endringer i autentiseringstilstand */
export function onAuthChange(
  callback: (user: User | null) => void
): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}
