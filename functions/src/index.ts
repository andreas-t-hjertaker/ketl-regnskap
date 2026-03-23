import { onRequest } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import Stripe from "stripe";
import { z } from "zod";
import { VertexAI, HarmCategory, HarmBlockThreshold } from "@google-cloud/vertexai";
import { success, fail, withAuth, withAdmin, withValidation, withApiKeyOrAuth, withApiKeyOrAuthValidation, rateLimit, type RouteContext } from "./middleware";
import { OPENAPI_SPEC, genererDocsHtml } from "./openapi";

admin.initializeApp();

const db = admin.firestore();

// ============================================================
// Zod-skjemaer
// ============================================================

const createNoteSchema = z.object({
  title: z.string().min(1, "Tittel er påkrevd").max(200),
  content: z.string().max(10000).optional().default(""),
});

// ─── v1: Regnskaps-API ─────────────────────────────────────────────────────

const posteringSchema = z.object({
  kontonr: z.string().min(1).max(10),
  kontonavn: z.string().min(1).max(200),
  debet: z.number().min(0),
  kredit: z.number().min(0),
  mvaKode: z.string().optional(),
  beskrivelse: z.string().optional(),
});

const bilagSchema = z.object({
  dato: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dato må være YYYY-MM-DD"),
  beskrivelse: z.string().min(1).max(500),
  belop: z.number().min(0),
  klientId: z.string().min(1),
  leverandor: z.string().optional(),
  kategori: z.string().optional(),
  motpartId: z.string().optional(),
  forfallsDato: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Forfallsdato må være YYYY-MM-DD").optional(),
  posteringer: z.array(posteringSchema).min(1),
}).refine(
  (data) => {
    const debet = data.posteringer.reduce((s, p) => s + p.debet, 0);
    const kredit = data.posteringer.reduce((s, p) => s + p.kredit, 0);
    return Math.abs(debet - kredit) < 0.01;
  },
  { message: "Posteringene er ikke balansert: debet må være lik kredit" }
);

/**
 * Modulus-11-sjekk for norske organisasjonsnumre (9 siffer, iht. NS 11028).
 * Vektene er [3, 2, 7, 6, 5, 4, 3, 2], kontrollsifferet er siste siffer.
 */
function erGyldigOrgnr(orgnr: string): boolean {
  if (!/^\d{9}$/.test(orgnr)) return false;
  const vekter = [3, 2, 7, 6, 5, 4, 3, 2];
  const sum = vekter.reduce((acc, v, i) => acc + v * parseInt(orgnr[i], 10), 0);
  const kontroll = 11 - (sum % 11);
  if (kontroll === 11) return parseInt(orgnr[8], 10) === 0;
  if (kontroll === 10) return false; // Ugyldig
  return parseInt(orgnr[8], 10) === kontroll;
}

const klientSchema = z.object({
  navn: z.string().min(1).max(200),
  orgnr: z.string().regex(/^\d{9}$/, "Organisasjonsnummer må ha 9 siffer").refine(
    erGyldigOrgnr,
    "Ugyldig organisasjonsnummer (Modulus-11-sjekk feilet)"
  ),
  kontaktperson: z.string().min(1).max(200),
  epost: z.string().email(),
  telefon: z.string().optional(),
  adresse: z.string().optional(),
  bransje: z.string().optional(),
});

/** Hjelpefunksjon: hent ID fra sti som "/v1/bilag/abc123/..." */
function pathSegment(path: string, index: number): string | undefined {
  return path.split("/").filter(Boolean)[index];
}

// ============================================================
// Rute-handlers
// ============================================================

/** GET / — API-info (offentlig) */
const getRoot = ({ res }: RouteContext) => {
  success(res, { message: "ketl cloud API", version: "0.1.0" });
};

/** GET /collections — List Firestore-samlinger (offentlig) */
const getCollections = async ({ res }: RouteContext) => {
  const collections = await db.listCollections();
  success(res, { collections: collections.map((c) => c.id) });
};

/** GET /me — Brukerinfo (krever auth) */
const getMe = withAuth(async ({ user, res }) => {
  success(res, {
    uid: user.uid,
    email: user.email,
    name: user.name,
    picture: user.picture,
  });
});

/** POST /notes — Opprett notat (krever auth + validering) */
const createNote = withValidation(createNoteSchema, async ({ user, data, res }) => {
  const note = await db.collection("notes").add({
    ...data,
    userId: user.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  success(res, { id: note.id, ...data }, 201);
});

/** GET /notes — Hent brukerens notater (krever auth) */
const getNotes = withAuth(async ({ user, res }) => {
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
});

/** PATCH /notes/:id — Oppdater notat (kun eier) */
const updateNote = withValidation(createNoteSchema.partial(), async ({ user, req, data, res }) => {
  const noteId = pathSegment(req.path, 1);
  if (!noteId) return fail(res, "Mangler notat-ID", 400);

  const ref = db.collection("notes").doc(noteId);
  const snap = await ref.get();
  if (!snap.exists) return fail(res, "Notat ikke funnet", 404);
  if ((snap.data() as { userId: string }).userId !== user.uid) {
    return fail(res, "Ingen tilgang", 403);
  }

  await ref.update({ ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  const updated = await ref.get();
  success(res, { id: ref.id, ...updated.data() });
});

/** DELETE /notes/:id — Slett notat (kun eier) */
const deleteNote = withAuth(async ({ user, req, res }) => {
  const noteId = pathSegment(req.path, 1);
  if (!noteId) return fail(res, "Mangler notat-ID", 400);

  const ref = db.collection("notes").doc(noteId);
  const doc = await ref.get();

  if (!doc.exists) return fail(res, "Notat ikke funnet", 404);
  if ((doc.data() as { userId: string }).userId !== user.uid) {
    return fail(res, "Ingen tilgang", 403);
  }

  await ref.delete();
  success(res, { deleted: true });
});

// ============================================================
// Stripe-konfigurasjon
// ============================================================

/** Lazy Stripe-initialisering — unngår krasj når env-variabelen mangler (f.eks. i CI deploy-analyse) */
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY er ikke konfigurert");
    _stripe = new Stripe(key);
  }
  return _stripe;
}

// ============================================================
// Stripe-handlers
// ============================================================

/** POST /stripe/checkout — Opprett Stripe Checkout-sesjon */
const createCheckout = withAuth(async ({ user, res, req }) => {
  const { priceId } = req.body as { priceId?: string };
  if (!priceId) {
    fail(res, "priceId er påkrevd");
    return;
  }

  // Hent eller opprett Stripe-kunde
  let customerId: string;
  const subDoc = await db.collection("subscriptions").doc(user.uid).get();

  if (subDoc.exists && subDoc.data()?.stripeCustomerId) {
    customerId = subDoc.data()!.stripeCustomerId;
  } else {
    const customer = await getStripe().customers.create({
      email: user.email ?? undefined,
      metadata: { firebaseUid: user.uid },
    });
    customerId = customer.id;
    await db.collection("subscriptions").doc(user.uid).set(
      { stripeCustomerId: customerId, status: "none" },
      { merge: true }
    );
  }

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${req.headers.origin || "https://ketlcloud.web.app"}/dashboard/abonnement?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${req.headers.origin || "https://ketlcloud.web.app"}/pricing`,
    metadata: { firebaseUid: user.uid },
  });

  success(res, { url: session.url });
});

/** POST /stripe/portal — Opprett Stripe kundeportal-sesjon */
const createPortal = withAuth(async ({ user, res, req }) => {
  const subDoc = await db.collection("subscriptions").doc(user.uid).get();
  const customerId = subDoc.data()?.stripeCustomerId;

  if (!customerId) {
    fail(res, "Ingen Stripe-kunde funnet", 404);
    return;
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${req.headers.origin || "https://ketlcloud.web.app"}/dashboard/abonnement`,
  });

  success(res, { url: session.url });
});

/** POST /stripe/webhook — Stripe webhook-handler (offentlig, men verifisert) */
const handleWebhook = async ({ req, res }: RouteContext) => {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err) {
    fail(res, `Webhook-signatur ugyldig: ${err instanceof Error ? err.message : "ukjent feil"}`, 400);
    return;
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const uid = session.metadata?.firebaseUid;
      if (uid && session.subscription) {
        const sub = await getStripe().subscriptions.retrieve(
          session.subscription as string,
          { expand: ["latest_invoice"] }
        );
        const invoice = sub.latest_invoice as Stripe.Invoice | null;
        const periodEnd = invoice?.period_end
          ? new Date(invoice.period_end * 1000)
          : null;
        await db.collection("subscriptions").doc(uid).set({
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: sub.id,
          stripePriceId: sub.items.data[0]?.price.id ?? null,
          status: sub.status,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        }, { merge: true });
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerSnap = await db.collection("subscriptions")
        .where("stripeCustomerId", "==", sub.customer as string)
        .limit(1).get();
      if (!customerSnap.empty) {
        const item = sub.items.data[0];
        const periodEnd = item ? new Date(item.current_period_end * 1000) : null;
        await customerSnap.docs[0].ref.update({
          stripeSubscriptionId: sub.id,
          stripePriceId: sub.items.data[0]?.price.id ?? null,
          status: sub.status,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const snap = await db.collection("subscriptions")
        .where("stripeCustomerId", "==", sub.customer as string)
        .limit(1).get();
      if (!snap.empty) {
        await snap.docs[0].ref.update({
          status: "canceled",
          cancelAtPeriodEnd: false,
        });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const custSnap = await db.collection("subscriptions")
        .where("stripeCustomerId", "==", invoice.customer as string)
        .limit(1).get();
      if (!custSnap.empty) {
        await custSnap.docs[0].ref.update({ status: "past_due" });
      }
      break;
    }
  }

  success(res, { received: true });
};

// ============================================================
// API-nøkkel-handlers
// ============================================================

const GYLDIGE_SCOPES = [
  "bilag:read", "bilag:write",
  "klienter:read", "klienter:write",
  "rapporter:read", "saft:export",
  "ai:chat", "admin",
] as const;
type ApiScope = typeof GYLDIGE_SCOPES[number];

/** GET /api-keys — List brukerens API-nøkler */
const listApiKeys = withAuth(async ({ user, res }) => {
  const snapshot = await db.collection("apiKeys")
    .where("userId", "==", user.uid)
    .orderBy("createdAt", "desc")
    .get();

  const keys = snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name,
      prefix: data.prefix,
      createdAt: data.createdAt?.toDate() ?? null,
      lastUsedAt: data.lastUsedAt?.toDate() ?? null,
      expiresAt: data.expiresAt?.toDate() ?? null,
      revoked: data.revoked,
      scopes: (data.scopes ?? []) as ApiScope[],
    };
  });

  success(res, keys);
});

/** POST /api-keys — Opprett ny API-nøkkel */
const createApiKey = withAuth(async ({ user, req, res }) => {
  const { name, scopes } = req.body as { name?: string; scopes?: string[] };
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    fail(res, "Navn er påkrevd");
    return;
  }

  // Valider scopes
  const gyldige: ApiScope[] = [];
  if (Array.isArray(scopes)) {
    for (const s of scopes) {
      if (GYLDIGE_SCOPES.includes(s as ApiScope)) {
        gyldige.push(s as ApiScope);
      }
    }
  }
  // Standard: kun lesing om ingen scopes er oppgitt
  const ferdigeScopes: ApiScope[] = gyldige.length > 0
    ? gyldige
    : ["bilag:read", "klienter:read", "rapporter:read"];

  // Generer nøkkel
  const rawKey = crypto.randomBytes(32).toString("hex");
  const fullKey = `sk_live_${rawKey}`;
  const hashedKey = crypto.createHash("sha256").update(fullKey).digest("hex");
  const prefix = fullKey.substring(0, 16);

  const docRef = await db.collection("apiKeys").add({
    name: name.trim(),
    prefix,
    hashedKey,
    userId: user.uid,
    scopes: ferdigeScopes,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastUsedAt: null,
    expiresAt: null,
    revoked: false,
  });

  success(res, {
    key: fullKey,
    apiKey: {
      id: docRef.id,
      name: name.trim(),
      prefix,
      scopes: ferdigeScopes,
      createdAt: new Date(),
      lastUsedAt: null,
      expiresAt: null,
      revoked: false,
    },
  }, 201);
});

/** DELETE /api-keys/:id — Tilbakekall en API-nøkkel */
const revokeApiKey = withAuth(async ({ user, req, res }) => {
  // Hent ID fra siste del av stien: /api-keys/abc123
  const parts = req.path.split("/");
  const keyId = parts[parts.length - 1];

  if (!keyId) {
    fail(res, "Nøkkel-ID er påkrevd");
    return;
  }

  const keyDoc = await db.collection("apiKeys").doc(keyId).get();

  if (!keyDoc.exists) {
    fail(res, "API-nøkkel ikke funnet", 404);
    return;
  }

  // Sikre at nøkkelen tilhører brukeren
  if (keyDoc.data()?.userId !== user.uid) {
    fail(res, "Ikke autorisert", 403);
    return;
  }

  await keyDoc.ref.update({ revoked: true });
  success(res, { id: keyId, revoked: true });
});

// ============================================================
// Admin-handlers
// ============================================================

/** POST /admin/set-role — Sett admin-rolle på en bruker */
const setAdminRole = withAdmin(async ({ req, res }) => {
  const { uid, admin: isAdmin } = req.body as { uid?: string; admin?: boolean };
  if (!uid) {
    fail(res, "uid er påkrevd");
    return;
  }
  await admin.auth().setCustomUserClaims(uid, { admin: !!isAdmin });
  success(res, { uid, admin: !!isAdmin });
});

/** GET /admin/users — List alle brukere */
const listAdminUsers = withAdmin(async ({ req, res }) => {
  const pageToken = req.query.pageToken as string | undefined;
  const result = await admin.auth().listUsers(100, pageToken || undefined);

  const users = result.users.map((u) => ({
    uid: u.uid,
    email: u.email ?? null,
    displayName: u.displayName ?? null,
    photoURL: u.photoURL ?? null,
    disabled: u.disabled,
    creationTime: u.metadata.creationTime,
    lastSignInTime: u.metadata.lastSignInTime,
    customClaims: u.customClaims ?? {},
  }));

  success(res, { users, pageToken: result.pageToken ?? null });
});

/** GET /admin/users/:uid — Hent brukerdetaljer med abonnement og API-nøkler */
const getAdminUser = withAdmin(async ({ req, res }) => {
  const parts = req.path.split("/");
  const uid = parts[parts.length - 1];

  if (!uid) {
    fail(res, "uid er påkrevd");
    return;
  }

  try {
    const userRecord = await admin.auth().getUser(uid);
    const subDoc = await db.collection("subscriptions").doc(uid).get();
    const keysSnap = await db.collection("apiKeys")
      .where("userId", "==", uid)
      .get();

    success(res, {
      user: {
        uid: userRecord.uid,
        email: userRecord.email ?? null,
        displayName: userRecord.displayName ?? null,
        photoURL: userRecord.photoURL ?? null,
        disabled: userRecord.disabled,
        creationTime: userRecord.metadata.creationTime,
        lastSignInTime: userRecord.metadata.lastSignInTime,
        customClaims: userRecord.customClaims ?? {},
      },
      subscription: subDoc.exists ? subDoc.data() : null,
      apiKeyCount: keysSnap.size,
    });
  } catch {
    fail(res, "Bruker ikke funnet", 404);
  }
});

/** POST /admin/users/:uid/disable — Aktiver/deaktiver bruker */
const disableAdminUser = withAdmin(async ({ req, res }) => {
  const parts = req.path.split("/");
  // Sti: /admin/users/:uid/disable — uid er nest siste
  const uid = parts[parts.length - 2];
  const { disabled } = req.body as { disabled?: boolean };

  if (!uid) {
    fail(res, "uid er påkrevd");
    return;
  }

  await admin.auth().updateUser(uid, { disabled: !!disabled });
  success(res, { uid, disabled: !!disabled });
});

/** DELETE /admin/users/:uid — Slett bruker og all data */
const deleteAdminUser = withAdmin(async ({ req, res }) => {
  const parts = req.path.split("/");
  const uid = parts[parts.length - 1];

  if (!uid) {
    fail(res, "uid er påkrevd");
    return;
  }

  // Slett toppnivå-dokumenter
  const batch = db.batch();
  batch.delete(db.collection("subscriptions").doc(uid));

  const keysSnap = await db.collection("apiKeys").where("userId", "==", uid).get();
  keysSnap.docs.forEach((d) => batch.delete(d.ref));

  const notesSnap = await db.collection("notes").where("userId", "==", uid).get();
  notesSnap.docs.forEach((d) => batch.delete(d.ref));

  const webhooksSnap = await db.collection("webhooks").where("userId", "==", uid).get();
  webhooksSnap.docs.forEach((d) => batch.delete(d.ref));

  await batch.commit();

  // Slett brukerens Firestore-data rekursivt (bilag, klienter, motparter, osv.)
  await db.recursiveDelete(db.collection("users").doc(uid));

  // Slett Firebase Auth-bruker
  await admin.auth().deleteUser(uid);

  success(res, { uid, deleted: true });
});

/** GET /admin/stats — Aggregerte statistikker */
const getAdminStats = withAdmin(async ({ res }) => {
  const [usersResult, subsSnap, keysSnap] = await Promise.all([
    admin.auth().listUsers(1000),
    db.collection("subscriptions").where("status", "==", "active").get(),
    db.collection("apiKeys").where("revoked", "==", false).get(),
  ]);

  success(res, {
    totalUsers: usersResult.users.length,
    activeSubscriptions: subsSnap.size,
    totalApiKeys: keysSnap.size,
  });
});

/** GET /admin/feature-flags — List alle feature flags (offentlig) */
const listFeatureFlags = async ({ res }: RouteContext) => {
  const snap = await db.collection("featureFlags").orderBy("createdAt", "desc").get();
  const flags = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
  success(res, flags);
};

/** POST /admin/feature-flags — Opprett ny feature flag */
const createFeatureFlag = withAdmin(async ({ req, res }) => {
  const { key, label, description, enabled, plans } = req.body as {
    key?: string; label?: string; description?: string; enabled?: boolean; plans?: string[];
  };

  if (!key || !label) {
    fail(res, "key og label er påkrevd");
    return;
  }

  const docRef = await db.collection("featureFlags").add({
    key,
    label,
    description: description || "",
    enabled: !!enabled,
    plans: plans || [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  success(res, { id: docRef.id, key, label }, 201);
});

/** PUT /admin/feature-flags/:id — Oppdater en feature flag */
const updateFeatureFlag = withAdmin(async ({ req, res }) => {
  const parts = req.path.split("/");
  const flagId = parts[parts.length - 1];

  if (!flagId) {
    fail(res, "Flag-ID er påkrevd");
    return;
  }

  const docRef = db.collection("featureFlags").doc(flagId);
  const doc = await docRef.get();
  if (!doc.exists) {
    fail(res, "Feature flag ikke funnet", 404);
    return;
  }

  const { key, label, description, enabled, plans } = req.body as {
    key?: string; label?: string; description?: string; enabled?: boolean; plans?: string[];
  };

  const updates: Record<string, unknown> = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (key !== undefined) updates.key = key;
  if (label !== undefined) updates.label = label;
  if (description !== undefined) updates.description = description;
  if (enabled !== undefined) updates.enabled = enabled;
  if (plans !== undefined) updates.plans = plans;

  await docRef.update(updates);
  success(res, { id: flagId, ...updates });
});

// ============================================================
// Konto-sletting
// ============================================================

/** DELETE /account — Slett alt brukerdata fra Firestore */
const deleteAccount = withAuth(async ({ user, res }) => {
  const batch = db.batch();

  // Slett toppnivå-dokumenter (subscriptions, apiKeys, notes)
  batch.delete(db.collection("subscriptions").doc(user.uid));

  const keysSnap = await db.collection("apiKeys").where("userId", "==", user.uid).get();
  keysSnap.docs.forEach((d) => batch.delete(d.ref));

  const notesSnap = await db.collection("notes").where("userId", "==", user.uid).get();
  notesSnap.docs.forEach((d) => batch.delete(d.ref));

  const webhooksSnap = await db.collection("webhooks").where("userId", "==", user.uid).get();
  webhooksSnap.docs.forEach((d) => batch.delete(d.ref));

  await batch.commit();

  // Slett brukerens Firestore-data rekursivt (bilag, klienter, motparter, audit_log, osv.)
  await db.recursiveDelete(db.collection("users").doc(user.uid));

  // Slett Firebase Auth-kontoen via Admin SDK slik at klienten ikke trenger
  // å kalle deleteUser() (som krever nylig innlogging og kan feile)
  await admin.auth().deleteUser(user.uid);

  success(res, { deleted: true });
});

// ============================================================
// v1 — Klienter
// ============================================================

const v1ListKlienter = withApiKeyOrAuth(async ({ user, res }) => {
  const snap = await db.collection(`users/${user.uid}/klienter`)
    .orderBy("opprettet", "desc").get();
  success(res, snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}, "klienter:read");

const v1CreateKlient = withApiKeyOrAuthValidation(klientSchema, async ({ user, data, res }) => {
  const ref = await db.collection(`users/${user.uid}/klienter`).add({
    ...data,
    opprettet: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  success(res, { id: ref.id, ...data }, 201);
}, "klienter:write");

const v1GetKlient = withApiKeyOrAuth(async ({ user, req, res }) => {
  const id = pathSegment(req.path, 2);
  if (!id) return fail(res, "Mangler klient-ID", 400);
  const snap = await db.doc(`users/${user.uid}/klienter/${id}`).get();
  if (!snap.exists) return fail(res, "Klient ikke funnet", 404);
  success(res, { id: snap.id, ...snap.data() });
}, "klienter:read");

const v1UpdateKlient = withApiKeyOrAuthValidation(klientSchema.partial(), async ({ user, req, data, res }) => {
  const id = pathSegment(req.path, 2);
  if (!id) return fail(res, "Mangler klient-ID", 400);
  const ref = db.doc(`users/${user.uid}/klienter/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return fail(res, "Klient ikke funnet", 404);
  await ref.update({ ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  success(res, { id, ...snap.data(), ...data });
}, "klienter:write");

const v1DeleteKlient = withApiKeyOrAuth(async ({ user, req, res }) => {
  const id = pathSegment(req.path, 2);
  if (!id) return fail(res, "Mangler klient-ID", 400);
  const bilagSnap = await db.collection(`users/${user.uid}/bilag`)
    .where("klientId", "==", id).limit(1).get();
  if (!bilagSnap.empty) {
    return fail(res, "Kan ikke slette klient med tilknyttede bilag", 409);
  }
  await db.doc(`users/${user.uid}/klienter/${id}`).delete();
  success(res, { slettet: true });
}, "klienter:write");

// ============================================================
// v1 — Bilag
// ============================================================

const v1ListBilag = withApiKeyOrAuth(async ({ user, req, res }) => {
  const { klientId, status, limit: lim } = req.query as Record<string, string>;
  let q: FirebaseFirestore.Query = db.collection(`users/${user.uid}/bilag`);
  if (klientId) q = q.where("klientId", "==", klientId);
  if (status) q = q.where("status", "==", status);
  q = q.orderBy("dato", "desc").limit(Math.min(parseInt(lim ?? "50", 10), 200));
  const snap = await q.get();
  success(res, snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}, "bilag:read");

const v1CreateBilag = withApiKeyOrAuthValidation(bilagSchema, async ({ user, data, res }) => {
  // Valider at klientId tilhører brukeren
  const klientSnap = await db.doc(`users/${user.uid}/klienter/${data.klientId}`).get();
  if (!klientSnap.exists) {
    return fail(res, "Klient ikke funnet", 404);
  }

  // Hent neste bilagsnummer via transaksjon
  const år = parseInt(data.dato.slice(0, 4), 10);
  const tellerRef = db.doc(`users/${user.uid}/counters/bilag_${år}`);
  const bilagsnr = await db.runTransaction(async (tx) => {
    const teller = await tx.get(tellerRef);
    const neste = (teller.exists ? (teller.data()!.siste as number) : 1000) + 1;
    tx.set(tellerRef, { siste: neste, oppdatert: admin.firestore.FieldValue.serverTimestamp() });
    return neste;
  });

  const ref = await db.collection(`users/${user.uid}/bilag`).add({
    ...data,
    bilagsnr,
    status: "bokført",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db.collection(`users/${user.uid}/audit_log`).add({
    handling: "bilag_opprettet",
    entitetType: "bilag",
    entitetId: ref.id,
    utfortAv: "bruker",
    uid: user.uid,
    detaljer: { bilagsnr, beskrivelse: data.beskrivelse, belop: data.belop },
    tidspunkt: admin.firestore.FieldValue.serverTimestamp(),
  });
  success(res, { id: ref.id, bilagsnr, ...data, status: "bokført" }, 201);
}, "bilag:write");

const v1GetBilag = withApiKeyOrAuth(async ({ user, req, res }) => {
  const id = pathSegment(req.path, 2);
  if (!id) return fail(res, "Mangler bilag-ID", 400);
  const snap = await db.doc(`users/${user.uid}/bilag/${id}`).get();
  if (!snap.exists) return fail(res, "Bilag ikke funnet", 404);
  success(res, { id: snap.id, ...snap.data() });
}, "bilag:read");

const v1GodkjennBilag = withApiKeyOrAuth(async ({ user, req, res }) => {
  const id = pathSegment(req.path, 2);
  if (!id) return fail(res, "Mangler bilag-ID", 400);
  const ref = db.doc(`users/${user.uid}/bilag/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return fail(res, "Bilag ikke funnet", 404);
  const data = snap.data()!;
  if (data.status !== "foreslått") return fail(res, "Bilag er ikke i status 'foreslått'", 400);
  if (!data.aiForslag) return fail(res, "Ingen AI-forslag å godkjenne", 400);
  await ref.update({
    status: "bokført",
    posteringer: data.aiForslag.posteringer,
    kategori: data.aiForslag.foreslåttKategori,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db.collection(`users/${user.uid}/audit_log`).add({
    handling: "ai_forslag_godkjent",
    entitetType: "bilag",
    entitetId: id,
    utfortAv: "bruker",
    uid: user.uid,
    tidspunkt: admin.firestore.FieldValue.serverTimestamp(),
  });
  success(res, { id, status: "bokført" });
}, "bilag:write");

const v1AvvisBilag = withApiKeyOrAuth(async ({ user, req, res }) => {
  const id = pathSegment(req.path, 2);
  if (!id) return fail(res, "Mangler bilag-ID", 400);
  const ref = db.doc(`users/${user.uid}/bilag/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return fail(res, "Bilag ikke funnet", 404);
  await ref.update({ status: "avvist", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  success(res, { id, status: "avvist" });
}, "bilag:write");

const v1KrediterBilag = withApiKeyOrAuth(async ({ user, req, res }) => {
  const id = pathSegment(req.path, 2);
  if (!id) return fail(res, "Mangler bilag-ID", 400);
  const ref = db.doc(`users/${user.uid}/bilag/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return fail(res, "Bilag ikke funnet", 404);
  const original = snap.data()!;
  if (original.status !== "bokført") return fail(res, "Kun bokførte bilag kan krediteres", 400);
  if (original.kreditertAvId) return fail(res, "Bilaget er allerede kreditert", 409);

  // Hent neste bilagsnummer via transaksjon
  const år = parseInt((original.dato as string).slice(0, 4), 10);
  const tellerRef = db.doc(`users/${user.uid}/counters/bilag_${år}`);
  const bilagsnr = await db.runTransaction(async (tx) => {
    const teller = await tx.get(tellerRef);
    const neste = (teller.exists ? (teller.data()!.siste as number) : 1000) + 1;
    tx.set(tellerRef, { siste: neste, oppdatert: admin.firestore.FieldValue.serverTimestamp() });
    return neste;
  });

  const reversertePosteringer = (original.posteringer as Array<Record<string, unknown>>).map((p) => ({
    ...p,
    debet: p.kredit,
    kredit: p.debet,
    beskrivelse: `Kreditering av bilag #${original.bilagsnr}`,
  }));
  const korRef = await db.collection(`users/${user.uid}/bilag`).add({
    bilagsnr,
    dato: new Date().toISOString().slice(0, 10),
    beskrivelse: `Kreditering av bilag #${original.bilagsnr} — ${original.beskrivelse}`,
    belop: -(original.belop as number),
    klientId: original.klientId,
    status: "bokført",
    kategori: original.kategori,
    leverandor: original.leverandor,
    posteringer: reversertePosteringer,
    korrigererBilagId: id,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await ref.update({
    status: "kreditert",
    kreditertAvId: korRef.id,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  success(res, { originalId: id, korrigeringId: korRef.id, bilagsnr }, 201);
}, "bilag:write");

// ============================================================
// v1 — Rapporter (server-side beregning)
// ============================================================

const v1Resultat = withApiKeyOrAuth(async ({ user, req, res }) => {
  const { periode, klientId } = req.query as Record<string, string>;
  let q: FirebaseFirestore.Query = db.collection(`users/${user.uid}/bilag`)
    .where("status", "in", ["bokført", "kreditert"]);
  if (klientId) q = q.where("klientId", "==", klientId);
  const snap = await q.get();

  type PosteRad = { kontonr: string; kontonavn: string; debet: number; kredit: number; dato: string };

  const posteringer: PosteRad[] = snap.docs.flatMap((d) => {
    const b = d.data();
    return ((b.posteringer ?? []) as PosteRad[]).map((p) => ({
      ...p,
      dato: b.dato as string,
    }));
  });

  const filtrert = periode
    ? posteringer.filter((p) => p.dato.startsWith(periode))
    : posteringer;

  const kontoMap = new Map<string, { navn: string; netto: number }>();
  for (const p of filtrert) {
    const netto = (p.debet ?? 0) - (p.kredit ?? 0);
    const existing = kontoMap.get(p.kontonr);
    if (existing) existing.netto += netto;
    else kontoMap.set(p.kontonr, { navn: p.kontonavn, netto });
  }

  const inntekter: Array<Record<string, unknown>> = [];
  const kostnader: Array<Record<string, unknown>> = [];
  for (const [konto, { navn, netto }] of kontoMap.entries()) {
    const cls = konto[0];
    if (cls === "3" && netto !== 0) inntekter.push({ konto, navn, belop: Math.abs(netto) });
    else if (["4", "5", "6", "7", "8"].includes(cls) && netto !== 0) kostnader.push({ konto, navn, belop: Math.abs(netto) });
  }
  const totalInntekter = inntekter.reduce((s, r) => s + (r.belop as number), 0);
  const totalKostnader = kostnader.reduce((s, r) => s + (r.belop as number), 0);

  success(res, {
    periode: periode ?? "alt",
    driftsinntekter: inntekter.sort((a, b) => (a.konto as string).localeCompare(b.konto as string)),
    driftskostnader: kostnader.sort((a, b) => (a.konto as string).localeCompare(b.konto as string)),
    totalInntekter,
    totalKostnader,
    resultat: totalInntekter - totalKostnader,
  });
}, "rapporter:read");

// ============================================================
// Webhooks — registrering og levering
// ============================================================
// v1 — Motparter (kunder og leverandører)
// ============================================================

const motpartSchema = z.object({
  type: z.enum(["kunde", "leverandor"]),
  navn: z.string().min(1).max(200),
  orgnr: z.string().regex(/^\d{9}$/, "Organisasjonsnummer må ha 9 siffer").refine(
    erGyldigOrgnr,
    "Ugyldig organisasjonsnummer (Modulus-11-sjekk feilet)"
  ).optional(),
  kontaktperson: z.string().max(200).optional(),
  epost: z.string().email().optional(),
  telefon: z.string().max(30).optional(),
  adresse: z.string().max(500).optional(),
  klientId: z.string().min(1),
});

const v1ListMotparter = withApiKeyOrAuth(async ({ user, req, res }) => {
  const { klientId, type } = req.query as Record<string, string>;
  let q: FirebaseFirestore.Query = db.collection(`users/${user.uid}/motparter`);
  if (klientId) q = q.where("klientId", "==", klientId);
  if (type && (type === "kunde" || type === "leverandor")) q = q.where("type", "==", type);
  q = q.orderBy("navn", "asc").limit(200);
  const snap = await q.get();
  success(res, snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}, "klienter:read");

const v1CreateMotpart = withApiKeyOrAuthValidation(motpartSchema, async ({ user, data, res }) => {
  // Valider at klientId tilhører brukeren
  const klientSnap = await db.doc(`users/${user.uid}/klienter/${data.klientId}`).get();
  if (!klientSnap.exists) {
    return fail(res, "Klient ikke funnet", 404);
  }

  const ref = await db.collection(`users/${user.uid}/motparter`).add({
    ...data,
    opprettet: admin.firestore.FieldValue.serverTimestamp(),
  });
  success(res, { id: ref.id, ...data }, 201);
}, "klienter:write");

const v1GetMotpart = withApiKeyOrAuth(async ({ user, req, res }) => {
  const id = pathSegment(req.path, 2);
  if (!id) return fail(res, "Mangler motpart-ID", 400);
  const snap = await db.doc(`users/${user.uid}/motparter/${id}`).get();
  if (!snap.exists) return fail(res, "Motpart ikke funnet", 404);
  success(res, { id: snap.id, ...snap.data() });
}, "klienter:read");

const v1UpdateMotpart = withApiKeyOrAuthValidation(motpartSchema.partial(), async ({ user, req, data, res }) => {
  const id = pathSegment(req.path, 2);
  if (!id) return fail(res, "Mangler motpart-ID", 400);
  const ref = db.doc(`users/${user.uid}/motparter/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return fail(res, "Motpart ikke funnet", 404);
  await ref.update({ ...data, oppdatert: admin.firestore.FieldValue.serverTimestamp() });
  success(res, { id, ...data });
}, "klienter:write");

const v1DeleteMotpart = withApiKeyOrAuth(async ({ user, req, res }) => {
  const id = pathSegment(req.path, 2);
  if (!id) return fail(res, "Mangler motpart-ID", 400);
  const ref = db.doc(`users/${user.uid}/motparter/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return fail(res, "Motpart ikke funnet", 404);
  await ref.delete();
  success(res, { deleted: true });
}, "klienter:write");

// ============================================================

type WebhookHendelse =
  | "bilag.opprettet" | "bilag.oppdatert" | "bilag.bokfort"
  | "bilag.avvist" | "bilag.kreditert"
  | "klient.opprettet" | "klient.oppdatert";

const GYLDIGE_HENDELSER: WebhookHendelse[] = [
  "bilag.opprettet", "bilag.oppdatert", "bilag.bokfort",
  "bilag.avvist", "bilag.kreditert",
  "klient.opprettet", "klient.oppdatert",
];

/** Lever payload til én webhook med HMAC-SHA256-signering og retry (maks 3) */
async function leverWebhook(
  webhookId: string,
  url: string,
  secret: string,
  hendelse: WebhookHendelse,
  userId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const body = JSON.stringify({ hendelse, payload, tidspunkt: new Date().toISOString() });
  const hmac = crypto.createHmac("sha256", secret).update(body).digest("hex");

  let statusKode = 0;
  let ok = false;
  let antallForsøk = 0;

  for (let forsøk = 1; forsøk <= 3; forsøk++) {
    antallForsøk = forsøk;
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Ketl-Signature": `sha256=${hmac}`,
          "X-Ketl-Hendelse": hendelse,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      statusKode = r.status;
      ok = r.ok;
      if (ok) break;
      // Eksponentiell backoff
      if (forsøk < 3) await new Promise((res) => setTimeout(res, forsøk * 2000));
    } catch {
      statusKode = 0;
      if (forsøk < 3) await new Promise((res) => setTimeout(res, forsøk * 2000));
    }
  }

  // Logg leveringen
  await db.collection("webhook_logg").add({
    webhookId,
    hendelse,
    statusKode,
    forsøk: antallForsøk,
    ok,
    url,
    userId,
    tidspunkt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/** Finn og lever aktive webhooks for en hendelse og bruker */
async function fireWebhooks(
  userId: string,
  hendelse: WebhookHendelse,
  payload: Record<string, unknown>
): Promise<void> {
  const snap = await db.collection("webhooks")
    .where("userId", "==", userId)
    .where("aktiv", "==", true)
    .get();

  for (const doc of snap.docs) {
    const data = doc.data();
    const hendelser = (data.hendelser ?? []) as WebhookHendelse[];
    if (!hendelser.includes(hendelse)) continue;
    leverWebhook(doc.id, data.url, data.secret ?? "", hendelse, userId, payload).catch(() => {
      // Feiler lydløst — leveringen er allerede logget
    });
  }
}

/** GET /webhooks — List brukerens webhooks */
const listWebhooks = withAuth(async ({ user, res }) => {
  const snap = await db.collection("webhooks")
    .where("userId", "==", user.uid)
    .orderBy("opprettet", "desc")
    .get();
  success(res, snap.docs.map((d) => ({
    id: d.id,
    url: d.data().url,
    hendelser: d.data().hendelser,
    aktiv: d.data().aktiv,
    opprettet: d.data().opprettet?.toDate() ?? null,
  })));
});

/** POST /webhooks — Registrer ny webhook */
const createWebhook = withAuth(async ({ user, req, res }) => {
  const { url, hendelser } = req.body as { url?: string; hendelser?: string[] };
  if (!url || typeof url !== "string") {
    fail(res, "URL er påkrevd"); return;
  }
  try { new URL(url); } catch { fail(res, "Ugyldig URL"); return; }
  const gyldige = (Array.isArray(hendelser) ? hendelser : [])
    .filter((h) => GYLDIGE_HENDELSER.includes(h as WebhookHendelse)) as WebhookHendelse[];
  if (gyldige.length === 0) {
    fail(res, `Minst én gyldig hendelse påkrevd: ${GYLDIGE_HENDELSER.join(", ")}`); return;
  }
  const secret = crypto.randomBytes(32).toString("hex");
  const ref = await db.collection("webhooks").add({
    url,
    hendelser: gyldige,
    aktiv: true,
    secret,
    userId: user.uid,
    opprettet: admin.firestore.FieldValue.serverTimestamp(),
  });
  const webhook = { id: ref.id, url, hendelser: gyldige, aktiv: true, opprettet: new Date().toISOString() };
  success(res, { id: ref.id, secret, webhook }, 201);
});

/** DELETE /webhooks/:id — Slett webhook */
const deleteWebhook = withAuth(async ({ user, req, res }) => {
  const id = req.path.split("/").filter(Boolean).pop();
  if (!id) { fail(res, "Mangler webhook-ID", 400); return; }
  const doc = await db.collection("webhooks").doc(id).get();
  if (!doc.exists || doc.data()?.userId !== user.uid) {
    fail(res, "Ikke funnet", 404); return;
  }
  await doc.ref.delete();
  success(res, { deleted: true });
});

/** GET /webhooks/:id/logg — Hent leveringslogg */
const getWebhookLogg = withAuth(async ({ user, req, res }) => {
  const id = pathSegment(req.path, 1);
  if (!id) { fail(res, "Mangler ID", 400); return; }
  const doc = await db.collection("webhooks").doc(id).get();
  if (!doc.exists || doc.data()?.userId !== user.uid) {
    fail(res, "Ikke funnet", 404); return;
  }
  const logg = await db.collection("webhook_logg")
    .where("webhookId", "==", id)
    .orderBy("tidspunkt", "desc")
    .limit(50)
    .get();
  success(res, logg.docs.map((d) => ({ id: d.id, ...d.data() })));
});

// ============================================================
// Ruter — enkel stibasert ruting
// ============================================================

type Route = {
  method: string;
  path: string;
  handler: (ctx: RouteContext) => Promise<void> | void;
};

// Rate limiter-instans
const apiRateLimit = rateLimit(100, 60_000);

const routes: Route[] = [
  { method: "GET",    path: "/",                    handler: getRoot },
  { method: "GET",    path: "/collections",         handler: getCollections },
  { method: "GET",    path: "/me",                  handler: getMe },
  { method: "POST",   path: "/notes",               handler: createNote },
  { method: "GET",    path: "/notes",               handler: getNotes },
  { method: "DELETE", path: "/notes/:id",           handler: deleteNote },
  // Stripe
  { method: "POST",   path: "/stripe/checkout",     handler: createCheckout },
  { method: "POST",   path: "/stripe/portal",       handler: createPortal },
  { method: "POST",   path: "/stripe/webhook",      handler: handleWebhook },
  // API-nøkler
  { method: "GET",    path: "/api-keys",            handler: listApiKeys },
  { method: "POST",   path: "/api-keys",            handler: createApiKey },
  // Webhooks
  { method: "GET",    path: "/webhooks",            handler: listWebhooks },
  { method: "POST",   path: "/webhooks",            handler: createWebhook },
  // Admin
  { method: "POST",   path: "/admin/set-role",      handler: setAdminRole },
  { method: "GET",    path: "/admin/users",         handler: listAdminUsers },
  { method: "GET",    path: "/admin/stats",         handler: getAdminStats },
  { method: "GET",    path: "/admin/feature-flags", handler: listFeatureFlags },
  { method: "POST",   path: "/admin/feature-flags", handler: createFeatureFlag },
  // Konto
  { method: "DELETE", path: "/account",             handler: deleteAccount },
  // ─── v1 Regnskaps-API ──────────────────────────────────────────────────────
  { method: "GET",    path: "/v1/klienter",         handler: v1ListKlienter },
  { method: "POST",   path: "/v1/klienter",         handler: v1CreateKlient },
  { method: "GET",    path: "/v1/bilag",            handler: v1ListBilag },
  { method: "POST",   path: "/v1/bilag",            handler: v1CreateBilag },
  { method: "GET",    path: "/v1/rapporter/resultat", handler: v1Resultat },
  { method: "GET",    path: "/v1/motparter",        handler: v1ListMotparter },
  { method: "POST",   path: "/v1/motparter",        handler: v1CreateMotpart },
  // Parametriserte v1-ruter håndteres med startsWith-matching i api-funksjonen
  // ─── OpenAPI-dokumentasjon ─────────────────────────────────────────────────
  {
    method: "GET",
    path: "/openapi.json",
    handler: ({ res }: RouteContext) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.json(OPENAPI_SPEC);
    },
  },
  {
    method: "GET",
    path: "/docs",
    handler: ({ req, res }: RouteContext) => {
      const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost";
      const proto = req.headers["x-forwarded-proto"] ?? "https";
      const specUrl = `${proto}://${host}/api/openapi.json`;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(genererDocsHtml(specUrl));
    },
  },
];

// ============================================================
// HTTP Functions
// ============================================================

// ============================================================
// AI Bokføringspipeline
// ============================================================

const SYSTEM_PROMPT = `Du er en norsk regnskapsassistent med ekspertkunnskap i:
- Norsk regnskapsstandard NS 4102 (kontoplan)
- SAF-T MVA-kodesystem (Skatteetatens standard)
- Regnskapsloven og bokføringsloven

Din oppgave er å analysere bilag (kvitteringer, fakturaer, etc.) og foreslå riktige posteringer.

Regler for posteringer:
- Debetsiden og kreditsiden MÅ summere til samme beløp (balansert bilag)
- Leverandørgjeld bokføres alltid på konto 2400
- Inngående MVA 25% → konto 2710
- Inngående MVA 15% → konto 2711
- Inngående MVA 12% → konto 2712

SAF-T MVA-koder (bruk disse i "mvaKode"-feltet):
- "0"  → Unntatt MVA / ingen MVA
- "1"  → Innenlands kjøp, høy sats 25% (inngående)
- "11" → Innenlands kjøp, middels sats 15% (inngående)
- "12" → Innenlands kjøp, lav sats 12% (inngående)
- "3"  → Innenlands salg, høy sats 25% (utgående)
- "5"  → Innenlands salg, middels sats 15% (utgående)
- "6"  → Innenlands salg, lav sats 12% (utgående)
- "81" → Kjøp fra utlandet, 25%
- "87" → Kjøp av tjenester fra utlandet, 25%

Inkluder "mvaKode" på kostnads- og inntektslinjer. Utelat "mvaKode" der det er 0%.

Du MÅ også inkludere et "forklaring"-objekt som forklarer resonneringen din:
- "dokumentSignaler": liste med observasjoner du gjorde fra bilagsteksten (leverandørnavn, beskrivelse, beløp, MVA-beregning etc.)
- "kontoValg": for hvert kontonr, gi en kort begrunnelse for valget
- "regelreferanser": relevante lovhenvisninger (f.eks. "Bokføringsloven § 10 — originaldokumentasjonskrav")
- "usikkerhet": punkter der du er usikker (tom liste hvis høy konfidens)

Returner ALLTID et gyldig JSON-objekt (ingen markdown, ingen forklarende tekst rundt JSON).

Format:
{
  "posteringer": [
    { "kontonr": "6860", "kontonavn": "Programvare og lisenser", "debet": 1992, "kredit": 0, "mvaKode": "1" },
    { "kontonr": "2710", "kontonavn": "Inngående MVA 25%", "debet": 498, "kredit": 0 },
    { "kontonr": "2400", "kontonavn": "Leverandørgjeld", "debet": 0, "kredit": 2490 }
  ],
  "begrunnelse": "Kort oppsummering av konteringen",
  "konfidens": 0.9,
  "foreslåttKategori": "Programvarekostnader",
  "forklaring": {
    "dokumentSignaler": [
      "Leverandørnavn 'GitHub' indikerer programvaretjeneste",
      "Beløp 2490 NOK inkl. 25% MVA gir 1992 NOK eks. MVA"
    ],
    "kontoValg": [
      { "kontonr": "6860", "grunn": "GitHub er en programvare-/lisensleverandør — konto 6860 Programvare og lisenser" },
      { "kontonr": "2710", "grunn": "Inngående MVA 25% på tjenestekjøp fra norsk leverandør" },
      { "kontonr": "2400", "grunn": "Leverandørgjeld — standard mottakskonto for fakturaer" }
    ],
    "regelreferanser": [
      "NS 4102 konto 6860 — programvare og IT-tjenester",
      "Merverdiavgiftsloven § 16 — fradragsrett inngående MVA"
    ],
    "usikkerhet": []
  }
}`;

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      if (i === maxRetries - 1) throw err;
      const status = (err as { status?: number }).status;
      if (status === 429 || status === 503) {
        await new Promise((r) => setTimeout(r, Math.pow(2, i) * 1000));
      } else {
        throw err;
      }
    }
  }
  throw new Error("Unreachable");
}

async function analyserMedGemini(
  projektId: string,
  beskrivelse: string,
  belop: number,
  leverandor: string | null,
  vedleggBase64?: string,
  mimeType?: string
): Promise<{
  posteringer: Array<{ kontonr: string; kontonavn: string; debet: number; kredit: number; mvaKode?: string }>;
  begrunnelse: string;
  konfidens: number;
  foreslåttKategori: string;
} | null> {
  const location = process.env.VERTEX_AI_LOCATION ?? "europe-west1";
  const vertexAI = new VertexAI({ project: projektId, location });
  const model = vertexAI.getGenerativeModel({
    model: "gemini-2.0-flash-001",
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ],
    systemInstruction: SYSTEM_PROMPT,
  });

  const userPrompt = `Analyser dette bilaget og foreslå posteringer:
Beskrivelse: ${beskrivelse}
Beløp (inkl. MVA): ${belop} NOK
Leverandør: ${leverandor ?? "Ukjent"}

${vedleggBase64 ? "Se vedlagt bilde/PDF for mer informasjon." : ""}`;

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: userPrompt },
  ];

  if (vedleggBase64 && mimeType) {
    parts.push({
      inlineData: {
        mimeType: mimeType as "image/jpeg" | "image/png" | "application/pdf",
        data: vedleggBase64,
      },
    });
  }

  const result = await withRetry(() =>
    model.generateContent({
      contents: [{ role: "user", parts }],
    })
  );

  const tekst = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!tekst) return null;

  // Rens JSON fra eventuell markdown-innpakning
  const jsonMatch = tekst.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.posteringer || !Array.isArray(parsed.posteringer)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Cloud Function: Analyser nytt bilag med Gemini AI
 * Utløst når et bilag med status "ubehandlet" opprettes i Firestore.
 */
export const analyserBilag = onDocumentCreated(
  {
    document: "users/{uid}/bilag/{bilagId}",
    region: "europe-west1",
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    if (!data || data.status !== "ubehandlet") return;

    const { uid, bilagId } = event.params;
    const projektId = process.env.GCLOUD_PROJECT || admin.app().options.projectId || "";

    try {
      // Hent eventuelt vedlegg fra Storage (maks 4 MB for inline)
      let vedleggBase64: string | undefined;
      let mimeType: string | undefined;
      if (data.vedleggUrl && typeof data.vedleggUrl === "string") {
        try {
          const storage = admin.storage();
          // Parse storage path fra URL
          const urlMatch = data.vedleggUrl.match(/\/o\/(.+?)\?/);
          if (urlMatch) {
            const filePath = decodeURIComponent(urlMatch[1]);
            const filRef = storage.bucket().file(filePath);
            const [innhold] = await filRef.download();
            if (innhold.length <= 4 * 1024 * 1024) {
              const [metadata] = await filRef.getMetadata();
              mimeType = (metadata as { contentType?: string }).contentType ?? "image/jpeg";
              vedleggBase64 = innhold.toString("base64");
            }
          }
        } catch {
          // Fortsett uten vedlegg
        }
      }

      const forslag = await analyserMedGemini(
        projektId,
        data.beskrivelse ?? "",
        data.belop ?? 0,
        data.leverandor ?? null,
        vedleggBase64,
        mimeType
      );

      if (!forslag) {
        console.warn(`[analyserBilag] Fikk ikke gyldig svar fra Gemini for bilag ${bilagId}`);
        return;
      }

      // Valider at posteringene balanserer
      const sumDebet = forslag.posteringer.reduce((s: number, p: { debet: number }) => s + (p.debet ?? 0), 0);
      const sumKredit = forslag.posteringer.reduce((s: number, p: { kredit: number }) => s + (p.kredit ?? 0), 0);
      if (Math.abs(sumDebet - sumKredit) > 1) {
        console.warn(`[analyserBilag] Ubalanserte posteringer for bilag ${bilagId}: debet=${sumDebet}, kredit=${sumKredit}`);
        return;
      }

      // ─── Konfidensterskel (#94): auto-bokfør hvis innstillingene tillater det ──
      const aiInnstillingerSnap = await db
        .doc(`users/${uid}/innstillinger/ai`)
        .get();
      const aiInn = aiInnstillingerSnap.exists
        ? (aiInnstillingerSnap.data() as {
            konfidensterskel?: number;
            reviewAll?: boolean;
            maxAutoBeløp?: number;
            kritiskeKontoer?: string[];
          })
        : {};
      const terskel = aiInn.konfidensterskel ?? 85;
      const reviewAll = aiInn.reviewAll ?? false;
      const maxBeløp = aiInn.maxAutoBeløp ?? 50_000;
      const kritiske = aiInn.kritiskeKontoer ?? ["2400", "2600", "2700", "2800"];

      const kontoer = forslag.posteringer.map((p: { kontonr: string }) => p.kontonr);
      const konfidensPst = forslag.konfidens * 100;
      const beløp = Math.abs(data.belop ?? 0);

      const kanAutoBokføre =
        !reviewAll &&
        konfidensPst >= terskel &&
        (maxBeløp === 0 || beløp <= maxBeløp) &&
        !kontoer.some((k: string) => kritiske.includes(k));

      const nyStatus = kanAutoBokføre ? "bokført" : "foreslått";

      const bilagRef = db.doc(`users/${uid}/bilag/${bilagId}`);
      const oppdatering: Record<string, unknown> = {
        status: nyStatus,
        aiForslag: {
          posteringer: forslag.posteringer,
          begrunnelse: forslag.begrunnelse,
          konfidens: forslag.konfidens,
          foreslåttKategori: forslag.foreslåttKategori,
          tidspunkt: admin.firestore.FieldValue.serverTimestamp(),
          // Strukturert forklaring for agent-forklarbarhet (#100)
          ...(forslag.forklaring ? { forklaring: forslag.forklaring } : {}),
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Når auto-bokfør: kopier posteringer og kategori til bilag-dokumentet
      if (kanAutoBokføre) {
        oppdatering.posteringer = forslag.posteringer;
        oppdatering.kategori = forslag.foreslåttKategori;
      }

      await bilagRef.update(oppdatering);

      // Skriv revisjonslogg
      await db.collection(`users/${uid}/audit_log`).add({
        handling: kanAutoBokføre ? "ai_auto_bokfort" : "ai_forslag_generert",
        entitetType: "bilag",
        entitetId: bilagId,
        utfortAv: "ai",
        uid,
        detaljer: {
          konfidens: forslag.konfidens,
          kategori: forslag.foreslåttKategori,
          antallPosteringer: forslag.posteringer.length,
          autoBokfort: kanAutoBokføre,
          terskel,
        },
        tidspunkt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(
        `[analyserBilag] Bilag ${bilagId}: konfidens=${konfidensPst.toFixed(0)}%, ` +
        `terskel=${terskel}%, status="${nyStatus}", autoBooking=${kanAutoBokføre}`
      );
    } catch (err) {
      console.error(`[analyserBilag] Feil ved analyse av bilag ${bilagId}:`, err);
    }
  }
);

/**
 * Bokføringsloven § 13 — Oppbevaringspolicy
 *
 * Kjøres første dag i måneden (02:00 norsk tid).
 * Markerer bokførte og krediterte bilag som "arkivert" når de er eldre enn 5 år
 * (1 825 dager). Bilag med status "arkivert" kan deretter slettes av bruker
 * dersom de ønsker det — plikten er oppfylt. Bilag med vedlegg i Cloud Storage
 * slettes IKKE automatisk; sletting krever eksplisitt brukerhandling.
 *
 * Produserer revisjonslogg: `users/{uid}/audit_log`.
 */
export const arkiverGamleBilag = onSchedule(
  {
    schedule: "0 2 1 * *",   // Første dag i måneden, 02:00
    timeZone: "Europe/Oslo",
    region: "europe-west1",
  },
  async () => {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 5);
    const cutoffIso = cutoff.toISOString().slice(0, 10); // "YYYY-MM-DD"

    const now = admin.firestore.FieldValue.serverTimestamp();
    const arkivertDato = new Date().toISOString().slice(0, 10);
    let totalt = 0;

    // Iterer over alle brukere
    const usersSnap = await db.collection("users").listDocuments();
    for (const userRef of usersSnap) {
      const bilagRef = userRef.collection("bilag");
      const snap = await bilagRef
        .where("status", "in", ["bokført", "kreditert"])
        .where("dato", "<=", cutoffIso)
        .get();

      if (snap.empty) continue;

      const auditRef = userRef.collection("audit_log");
      // Firestore batch-grense er 500 operasjoner; hvert bilag gir 2 → maks 250 per batch
      const BATCH_SIZE = 250;
      for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
        const chunk = snap.docs.slice(i, i + BATCH_SIZE);
        const batch = db.batch();
        for (const doc of chunk) {
          batch.update(doc.ref, { status: "arkivert", arkivertDato });
          batch.set(auditRef.doc(), {
            handling: "bilag_arkivert",
            entitetType: "bilag",
            entitetId: doc.id,
            utfortAv: "system",
            uid: userRef.id,
            detaljer: {
              bilagsnr: doc.data().bilagsnr,
              dato: doc.data().dato,
              cutoffDato: cutoffIso,
            },
            tidspunkt: now,
          });
          totalt++;
        }
        await batch.commit();
      }
    }

    console.log(`[arkiverGamleBilag] Arkiverte ${totalt} bilag eldre enn ${cutoffIso}`);
  }
);

/**
 * Webhook-trigger: brann webhooks ved bilagsstatus-endring
 *
 * Lytter på oppdateringer av bilag i `users/{uid}/bilag/{bilagId}`.
 * Hvis `status`-feltet endres, leveres en webhook-hendelse til alle
 * aktive webhooks som er konfigurert for den aktuelle hendelsen.
 */
export const bilagOpprettetWebhookTrigger = onDocumentCreated(
  {
    document: "users/{uid}/bilag/{bilagId}",
    region: "europe-west1",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();
    const uid = event.params.uid;
    const bilagId = event.params.bilagId;
    await fireWebhooks(uid, "bilag.opprettet", {
      bilagId,
      bilagsnr: data.bilagsnr,
      dato: data.dato,
      beskrivelse: data.beskrivelse,
      belop: data.belop,
      status: data.status,
      klientId: data.klientId,
    });
  }
);

export const bilagWebhookTrigger = onDocumentUpdated(
  {
    document: "users/{uid}/bilag/{bilagId}",
    region: "europe-west1",
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const statusFør = before.status as string | undefined;
    const statusEtter = after.status as string | undefined;
    if (!statusFør || !statusEtter || statusFør === statusEtter) return;

    const uid = event.params.uid;
    const bilagId = event.params.bilagId;

    // Bestem hvilken webhook-hendelse som skal sendes
    const hendelsesMap: Record<string, string> = {
      "bokført":    "bilag.bokfort",
      "avvist":     "bilag.avvist",
      "kreditert":  "bilag.kreditert",
    };
    const hendelse = hendelsesMap[statusEtter];
    if (!hendelse) return; // Ikke en hendelse vi sporer

    await fireWebhooks(uid, hendelse as Parameters<typeof fireWebhooks>[1], {
      bilagId,
      bilagsnr: after.bilagsnr,
      dato: after.dato,
      beskrivelse: after.beskrivelse,
      belop: after.belop,
      status: statusEtter,
      klientId: after.klientId,
    });
  }
);

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
 * Hoved-API med stibasert ruting og middleware
 */
export const api = onRequest(
  { region: "europe-west1", cors: true, invoker: "public" },
  async (req, res) => {
    // Rate limiting
    if (!apiRateLimit({ req, res })) return;

    // Eksakt sti-matching
    const route = routes.find(
      (r) => r.method === req.method && r.path === req.path
    );

    if (route) {
      await route.handler({ req, res });
      return;
    }

    // Sti-parameter-matching: DELETE /api-keys/:id
    if (req.method === "DELETE" && req.path.startsWith("/api-keys/")) {
      await revokeApiKey({ req, res });
      return;
    }

    // Admin bruker-ruter: GET/DELETE /admin/users/:uid, POST /admin/users/:uid/disable
    if (req.path.startsWith("/admin/users/")) {
      if (req.method === "GET" && !req.path.endsWith("/disable")) {
        await getAdminUser({ req, res });
        return;
      }
      if (req.method === "POST" && req.path.endsWith("/disable")) {
        await disableAdminUser({ req, res });
        return;
      }
      if (req.method === "DELETE") {
        await deleteAdminUser({ req, res });
        return;
      }
    }

    // Admin feature-flag-ruter: PUT /admin/feature-flags/:id
    if (req.method === "PUT" && req.path.startsWith("/admin/feature-flags/")) {
      await updateFeatureFlag({ req, res });
      return;
    }

    // ─── v1 Klienter: GET/PUT/DELETE /v1/klienter/:id ───────────────────────
    if (req.path.startsWith("/v1/klienter/")) {
      const tail = req.path.slice("/v1/klienter/".length);
      // Avvis tom ID
      if (!tail || tail === "") { fail(res, "Mangler klient-ID", 400); return; }
      if (req.method === "GET") { await v1GetKlient({ req, res }); return; }
      if (req.method === "PUT") { await v1UpdateKlient({ req, res }); return; }
      if (req.method === "DELETE") { await v1DeleteKlient({ req, res }); return; }
    }

    // ─── v1 Motparter: GET/PUT/DELETE /v1/motparter/:id ─────────────────────
    if (req.path.startsWith("/v1/motparter/")) {
      const tail = req.path.slice("/v1/motparter/".length);
      if (!tail) { fail(res, "Mangler motpart-ID", 400); return; }
      if (req.method === "GET") { await v1GetMotpart({ req, res }); return; }
      if (req.method === "PUT") { await v1UpdateMotpart({ req, res }); return; }
      if (req.method === "DELETE") { await v1DeleteMotpart({ req, res }); return; }
    }

    // ─── Notater: PATCH/DELETE /notes/:id ───────────────────────────────────
    if (req.path.startsWith("/notes/")) {
      if (req.method === "PATCH") { await updateNote({ req, res }); return; }
      if (req.method === "DELETE") { await deleteNote({ req, res }); return; }
    }

    // ─── Webhooks: DELETE /webhooks/:id, GET /webhooks/:id/logg ─────────────
    if (req.path.startsWith("/webhooks/")) {
      if (req.method === "DELETE") { await deleteWebhook({ req, res }); return; }
      if (req.method === "GET" && req.path.endsWith("/logg")) {
        await getWebhookLogg({ req, res }); return;
      }
    }

    // ─── v1 Bilag: GET/PATCH/POST /v1/bilag/:id/... ─────────────────────────
    if (req.path.startsWith("/v1/bilag/")) {
      if (req.method === "GET" && !req.path.includes("/", "/v1/bilag/".length)) {
        await v1GetBilag({ req, res }); return;
      }
      if (req.method === "PATCH" && req.path.endsWith("/godkjenn")) {
        await v1GodkjennBilag({ req, res }); return;
      }
      if (req.method === "PATCH" && req.path.endsWith("/avvis")) {
        await v1AvvisBilag({ req, res }); return;
      }
      if (req.method === "POST" && req.path.endsWith("/krediter")) {
        await v1KrediterBilag({ req, res }); return;
      }
    }

    fail(res, "Ikke funnet", 404);
  }
);
