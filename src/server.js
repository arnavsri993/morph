import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  copyFixtureForDemo,
  createReport,
  listRuns,
  loadConfig,
  loopProject,
  repairProject,
  storeRun
} from "./core.js";
import {
  AuthError,
  createAuthManager,
  loadEnvFile
} from "./auth.js";
import {
  BillingError,
  createBillingManager,
  maskSecret,
  readBillingState,
  writeBillingState
} from "./billing.js";
import { landingHtml } from "./landing.js";

export async function serveMorph(config, options = {}) {
  if (options.loadEnv !== false) {
    await loadEnvFile(options.cwd ?? process.cwd());
  }
  const host = options.host ?? config.server?.host ?? "127.0.0.1";
  const port = Number(options.port ?? config.server?.port ?? 4177);
  const runtimeAuth = {
    githubClientId: process.env.GITHUB_CLIENT_ID?.trim() || null,
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET?.trim() || null,
    googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() || null,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || null
  };
  const runtimeBilling = {
    stripeSecretKey: process.env.STRIPE_SECRET_KEY?.trim() || null,
    stripePriceId: process.env.STRIPE_PRICE_ID?.trim() || null,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim() || null
  };
  const auth = createAuthManager(config, runtimeAuth);
  const billing = createBillingManager(config, runtimeBilling);

  const server = createServer(async (request, response) => {
    let url;
    try {
      if (!request.url) return sendJson(response, 400, { error: "missing_url" });
      url = new URL(request.url, `http://${host}:${port}`);
      const session = auth.getSession(request);
      const appUrl = auth.getAppUrl(request, host, port);

      if (auth.isAuthRequired() && !session && !auth.isPublicRoute(url.pathname, request.method)) {
        if (url.pathname.startsWith("/api/")) {
          return sendJson(response, 401, { error: "unauthorized", message: "Sign in required." });
        }
        const returnTo = encodeURIComponent(`${url.pathname}${url.search}`);
        return redirect(response, `/login?returnTo=${returnTo}`);
      }

      if (request.method === "GET" && url.pathname === "/login") {
        if (session) return redirect(response, sanitizeReturnTo(url.searchParams.get("returnTo")));
        return sendHtml(response, auth.loginHtml({
          error: url.searchParams.get("error"),
          providers: auth.getProviders(),
          returnTo: sanitizeReturnTo(url.searchParams.get("returnTo"))
        }));
      }

      if (request.method === "GET" && (url.pathname === "/auth/google" || url.pathname === "/auth/github")) {
        const provider = url.pathname === "/auth/google" ? "google" : "github";
        const location = auth.startOAuth(provider, url.searchParams.get("returnTo"), appUrl);
        return redirect(response, location);
      }

      if (request.method === "GET" && url.pathname === "/auth/google/callback") {
        const result = await auth.handleOAuthCallback("google", url, appUrl);
        auth.setSession(response, result.user);
        return redirect(response, result.returnTo);
      }

      if (request.method === "GET" && url.pathname === "/auth/github/callback") {
        const result = await auth.handleOAuthCallback("github", url, appUrl);
        auth.setSession(response, result.user);
        return redirect(response, result.returnTo);
      }

      if (request.method === "GET" && url.pathname === "/auth/logout") {
        auth.clearSession(response);
        return redirect(response, "/login");
      }

      if (request.method === "GET" && url.pathname === "/api/auth/session") {
        return sendJson(response, 200, {
          authenticated: Boolean(session),
          user: session ? publicUser(session) : null,
          authMode: auth.getAuthMode(),
          providers: auth.getProviders()
        });
      }

      if (request.method === "GET" && url.pathname === "/api/auth/providers") {
        return sendJson(response, 200, { providers: auth.getProviders() });
      }

      if (request.method === "GET" && url.pathname === "/") {
        return sendHtml(response, landingHtml(config, session));
      }

      if (request.method === "GET" && (url.pathname === "/studio" || url.pathname === "/studio/")) {
        return sendHtml(response, dashboardHtml(config, session));
      }

      if (request.method === "GET" && url.pathname === "/api/health") {
        const github = getGithubCredentials(runtimeAuth);
        const google = getGoogleCredentials(runtimeAuth);
        return sendJson(response, 200, {
          ok: true,
          product: "Morph",
          authMode: auth.getAuthMode(),
          authenticated: Boolean(session),
          user: session ? publicUser(session) : null,
          billingMode: billing.getBillingMode(),
          providers: auth.getProviders(),
          github: {
            configured: isGithubConfigured(runtimeAuth),
            clientId: maskClientId(github.clientId)
          },
          google: {
            configured: isGoogleConfigured(runtimeAuth),
            clientId: maskClientId(google.clientId)
          },
          stripe: {
            checkoutConfigured: billing.isCheckoutConfigured(),
            webhookConfigured: billing.isWebhookConfigured(),
            priceId: maskSecret(billing.getStripeCredentials().priceId)
          }
        });
      }

      if (request.method === "POST" && url.pathname === "/api/auth/github") {
        if (auth.isAuthRequired() && !session) throw new HttpError(401, "unauthorized", "Sign in required.");
        const body = await readJson(request);
        const clientId = String(body.clientId ?? "").trim();
        const clientSecret = String(body.clientSecret ?? "").trim();
        if (!clientId || !clientSecret) {
          throw new HttpError(400, "missing_credentials", "GitHub client ID and client secret are required.");
        }
        runtimeAuth.githubClientId = clientId;
        runtimeAuth.githubClientSecret = clientSecret;
        process.env.GITHUB_CLIENT_ID = clientId;
        process.env.GITHUB_CLIENT_SECRET = clientSecret;
        return sendJson(response, 200, {
          ok: true,
          authMode: auth.getAuthMode(),
          providers: auth.getProviders(),
          github: {
            configured: true,
            clientId: maskClientId(clientId)
          }
        });
      }

      if (request.method === "POST" && url.pathname === "/api/auth/google") {
        if (auth.isAuthRequired() && !session) throw new HttpError(401, "unauthorized", "Sign in required.");
        const body = await readJson(request);
        const clientId = String(body.clientId ?? "").trim();
        const clientSecret = String(body.clientSecret ?? "").trim();
        if (!clientId || !clientSecret) {
          throw new HttpError(400, "missing_credentials", "Google client ID and client secret are required.");
        }
        runtimeAuth.googleClientId = clientId;
        runtimeAuth.googleClientSecret = clientSecret;
        process.env.GOOGLE_CLIENT_ID = clientId;
        process.env.GOOGLE_CLIENT_SECRET = clientSecret;
        return sendJson(response, 200, {
          ok: true,
          authMode: auth.getAuthMode(),
          providers: auth.getProviders(),
          google: {
            configured: true,
            clientId: maskClientId(clientId)
          }
        });
      }

      if (request.method === "POST" && url.pathname === "/api/billing/stripe") {
        if (auth.isAuthRequired() && !session) throw new HttpError(401, "unauthorized", "Sign in required.");
        const body = await readJson(request);
        const secretKey = String(body.secretKey ?? "").trim();
        const priceId = String(body.priceId ?? "").trim();
        const webhookSecret = String(body.webhookSecret ?? "").trim();
        if (!secretKey || !priceId) {
          throw new HttpError(400, "missing_credentials", "Stripe secret key and price ID are required.");
        }
        runtimeBilling.stripeSecretKey = secretKey;
        runtimeBilling.stripePriceId = priceId;
        process.env.STRIPE_SECRET_KEY = secretKey;
        process.env.STRIPE_PRICE_ID = priceId;
        if (webhookSecret) {
          runtimeBilling.stripeWebhookSecret = webhookSecret;
          process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
        }
        return sendJson(response, 200, {
          ok: true,
          billingMode: billing.getBillingMode(),
          stripe: {
            checkoutConfigured: billing.isCheckoutConfigured(),
            webhookConfigured: billing.isWebhookConfigured(),
            secretKey: maskSecret(secretKey),
            priceId: maskSecret(priceId)
          }
        });
      }

      if (request.method === "GET" && url.pathname === "/api/billing") {
        const state = await readBillingState(config);
        return sendJson(response, 200, {
          billingMode: billing.getBillingMode(),
          checkoutConfigured: billing.isCheckoutConfigured(),
          webhookConfigured: billing.isWebhookConfigured(),
          subscription: state
        });
      }

      if (request.method === "GET" && url.pathname === "/api/projects") {
        return sendJson(response, 200, {
          workspace: config.workspace ?? { id: "local", name: "Local Workspace" },
          projects: [
            {
              id: config.projectId ?? slugify(config.projectName),
              name: config.projectName,
              root: config.projectRoot,
              gate: config.gate ?? { minScore: 95 }
            }
          ]
        });
      }

      if (request.method === "GET" && url.pathname === "/api/runs") {
        return sendJson(response, 200, { runs: await listRuns(config) });
      }

      if (request.method === "POST" && url.pathname === "/api/runs/verify") {
        const report = await createReport(config);
        const stored = await storeRun(config, "verify", report);
        return sendJson(response, 201, { run: stored });
      }

      if (request.method === "POST" && url.pathname === "/api/runs/repair") {
        const body = await readJson(request);
        const repair = await repairProject(config, { apply: Boolean(body.apply) });
        const stored = await storeRun(config, "repair", repair);
        return sendJson(response, 201, { run: stored });
      }

      if (request.method === "POST" && url.pathname === "/api/runs/loop") {
        const body = await readJson(request);
        const loop = await loopProject(config, { apply: Boolean(body.apply) });
        const stored = await storeRun(config, "loop", loop);
        return sendJson(response, 201, { run: stored });
      }

      if (request.method === "POST" && url.pathname === "/api/studio/review") {
        const review = await runStudioReview(config);
        const stored = await storeRun(config, "studio-review", review);
        return sendJson(response, 201, { run: stored });
      }

      if (request.method === "POST" && url.pathname === "/api/billing/checkout") {
        if (!billing.isCheckoutConfigured()) {
          return sendJson(response, 200, {
            mode: "stub",
            provider: "stripe",
            message: "Checkout is stubbed until STRIPE_SECRET_KEY and STRIPE_PRICE_ID are configured. Save them in Studio or .env, then retry.",
            envRequired: ["STRIPE_SECRET_KEY", "STRIPE_PRICE_ID", "MORPH_APP_URL"]
          });
        }
        const checkout = await billing.createCheckoutSession({
          appUrl,
          customerEmail: session?.email ?? null
        });
        return sendJson(response, 200, {
          mode: "live",
          provider: "stripe",
          sessionId: checkout.id,
          url: checkout.url,
          message: "Redirect the browser to url to complete Stripe Checkout."
        });
      }

      if (request.method === "POST" && url.pathname === "/api/webhooks/stripe") {
        const body = await readBody(request);
        if (!billing.isWebhookConfigured()) {
          return sendJson(response, 200, {
            received: true,
            mode: "stub",
            bytes: Buffer.byteLength(body),
            verification: "Set STRIPE_WEBHOOK_SECRET to enable Stripe-Signature verification."
          });
        }
        billing.verifyWebhookSignature(body, request.headers["stripe-signature"]);
        let event;
        try {
          event = JSON.parse(body);
        } catch {
          throw new HttpError(400, "invalid_json", "Webhook body must be valid JSON.");
        }
        const state = billing.applyWebhookEvent(await readBillingState(config), event);
        await writeBillingState(config, state);
        return sendJson(response, 200, {
          received: true,
          mode: "live",
          verified: true,
          eventType: event.type ?? null,
          subscription: state
        });
      }

      if (request.method === "GET" && url.pathname.startsWith("/api/runs/")) {
        const runId = decodeURIComponent(url.pathname.replace("/api/runs/", ""));
        const runs = await listRuns(config);
        const run = runs.find((candidate) => candidate.id === runId);
        if (!run) return sendJson(response, 404, { error: "run_not_found" });
        return sendJson(response, 200, { run });
      }

      if (request.method === "GET" && url.pathname === "/api/config") {
        return sendJson(response, 200, publicConfig(config, runtimeAuth, billing));
      }

      return sendJson(response, 404, { error: "not_found" });
    } catch (error) {
      if (error instanceof AuthError && url && !url.pathname.startsWith("/api/")) {
        const returnTo = encodeURIComponent(sanitizeReturnTo(url.searchParams.get("returnTo")));
        return redirect(response, `/login?error=${encodeURIComponent(error.message)}&returnTo=${returnTo}`);
      }
      return sendJson(response, error.statusCode ?? 500, {
        error: error.code ?? "server_error",
        message: error.message
      });
    }
  });

  await new Promise((resolve) => server.listen(port, host, resolve));
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return {
    server,
    url: `http://${host}:${actualPort}`
  };
}

async function runStudioReview(config) {
  const studioRoot = path.join(config.configDir, ".studio-run");
  const studioProjectRoot = path.join(studioRoot, "project");
  const studioConfigPath = path.join(studioRoot, "morph.config.json");

  await mkdir(studioRoot, { recursive: true });
  await copyFixtureForDemo(config.projectRoot, studioProjectRoot);
  await writeFile(studioConfigPath, `${JSON.stringify({
    projectName: `${config.projectName} Studio Review`,
    projectId: `${config.projectId ?? slugify(config.projectName)}-studio`,
    projectRoot: "project",
    morphDir: ".morph",
    workspace: config.workspace,
    tokenFiles: config.tokenFiles,
    scan: config.scan,
    componentImports: config.componentImports,
    gate: config.gate,
    report: config.report,
    auth: config.auth,
    billing: config.billing
  }, null, 2)}\n`);

  const studioConfig = await loadConfig(studioConfigPath, studioRoot);
  const before = await createReport(studioConfig);
  const repair = await repairProject(studioConfig, { apply: true });
  const after = repair.after ?? await createReport(studioConfig);

  return {
    schemaVersion: "morph.studio-review.v1",
    generatedAt: new Date().toISOString(),
    project: config.projectName,
    isolated: true,
    sourceProjectRoot: path.relative(config.configDir, config.projectRoot),
    studioProjectRoot: path.relative(config.configDir, studioProjectRoot),
    userJourney: [
      "Inspect the Cursor-generated UI.",
      "Explain the drift in human language.",
      "Generate deterministic repair patches.",
      "Apply the repair on an isolated review copy.",
      "Return a passing merge gate with JSON receipts."
    ],
    before,
    repair: {
      runId: repair.runId,
      applied: repair.applied,
      replacements: repair.replacements,
      patches: repair.patches,
      risk: repair.risk
    },
    after,
    finalVerdict: after.verdict,
    passed: after.verdict === "pass",
    ciSummary: after.verdict === "pass"
      ? "Morph Studio review passed on an isolated copy. Source fixture remains seeded for repeat demos."
      : "Morph Studio review still fails. Escalate remaining issues before merge."
  };
}

async function readJson(request) {
  const body = await readBody(request);
  if (!body.trim()) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, "invalid_json", "Request body must be valid JSON.");
  }
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function sendHtml(response, html, status = 200, headers = {}) {
  response.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    ...headers
  });
  response.end(html);
}

function redirect(response, location, status = 302) {
  response.writeHead(status, { location, "cache-control": "no-store" });
  response.end();
}

function sanitizeReturnTo(value) {
  const returnTo = String(value ?? "/").trim();
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) return "/";
  return returnTo;
}

function publicUser(session) {
  return {
    email: session.email,
    name: session.name,
    picture: session.picture,
    provider: session.provider
  };
}

class HttpError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function getGithubCredentials(runtimeAuth) {
  return {
    clientId: runtimeAuth.githubClientId || process.env.GITHUB_CLIENT_ID?.trim() || "",
    clientSecret: runtimeAuth.githubClientSecret || process.env.GITHUB_CLIENT_SECRET?.trim() || ""
  };
}

function isGithubConfigured(runtimeAuth) {
  const { clientId, clientSecret } = getGithubCredentials(runtimeAuth);
  return Boolean(clientId && clientSecret);
}

function getGoogleCredentials(runtimeAuth) {
  return {
    clientId: runtimeAuth.googleClientId || process.env.GOOGLE_CLIENT_ID?.trim() || "",
    clientSecret: runtimeAuth.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET?.trim() || ""
  };
}

function isGoogleConfigured(runtimeAuth) {
  const { clientId, clientSecret } = getGoogleCredentials(runtimeAuth);
  return Boolean(clientId && clientSecret);
}

function maskClientId(clientId) {
  const value = String(clientId ?? "").trim();
  if (!value) return null;
  if (value.length <= 8) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function publicConfig(config, runtimeAuth, billing) {
  const github = getGithubCredentials(runtimeAuth);
  const google = getGoogleCredentials(runtimeAuth);
  return {
    projectName: config.projectName,
    projectId: config.projectId ?? slugify(config.projectName),
    workspace: config.workspace,
    auth: {
      mode: config.auth?.mode ?? process.env.MORPH_AUTH_MODE ?? "dev",
      providers: ["github", "google", "email"],
      github: {
        configured: isGithubConfigured(runtimeAuth),
        clientId: maskClientId(github.clientId)
      },
      google: {
        configured: isGoogleConfigured(runtimeAuth),
        clientId: maskClientId(google.clientId)
      }
    },
    billing: {
      provider: "stripe",
      configured: billing.isCheckoutConfigured(),
      webhookConfigured: billing.isWebhookConfigured(),
      mode: billing.getBillingMode()
    }
  };
}

function dashboardHtml(config, session) {
  const userLabel = session
    ? `${escapeHtml(session.name || session.email)} · ${escapeHtml(session.provider)}`
    : "Signed out";
  const userBlock = session
    ? `<span class="pill user-pill">${userLabel}</span><a class="logout" href="/auth/logout">Sign out</a>`
    : `<a class="logout" href="/login?returnTo=%2Fstudio">Log in</a>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Morph Studio</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f5f7fb;
      --ink: #101828;
      --muted: #667085;
      --line: #d0d8e6;
      --surface: #ffffff;
      --surface-soft: #eef4ff;
      --accent: #1f5eff;
      --accent-dark: #1746bf;
      --ok: #08746f;
      --bad: #b42318;
      --warn: #b45309;
      --shadow: 0 16px 40px rgba(16, 24, 40, 0.10);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }
    header {
      border-bottom: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.92);
      position: sticky;
      top: 0;
      backdrop-filter: blur(14px);
      z-index: 2;
    }
    .bar, main {
      width: min(1180px, calc(100vw - 32px));
      margin: 0 auto;
    }
    .bar {
      min-height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .bar-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
      color: inherit;
      text-decoration: none;
    }
    .back-link {
      color: var(--muted);
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
    }
    .back-link:hover { color: var(--ink); }
    .mark {
      width: 30px;
      height: 30px;
      border-radius: 7px;
      background: var(--ink);
      color: white;
      display: grid;
      place-items: center;
      font-size: 14px;
    }
    .pill {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 6px 10px;
      color: var(--muted);
      background: var(--surface);
      font-size: 13px;
    }
    .user-pill { color: var(--ink); }
    .logout {
      color: var(--accent);
      text-decoration: none;
      font-size: 13px;
      font-weight: 650;
    }
    .logout:hover { text-decoration: underline; }
    main { padding: 24px 0 48px; }
    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.06fr) minmax(320px, 0.94fr);
      gap: 20px;
      align-items: stretch;
    }
    h1 {
      font-size: 44px;
      line-height: 1.02;
      margin: 0 0 16px;
      max-width: 780px;
    }
    h2 { margin: 0 0 10px; font-size: 18px; }
    h3 { margin: 0 0 8px; font-size: 14px; }
    p { color: var(--muted); line-height: 1.55; margin: 0; }
    .panel {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 18px;
      box-shadow: 0 1px 0 rgba(16, 24, 40, 0.02);
    }
    .stage {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .stage-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--line);
      background: #fbfcff;
    }
    .journey {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
      margin-top: 18px;
    }
    .step {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      padding: 10px;
      min-height: 86px;
    }
    .step strong {
      display: block;
      font-size: 13px;
      margin-bottom: 5px;
    }
    .step span {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
      display: block;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 20px;
    }
    button {
      min-height: 38px;
      border-radius: 6px;
      border: 1px solid var(--line);
      background: var(--surface);
      color: var(--ink);
      padding: 0 13px;
      font-weight: 650;
      cursor: pointer;
    }
    button:hover { border-color: #98a9c8; }
    button.primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    button.primary:hover { background: var(--accent-dark); }
    .panel-tabs {
      display: flex;
      gap: 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 14px;
      background: var(--surface);
      width: fit-content;
    }
    .panel-tabs button {
      min-height: 32px;
      border: none;
      border-radius: 0;
      padding: 0 14px;
      font-size: 12.5px;
      font-weight: 650;
      color: var(--muted);
      background: transparent;
      cursor: pointer;
    }
    .panel-tabs button.active {
      background: var(--accent);
      color: #fff;
    }
    .panel-tabs button:hover:not(.active) { background: var(--surface-soft); }
    .tab-pane[hidden] { display: none; }
    .sso-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 12px;
      color: var(--accent);
      font-size: 13px;
      font-weight: 650;
      text-decoration: none;
    }
    .sso-link:hover { text-decoration: underline; }
    .sso-link[hidden] { display: none; }
    .plan-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid var(--line);
    }
    .auth-panel form {
      display: grid;
      gap: 12px;
      margin-top: 12px;
    }
    .auth-panel label {
      display: grid;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      color: var(--ink);
    }
    .auth-panel input {
      min-height: 38px;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 0 12px;
      font: inherit;
      font-weight: 400;
      color: var(--ink);
      background: #fff;
    }
    .auth-panel input:focus {
      outline: 2px solid rgba(31, 94, 255, 0.18);
      border-color: var(--accent);
    }
    .auth-status {
      font-size: 12px;
      margin-top: 4px;
    }
    .auth-status.ready { color: var(--ok); }
    .auth-status.pending { color: var(--warn); }
    .metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-top: 22px;
    }
    .metric {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
      background: var(--surface);
    }
    .metric strong {
      display: block;
      font-size: 24px;
      margin-bottom: 4px;
    }
    .compare {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 14px;
      padding: 16px;
    }
    .preview {
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
      background: #f8fafc;
    }
    .preview-title {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      background: #fff;
      font-size: 13px;
      font-weight: 700;
    }
    .mini-app {
      min-height: 268px;
      padding: 18px;
    }
    .mini-shell {
      border: 1px solid #d6dee8;
      background: #ffffff;
      padding: 16px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
    }
    .mini-shell.before {
      min-width: 460px;
      border-radius: 28px;
      padding: 29px;
      box-shadow: 0 25px 50px rgba(15, 23, 42, 0.25);
    }
    .mini-shell.after {
      min-width: 0;
      border-radius: 8px;
    }
    .mini-copy {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
    }
    .mini-copy p {
      max-width: 280px;
      font-size: 13px;
    }
    .mini-label {
      font-size: 14px;
      font-weight: 700;
      color: var(--ink);
      margin-bottom: 6px;
    }
    .bad-button {
      border: 0;
      border-radius: 28px;
      background: #7c3aed;
      color: #faf5ff;
      padding: 11px 21px;
      box-shadow: none;
      white-space: nowrap;
    }
    .good-button {
      border: 0;
      border-radius: 6px;
      background: #2563eb;
      color: #ffffff;
      padding: 10px 16px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
      white-space: nowrap;
    }
    .issue-list {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      padding: 0 16px 16px;
    }
    .issue-chip {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: #fff;
      font-size: 12px;
      line-height: 1.35;
    }
    .issue-chip strong {
      display: block;
      font-size: 13px;
      margin-bottom: 4px;
    }
    .grid {
      display: grid;
      grid-template-columns: 300px minmax(0, 1fr);
      gap: 18px;
      margin-top: 22px;
    }
    .run {
      border-bottom: 1px solid var(--line);
      padding: 12px 0;
      cursor: pointer;
    }
    .run:last-child { border-bottom: 0; }
    .status-pass { color: var(--ok); }
    .status-fail { color: var(--bad); }
    .status-stored { color: var(--muted); }
    pre {
      overflow: auto;
      margin: 0;
      min-height: 260px;
      max-height: 520px;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #0f172a;
      color: #e5edf8;
      font-size: 12px;
      line-height: 1.5;
    }
    .output-wrap { display: flex; flex-direction: column; gap: 0; }
    .output-toggle {
      display: flex;
      gap: 0;
      border: 1px solid var(--line);
      border-bottom: none;
      border-radius: 8px 8px 0 0;
      overflow: hidden;
      width: fit-content;
      background: var(--surface);
    }
    .output-toggle button {
      min-height: 30px;
      border: none;
      border-radius: 0;
      padding: 0 14px;
      font-size: 12px;
      font-weight: 600;
      color: var(--muted);
      background: transparent;
      cursor: pointer;
    }
    .output-toggle button.active {
      background: var(--accent);
      color: #fff;
    }
    .output-toggle button:hover:not(.active) { background: var(--surface-soft); }
    .output-wrap pre { border-radius: 0 8px 8px 8px; }
    .readable {
      overflow: auto;
      min-height: 260px;
      max-height: 520px;
      border: 1px solid var(--line);
      border-radius: 0 8px 8px 8px;
      background: var(--surface);
      font-size: 13px;
      line-height: 1.5;
    }
    .readable details { border-bottom: 1px solid var(--line); }
    .readable details:last-child { border-bottom: none; }
    .readable summary {
      padding: 10px 14px;
      cursor: pointer;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
      user-select: none;
      list-style: none;
    }
    .readable summary::-webkit-details-marker { display: none; }
    .readable summary::before { content: "▶"; font-size: 10px; color: var(--muted); transition: transform 0.15s; }
    .readable details[open] > summary::before { transform: rotate(90deg); }
    .readable summary .preview { color: var(--muted); font-weight: 400; font-size: 12px; }
    .readable .detail-body { padding: 0 14px 12px 28px; }
    .r-badge {
      display: inline-block;
      border-radius: 999px;
      padding: 2px 10px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .r-badge.pass { background: #dcfce7; color: var(--ok); }
    .r-badge.fail { background: #fee2e2; color: var(--bad); }
    .r-badge.high { background: #fee2e2; color: var(--bad); }
    .r-badge.medium { background: #fef3c7; color: var(--warn); }
    .r-badge.low { background: #f1f5f9; color: var(--muted); }
    .score-bar-wrap { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
    .score-bar { height: 8px; border-radius: 999px; background: var(--line); flex: 1; overflow: hidden; }
    .score-bar-fill { height: 100%; border-radius: 999px; }
    .score-bar-fill.good { background: var(--ok); }
    .score-bar-fill.warn { background: var(--warn); }
    .score-bar-fill.bad { background: var(--bad); }
    .r-chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .r-chip { border: 1px solid var(--line); border-radius: 6px; padding: 4px 10px; font-size: 12px; }
    .r-kv { display: grid; grid-template-columns: 140px 1fr; gap: 4px 12px; }
    .r-kv dt { color: var(--muted); font-size: 12px; }
    .r-kv dd { margin: 0; font-size: 12px; }
    .r-issue {
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 8px;
      background: var(--surface);
    }
    .r-issue:last-child { margin-bottom: 0; }
    .r-issue-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-weight: 600; font-size: 13px; }
    .r-issue dl { margin: 0; }
    .r-list { padding-left: 18px; margin: 0; }
    .r-list li { margin-bottom: 4px; font-size: 12px; }
    .r-text { font-size: 12px; color: var(--ink); white-space: pre-wrap; word-break: break-word; }
    @media (max-width: 820px) {
      h1 { font-size: 34px; }
      .hero, .grid, .compare, .journey, .issue-list { grid-template-columns: 1fr; }
      .metrics { grid-template-columns: 1fr 1fr 1fr; }
      .mini-shell.before { min-width: 0; }
      .mini-copy { flex-direction: column; }
    }
  </style>
</head>
<body>
  <header>
    <div class="bar">
      <a class="brand" href="/" title="Back to morph.dev"><span class="mark">M</span><span>Morph Studio</span></a>
      <div class="bar-actions">
        <a class="back-link" href="/">← Landing page</a>
        <span class="pill">Interactive PR review for AI-generated frontend</span>
        ${userBlock}
      </div>
    </div>
  </header>
  <main>
    <section class="hero">
      <div>
        <h1>Review AI-generated UI before it wastes your team’s time.</h1>
        <p>Cursor can ship a billing screen in seconds. The hard part is knowing whether that screen belongs in your product. Morph turns frontend review into an interactive journey: inspect the agent output, hear the design critique, apply the repair, and ship the branch with receipts.</p>
        <div class="actions">
          <button class="primary" data-action="studio-review">Run full review</button>
          <button data-action="verify">Inspect agent UI</button>
          <button data-action="repair">Generate fix plan</button>
          <button data-action="studio-review">Apply fix</button>
        </div>
        <div class="bar-actions" style="justify-content: flex-start; margin: 14px 0 0;">
          <span class="pill">Score: <strong id="score">–</strong></span>
          <span class="pill">Gate: <strong id="gate">–</strong></span>
          <span class="pill">Runs stored: <strong id="runs">0</strong></span>
          <span class="pill">State: <strong id="reviewState">Idle</strong></span>
        </div>
        <div class="journey">
          <div class="step"><strong>1. Agent ships</strong><span>A generated billing card compiles, but breaks the product grammar.</span></div>
          <div class="step"><strong>2. Morph reviews</strong><span>Token drift, component reuse, focus states, and mobile risk become receipts.</span></div>
          <div class="step"><strong>3. Repair applies</strong><span>Deterministic patches snap the UI back into the system.</span></div>
          <div class="step"><strong>4. Human decides</strong><span>The reviewer sees the before, after, score, and JSON proof in one place.</span></div>
        </div>
      </div>
      <div class="panel auth-panel">
        <div class="panel-tabs" role="tablist" aria-label="Connect providers">
          <button type="button" class="active" data-tab="github" role="tab" aria-selected="true">GitHub</button>
          <button type="button" data-tab="google" role="tab" aria-selected="false">Google</button>
          <button type="button" data-tab="stripe" role="tab" aria-selected="false">Billing</button>
        </div>

        <div class="tab-pane" data-pane="github">
          <h2>GitHub OAuth</h2>
          <p>Enter your GitHub OAuth app credentials. Morph uses these at runtime instead of static <code>.env</code> values.</p>
          <form id="githubAuthForm">
            <label for="githubClientId">GitHub client ID</label>
            <input id="githubClientId" name="clientId" type="text" required autocomplete="off" placeholder="Ov23li...">
            <label for="githubClientSecret">GitHub client secret</label>
            <input id="githubClientSecret" name="clientSecret" type="password" required autocomplete="off" placeholder="ghp_...">
            <button type="submit" class="primary">Save credentials</button>
            <p id="authStatus" class="auth-status pending">Credentials required before GitHub sign-in is enabled.</p>
          </form>
          <a class="sso-link" id="githubSignIn" href="/auth/github?returnTo=%2Fstudio" hidden>Sign in with GitHub →</a>
        </div>

        <div class="tab-pane" data-pane="google" hidden>
          <h2>Google OAuth</h2>
          <p>Enter your Google OAuth client credentials (Web application type, redirect URI <code>/auth/google/callback</code>).</p>
          <form id="googleAuthForm">
            <label for="googleClientId">Google client ID</label>
            <input id="googleClientId" name="clientId" type="text" required autocomplete="off" placeholder="1234-abc.apps.googleusercontent.com">
            <label for="googleClientSecret">Google client secret</label>
            <input id="googleClientSecret" name="clientSecret" type="password" required autocomplete="off" placeholder="GOCSPX-...">
            <button type="submit" class="primary">Save credentials</button>
            <p id="googleStatus" class="auth-status pending">Credentials required before Google sign-in is enabled.</p>
          </form>
          <a class="sso-link" id="googleSignIn" href="/auth/google?returnTo=%2Fstudio" hidden>Sign in with Google →</a>
        </div>

        <div class="tab-pane" data-pane="stripe" hidden>
          <h2>Stripe billing</h2>
          <p>Save Stripe keys to switch checkout from stub to live mode. Webhooks update the workspace plan with signature verification.</p>
          <form id="stripeForm">
            <label for="stripeSecretKey">Secret key</label>
            <input id="stripeSecretKey" name="secretKey" type="password" required autocomplete="off" placeholder="sk_test_...">
            <label for="stripePriceId">Price ID</label>
            <input id="stripePriceId" name="priceId" type="text" required autocomplete="off" placeholder="price_...">
            <label for="stripeWebhookSecret">Webhook secret (optional)</label>
            <input id="stripeWebhookSecret" name="webhookSecret" type="password" autocomplete="off" placeholder="whsec_...">
            <button type="submit" class="primary">Save Stripe config</button>
            <p id="stripeStatus" class="auth-status pending">Checkout runs in stub mode until keys are saved.</p>
          </form>
          <div class="plan-row">
            <span class="pill">Plan: <strong id="planLabel">Local · free</strong></span>
            <button class="primary" id="upgradeButton" type="button">Upgrade to Team</button>
          </div>
        </div>
      </div>
    </section>

    <section class="grid">
      <div class="panel">
        <h2>Review history</h2>
        <div id="runList">Loading...</div>
      </div>
      <div class="output-wrap">
        <div class="output-toggle">
          <button id="toggleJson" class="active" data-mode="json">JSON</button>
          <button id="toggleReadable" data-mode="readable">Readable</button>
        </div>
        <pre id="output">Loading Morph control plane...</pre>
        <div id="outputReadable" class="readable" style="display:none"></div>
      </div>
    </section>
  </main>
  <script>
    const output = document.querySelector("#output");
    const outputReadable = document.querySelector("#outputReadable");
    const runList = document.querySelector("#runList");
    const score = document.querySelector("#score");
    const runs = document.querySelector("#runs");
    const gate = document.querySelector("#gate");
    const reviewState = document.querySelector("#reviewState");
    const githubAuthForm = document.querySelector("#githubAuthForm");
    const githubClientId = document.querySelector("#githubClientId");
    const githubClientSecret = document.querySelector("#githubClientSecret");
    const authStatus = document.querySelector("#authStatus");
    const githubSignIn = document.querySelector("#githubSignIn");
    const googleAuthForm = document.querySelector("#googleAuthForm");
    const googleClientId = document.querySelector("#googleClientId");
    const googleClientSecret = document.querySelector("#googleClientSecret");
    const googleStatus = document.querySelector("#googleStatus");
    const googleSignIn = document.querySelector("#googleSignIn");
    const stripeForm = document.querySelector("#stripeForm");
    const stripeSecretKey = document.querySelector("#stripeSecretKey");
    const stripePriceId = document.querySelector("#stripePriceId");
    const stripeWebhookSecret = document.querySelector("#stripeWebhookSecret");
    const stripeStatus = document.querySelector("#stripeStatus");
    const planLabel = document.querySelector("#planLabel");
    const upgradeButton = document.querySelector("#upgradeButton");
    const GITHUB_AUTH_KEY = "morph.github.oauth";
    const GOOGLE_AUTH_KEY = "morph.google.oauth";

    document.querySelectorAll(".panel-tabs [data-tab]").forEach((tabButton) => {
      tabButton.addEventListener("click", () => {
        document.querySelectorAll(".panel-tabs [data-tab]").forEach((candidate) => {
          const active = candidate === tabButton;
          candidate.classList.toggle("active", active);
          candidate.setAttribute("aria-selected", active ? "true" : "false");
        });
        document.querySelectorAll(".tab-pane").forEach((pane) => {
          pane.hidden = pane.dataset.pane !== tabButton.dataset.tab;
        });
      });
    });

    let outputMode = "json";
    let lastPayload = null;

    document.querySelector("#toggleJson").addEventListener("click", () => setOutputMode("json"));
    document.querySelector("#toggleReadable").addEventListener("click", () => setOutputMode("readable"));

    function setOutputMode(mode) {
      outputMode = mode;
      document.querySelector("#toggleJson").className = mode === "json" ? "active" : "";
      document.querySelector("#toggleReadable").className = mode === "readable" ? "active" : "";
      if (lastPayload !== null) {
        applyOutputMode(lastPayload);
      }
    }

    function applyOutputMode(payload) {
      if (outputMode === "readable") {
        output.style.display = "none";
        outputReadable.style.display = "";
        outputReadable.innerHTML = renderReadable(payload);
      } else {
        outputReadable.style.display = "none";
        output.style.display = "";
        output.textContent = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
      }
    }

    function badge(text, cls) {
      return '<span class="r-badge ' + cls + '">' + esc(String(text)) + '</span>';
    }

    function esc(s) {
      return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    }

    function renderReadable(payload) {
      if (typeof payload !== "object" || payload === null) {
        return '<div style="padding:14px"><span class="r-text">' + esc(String(payload)) + '</span></div>';
      }
      const run = payload?.run;
      const rp = run?.payload;
      if (rp?.schemaVersion === "morph.studio-review.v1") return renderStudioReview(run, rp);
      if (rp) return renderReportBody(rp);
      // Fallback: generic sections for health-check / other flat payloads
      let html = "";
      for (const [key, val] of Object.entries(payload)) html += renderSection(key, val);
      return html;
    }

    // ── Studio-review renderer ────────────────────────────────────────────────

    function renderStudioReview(run, p) {
      const before = p.before;
      const after  = p.after;
      const repair = p.repair;
      const vCls   = p.finalVerdict === "pass" ? "pass" : "fail";

      let html = '<div style="padding:14px 14px 10px;border-bottom:1px solid var(--line)">';
      // Overall verdict + summary line
      html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">';
      html += badge(p.finalVerdict || "unknown", vCls);
      html += '<span style="color:var(--muted);font-size:12px">' + esc(p.ciSummary || "") + '</span>';
      html += '</div>';
      // Pipeline strip: Before → Repair → After
      html += '<div style="display:flex;gap:8px;align-items:center;font-size:12px;flex-wrap:wrap">';
      html += pipelineStep("Before", before?.verdict, before?.score);
      html += '<span style="color:var(--muted)">→</span>';
      html += '<span style="color:var(--muted)">' + esc(String(repair?.replacements ?? 0)) + ' fixes applied</span>';
      html += '<span style="color:var(--muted)">→</span>';
      html += pipelineStep("After", after?.verdict, after?.score);
      html += '</div>';
      html += '</div>';

      // Before section (open by default when there are issues)
      const hasIssues = Array.isArray(before?.issues) && before.issues.length > 0;
      html += '<details' + (hasIssues ? " open" : "") + '>';
      html += '<summary>Before review <span class="preview">' + badge(before?.verdict || "?", before?.verdict === "pass" ? "pass" : "fail") + ' &nbsp;' + esc(String(before?.score ?? "?")) + '/100</span></summary>';
      html += '<div class="detail-body">' + renderReportBody(before) + '</div></details>';

      // Repair section
      html += '<details><summary>Repair <span class="preview">' + esc(String(repair?.replacements ?? 0)) + ' replacements applied</span></summary>';
      html += '<div class="detail-body">' + renderRepairBody(repair) + '</div></details>';

      // After section
      html += '<details><summary>After repair <span class="preview">' + badge(after?.verdict || "?", after?.verdict === "pass" ? "pass" : "fail") + ' &nbsp;' + esc(String(after?.score ?? "?")) + '/100</span></summary>';
      html += '<div class="detail-body">' + renderReportBody(after) + '</div></details>';

      // User journey
      if (Array.isArray(p.userJourney) && p.userJourney.length) {
        html += '<details><summary>User journey <span class="preview">' + p.userJourney.length + ' steps</span></summary>';
        html += '<div class="detail-body"><ul class="r-list">' + p.userJourney.map(s => '<li>' + esc(s) + '</li>').join("") + '</ul></div></details>';
      }

      return html;
    }

    function pipelineStep(label, verdict, score) {
      const cls = verdict === "pass" ? "pass" : "fail";
      return '<span>' + esc(label) + ': ' + badge(verdict || "?", cls) + ' <strong>' + esc(String(score ?? "?")) + '</strong>/100</span>';
    }

    // ── Report body (shared by before/after and plain verify runs) ────────────

    function renderReportBody(report) {
      if (!report) return '<span class="r-text">No data.</span>';
      let html = '';

      // Score bar
      const n = Number(report.score);
      const sc = n >= 95 ? "good" : n >= 70 ? "warn" : "bad";
      html += '<div class="score-bar-wrap" style="margin-bottom:10px">';
      html += '<strong>' + esc(String(report.score ?? "?")) + ' / 100</strong>';
      html += '<div class="score-bar"><div class="score-bar-fill ' + sc + '" style="width:' + Math.max(0, Math.min(100, n)) + '%"></div></div>';
      html += '</div>';

      // Summary chips
      if (report.summary) {
        const s = report.summary;
        html += '<div class="r-chips" style="margin-bottom:10px">';
        if (s.high)   html += '<span class="r-chip"><span style="color:var(--bad)">●</span> ' + s.high + ' high</span>';
        if (s.medium) html += '<span class="r-chip"><span style="color:var(--warn)">●</span> ' + s.medium + ' medium</span>';
        if (s.low)    html += '<span class="r-chip"><span style="color:var(--muted)">●</span> ' + s.low + ' low</span>';
        if (!s.high && !s.medium && !s.low) html += '<span class="r-chip" style="color:var(--ok)">No issues</span>';
        html += '</div>';
      }

      // Gate
      if (report.gate) {
        const g = report.gate;
        html += '<div style="margin-bottom:10px;font-size:12px">';
        html += 'Merge gate: ' + badge(g.passed ? "passed" : "blocked", g.passed ? "pass" : "fail");
        html += ' &nbsp;threshold ' + esc(String(g.threshold)) + '/100';
        html += '</div>';
      }

      // Issues
      if (Array.isArray(report.issues) && report.issues.length > 0) {
        html += report.issues.map(issue => {
          const sev = String(issue.severity || "low").toLowerCase();
          return '<div class="r-issue">' +
            '<div class="r-issue-head">' + badge(issue.severity, sev) + ' <span>' + esc(issue.id || "") + '</span></div>' +
            '<dl class="r-kv">' +
            (issue.file ? '<dt>File</dt><dd>' + esc(issue.file) + (issue.line ? ':' + issue.line : '') + '</dd>' : '') +
            (issue.reason ? '<dt>Reason</dt><dd>' + esc(issue.reason) + '</dd>' : '') +
            (issue.suggestedFix ? '<dt>Fix</dt><dd>' + esc(issue.suggestedFix) + '</dd>' : '') +
            '</dl>' +
            '</div>';
        }).join("");
      } else if (Array.isArray(report.issues)) {
        html += '<span class="r-text" style="color:var(--ok)">✓ No issues found.</span>';
      }

      // Next actions
      if (Array.isArray(report.nextActions) && report.nextActions.length) {
        html += '<ul class="r-list" style="margin-top:10px">' + report.nextActions.map(a => '<li>' + esc(a) + '</li>').join("") + '</ul>';
      }

      return html;
    }

    // ── Repair body ───────────────────────────────────────────────────────────

    function renderRepairBody(repair) {
      if (!repair) return '<span class="r-text">No repair data.</span>';
      let html = '<dl class="r-kv" style="margin-bottom:10px">';
      html += '<dt>Applied</dt><dd>' + (repair.applied ? '<span style="color:var(--ok)">Yes</span>' : '<span style="color:var(--bad)">No</span>') + '</dd>';
      html += '<dt>Replacements</dt><dd>' + esc(String(repair.replacements)) + '</dd>';
      html += '<dt>Risk</dt><dd>' + esc(repair.risk || "unknown") + '</dd>';
      html += '</dl>';
      if (Array.isArray(repair.patches) && repair.patches.length) {
        html += '<strong style="font-size:12px;display:block;margin-bottom:4px">Patched files</strong>';
        html += '<ul class="r-list">' + repair.patches.map(p => '<li>' + esc(p.file) + ' (' + (p.replacements?.length || 0) + ' replacements)</li>').join("") + '</ul>';
      }
      return html;
    }

    // ── Generic section renderer (fallback for health-check / unknown shapes) ─

    function renderSection(key, val) {
      let preview = "", body = "";
      if (key === "verdict") {
        const cls = String(val).toLowerCase() === "pass" ? "pass" : "fail";
        preview = badge(val, cls); body = badge(val, cls);
      } else if (key === "score") {
        const n = Number(val), cls = n >= 95 ? "good" : n >= 70 ? "warn" : "bad";
        preview = '<span class="preview">' + esc(String(val)) + '/100</span>';
        body = '<div class="score-bar-wrap"><strong>' + esc(String(val)) + ' / 100</strong><div class="score-bar"><div class="score-bar-fill ' + cls + '" style="width:' + Math.max(0,Math.min(100,n)) + '%"></div></div></div>';
      } else if (typeof val === "boolean") {
        preview = '<span class="preview">' + val + '</span>';
        body = val ? '<span style="color:var(--ok)">true</span>' : '<span style="color:var(--bad)">false</span>';
      } else if (Array.isArray(val)) {
        preview = '<span class="preview">[' + val.length + ']</span>';
        body = '<ul class="r-list">' + val.map(v => '<li>' + esc(typeof v === "object" ? JSON.stringify(v) : String(v)) + '</li>').join("") + '</ul>';
      } else if (typeof val === "object" && val !== null) {
        const entries = Object.entries(val);
        preview = '<span class="preview">' + entries.length + ' keys</span>';
        body = '<dl class="r-kv">' + entries.map(([k,v]) => '<dt>' + esc(k) + '</dt><dd>' + esc(typeof v === "object" ? JSON.stringify(v) : String(v)) + '</dd>').join("") + '</dl>';
      } else {
        const s = String(val); preview = '<span class="preview">' + esc(s.slice(0,60)) + (s.length > 60 ? "…" : "") + '</span>';
        body = '<span class="r-text">' + esc(s) + '</span>';
      }
      return '<details><summary>' + esc(key) + ' ' + preview + '</summary><div class="detail-body">' + body + '</div></details>';
    }

    const narration = "Morph Studio reviews a Cursor generated billing screen before it reaches a teammate. The first version compiles, but it introduces hardcoded color, rogue radius, raw button markup, missing focus state, and mobile overflow risk. Morph creates file-level receipts, applies deterministic repairs, and returns a passing merge gate.";

    function readStoredAuth(key) {
      try {
        return JSON.parse(localStorage.getItem(key) || "null");
      } catch {
        return null;
      }
    }

    function storeAuth(key, clientId, clientSecret) {
      localStorage.setItem(key, JSON.stringify({ clientId, clientSecret }));
    }

    function renderProviderStatus(statusElement, signInElement, providerLabel, configured, clientId) {
      if (!statusElement) return;
      if (configured) {
        statusElement.textContent = clientId
          ? providerLabel + " OAuth ready (" + clientId + ")."
          : providerLabel + " OAuth ready.";
        statusElement.className = "auth-status ready";
        if (signInElement) signInElement.hidden = false;
      } else {
        statusElement.textContent = "Credentials required before " + providerLabel + " sign-in is enabled.";
        statusElement.className = "auth-status pending";
        if (signInElement) signInElement.hidden = true;
      }
    }

    function renderAuthStatus(configured, clientId) {
      renderProviderStatus(authStatus, githubSignIn, "GitHub", configured, clientId);
    }

    function renderGoogleStatus(configured, clientId) {
      renderProviderStatus(googleStatus, googleSignIn, "Google", configured, clientId);
    }

    function renderStripeStatus(checkoutConfigured, webhookConfigured) {
      if (!stripeStatus) return;
      if (checkoutConfigured) {
        stripeStatus.textContent = webhookConfigured
          ? "Stripe live: checkout + verified webhooks enabled."
          : "Stripe live: checkout enabled. Add a webhook secret to sync plan state.";
        stripeStatus.className = "auth-status ready";
      } else {
        stripeStatus.textContent = "Checkout runs in stub mode until keys are saved.";
        stripeStatus.className = "auth-status pending";
      }
    }

    function renderPlan(subscription) {
      if (!planLabel || !subscription) return;
      const plan = subscription.plan === "team" ? "Team" : "Local";
      planLabel.textContent = plan + " · " + (subscription.status || "free");
    }

    async function saveGithubAuth(clientId, clientSecret) {
      const payload = await api("/api/auth/github", {
        method: "POST",
        body: JSON.stringify({ clientId, clientSecret })
      });
      storeAuth(GITHUB_AUTH_KEY, clientId, clientSecret);
      renderAuthStatus(true, payload.github?.clientId);
      return payload;
    }

    async function saveGoogleAuth(clientId, clientSecret) {
      const payload = await api("/api/auth/google", {
        method: "POST",
        body: JSON.stringify({ clientId, clientSecret })
      });
      storeAuth(GOOGLE_AUTH_KEY, clientId, clientSecret);
      renderGoogleStatus(true, payload.google?.clientId);
      return payload;
    }

    async function refreshBilling() {
      try {
        const payload = await api("/api/billing");
        renderStripeStatus(payload.checkoutConfigured, payload.webhookConfigured);
        renderPlan(payload.subscription);
        return payload;
      } catch {
        return null;
      }
    }

    async function api(path, options) {
      const response = await fetch(path, {
        headers: { "content-type": "application/json" },
        ...options
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Request failed");
      return payload;
    }

    function renderPayload(payload) {
      lastPayload = payload;
      applyOutputMode(payload);
      const report = payload.run?.payload?.after || payload.run?.payload;
      const loop = payload.run?.payload;
      if (report?.score !== undefined) score.textContent = report.score;
      if (report?.verdict) gate.textContent = report.verdict.toUpperCase();
      if (loop?.finalVerdict) gate.textContent = loop.finalVerdict.toUpperCase();
      reviewState.textContent = gate.textContent === "PASS" ? "Repaired" : "Needs review";
    }

    async function refreshRuns() {
      const payload = await api("/api/runs");
      runs.textContent = payload.runs.length;
      runList.innerHTML = payload.runs.length ? "" : "No runs stored yet.";
      for (const run of payload.runs.slice(0, 8)) {
        const verdict = run.payload?.finalVerdict || run.payload?.verdict || run.payload?.after?.verdict || "stored";
        const div = document.createElement("div");
        div.className = "run";
        div.innerHTML = "<strong>" + run.kind + "</strong><br><span class='status-" + verdict + "'>" + verdict + "</span><br><small>" + run.id + "</small>";
        div.addEventListener("click", () => renderPayload({ run }));
        runList.appendChild(div);
      }
    }

    document.addEventListener("click", async (event) => {
      if (event.target?.dataset?.speak) {
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(new SpeechSynthesisUtterance(narration));
        } else {
          lastPayload = null;
          output.style.display = "";
          outputReadable.style.display = "none";
          output.textContent = narration;
        }
        return;
      }

      const action = event.target?.dataset?.action;
      if (!action) return;
      lastPayload = null;
      output.style.display = "";
      outputReadable.style.display = "none";
      output.textContent = "Running " + action + "...";
      reviewState.textContent = "Running";
      try {
        const route = action === "checkout"
          ? "/api/billing/checkout"
          : action === "studio-review"
            ? "/api/studio/review"
            : "/api/runs/" + action;
        const shouldApply = action === "loop" || event.target?.dataset?.apply === "true";
        const body = JSON.stringify({ apply: shouldApply });
        const payload = await api(route, { method: "POST", body });
        renderPayload(payload);
        await refreshRuns();
      } catch (error) {
        lastPayload = null;
        output.style.display = "";
        outputReadable.style.display = "none";
        output.textContent = error.stack || error.message;
      }
    });

    githubAuthForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const clientId = githubClientId.value.trim();
      const clientSecret = githubClientSecret.value.trim();
      if (!clientId || !clientSecret) {
        renderAuthStatus(false);
        return;
      }
      authStatus.textContent = "Saving GitHub credentials...";
      authStatus.className = "auth-status pending";
      try {
        const payload = await saveGithubAuth(clientId, clientSecret);
        renderPayload(payload);
      } catch (error) {
        renderAuthStatus(false);
        lastPayload = null;
        output.style.display = "";
        outputReadable.style.display = "none";
        output.textContent = error.stack || error.message;
      }
    });

    googleAuthForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const clientId = googleClientId.value.trim();
      const clientSecret = googleClientSecret.value.trim();
      if (!clientId || !clientSecret) {
        renderGoogleStatus(false);
        return;
      }
      googleStatus.textContent = "Saving Google credentials...";
      googleStatus.className = "auth-status pending";
      try {
        const payload = await saveGoogleAuth(clientId, clientSecret);
        renderPayload(payload);
      } catch (error) {
        renderGoogleStatus(false);
        lastPayload = null;
        output.style.display = "";
        outputReadable.style.display = "none";
        output.textContent = error.stack || error.message;
      }
    });

    stripeForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const secretKey = stripeSecretKey.value.trim();
      const priceId = stripePriceId.value.trim();
      const webhookSecret = stripeWebhookSecret.value.trim();
      if (!secretKey || !priceId) {
        renderStripeStatus(false, false);
        return;
      }
      stripeStatus.textContent = "Saving Stripe configuration...";
      stripeStatus.className = "auth-status pending";
      try {
        const payload = await api("/api/billing/stripe", {
          method: "POST",
          body: JSON.stringify({ secretKey, priceId, webhookSecret })
        });
        renderStripeStatus(Boolean(payload.stripe?.checkoutConfigured), Boolean(payload.stripe?.webhookConfigured));
        renderPayload(payload);
      } catch (error) {
        renderStripeStatus(false, false);
        lastPayload = null;
        output.style.display = "";
        outputReadable.style.display = "none";
        output.textContent = error.stack || error.message;
      }
    });

    upgradeButton?.addEventListener("click", async () => {
      upgradeButton.disabled = true;
      upgradeButton.textContent = "Starting checkout...";
      try {
        const payload = await api("/api/billing/checkout", { method: "POST", body: "{}" });
        if (payload.mode === "live" && payload.url) {
          window.location.href = payload.url;
          return;
        }
        renderPayload(payload);
      } catch (error) {
        lastPayload = null;
        output.style.display = "";
        outputReadable.style.display = "none";
        output.textContent = error.stack || error.message;
      } finally {
        upgradeButton.disabled = false;
        upgradeButton.textContent = "Upgrade to Team";
      }
    });

    refreshRuns().then(async () => {
      const storedGithub = readStoredAuth(GITHUB_AUTH_KEY);
      if (storedGithub?.clientId && storedGithub?.clientSecret) {
        githubClientId.value = storedGithub.clientId;
        githubClientSecret.value = storedGithub.clientSecret;
        try {
          await saveGithubAuth(storedGithub.clientId, storedGithub.clientSecret);
        } catch {
          renderAuthStatus(false);
        }
      }
      const storedGoogle = readStoredAuth(GOOGLE_AUTH_KEY);
      if (storedGoogle?.clientId && storedGoogle?.clientSecret) {
        googleClientId.value = storedGoogle.clientId;
        googleClientSecret.value = storedGoogle.clientSecret;
        try {
          await saveGoogleAuth(storedGoogle.clientId, storedGoogle.clientSecret);
        } catch {
          renderGoogleStatus(false);
        }
      }
      const health = await api("/api/health");
      renderAuthStatus(Boolean(health.github?.configured), health.github?.clientId);
      renderGoogleStatus(Boolean(health.google?.configured), health.google?.clientId);
      await refreshBilling();

      const billingResult = new URLSearchParams(window.location.search).get("billing");
      if (billingResult === "success") {
        reviewState.textContent = "Plan updated";
        renderPayload({ billing: "Stripe checkout completed. Webhook will confirm the subscription shortly." });
      } else if (billingResult === "cancelled") {
        renderPayload({ billing: "Stripe checkout was cancelled. No changes made." });
      } else {
        renderPayload(health);
      }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function slugify(value) {
  return String(value ?? "project")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "project";
}
