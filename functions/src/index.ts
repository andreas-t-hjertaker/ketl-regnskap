import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import Stripe from "stripe";
import { z } from "zod";
import { success, fail, withAuth, withAdmin, withValidation, rateLimit, type RouteContext } from "./middleware";

admin.initializeApp();

const db = admin.firestore();

// ============================================================
// Zod-skjemaer
// ============================================================

const createNoteSchema = z.object({
  title: z.string().min(1, "Tittel er påkrevd").max(200),
  content: z.string().max(10000).optional().default(""),
});

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
        // Beregn neste faktureringsperiode fra billing_cycle_anchor
        const periodEnd = sub.cancel_at
          ? new Date(sub.cancel_at * 1000)
          : new Date(sub.billing_cycle_anchor * 1000);
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
    };
  });

  success(res, keys);
});

/** POST /api-keys — Opprett ny API-nøkkel */
const createApiKey = withAuth(async ({ user, req, res }) => {
  const { name } = req.body as { name?: string };
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    fail(res, "Navn er påkrevd");
    return;
  }

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

  // Slett Firestore-data
  const batch = db.batch();
  const subRef = db.collection("subscriptions").doc(uid);
  batch.delete(subRef);

  const keysSnap = await db.collection("apiKeys").where("userId", "==", uid).get();
  keysSnap.docs.forEach((d) => batch.delete(d.ref));

  const notesSnap = await db.collection("notes").where("userId", "==", uid).get();
  notesSnap.docs.forEach((d) => batch.delete(d.ref));

  await batch.commit();

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

  const subRef = db.collection("subscriptions").doc(user.uid);
  batch.delete(subRef);

  const keysSnap = await db.collection("apiKeys").where("userId", "==", user.uid).get();
  keysSnap.docs.forEach((d) => batch.delete(d.ref));

  const notesSnap = await db.collection("notes").where("userId", "==", user.uid).get();
  notesSnap.docs.forEach((d) => batch.delete(d.ref));

  await batch.commit();
  success(res, { deleted: true });
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
  { method: "GET", path: "/", handler: getRoot },
  { method: "GET", path: "/collections", handler: getCollections },
  { method: "GET", path: "/me", handler: getMe },
  { method: "POST", path: "/notes", handler: createNote },
  { method: "GET", path: "/notes", handler: getNotes },
  // Stripe
  { method: "POST", path: "/stripe/checkout", handler: createCheckout },
  { method: "POST", path: "/stripe/portal", handler: createPortal },
  { method: "POST", path: "/stripe/webhook", handler: handleWebhook },
  // API-nøkler
  { method: "GET", path: "/api-keys", handler: listApiKeys },
  { method: "POST", path: "/api-keys", handler: createApiKey },
  // DELETE /api-keys/:id håndteres med startsWith-matching under
  // Admin
  { method: "POST", path: "/admin/set-role", handler: setAdminRole },
  { method: "GET", path: "/admin/users", handler: listAdminUsers },
  { method: "GET", path: "/admin/stats", handler: getAdminStats },
  { method: "GET", path: "/admin/feature-flags", handler: listFeatureFlags },
  { method: "POST", path: "/admin/feature-flags", handler: createFeatureFlag },
  // GET /admin/users/:uid, POST /admin/users/:uid/disable, DELETE /admin/users/:uid,
  // PUT /admin/feature-flags/:id — håndteres med startsWith-matching under
  // Konto
  { method: "DELETE", path: "/account", handler: deleteAccount },
];

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

    fail(res, "Ikke funnet", 404);
  }
);
