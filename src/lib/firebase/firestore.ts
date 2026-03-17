import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { app } from "./config";

export const db = getFirestore(app);

// Hjelpefunksjoner for vanlige operasjoner
export async function getCollection<T = DocumentData>(
  path: string,
  ...constraints: QueryConstraint[]
) {
  const q = query(collection(db, path), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as (T & { id: string })[];
}

export async function getDocument<T = DocumentData>(
  path: string,
  id: string
) {
  const snap = await getDoc(doc(db, path, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as T & { id: string };
}

export async function addDocument(path: string, data: DocumentData) {
  return addDoc(collection(db, path), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateDocument(
  path: string,
  id: string,
  data: DocumentData
) {
  return updateDoc(doc(db, path, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDocument(path: string, id: string) {
  return deleteDoc(doc(db, path, id));
}

// Re-export nyttige ting
export {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
};
