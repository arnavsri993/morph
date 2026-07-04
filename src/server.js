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

export async function serveMorph(config, options = {}) {
  if (options.loadEnv !== false) {
    await loadEnvFile(options.cwd ?? process.cwd());
  }
  const host = options.host ?? config.server?.host ?? "127.0.0.1";
  const port = Number(options.port ?? config.server?.port ?? 4177);
  const runtimeAuth = {
    githubClientId: process.env.GITHUB_CLIENT_ID?.trim() || null,
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET?.trim() || null
  };
  const auth = createAuthManager(config, runtimeAuth);

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
        return sendHtml(response, dashboardHtml(config, session));
      }

      if (request.method === "GET" && url.pathname === "/api/health") {
        const github = getGithubCredentials(runtimeAuth);
        return sendJson(response, 200, {
          ok: true,
          product: "Morph",
          authMode: auth.getAuthMode(),
          authenticated: Boolean(session),
          user: session ? publicUser(session) : null,
          billingMode: config.billing?.mode ?? "stub",
          providers: auth.getProviders(),
          github: {
            configured: isGithubConfigured(runtimeAuth),
            clientId: maskClientId(github.clientId)
          }
        });
      }

      if (request.method === "POST" && url.pathname === "/api/auth/github") {
        if (!session) throw new HttpError(401, "unauthorized", "Sign in required.");
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
        return sendJson(response, 200, {
          mode: "stub",
          provider: "stripe",
          message: "Checkout is stubbed until STRIPE_SECRET_KEY and STRIPE_PRICE_ID are configured.",
          envRequired: ["STRIPE_SECRET_KEY", "STRIPE_PRICE_ID", "MORPH_APP_URL"]
        });
      }

      if (request.method === "POST" && url.pathname === "/api/webhooks/stripe") {
        const body = await readBody(request);
        return sendJson(response, 200, {
          received: true,
          mode: "stub",
          bytes: Buffer.byteLength(body),
          verification: "Set STRIPE_WEBHOOK_SECRET and verify Stripe-Signature before production use."
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
        return sendJson(response, 200, publicConfig(config, runtimeAuth));
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

function maskClientId(clientId) {
  const value = String(clientId ?? "").trim();
  if (!value) return null;
  if (value.length <= 8) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function publicConfig(config, runtimeAuth) {
  const github = getGithubCredentials(runtimeAuth);
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
        configured: Boolean(
          process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()
        )
      }
    },
    billing: {
      provider: "stripe",
      configured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID),
      mode: config.billing?.mode ?? "stub"
    }
  };
}

function dashboardHtml(config, session) {
  const userLabel = session
    ? `${escapeHtml(session.name || session.email)} · ${escapeHtml(session.provider)}`
    : "Signed out";
  const userBlock = session
    ? `<span class="pill user-pill">${userLabel}</span><a class="logout" href="/auth/logout">Sign out</a>`
    : "";
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
    }
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
      <div class="brand"><span class="mark">M</span><span>Morph Studio</span></div>
      <div class="bar-actions">
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
          <button data-speak="true">Narrate review</button>
        </div>
        <div class="journey">
          <div class="step"><strong>1. Agent ships</strong><span>A generated billing card compiles, but breaks the product grammar.</span></div>
          <div class="step"><strong>2. Morph reviews</strong><span>Token drift, component reuse, focus states, and mobile risk become receipts.</span></div>
          <div class="step"><strong>3. Repair applies</strong><span>Deterministic patches snap the UI back into the system.</span></div>
          <div class="step"><strong>4. Human decides</strong><span>The reviewer sees the before, after, score, and JSON proof in one place.</span></div>
        </div>
      </div>
      <div class="panel auth-panel">
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
      </div>
    </section>

    <section class="grid">
      <div class="panel">
        <h2>Review history</h2>
        <div id="runList">Loading...</div>
      </div>
      <div>
        <pre id="output">Loading Morph control plane...</pre>
      </div>
    </section>
  </main>
  <script>
    const output = document.querySelector("#output");
    const runList = document.querySelector("#runList");
    const score = document.querySelector("#score");
    const runs = document.querySelector("#runs");
    const gate = document.querySelector("#gate");
    const reviewState = document.querySelector("#reviewState");
    const githubAuthForm = document.querySelector("#githubAuthForm");
    const githubClientId = document.querySelector("#githubClientId");
    const githubClientSecret = document.querySelector("#githubClientSecret");
    const authStatus = document.querySelector("#authStatus");
    const GITHUB_AUTH_KEY = "morph.github.oauth";

    const narration = "Morph Studio reviews a Cursor generated billing screen before it reaches a teammate. The first version compiles, but it introduces hardcoded color, rogue radius, raw button markup, missing focus state, and mobile overflow risk. Morph creates file-level receipts, applies deterministic repairs, and returns a passing merge gate.";

    function readStoredGithubAuth() {
      try {
        return JSON.parse(localStorage.getItem(GITHUB_AUTH_KEY) || "null");
      } catch {
        return null;
      }
    }

    function storeGithubAuth(clientId, clientSecret) {
      localStorage.setItem(GITHUB_AUTH_KEY, JSON.stringify({ clientId, clientSecret }));
    }

    function renderAuthStatus(configured, clientId) {
      if (!authStatus) return;
      if (configured) {
        authStatus.textContent = clientId
          ? "GitHub OAuth ready (" + clientId + ")."
          : "GitHub OAuth ready.";
        authStatus.className = "auth-status ready";
      } else {
        authStatus.textContent = "Credentials required before GitHub sign-in is enabled.";
        authStatus.className = "auth-status pending";
      }
    }

    async function saveGithubAuth(clientId, clientSecret) {
      const payload = await api("/api/auth/github", {
        method: "POST",
        body: JSON.stringify({ clientId, clientSecret })
      });
      storeGithubAuth(clientId, clientSecret);
      renderAuthStatus(true, payload.github?.clientId);
      return payload;
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
      output.textContent = JSON.stringify(payload, null, 2);
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
          output.textContent = narration;
        }
        return;
      }

      const action = event.target?.dataset?.action;
      if (!action) return;
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
        output.textContent = JSON.stringify(payload, null, 2);
      } catch (error) {
        renderAuthStatus(false);
        output.textContent = error.stack || error.message;
      }
    });

    refreshRuns().then(async () => {
      const stored = readStoredGithubAuth();
      if (stored?.clientId && stored?.clientSecret) {
        githubClientId.value = stored.clientId;
        githubClientSecret.value = stored.clientSecret;
        try {
          await saveGithubAuth(stored.clientId, stored.clientSecret);
        } catch {
          renderAuthStatus(false);
        }
      }
      const health = await api("/api/health");
      renderAuthStatus(Boolean(health.github?.configured), health.github?.clientId);
      output.textContent = JSON.stringify(health, null, 2);
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
