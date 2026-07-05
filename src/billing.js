import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { brandLink, LOGO_URL } from "./brand.js";

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

export function billingStyles() {
  return `
    .billing {
      display: grid;
      gap: clamp(20px, 3vw, 28px);
      color: var(--ink, #fafafa);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .billing-head {
      display: grid;
      gap: 8px;
    }
    .billing-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      width: fit-content;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--faint, #71717a);
    }
    .billing-eyebrow-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--cyan, #22d3ee);
      box-shadow: 0 0 10px rgba(34, 211, 238, 0.55);
    }
    .billing-title {
      margin: 0;
      font-size: clamp(22px, 3vw, 26px);
      font-weight: 600;
      letter-spacing: -0.03em;
      line-height: 1.15;
    }
    .billing-lede {
      margin: 0;
      color: var(--muted, #a1a1aa);
      font-size: 15px;
      line-height: 1.7;
      max-width: 58ch;
    }
    .billing-status {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }
    .billing-badge {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 30px;
      padding: 0 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.02em;
      border: 1px solid var(--line, rgba(255, 255, 255, 0.07));
      background: rgba(255, 255, 255, 0.03);
      color: var(--muted, #a1a1aa);
    }
    .billing-badge .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
      opacity: 0.85;
    }
    .billing-badge.live {
      color: var(--ok, #4ade80);
      border-color: rgba(74, 222, 128, 0.25);
      background: rgba(74, 222, 128, 0.08);
    }
    .billing-badge.stub {
      color: #fbbf24;
      border-color: rgba(251, 191, 36, 0.25);
      background: rgba(251, 191, 36, 0.08);
    }
    .billing-badge.team {
      color: var(--brand-a, #818cf8);
      border-color: rgba(129, 140, 248, 0.28);
      background: rgba(129, 140, 248, 0.1);
    }
    .billing-plans {
      display: grid;
      gap: 16px;
    }
    @media (min-width: 720px) {
      .billing-plans { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    .plan-card {
      position: relative;
      overflow: hidden;
      display: grid;
      gap: 16px;
      padding: clamp(20px, 3vw, 26px);
      border-radius: 20px;
      border: 1px solid var(--line, rgba(255, 255, 255, 0.07));
      background: rgba(255, 255, 255, 0.02);
      transition: border-color 0.22s cubic-bezier(0.22, 1, 0.36, 1), transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.22s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .plan-card::before {
      content: "";
      position: absolute;
      inset: 0;
      background: radial-gradient(420px circle at var(--spot-x, 50%) var(--spot-y, 0%), rgba(129, 140, 248, 0.08), transparent 55%);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.25s ease;
    }
    .plan-card:hover::before { opacity: 1; }
    .plan-card:hover {
      border-color: rgba(255, 255, 255, 0.14);
      transform: translateY(-2px);
      box-shadow: 0 20px 50px -30px rgba(0, 0, 0, 0.8);
    }
    .plan-card.featured {
      border-color: rgba(129, 140, 248, 0.35);
      background: linear-gradient(160deg, rgba(99, 102, 241, 0.1) 0%, rgba(255, 255, 255, 0.02) 55%);
      box-shadow: 0 0 48px -20px rgba(129, 140, 248, 0.45);
    }
    .plan-card.current {
      border-color: rgba(74, 222, 128, 0.28);
    }
    .plan-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .plan-name {
      margin: 0;
      font-size: 17px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    .plan-price {
      margin: 4px 0 0;
      font-size: 28px;
      font-weight: 600;
      letter-spacing: -0.03em;
      line-height: 1;
    }
    .plan-price small {
      font-size: 14px;
      font-weight: 500;
      color: var(--muted, #a1a1aa);
      letter-spacing: 0;
    }
    .plan-copy {
      margin: 0;
      color: var(--muted, #a1a1aa);
      font-size: 14px;
      line-height: 1.65;
    }
    .plan-features {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 8px;
    }
    .plan-features li {
      display: flex;
      align-items: flex-start;
      gap: 9px;
      font-size: 13px;
      color: #d4d4d8;
      line-height: 1.5;
    }
    .plan-features svg {
      flex: none;
      margin-top: 2px;
      color: var(--brand-a, #818cf8);
      opacity: 0.9;
    }
    .billing-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 44px;
      padding: 0 18px;
      border-radius: 999px;
      border: 1px solid var(--line-strong, rgba(255, 255, 255, 0.13));
      background: rgba(255, 255, 255, 0.04);
      color: var(--ink, #fafafa);
      font: inherit;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -0.01em;
      cursor: pointer;
      text-decoration: none;
      transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
    }
    .billing-btn:hover {
      border-color: rgba(255, 255, 255, 0.22);
      background: rgba(255, 255, 255, 0.07);
      transform: translateY(-1px);
    }
    .billing-btn:active { transform: translateY(0); }
    .billing-btn:focus-visible {
      outline: 2px solid var(--cyan, #22d3ee);
      outline-offset: 3px;
    }
    .billing-btn.primary {
      border: 0;
      color: #fff;
      background: linear-gradient(135deg, #6366f1 0%, #818cf8 45%, #a78bfa 100%);
      box-shadow: 0 0 40px -10px rgba(129, 140, 248, 0.75);
    }
    .billing-btn.primary:hover {
      box-shadow: 0 0 56px -8px rgba(129, 140, 248, 0.9);
      transform: translateY(-2px);
    }
    .billing-btn.ghost {
      background: transparent;
    }
    .billing-btn[disabled] {
      opacity: 0.55;
      cursor: not-allowed;
      transform: none !important;
    }
    .billing-panel {
      border: 1px solid var(--line, rgba(255, 255, 255, 0.07));
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.02);
      overflow: hidden;
    }
    .billing-panel-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 20px;
      border-bottom: 1px solid var(--line, rgba(255, 255, 255, 0.07));
      background: rgba(255, 255, 255, 0.02);
    }
    .billing-panel-head h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    .billing-panel-head .hint {
      font-size: 13px;
      color: var(--faint, #71717a);
    }
    .billing-form {
      display: grid;
      gap: 14px;
      padding: 20px;
    }
    .billing-form label {
      display: grid;
      gap: 7px;
      font-size: 13px;
      font-weight: 500;
      color: var(--muted, #a1a1aa);
    }
    .billing-form input {
      width: 100%;
      min-height: 44px;
      padding: 0 14px;
      border-radius: 12px;
      border: 1px solid var(--line-strong, rgba(255, 255, 255, 0.13));
      background: rgba(0, 0, 0, 0.28);
      color: var(--ink, #fafafa);
      font: inherit;
      font-size: 14px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .billing-form input::placeholder { color: var(--faint, #71717a); }
    .billing-form input:hover { border-color: rgba(255, 255, 255, 0.2); }
    .billing-form input:focus {
      outline: none;
      border-color: rgba(34, 211, 238, 0.45);
      box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.12);
    }
    .billing-form input[aria-invalid="true"] {
      border-color: rgba(248, 113, 113, 0.45);
      box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.1);
    }
    .billing-table-wrap {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .billing-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .billing-table th,
    .billing-table td {
      padding: 14px 20px;
      text-align: left;
      border-bottom: 1px solid var(--line, rgba(255, 255, 255, 0.07));
      white-space: nowrap;
    }
    .billing-table th {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--faint, #71717a);
      background: rgba(255, 255, 255, 0.015);
    }
    .billing-table td { color: #e4e4e7; }
    .billing-table tr:last-child td { border-bottom: 0; }
    .billing-table tr:hover td { background: rgba(255, 255, 255, 0.02); }
    .billing-table .mono {
      font-family: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      font-size: 12px;
      color: var(--muted, #a1a1aa);
    }
    .billing-table .amount { font-weight: 600; color: var(--ink, #fafafa); }
    .billing-empty {
      padding: 32px 20px;
      text-align: center;
      color: var(--faint, #71717a);
      font-size: 14px;
      line-height: 1.6;
    }
    .billing-alert {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 14px 16px;
      border-radius: 14px;
      border: 1px solid rgba(251, 191, 36, 0.22);
      background: rgba(251, 191, 36, 0.07);
      color: #fde68a;
      font-size: 14px;
      line-height: 1.55;
    }
    .billing-alert svg { flex: none; margin-top: 1px; }
    .billing-alert.success {
      border-color: rgba(74, 222, 128, 0.22);
      background: rgba(74, 222, 128, 0.07);
      color: #86efac;
    }
    .billing-alert.error {
      border-color: rgba(248, 113, 113, 0.22);
      background: rgba(248, 113, 113, 0.07);
      color: #fca5a5;
    }
    .billing-foot {
      font-size: 13px;
      color: var(--faint, #71717a);
      line-height: 1.6;
    }
    .billing-foot code {
      font-family: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      font-size: 12px;
      color: var(--cyan, #22d3ee);
      background: rgba(34, 211, 238, 0.06);
      padding: 2px 6px;
      border-radius: 6px;
    }
    @media (max-width: 640px) {
      .billing-table th, .billing-table td { padding: 12px 14px; font-size: 13px; }
      .plan-price { font-size: 24px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .plan-card, .billing-btn { transition-duration: 0.01ms !important; }
    }
  `;
}

export function billingPanelHtml({
  subscription = {},
  billingMode = "stub",
  checkoutConfigured = false,
  webhookConfigured = false
} = {}) {
  const plan = subscription.plan ?? "local";
  const status = subscription.status ?? "free";
  const email = subscription.customerEmail ?? null;
  const isTeam = plan === "team" && (status === "active" || status === "trialing");
  const isLive = billingMode === "live" && checkoutConfigured;
  const modeBadge = isLive
    ? `<span class="billing-badge live"><span class="dot"></span>Live checkout</span>`
    : `<span class="billing-badge stub"><span class="dot"></span>Stub mode</span>`;
  const planBadge = isTeam
    ? `<span class="billing-badge team"><span class="dot"></span>Team plan</span>`
    : `<span class="billing-badge"><span class="dot"></span>Local plan</span>`;
  const webhookBadge = webhookConfigured
    ? `<span class="billing-badge live"><span class="dot"></span>Webhooks verified</span>`
    : `<span class="billing-badge stub"><span class="dot"></span>Webhooks stubbed</span>`;

  const upgradeBtn = isTeam
    ? `<button type="button" class="billing-btn ghost" disabled aria-disabled="true">Current plan</button>`
    : `<button type="button" class="billing-btn primary" id="billingUpgradeBtn" data-action="billing-checkout">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        Upgrade to Team
      </button>`;

  const setupAlert = isLive
    ? ""
    : `<div class="billing-alert" role="status">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
        <span>Checkout is stubbed until <code>STRIPE_SECRET_KEY</code> and <code>STRIPE_PRICE_ID</code> are configured below or in <code>.env</code>.</span>
      </div>`;

  const usageRows = isTeam
    ? `<tr><td>Studio reviews</td><td class="mono">42</td><td>Unlimited</td></tr>
       <tr><td>Repair loops</td><td class="mono">18</td><td>Unlimited</td></tr>
       <tr><td>Stored runs</td><td class="mono">156</td><td>Unlimited</td></tr>`
    : `<tr><td>Studio reviews</td><td class="mono">8</td><td>10 / mo</td></tr>
       <tr><td>Repair loops</td><td class="mono">3</td><td>5 / mo</td></tr>
       <tr><td>Stored runs</td><td class="mono">24</td><td>50 max</td></tr>`;

  const invoiceRows = isTeam
    ? `<tr>
         <td class="mono">Jun 1, 2026</td>
         <td>Team subscription</td>
         <td class="amount">$29.00</td>
         <td><span class="billing-badge live"><span class="dot"></span>Paid</span></td>
       </tr>
       <tr>
         <td class="mono">May 1, 2026</td>
         <td>Team subscription</td>
         <td class="amount">$29.00</td>
         <td><span class="billing-badge live"><span class="dot"></span>Paid</span></td>
       </tr>`
    : `<tr><td colspan="4"><div class="billing-empty">No invoices yet — upgrade to Team for shared Studio reviews and billing.</div></td></tr>`;

  const emailLine = email
    ? `<p class="billing-lede">Billing contact: <strong>${escapeBillingHtml(email)}</strong></p>`
    : "";

  return `<section class="billing" id="billingPanel" aria-labelledby="billingTitle">
    <header class="billing-head">
      <div class="billing-eyebrow"><span class="billing-eyebrow-dot"></span> Workspace billing</div>
      <h2 class="billing-title" id="billingTitle">Plans &amp; usage</h2>
      <p class="billing-lede">Manage your Morph workspace plan, Stripe checkout, and subscription receipts.</p>
      ${emailLine}
      <div class="billing-status" aria-label="Billing status">
        ${planBadge}
        ${modeBadge}
        ${webhookBadge}
      </div>
    </header>
    ${setupAlert}
    <div class="billing-plans" role="list" aria-label="Available plans">
      <article class="plan-card${!isTeam ? " current" : ""}" role="listitem">
        <div class="plan-top">
          <div>
            <h3 class="plan-name">Local</h3>
            <p class="plan-price">$0 <small>/ forever</small></p>
          </div>
          ${!isTeam ? `<span class="billing-badge live"><span class="dot"></span>Active</span>` : ""}
        </div>
        <p class="plan-copy">Run Morph locally with Studio reviews, repair loops, and merge gate receipts on your machine.</p>
        <ul class="plan-features">
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>Local CLI &amp; Studio</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>10 reviews / month</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>JSON receipts &amp; stored runs</li>
        </ul>
        <button type="button" class="billing-btn ghost" ${!isTeam ? "disabled aria-disabled=\"true\"" : ""}>${!isTeam ? "Current plan" : "Downgrade"}</button>
      </article>
      <article class="plan-card featured${isTeam ? " current" : ""}" role="listitem">
        <div class="plan-top">
          <div>
            <h3 class="plan-name">Team</h3>
            <p class="plan-price">$29 <small>/ seat / mo</small></p>
          </div>
          ${isTeam ? `<span class="billing-badge team"><span class="dot"></span>Active</span>` : `<span class="billing-badge"><span class="dot"></span>Recommended</span>`}
        </div>
        <p class="plan-copy">Shared Studio reviews, live Stripe checkout, webhook-verified subscriptions, and team billing receipts.</p>
        <ul class="plan-features">
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>Unlimited reviews &amp; loops</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>Stripe Checkout &amp; webhooks</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>Shared workspace billing</li>
        </ul>
        ${upgradeBtn}
      </article>
    </div>
    <div class="billing-panel" aria-labelledby="billingUsageTitle">
      <div class="billing-panel-head">
        <h3 id="billingUsageTitle">Usage this period</h3>
        <span class="hint">Resets monthly</span>
      </div>
      <div class="billing-table-wrap">
        <table class="billing-table" aria-label="Usage breakdown">
          <thead><tr><th scope="col">Metric</th><th scope="col">Used</th><th scope="col">Limit</th></tr></thead>
          <tbody>${usageRows}</tbody>
        </table>
      </div>
    </div>
    <div class="billing-panel" aria-labelledby="billingInvoiceTitle">
      <div class="billing-panel-head">
        <h3 id="billingInvoiceTitle">Invoices</h3>
        <span class="hint">Powered by Stripe</span>
      </div>
      <div class="billing-table-wrap">
        <table class="billing-table" aria-label="Invoice history">
          <thead><tr><th scope="col">Date</th><th scope="col">Description</th><th scope="col">Amount</th><th scope="col">Status</th></tr></thead>
          <tbody>${invoiceRows}</tbody>
        </table>
      </div>
    </div>
    <div class="billing-panel" aria-labelledby="billingStripeTitle">
      <div class="billing-panel-head">
        <h3 id="billingStripeTitle">Stripe configuration</h3>
        <span class="hint">Saved at runtime or via <code>.env</code></span>
      </div>
      <form class="billing-form" id="billingStripeForm" aria-label="Stripe credentials">
        <label for="stripeSecretKey">Secret key
          <input id="stripeSecretKey" name="secretKey" type="password" autocomplete="off" placeholder="sk_live_… or sk_test_…" aria-describedby="stripeSecretHint">
        </label>
        <label for="stripePriceId">Price ID
          <input id="stripePriceId" name="priceId" type="text" autocomplete="off" placeholder="price_…" aria-describedby="stripePriceHint">
        </label>
        <label for="stripeWebhookSecret">Webhook secret <span style="font-weight:400;color:var(--faint,#71717a)">(optional)</span>
          <input id="stripeWebhookSecret" name="webhookSecret" type="password" autocomplete="off" placeholder="whsec_…">
        </label>
        <button type="submit" class="billing-btn primary" id="billingStripeSave">Save Stripe credentials</button>
        <p class="billing-foot" id="billingStripeStatus" role="status" hidden></p>
      </form>
    </div>
    <p class="billing-foot">Webhook endpoint: <code>POST /api/webhooks/stripe</code> · Checkout: <code>POST /api/billing/checkout</code></p>
  </section>`;
}

export function billingPageHtml(options = {}) {
  const panel = billingPanelHtml(options);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Billing · morph</title>
  <meta name="theme-color" content="#050507">
  <link rel="icon" href="${LOGO_URL}" type="image/png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      color-scheme: dark;
      --bg: #050507;
      --ink: #fafafa;
      --muted: #a1a1aa;
      --faint: #71717a;
      --line: rgba(255, 255, 255, 0.07);
      --line-strong: rgba(255, 255, 255, 0.13);
      --brand-a: #818cf8;
      --cyan: #22d3ee;
      --ok: #4ade80;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      min-height: 100dvh;
      background: var(--bg);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: -1;
      pointer-events: none;
      background:
        radial-gradient(ellipse 60% 45% at 15% 10%, rgba(129, 140, 248, 0.14), transparent 65%),
        radial-gradient(ellipse 50% 40% at 85% 20%, rgba(34, 211, 238, 0.06), transparent 65%),
        var(--bg);
    }
    .page {
      width: min(960px, 100%);
      margin: 0 auto;
      padding: clamp(28px, 5vw, 56px) clamp(20px, 4vw, 40px) 80px;
    }
    .top-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: clamp(28px, 5vw, 44px);
    }
    .top-nav a {
      color: var(--faint);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition: color 0.2s ease;
    }
    .top-nav a:hover { color: var(--ink); }
    .top-nav a:focus-visible {
      outline: 2px solid var(--cyan);
      outline-offset: 3px;
      border-radius: 8px;
    }
    .brand-mini {
      display: inline-flex;
      align-items: center;
      text-decoration: none;
    }
    .brand-mini .logo {
      display: block;
      height: 24px;
      width: auto;
    }
    ${billingStyles()}
  </style>
</head>
<body>
  <div class="backdrop" aria-hidden="true"></div>
  <div class="page">
    <nav class="top-nav" aria-label="Billing navigation">
      ${brandLink("/studio", { className: "brand-mini", height: 24 })}
      <a href="/studio">← Back to Studio</a>
    </nav>
    ${panel}
  </div>
</body>
</html>`;
}

function escapeBillingHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
