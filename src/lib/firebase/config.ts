import { initializeApp, getApps } from "firebase/app";

// Les fra miljøvariabler med fallback til hardkodede verdier
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBlGlAmjFinbDhby5LmHeE4tRM2izF85uE",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "ketlcloud.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ketlcloud",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "ketlcloud.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "238849700424",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:238849700424:web:43143057604f8203b49e7d",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-36LXN3WEM8",
};

// Unngå re-initialisering ved hot reload
export const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
