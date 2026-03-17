import { initializeApp, getApps } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyBlGlAmjFinbDhby5LmHeE4tRM2izF85uE",
  authDomain: "ketlcloud.firebaseapp.com",
  projectId: "ketlcloud",
  storageBucket: "ketlcloud.firebasestorage.app",
  messagingSenderId: "238849700424",
  appId: "1:238849700424:web:43143057604f8203b49e7d",
  measurementId: "G-36LXN3WEM8",
};

// Unngå re-initialisering ved hot reload
export const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
