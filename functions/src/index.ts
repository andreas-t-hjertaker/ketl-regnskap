import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

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
 * Generisk API-endpoint — utvid med routing etter behov
 */
export const api = onRequest(
  { region: "europe-west1", cors: true, invoker: "public" },
  async (req, res) => {
    const { method, path } = req;

    if (method === "GET" && path === "/") {
      res.json({ message: "ketl cloud API", version: "0.1.0" });
      return;
    }

    if (method === "GET" && path === "/collections") {
      const collections = await db.listCollections();
      res.json({
        collections: collections.map((c) => c.id),
      });
      return;
    }

    res.status(404).json({ error: "Not found" });
  }
);
