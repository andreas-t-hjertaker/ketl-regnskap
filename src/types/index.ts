// Delte typer for hele prosjektet

/** Standard API-respons fra Cloud Functions */
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/** Brukertype som speiler Firebase Auth-felter */
export type User = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
};

/** Legg til id-felt på en type */
export type WithId<T> = T & { id: string };

/** Legg til tidsstempler */
export type WithTimestamps<T> = T & {
  createdAt: Date;
  updatedAt: Date;
};

/** Standard Firestore-dokument med id og tidsstempler */
export type FirestoreDoc = WithId<WithTimestamps<Record<string, unknown>>>;
