import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const STRIPE_API_BASE = "https://api.stripe.com/v1";
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export class BillingError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function createBillingManager(config, runtimeBilling) {
  function getStripeCredentials() {
    return {
      secretKey: runtimeBilling.stripeSecretKey || process.env.STRIPE_SECRET_KEY?.trim() || "",
      priceId: runtimeBilling.stripePriceId || process.env.STRIPE_PRICE_ID?.trim() || "",
      webhookSecret: runtimeBilling.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET?.trim() || ""
    };
  }

  function isPlaceholder(value) {
    return /replace[_-]?me/i.test(value);
  }

  function isCheckoutConfigured() {
    const { secretKey, priceId } = getStripeCredentials();
    return Boolean(secretKey && priceId && !isPlaceholder(secretKey) && !isPlaceholder(priceId));
  }

  function isWebhookConfigured() {
    const { webhookSecret } = getStripeCredentials();
    return Boolean(webhookSecret && !isPlaceholder(webhookSecret));
  }

  function getBillingMode() {
    return isCheckoutConfigured() ? "live" : config.billing?.mode ?? "stub";
  }

  async function createCheckoutSession({ appUrl, customerEmail }) {
    const { secretKey, priceId } = getStripeCredentials();
    const body = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: `${appUrl}/studio?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/studio?billing=cancelled`,
      "subscription_data[metadata][product]": "morph-team",
      allow_promotion_codes: "true"
    });
    if (customerEmail) body.set("customer_email", customerEmail);

    let response;
    let payload;
    try {
      response = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${secretKey}`,
          "content-type": "application/x-www-form-urlencoded"
        },
        body
      });
      payload = await response.json();
    } catch (error) {
      throw new BillingError(502, "stripe_unreachable", `Could not reach Stripe: ${error.message}`);
    }

    if (!response.ok) {
      throw new BillingError(
        502,
        "stripe_checkout_error",
        payload?.error?.message || "Stripe checkout session creation failed."
      );
    }

    return {
      id: payload.id,
      url: payload.url,
      mode: "live",
      provider: "stripe"
    };
  }

  function verifyWebhookSignature(rawBody, signatureHeader, { toleranceSeconds = SIGNATURE_TOLERANCE_SECONDS, now = Date.now() } = {}) {
    const { webhookSecret } = getStripeCredentials();
    if (!webhookSecret) {
      throw new BillingError(503, "webhook_not_configured", "STRIPE_WEBHOOK_SECRET is not configured.");
    }
    if (!signatureHeader) {
      throw new BillingError(400, "missing_signature", "Missing Stripe-Signature header.");
    }

    let timestamp = null;
    const candidateSignatures = [];
    for (const part of String(signatureHeader).split(",")) {
      const [key, value] = part.split("=").map((piece) => piece?.trim());
      if (key === "t") timestamp = Number(value);
      if (key === "v1" && value) candidateSignatures.push(value);
    }

    if (!timestamp || !candidateSignatures.length) {
      throw new BillingError(400, "invalid_signature_header", "Stripe-Signature header is malformed.");
    }

    const ageSeconds = Math.abs(now / 1000 - timestamp);
    if (ageSeconds > toleranceSeconds) {
      throw new BillingError(400, "signature_expired", "Stripe-Signature timestamp is outside the tolerance window.");
    }

    const expected = createHmac("sha256", webhookSecret)
      .update(`${timestamp}.${rawBody}`, "utf8")
      .digest("hex");
    const expectedBuffer = Buffer.from(expected, "utf8");

    const matches = candidateSignatures.some((candidate) => {
      const candidateBuffer = Buffer.from(candidate, "utf8");
      return candidateBuffer.length === expectedBuffer.length && timingSafeEqual(candidateBuffer, expectedBuffer);
    });

    if (!matches) {
      throw new BillingError(400, "signature_mismatch", "Stripe-Signature verification failed.");
    }

    return true;
  }

  function applyWebhookEvent(state, event) {
    const next = { ...state, lastEventId: event.id ?? null, lastEventType: event.type ?? null, updatedAt: new Date().toISOString() };
    const object = event.data?.object ?? {};

    if (event.type === "checkout.session.completed") {
      return {
        ...next,
        plan: "team",
        status: "active",
        stripeCustomerId: object.customer ?? next.stripeCustomerId ?? null,
        stripeSubscriptionId: object.subscription ?? next.stripeSubscriptionId ?? null,
        customerEmail: object.customer_details?.email ?? next.customerEmail ?? null
      };
    }
    if (event.type === "customer.subscription.updated") {
      return {
        ...next,
        plan: object.status === "active" || object.status === "trialing" ? "team" : next.plan,
        status: object.status ?? next.status,
        stripeSubscriptionId: object.id ?? next.stripeSubscriptionId ?? null
      };
    }
    if (event.type === "customer.subscription.deleted") {
      return { ...next, plan: "local", status: "cancelled" };
    }
    return next;
  }

  return {
    getStripeCredentials,
    isCheckoutConfigured,
    isWebhookConfigured,
    getBillingMode,
    createCheckoutSession,
    verifyWebhookSignature,
    applyWebhookEvent
  };
}

export function defaultBillingState() {
  return {
    plan: "local",
    status: "free",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    customerEmail: null,
    lastEventId: null,
    lastEventType: null,
    updatedAt: null
  };
}

export async function readBillingState(config) {
  const file = billingStateFile(config);
  if (!existsSync(file)) return defaultBillingState();
  try {
    return { ...defaultBillingState(), ...JSON.parse(await readFile(file, "utf8")) };
  } catch {
    return defaultBillingState();
  }
}

export async function writeBillingState(config, state) {
  const file = billingStateFile(config);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(state, null, 2)}\n`);
  return state;
}

function billingStateFile(config) {
  return path.join(config.morphDir, "billing.json");
}

export function maskSecret(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  if (trimmed.length <= 8) return trimmed;
  return `${trimmed.slice(0, 7)}...${trimmed.slice(-4)}`;
}
