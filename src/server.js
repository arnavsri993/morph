import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  createReport,
  listRuns,
  loopProject,
  repairProject,
  storeRun
} from "./core.js";

export async function serveMorph(config, options = {}) {
  const host = options.host ?? config.server?.host ?? "127.0.0.1";
  const port = Number(options.port ?? config.server?.port ?? 4177);

  const server = createServer(async (request, response) => {
    try {
      if (!request.url) return sendJson(response, 400, { error: "missing_url" });
      const url = new URL(request.url, `http://${host}:${port}`);

      if (request.method === "GET" && url.pathname === "/") {
        return sendHtml(response, dashboardHtml(config));
      }

      if (request.method === "GET" && url.pathname === "/api/health") {
        return sendJson(response, 200, {
          ok: true,
          product: "Morph",
          authMode: config.auth?.mode ?? process.env.MORPH_AUTH_MODE ?? "dev",
          billingMode: config.billing?.mode ?? "stub"
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
        return sendJson(response, 200, publicConfig(config));
      }

      return sendJson(response, 404, { error: "not_found" });
    } catch (error) {
      return sendJson(response, 500, {
        error: "server_error",
        message: error.message
      });
    }
  });

  await new Promise((resolve) => server.listen(port, host, resolve));
  return {
    server,
    url: `http://${host}:${port}`
  };
}

async function readJson(request) {
  const body = await readBody(request);
  if (!body.trim()) return {};
  return JSON.parse(body);
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

function sendHtml(response, html) {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(html);
}

function publicConfig(config) {
  return {
    projectName: config.projectName,
    projectId: config.projectId ?? slugify(config.projectName),
    workspace: config.workspace,
    auth: {
      mode: config.auth?.mode ?? process.env.MORPH_AUTH_MODE ?? "dev",
      providers: ["github", "google", "email"]
    },
    billing: {
      provider: "stripe",
      configured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID),
      mode: config.billing?.mode ?? "stub"
    }
  };
}

function dashboardHtml(config) {
  const projectName = escapeHtml(config.projectName);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Morph Control Plane</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f8fb;
      --ink: #111827;
      --muted: #5b6475;
      --line: #d9dee8;
      --surface: #ffffff;
      --accent: #2563eb;
      --ok: #0f766e;
      --bad: #b42318;
      --warn: #b45309;
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
      background: rgba(255, 255, 255, 0.86);
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
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
    }
    .mark {
      width: 28px;
      height: 28px;
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
    main { padding: 28px 0 48px; }
    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
      gap: 20px;
      align-items: stretch;
    }
    h1 {
      font-size: clamp(30px, 4vw, 54px);
      line-height: 1;
      margin: 0 0 16px;
      max-width: 780px;
    }
    p { color: var(--muted); line-height: 1.55; }
    .panel {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 18px;
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
    button.primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
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
    .grid {
      display: grid;
      grid-template-columns: 260px minmax(0, 1fr);
      gap: 18px;
      margin-top: 22px;
    }
    .run {
      border-bottom: 1px solid var(--line);
      padding: 12px 0;
    }
    .run:last-child { border-bottom: 0; }
    .status-pass { color: var(--ok); }
    .status-fail { color: var(--bad); }
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
      .hero, .grid { grid-template-columns: 1fr; }
      .metrics { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header>
    <div class="bar">
      <div class="brand"><span class="mark">M</span><span>Morph</span></div>
      <span class="pill">Auth-ready · Stripe-ready · CI gate</span>
    </div>
  </header>
  <main>
    <section class="hero">
      <div>
        <h1>Design-system CI for agent-written frontend.</h1>
        <p>Morph watches AI-generated UI for token drift, component fragmentation, interaction regressions, and responsive risk. It produces receipts a reviewer can trust and patches an agent can apply.</p>
        <div class="actions">
          <button class="primary" data-action="verify">Run verify</button>
          <button data-action="loop">Run loop</button>
          <button data-action="repair">Plan repair</button>
          <button data-action="checkout">Checkout stub</button>
        </div>
      </div>
      <div class="panel">
        <div class="pill">Project</div>
        <h2>${projectName}</h2>
        <p>Workspace and billing APIs are exposed as product boundaries, while deterministic local scanning keeps the hackathon demo reliable offline.</p>
        <div class="metrics">
          <div class="metric"><strong id="score">--</strong><span>Score</span></div>
          <div class="metric"><strong id="runs">--</strong><span>Runs</span></div>
          <div class="metric"><strong id="gate">--</strong><span>Gate</span></div>
        </div>
      </div>
    </section>
    <section class="grid">
      <div class="panel">
        <h2>Runs</h2>
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
      if (report?.score !== undefined) score.textContent = report.score;
      if (report?.verdict) gate.textContent = report.verdict.toUpperCase();
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
      const action = event.target?.dataset?.action;
      if (!action) return;
      output.textContent = "Running " + action + "...";
      try {
        const route = action === "checkout" ? "/api/billing/checkout" : "/api/runs/" + action;
        const body = action === "loop" ? JSON.stringify({ apply: true }) : JSON.stringify({ apply: false });
        const payload = await api(route, { method: "POST", body });
        renderPayload(payload);
        await refreshRuns();
      } catch (error) {
        output.textContent = error.stack || error.message;
      }
    });

    refreshRuns().then(async () => {
      const health = await api("/api/health");
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
