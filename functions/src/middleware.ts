import type { Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { z, type ZodSchema } from "zod";

// ============================================================
// Typed response-hjelpere
// ============================================================

export function success<T>(res: Response, data: T, status = 200) {
  res.status(status).json({ success: true, data });
}

export function fail(res: Response, message: string, status = 400) {
  res.status(status).json({ success: false, error: message });
}

// ============================================================
// Typer for rute-handlers
// ============================================================

/** Tilgjengelige API-scopes */
export const API_SCOPES = [
  "bilag:read",
  "bilag:write",
  "klienter:read",
  "klienter:write",
  "rapporter:read",
  "saft:export",
  "ai:chat",
  "admin",
] as const;

export type ApiScope = typeof API_SCOPES[number];

/** Kontekst som sendes til alle handlers */
export type RouteContext = {
  req: Request;
  res: Response;
};

/** Kontekst for autentiserte handlers */
export type AuthenticatedContext = RouteContext & {
  user: DecodedIdToken;
  /** Scopes fra API-nøkkel (undefined = autentisert med Firebase token = full tilgang) */
  apiKeyScopes?: ApiScope[];
};

/** Kontekst for validerte handlers */
export type ValidatedContext<T> = AuthenticatedContext & {
  data: T;
};

/** Enkel handler uten auth */
type PublicHandler = (ctx: RouteContext) => Promise<void> | void;

/** Handler med autentisert bruker */
export type AuthHandler = (ctx: AuthenticatedContext) => Promise<void> | void;

/** Handler med autentisering og validert body */
type ValidatedHandler<T> = (ctx: ValidatedContext<T>) => Promise<void> | void;

// ============================================================
// Middleware-wrappers
// ============================================================

/**
 * Wrapper som verifiserer Firebase ID-token.
 * Returnerer 401 hvis tokenet mangler eller er ugyldig.
 *
 * Bruk:
 *   const getMe = withAuth(async ({ user, res }) => {
 *     success(res, { uid: user.uid, email: user.email });
 *   });
 */
export function withAuth(handler: AuthHandler): PublicHandler {
  return async ({ req, res }) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      fail(res, "Ikke autentisert", 401);
      return;
    }

    try {
      const token = header.split("Bearer ")[1];
      const user = await admin.auth().verifyIdToken(token);
      await handler({ req, res, user });
    } catch {
      fail(res, "Ugyldig eller utløpt token", 401);
      return;
    }
  };
}

/**
 * Wrapper som verifiserer auth + validerer request body med Zod.
 * Returnerer 400 med valideringsfeil hvis body er ugyldig.
 *
 * Bruk:
 *   const createNote = withValidation(createNoteSchema, async ({ user, data, res }) => {
 *     const note = await db.collection("notes").add({ ...data, userId: user.uid });
 *     success(res, { id: note.id, ...data }, 201);
 *   });
 */
export function withValidation<T>(
  schema: ZodSchema<T>,
  handler: ValidatedHandler<T>
): PublicHandler {
  return withAuth(async ({ req, res, user }) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const messages = parsed.error.errors.map((e: z.ZodIssue) => e.message).join(", ");
      fail(res, messages);
      return;
    }
    await handler({ req, res, user, data: parsed.data });
  });
}

/**
 * Som withValidation, men godkjenner både Firebase ID-token og API-nøkkel.
 * Brukes for v1-endepunkter som skal nås via x-api-key.
 */
export function withApiKeyOrAuthValidation<T>(
  schema: ZodSchema<T>,
  handler: ValidatedHandler<T>
): PublicHandler {
  return withApiKeyOrAuth(async ({ req, res, user, apiKeyScopes }) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const messages = parsed.error.errors.map((e: z.ZodIssue) => e.message).join(", ");
      fail(res, messages);
      return;
    }
    await handler({ req, res, user, apiKeyScopes, data: parsed.data });
  });
}

// ============================================================
// Admin-middleware
// ============================================================

/** Sjekk om autentisert bruker har admin-rolle */
export function withAdmin(handler: AuthHandler): PublicHandler {
  return withAuth(async (ctx) => {
    if (!ctx.user.admin) {
      fail(ctx.res, "Krever administratortilgang", 403);
      return;
    }
    await handler(ctx);
  });
}

// ============================================================
// API-nøkkel eller Firebase Auth middleware
// ============================================================

/**
 * Godkjenner enten Firebase ID-token (Bearer) eller API-nøkkel (x-api-key).
 * For API-nøkkel: hasher nøkkelen, slår opp i Firestore, setter bruker til eieren.
 */
export function withApiKeyOrAuth(handler: AuthHandler): PublicHandler {
  return async ({ req, res }) => {
    // 1. Prøv Firebase ID-token
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const token = authHeader.split("Bearer ")[1];
        const user = await admin.auth().verifyIdToken(token);
        await handler({ req, res, user });
        return;
      } catch {
        fail(res, "Ugyldig eller utløpt token", 401);
        return;
      }
    }

    // 2. Prøv API-nøkkel
    const apiKey = req.headers["x-api-key"] as string | undefined;
    if (apiKey) {
      try {
        const hashedKey = crypto.createHash("sha256").update(apiKey).digest("hex");
        const snapshot = await admin.firestore()
          .collection("apiKeys")
          .where("hashedKey", "==", hashedKey)
          .where("revoked", "==", false)
          .limit(1)
          .get();

        if (snapshot.empty) {
          fail(res, "Ugyldig API-nøkkel", 401);
          return;
        }

        const keyDoc = snapshot.docs[0];
        const keyData = keyDoc.data();

        // Oppdater lastUsedAt
        await keyDoc.ref.update({ lastUsedAt: admin.firestore.FieldValue.serverTimestamp() });

        // Lag en pseudo-DecodedIdToken med eierens UID
        const user = { uid: keyData.userId } as DecodedIdToken;
        const apiKeyScopes = (keyData.scopes ?? []) as ApiScope[];
        await handler({ req, res, user, apiKeyScopes });
        return;
      } catch {
        fail(res, "Feil ved API-nøkkel-verifisering", 500);
        return;
      }
    }

    fail(res, "Ikke autentisert — send Bearer-token eller x-api-key", 401);
  };
}

/**
 * Wrapper som krever et spesifikt scope.
 * Brukes rundt withApiKeyOrAuth-handlers for å begrense tilgang.
 * Hvis autentisert via Firebase ID-token (apiKeyScopes === undefined) gis full tilgang.
 *
 * Eksempel:
 *   const listBilag = requireScope("bilag:read", withApiKeyOrAuth(async ({ user, res }) => { ... }));
 */
export function requireScope(scope: ApiScope, handler: PublicHandler): PublicHandler {
  return async ({ req, res }) => {
    // Vi henter scopes fra req etter at withApiKeyOrAuth har kjørt
    // ved å pakke handleren slik at scopes sjekkes inni
    await withApiKeyOrAuth(async (ctx) => {
      // undefined scopes = Firebase-token = full tilgang
      if (ctx.apiKeyScopes !== undefined && !ctx.apiKeyScopes.includes(scope)) {
        fail(res, `Mangler scope: ${scope}`, 403);
        return;
      }
      await (handler as AuthHandler)(ctx);
    })({ req, res });
  };
}

// ============================================================
// Rate limiting (in-memory)
// ============================================================

type RateLimitEntry = { count: number; resetAt: number };
const rateLimitMap = new Map<string, RateLimitEntry>();

/**
 * Enkel in-memory rate limiter.
 * Standard: 100 forespørsler per minutt per IP.
 */
export function rateLimit(
  maxRequests = 100,
  windowMs = 60_000
): (ctx: RouteContext) => boolean {
  return ({ req, res }) => {
    const ip = req.ip || req.headers["x-forwarded-for"] as string || "unknown";
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
      return true;
    }

    entry.count++;
    if (entry.count > maxRequests) {
      fail(res, "For mange forespørsler — prøv igjen senere", 429);
      return false;
    }

    return true;
  };
}
