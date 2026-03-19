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
  startAfter,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  runTransaction,
  type DocumentData,
  type DocumentSnapshot,
  type QueryConstraint,
} from "firebase/firestore";
import { app } from "./config";

export const db = getFirestore(app);

// --- Eksisterende hjelpefunksjoner ---

export async function getCollection<T = DocumentData>(
  path: string,
  ...constraints: QueryConstraint[]
) {
  const q = query(collection(db, path), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
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

// --- Sanntidslyttere ---

/** Abonner på en hel samling med sanntidsoppdateringer */
export function subscribeToCollection<T = DocumentData>(
  path: string,
  callback: (data: (T & { id: string })[]) => void,
  ...constraints: QueryConstraint[]
) {
  const q = query(collection(db, path), ...constraints);
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as (T & { id: string })[];
    callback(data);
  });
}

/** Abonner på et enkelt dokument med sanntidsoppdateringer */
export function subscribeToDocument<T = DocumentData>(
  path: string,
  id: string,
  callback: (data: (T & { id: string }) | null) => void
) {
  return onSnapshot(doc(db, path, id), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback({ id: snap.id, ...snap.data() } as T & { id: string });
  });
}

// --- Paginering ---

type PaginatedResult<T> = {
  data: (T & { id: string })[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
};

/** Hent en samling med paginering */
export async function getCollectionPaginated<T = DocumentData>(
  path: string,
  pageSize: number,
  lastDocument?: DocumentSnapshot | null,
  ...constraints: QueryConstraint[]
): Promise<PaginatedResult<T>> {
  const queryConstraints: QueryConstraint[] = [
    ...constraints,
    limit(pageSize + 1),
  ];

  if (lastDocument) {
    queryConstraints.push(startAfter(lastDocument));
  }

  const q = query(collection(db, path), ...queryConstraints);
  const snapshot = await getDocs(q);

  const hasMore = snapshot.docs.length > pageSize;
  const docs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;

  return {
    data: docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as (T & { id: string })[],
    lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
    hasMore,
  };
}

// --- Batch-operasjoner ---

type BatchOperation =
  | { type: "set"; path: string; id: string; data: DocumentData }
  | { type: "update"; path: string; id: string; data: DocumentData }
  | { type: "delete"; path: string; id: string };

/** Utfør flere operasjoner som en atomisk batch */
export async function batchWrite(operations: BatchOperation[]) {
  const batch = writeBatch(db);

  for (const op of operations) {
    const ref = doc(db, op.path, op.id);
    switch (op.type) {
      case "set":
        batch.set(ref, {
          ...op.data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        break;
      case "update":
        batch.update(ref, {
          ...op.data,
          updatedAt: serverTimestamp(),
        });
        break;
      case "delete":
        batch.delete(ref);
        break;
    }
  }

  return batch.commit();
}

/**
 * Hent neste bilagsnummer atomisk via Firestore-transaksjon.
 * Tellerdokument: users/{uid}/counters/bilag_{år}
 * Starter på 1001 og øker med 1 per bilag — garanterer ingen hull.
 */
export async function nestebilagsnummer(uid: string, år?: number): Promise<number> {
  const regnskapsår = år ?? new Date().getFullYear();
  const tellerRef = doc(db, `users/${uid}/counters/bilag_${regnskapsår}`);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(tellerRef);
    const forrige = snap.exists() ? (snap.data().siste as number) : 1000;
    const neste = forrige + 1;
    tx.set(tellerRef, { siste: neste, oppdatert: serverTimestamp() });
    return neste;
  });
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
  runTransaction,
};
