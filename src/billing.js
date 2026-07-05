import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { brandLink, brandStyles, headLinks, headerBarStyles } from "./brand.js";
import {
  CHROME_THEME_COLOR,
  backdropHtml,
  backdropStyles,
  chromeReset,
  chromeTokens
} from "./chrome.js";

export function createBillingManager(config) {
  function getBillingMode() {
    return config.billing?.mode ?? "local";
  }

  return { getBillingMode };
}

export function defaultBillingState() {
  return {
    plan: "local",
    status: "free",
    customerEmail: null,
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
    .billing-foot {
      font-size: 13px;
      color: var(--faint, #71717a);
      line-height: 1.6;
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

export function billingPanelHtml({ subscription = {} } = {}) {
  const plan = subscription.plan ?? "local";
  const status = subscription.status ?? "free";
  const email = subscription.customerEmail ?? null;
  const isTeam = plan === "team" && (status === "active" || status === "trialing");
  const planBadge = isTeam
    ? `<span class="billing-badge team"><span class="dot"></span>Team plan</span>`
    : `<span class="billing-badge"><span class="dot"></span>Local plan</span>`;

  const upgradeBtn = isTeam
    ? `<button type="button" class="billing-btn ghost" disabled aria-disabled="true">Current plan</button>`
    : `<button type="button" class="billing-btn primary" disabled aria-disabled="true">Team checkout coming soon</button>`;

  const usageRows = isTeam
    ? `<tr><td>Studio reviews</td><td class="mono">42</td><td>Unlimited</td></tr>
       <tr><td>Repair loops</td><td class="mono">18</td><td>Unlimited</td></tr>
       <tr><td>Stored runs</td><td class="mono">156</td><td>Unlimited</td></tr>`
    : `<tr><td>Studio reviews</td><td class="mono">8</td><td>10 / mo</td></tr>
       <tr><td>Repair loops</td><td class="mono">3</td><td>5 / mo</td></tr>
       <tr><td>Stored runs</td><td class="mono">24</td><td>50 max</td></tr>`;

  const invoiceRows = `<tr><td colspan="4"><div class="billing-empty">No invoices yet — team billing is not enabled in this build.</div></td></tr>`;

  const emailLine = email
    ? `<p class="billing-lede">Billing contact: <strong>${escapeBillingHtml(email)}</strong></p>`
    : "";

  return `<section class="billing" id="billingPanel" aria-labelledby="billingTitle">
    <header class="billing-head">
      <div class="billing-eyebrow"><span class="billing-eyebrow-dot"></span> Workspace billing</div>
      <h2 class="billing-title" id="billingTitle">Plans &amp; usage</h2>
      <p class="billing-lede">Manage your morph workspace plan and usage limits. Paid checkout is not wired up yet.</p>
      ${emailLine}
      <div class="billing-status" aria-label="Billing status">
        ${planBadge}
      </div>
    </header>
    <div class="billing-plans" role="list" aria-label="Available plans">
      <article class="plan-card${!isTeam ? " current" : ""}" role="listitem">
        <div class="plan-top">
          <div>
            <h3 class="plan-name">Local</h3>
            <p class="plan-price">$0 <small>/ forever</small></p>
          </div>
          ${!isTeam ? `<span class="billing-badge live"><span class="dot"></span>Active</span>` : ""}
        </div>
        <p class="plan-copy">Run morph locally with Studio reviews, repair loops, and merge gate receipts on your machine.</p>
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
        <p class="plan-copy">Shared Studio reviews, higher limits, and team billing receipts when checkout ships.</p>
        <ul class="plan-features">
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>Unlimited reviews &amp; loops</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>Shared workspace billing</li>
          <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>Priority support</li>
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
        <span class="hint">Local workspace</span>
      </div>
      <div class="billing-table-wrap">
        <table class="billing-table" aria-label="Invoice history">
          <thead><tr><th scope="col">Date</th><th scope="col">Description</th><th scope="col">Amount</th><th scope="col">Status</th></tr></thead>
          <tbody>${invoiceRows}</tbody>
        </table>
      </div>
    </div>
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
  <meta name="theme-color" content="${CHROME_THEME_COLOR}">
  ${headLinks()}
  <style>
    ${chromeTokens()}
    ${chromeReset()}
    ${backdropStyles()}
    .page {
      width: min(960px, 100%);
      margin: 0 auto;
      padding: clamp(28px, 5vw, 56px) clamp(20px, 4vw, 40px) 80px;
    }
    ${headerBarStyles()}
    .header-back {
      color: var(--faint);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition: color 0.2s ease;
    }
    .header-back:hover { color: var(--ink); }
    .header-back:focus-visible {
      outline: 2px solid var(--cyan);
      outline-offset: 3px;
      border-radius: 8px;
    }
    ${brandStyles()}
    ${billingStyles()}
  </style>
</head>
<body>
  ${backdropHtml()}
  <header class="site-header">
    <div class="shell site-header-inner">
      ${brandLink("/studio", { className: "brand-mini", height: 58 })}
      <a class="header-back" href="/studio">← Back to Studio</a>
    </div>
  </header>
  <div class="page">
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
