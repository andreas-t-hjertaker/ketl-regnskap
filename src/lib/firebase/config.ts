import { initializeApp, getApps } from "firebase/app";

// Les fra miljøvariabler med fallback til hardkodede verdier
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDbszDT9jyAKwixr91YhnPWCtMzlJSpJ_A",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "ketl-regnskap.firebaseapp.com",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://ketl-regnskap-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ketl-regnskap",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "ketl-regnskap.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "214791704171",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:214791704171:web:0d2c81da3a1dd8077e6b2e",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-R8M36XE9CL",
};

// Unngå re-initialisering ved hot reload
export const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
