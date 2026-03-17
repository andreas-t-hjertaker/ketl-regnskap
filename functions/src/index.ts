import { onRequest, type Request } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { z } from "zod";
import type { Response } from "express";

admin.initializeApp();

const db = admin.firestore();

function success<T>(res: Response, data: T, status = 200) {
  res.status(status).json({ success: true, data });
}

function fail(res: Response, message: string, status = 400) {
  res.status(status).json({ success: false, error: message });
}

// ============================================================
// Auth-middleware — verifiserer Firebase ID-token
// ============================================================

async function verifyAuth(req: Request) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  try {
    return await admin.auth().verifyIdToken(header.split("Bearer ")[1]);
  } catch {
    return null;
  }
}

// ============================================================
// Zod-skjemaer
// ============================================================

const createNoteSchema = z.object({
  title: z.string().min(1, "Tittel er påkrevd").max(200),
  content: z.string().max(10000).optional().default(""),
});

// ============================================================
// HTTP Functions
// ============================================================

/**
 * Health check / API-status
 */
export const health = onRequest(
  { region: "europe-west1", cors: true },
  (_req, res) => {
    res.json({
      status: "ok",
      project: "ketlcloud",
      timestamp: new Date().toISOString(),
      services: {
        firestore: "connected",
        storage: "connected",
        functions: "running",
      },
    });
  }
);

/**
 * Hoved-API med enkel stibasert ruting
 */
export const api = onRequest(
  { region: "europe-west1", cors: true, invoker: "public" },
  async (req, res) => {
    const { method, path } = req;

    // --- Offentlige ruter ---

    if (method === "GET" && path === "/") {
      success(res, { message: "ketl cloud API", version: "0.1.0" });
      return;
    }

    if (method === "GET" && path === "/collections") {
      const collections = await db.listCollections();
      success(res, { collections: collections.map((c) => c.id) });
      return;
    }

    // --- Beskyttede ruter (krever autentisering) ---

    const user = await verifyAuth(req);

    if (method === "GET" && path === "/me") {
      if (!user) {
        fail(res, "Ikke autentisert", 401);
        return;
      }
      success(res, {
        uid: user.uid,
        email: user.email,
        name: user.name,
        picture: user.picture,
      });
      return;
    }

    if (method === "POST" && path === "/notes") {
      if (!user) {
        fail(res, "Ikke autentisert", 401);
        return;
      }

      const parsed = createNoteSchema.safeParse(req.body);
      if (!parsed.success) {
        fail(res, parsed.error.errors.map((e) => e.message).join(", "));
        return;
      }

      const note = await db.collection("notes").add({
        ...parsed.data,
        userId: user.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      success(res, { id: note.id, ...parsed.data }, 201);
      return;
    }

    if (method === "GET" && path === "/notes") {
      if (!user) {
        fail(res, "Ikke autentisert", 401);
        return;
      }

      const snapshot = await db
        .collection("notes")
        .where("userId", "==", user.uid)
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();

      const notes = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      success(res, notes);
      return;
    }

    // --- 404 ---
    fail(res, "Ikke funnet", 404);
  }
);
