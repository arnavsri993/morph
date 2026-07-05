import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
import { capturePreviewUrl } from "./preview.js";
import { transformSite } from "./transform.js";
import { cloneRepo } from "./github.js";

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
        const body = await readJson(request);
        const review = await runStudioReview(config, {
          source: body.source,
          previewUrl: body.previewUrl,
          githubRepo: body.githubRepo,
          instructions: body.instructions,
          referenceImage: body.referenceImage,
          generateReference: body.generateReference
        });
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

      if (request.method === "GET" && (url.pathname === "/transformed" || url.pathname.startsWith("/transformed/"))) {
        return serveTransformedFile(response, config, url.pathname);
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

const DEFAULT_REVIEW_FILE = "src/routes/settings/billing.tsx";

async function runStudioReview(config, options = {}) {
  const instructions = String(options.instructions ?? "").trim();
  const { source, previewUrl, githubRepo } = resolveStudioSource(options);

  if (source === "github") {
    return runGithubTransformReview(config, {
      githubRepo,
      instructions,
      referenceImage: options.referenceImage,
      generateReference: options.generateReference
    });
  }

  let preview = null;
  if (source === "url") {
    preview = await capturePreviewUrl(previewUrl);
  }

  const studioRoot = path.join(config.configDir, ".studio-run");
  const studioProjectRoot = path.join(studioRoot, "project");
  const studioConfigPath = path.join(studioRoot, "morph.config.json");
  const targetFile = DEFAULT_REVIEW_FILE;

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
  const reviewFilePath = path.join(studioProjectRoot, targetFile);
  const codeBefore = await readFile(reviewFilePath, "utf8");
  const before = await createReport(studioConfig);
  const repair = await repairProject(studioConfig, { apply: true });
  const after = repair.after ?? await createReport(studioConfig);
  const codeAfter = await readFile(reviewFilePath, "utf8");

  const userJourney = [];
  if (instructions) {
    userJourney.push(`Apply agent instructions: ${instructions.length > 140 ? `${instructions.slice(0, 140)}…` : instructions}`);
  }
  if (source === "github") {
    userJourney.push(`Review agent branch from GitHub repo ${githubRepo}.`);
  }
  if (preview?.status === "captured") {
    userJourney.push("Capture live UI with Playwright.", "Compare the captured surface against design-system grammar.");
  } else if (preview?.status === "playwright_not_installed") {
    userJourney.push("Preview URL recorded; install Playwright to capture the live UI.");
  }
  userJourney.push(
    "Inspect the agent-generated UI.",
    "Explain the drift in human language.",
    "Generate deterministic repair patches.",
    "Apply the repair on an isolated review copy.",
    "Return a passing merge gate with JSON receipts."
  );

  return {
    schemaVersion: "morph.studio-review.v1",
    generatedAt: new Date().toISOString(),
    project: config.projectName,
    isolated: true,
    source,
    instructions: instructions || null,
    githubRepo: source === "github" ? githubRepo : null,
    previewUrl: source === "url" ? previewUrl : null,
    preview,
    targetFile,
    codeReview: {
      file: targetFile,
      before: codeBefore,
      after: codeAfter,
      changed: codeBefore !== codeAfter
    },
    sourceProjectRoot: path.relative(config.configDir, config.projectRoot),
    studioProjectRoot: path.relative(config.configDir, studioProjectRoot),
    userJourney,
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
      ? "morph Studio review passed on an isolated copy."
      : "morph Studio review still fails. Escalate remaining issues before merge."
  };
}

async function runGithubTransformReview(config, { githubRepo, instructions, referenceImage, generateReference }) {
  const studioRoot = path.join(config.configDir, ".studio-run");
  const checkoutRoot = path.join(studioRoot, "checkout");
  const transformedRoot = path.join(studioRoot, "transformed");
  await mkdir(studioRoot, { recursive: true });

  try {
    await cloneRepo(githubRepo, checkoutRoot);
  } catch (error) {
    throw new HttpError(422, "github_clone_failed", `Could not clone ${githubRepo}: ${error.message}`);
  }

  let transform;
  try {
    transform = await transformSite(checkoutRoot, transformedRoot, {
      instructions,
      profile: null,
      referenceImage: referenceImage || null,
      generateReference: Boolean(generateReference)
    });
  } catch (error) {
    throw new HttpError(422, "transform_failed", error.message);
  }

  const before = heuristicsAsReport(transform.before, transform.codeReview.file, config);
  const after = heuristicsAsReport(transform.after, "index.html", config);

  return {
    schemaVersion: "morph.studio-review.v1",
    generatedAt: new Date().toISOString(),
    project: config.projectName,
    isolated: true,
    source: "github",
    engine: "design_db_transform",
    instructions: instructions || null,
    githubRepo,
    previewUrl: null,
    preview: null,
    targetFile: transform.codeReview.file,
    codeReview: transform.codeReview,
    transform: {
      profile: transform.profile,
      designDatabase: transform.designDatabase,
      content: transform.content,
      improvement: transform.improvement,
      outputFiles: transform.output.files
    },
    transformedPreviewPath: "/transformed/index.html",
    userJourney: [
      `Clone agent repo ${githubRepo} (shallow).`,
      `Score the incoming UI against ${transform.designDatabase.heuristics} design-quality heuristics: ${transform.before.score}/100.`,
      "Extract the site's content: brand, navigation, hero copy, features, CTAs.",
      `Select the best-matching profile from the design intelligence database: ${transform.profile.name} (${transform.profile.inspiration}).`,
      "Re-render the site with the profile's full design system: type scale, palette, spacing rhythm, components, motion, responsive rules.",
      `Verify the transformed UI: ${transform.after.score}/100. Preview it at /transformed/index.html.`
    ],
    before,
    repair: {
      runId: null,
      applied: true,
      replacements: transform.before.findings.length,
      patches: [{ file: "index.html", replacements: [] }, { file: "morph-theme.css", replacements: [] }],
      risk: "full_rerender_from_design_database"
    },
    after,
    finalVerdict: after.verdict,
    passed: after.verdict === "pass",
    ciSummary: transform.summary
  };
}

function heuristicsAsReport(assessment, file, config) {
  const threshold = config.gate?.minScore ?? 95;
  const verdict = assessment.score >= threshold && assessment.findings.length === 0 ? "pass" : "fail";
  return {
    verdict,
    score: assessment.score,
    summary: assessment.summary,
    gate: {
      threshold,
      passed: verdict === "pass",
      mergePolicy: config.gate?.mergePolicy ?? "block_on_any_drift"
    },
    issues: assessment.findings.map((finding) => ({
      id: finding.id,
      type: `${finding.category}_quality`,
      severity: finding.severity,
      file,
      reason: finding.message,
      suggestedFix: "Handled by the Morph design-database transform."
    }))
  };
}

const TRANSFORMED_CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

async function serveTransformedFile(response, config, pathname) {
  const transformedRoot = path.resolve(config.configDir, ".studio-run/transformed");
  const relative = decodeURIComponent(pathname.replace(/^\/transformed\/?/, "")) || "index.html";
  const target = path.resolve(transformedRoot, relative);
  if (!target.startsWith(transformedRoot + path.sep) && target !== transformedRoot) {
    return sendJson(response, 400, { error: "invalid_path" });
  }
  try {
    const body = await readFile(target);
    const type = TRANSFORMED_CONTENT_TYPES[path.extname(target).toLowerCase()] ?? "application/octet-stream";
    response.writeHead(200, { "content-type": type, "cache-control": "no-store" });
    response.end(body);
  } catch {
    return sendJson(response, 404, {
      error: "no_transformed_site",
      message: "Run a GitHub review first — the transformed site will be served here."
    });
  }
}

function normalizeGithubRepo(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^file:\/\//i.test(raw)) return raw;
  const match = raw.match(/github\.com\/([^/?#]+\/[^/?#]+)/i);
  if (match) return match[1].replace(/\.git$/, "");
  return raw.replace(/^\/+|\/+$/g, "").replace(/\.git$/, "");
}

function resolveStudioSource(options) {
  const previewUrl = String(options.previewUrl ?? "").trim();
  const githubRepo = normalizeGithubRepo(options.githubRepo);
  let source = String(options.source ?? "").trim();

  if (source === "paste" || source === "fixture") {
    throw new HttpError(400, "missing_project_source", "Connect a GitHub repo or provide a preview URL before running a review.");
  }

  if (!source) {
    if (previewUrl && githubRepo) {
      throw new HttpError(400, "ambiguous_source", "Provide either a GitHub repo or a preview URL, not both.");
    }
    if (previewUrl) source = "url";
    else if (githubRepo) source = "github";
    else {
      throw new HttpError(400, "missing_project_source", "Connect a GitHub repo or provide a preview URL before running a review.");
    }
  }

  if (source === "url") {
    if (!previewUrl) {
      throw new HttpError(400, "missing_preview_url", "A preview URL is required.");
    }
    if (githubRepo) {
      throw new HttpError(400, "ambiguous_source", "Provide either a GitHub repo or a preview URL, not both.");
    }
    return { source: "url", previewUrl, githubRepo: null };
  }

  if (source === "github") {
    if (!githubRepo) {
      throw new HttpError(400, "missing_github_repo", "A GitHub repository is required.");
    }
    if (previewUrl) {
      throw new HttpError(400, "ambiguous_source", "Provide either a GitHub repo or a preview URL, not both.");
    }
    return { source: "github", previewUrl: null, githubRepo };
  }

  throw new HttpError(400, "invalid_source", "Source must be github or url.");
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
  const workspaceName = escapeHtml(config.workspace?.name ?? "Local Workspace");
  const projectName = escapeHtml(config.projectName ?? "Project");
  const githubConnected = session?.provider === "github";
  const githubLabel = githubConnected ? escapeHtml(session.name || session.email || "GitHub account") : "";
  const userBlock = session
    ? `<div class="user-chip"><span class="user-avatar" aria-hidden="true">${escapeHtml((session.name || session.email || "?").slice(0, 1).toUpperCase())}</span><span class="user-name">${escapeHtml(session.name || session.email)}</span></div><a class="top-link" href="/auth/logout">Sign out</a>`
    : `<a class="top-link" href="/login?returnTo=%2Fstudio">Log in</a>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>morph Studio</title>
  <meta name="theme-color" content="#05060b">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      color-scheme: dark;
      --bg: #05060b;
      --surface: rgba(14, 18, 30, 0.62);
      --surface-solid: #0c101b;
      --ink: #eef2fc;
      --muted: #98a3c1;
      --faint: #67718e;
      --line: rgba(148, 163, 199, 0.13);
      --line-strong: rgba(148, 163, 199, 0.26);
      --brand-a: #6d8dff;
      --brand-b: #8b5cf6;
      --cyan: #22d3ee;
      --ok: #34d399;
      --bad: #fb7185;
      --warn: #fbbf24;
      --font: "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --display: "Space Grotesk", var(--font);
      --mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      --radius: 14px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: var(--font);
      font-size: 15px;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    ::selection { background: rgba(109, 141, 255, 0.35); }
    :focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; border-radius: 6px; }
    a { color: inherit; }
    code { font-family: var(--mono); font-size: 0.88em; color: var(--cyan); }

    .backdrop { position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; }
    .grid-bg {
      position: absolute; inset: -2px;
      background-image:
        linear-gradient(rgba(148, 163, 199, 0.045) 1px, transparent 1px),
        linear-gradient(90deg, rgba(148, 163, 199, 0.045) 1px, transparent 1px);
      background-size: 42px 42px;
      -webkit-mask-image: radial-gradient(ellipse 110% 65% at 50% 0%, black 25%, transparent 75%);
      mask-image: radial-gradient(ellipse 110% 65% at 50% 0%, black 25%, transparent 75%);
    }
    .glow {
      position: absolute;
      width: 760px; height: 520px;
      left: 50%; top: -260px;
      transform: translateX(-50%);
      background: radial-gradient(ellipse at center, rgba(109, 141, 255, 0.16), transparent 65%);
      filter: blur(50px);
    }

    /* ── App shell ─────────────────────────────────────────────────── */
    .app { display: grid; grid-template-columns: 236px minmax(0, 1fr); min-height: 100vh; }
    .side {
      position: sticky;
      top: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 20px 14px;
      border-right: 1px solid var(--line);
      background: rgba(8, 10, 18, 0.72);
      -webkit-backdrop-filter: blur(16px);
      backdrop-filter: blur(16px);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 4px 8px 16px;
      font-family: var(--display);
      font-weight: 700;
      font-size: 16.5px;
      letter-spacing: -0.01em;
      text-decoration: none;
    }
    .mark {
      width: 30px; height: 30px;
      border-radius: 9px;
      display: grid;
      place-items: center;
      font-size: 14px;
      font-weight: 700;
      color: #fff;
      background: linear-gradient(135deg, var(--brand-a) 0%, var(--brand-b) 90%);
      box-shadow: 0 0 0 1px rgba(109, 141, 255, 0.35), 0 6px 18px -6px rgba(109, 141, 255, 0.65);
    }
    .side-label {
      padding: 14px 10px 6px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      color: var(--faint);
    }
    .side-link {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 9px;
      color: var(--muted);
      text-decoration: none;
      font-size: 13.5px;
      font-weight: 550;
      transition: color 0.15s ease, background 0.15s ease;
    }
    .side-link svg { flex: none; opacity: 0.85; }
    .side-link:hover { color: var(--ink); background: rgba(148, 163, 199, 0.08); }
    .side-link.active {
      color: var(--ink);
      background: linear-gradient(90deg, rgba(109, 141, 255, 0.16), rgba(139, 92, 246, 0.08));
      box-shadow: inset 2px 0 0 var(--brand-a);
    }
    .side-foot {
      margin-top: auto;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: rgba(14, 18, 30, 0.6);
      padding: 12px 13px;
    }
    .side-foot .ws { font-size: 12px; color: var(--faint); margin-bottom: 2px; }
    .side-foot .pr { font-size: 13px; font-weight: 650; }
    .side-foot .fixture {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
      font-family: var(--mono);
      font-size: 10.5px;
      color: var(--warn);
      background: rgba(251, 191, 36, 0.08);
      border: 1px solid rgba(251, 191, 36, 0.25);
      border-radius: 6px;
      padding: 3px 8px;
    }

    .main { min-width: 0; display: flex; flex-direction: column; }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      min-height: 58px;
      padding: 0 28px;
      border-bottom: 1px solid var(--line);
      background: rgba(5, 6, 11, 0.8);
      -webkit-backdrop-filter: blur(16px);
      backdrop-filter: blur(16px);
    }
    .crumbs { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--faint); min-width: 0; }
    .crumbs .sep { opacity: 0.55; }
    .crumbs b { color: var(--ink); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .top-actions { display: flex; align-items: center; gap: 14px; }
    .state-chip {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      border: 1px solid var(--line-strong);
      border-radius: 999px;
      padding: 4px 12px;
      font-size: 12.5px;
      font-weight: 600;
      color: var(--muted);
      white-space: nowrap;
    }
    .state-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--faint); transition: background 0.2s ease, box-shadow 0.2s ease; }
    .state-chip[data-state="ok"] .state-dot { background: var(--ok); box-shadow: 0 0 8px rgba(52, 211, 153, 0.8); }
    .state-chip[data-state="warn"] .state-dot { background: var(--warn); box-shadow: 0 0 8px rgba(251, 191, 36, 0.7); }
    .state-chip[data-state="busy"] .state-dot { background: var(--cyan); box-shadow: 0 0 8px rgba(34, 211, 238, 0.8); animation: pulse 1s ease-in-out infinite; }
    .state-chip[data-state="bad"] .state-dot { background: var(--bad); box-shadow: 0 0 8px rgba(251, 113, 133, 0.8); }
    @keyframes pulse { 50% { opacity: 0.4; } }
    .user-chip { display: flex; align-items: center; gap: 8px; }
    .user-avatar {
      width: 26px; height: 26px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      font-size: 12px;
      font-weight: 700;
      color: #fff;
      background: linear-gradient(135deg, var(--brand-a), var(--brand-b));
    }
    .user-name { font-size: 13px; font-weight: 600; color: var(--muted); }
    .top-link {
      color: var(--muted);
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      transition: color 0.15s ease;
      white-space: nowrap;
    }
    .top-link:hover { color: var(--ink); }

    .content { padding: 30px 28px 56px; display: grid; gap: 22px; width: 100%; max-width: 1220px; margin: 0 auto; }

    /* ── Page head ─────────────────────────────────────────────────── */
    .page-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 18px; }
    h1 {
      margin: 0 0 8px;
      font-family: var(--display);
      font-size: clamp(26px, 3vw, 34px);
      line-height: 1.1;
      letter-spacing: -0.02em;
      font-weight: 700;
    }
    .lede { margin: 0; color: var(--muted); font-size: 14.5px; line-height: 1.65; max-width: 640px; }
    .lede code { font-size: 12.5px; }
    h2 { margin: 0; font-family: var(--display); font-size: 17px; font-weight: 650; letter-spacing: -0.01em; }
    h3 { margin: 0 0 6px; font-size: 14.5px; font-weight: 650; }
    p { margin: 0; color: var(--muted); }

    .actions { display: flex; flex-wrap: wrap; gap: 10px; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 40px;
      padding: 0 17px;
      border-radius: 11px;
      border: 1px solid transparent;
      font: inherit;
      font-size: 13.5px;
      font-weight: 650;
      cursor: pointer;
      text-decoration: none;
      white-space: nowrap;
      transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }
    .btn svg { flex: none; }
    .btn:active { transform: translateY(1px); }
    .btn-primary {
      color: #fff;
      background: linear-gradient(135deg, var(--brand-a), var(--brand-b));
      box-shadow: 0 0 0 1px rgba(120, 140, 255, 0.4) inset, 0 12px 30px -12px rgba(109, 141, 255, 0.7);
    }
    .btn-primary:hover { box-shadow: 0 0 0 1px rgba(140, 160, 255, 0.55) inset, 0 16px 38px -12px rgba(109, 141, 255, 0.85); transform: translateY(-1px); }
    .btn-ghost {
      color: var(--ink);
      background: rgba(148, 163, 199, 0.06);
      border-color: var(--line-strong);
    }
    .btn-ghost:hover { border-color: rgba(148, 163, 199, 0.5); background: rgba(148, 163, 199, 0.11); }
    .btn[disabled] { opacity: 0.55; cursor: wait; }

    /* ── Panels & stats ────────────────────────────────────────────── */
    .panel {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--surface);
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
    }
    .panel-pad { padding: 20px; }
    .panel-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 18px;
      border-bottom: 1px solid var(--line);
    }
    .panel-head .hint { font-size: 12px; color: var(--faint); }

    .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
    .stat {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--surface);
      padding: 16px 18px 14px;
      display: grid;
      gap: 2px;
      position: relative;
      overflow: hidden;
    }
    .stat::before {
      content: "";
      position: absolute;
      inset: 0 auto 0 0;
      width: 3px;
      background: linear-gradient(180deg, var(--brand-a), var(--brand-b));
      opacity: 0.55;
    }
    .stat-label { font-size: 11.5px; font-weight: 650; letter-spacing: 0.07em; text-transform: uppercase; color: var(--faint); }
    .stat-value {
      font-family: var(--display);
      font-size: 27px;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.25;
      font-variant-numeric: tabular-nums;
    }
    .stat-value.ok { color: var(--ok); }
    .stat-value.bad { color: var(--bad); }
    .stat-sub { font-size: 11.5px; color: var(--faint); font-family: var(--mono); }

    /* ── Pipeline strip ────────────────────────────────────────────── */
    .pipeline {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px 18px;
      padding: 15px 20px;
      border: 1px solid rgba(109, 141, 255, 0.28);
      border-radius: var(--radius);
      background: linear-gradient(90deg, rgba(109, 141, 255, 0.09), rgba(139, 92, 246, 0.05));
    }
    .pipeline[hidden] { display: none; }
    .pipe-stage { display: flex; align-items: baseline; gap: 8px; }
    .pipe-k { font-size: 11.5px; font-weight: 650; letter-spacing: 0.07em; text-transform: uppercase; color: var(--faint); }
    .pipe-v { font-family: var(--mono); font-size: 13px; font-weight: 600; }
    .pipe-v.ok { color: var(--ok); }
    .pipe-v.bad { color: var(--bad); }
    .pipe-v.warn { color: var(--warn); }
    .pipe-arrow { color: var(--faint); }
    .pipe-summary { margin-left: auto; font-size: 12.5px; color: var(--muted); }

    /* ── Journey strip ─────────────────────────────────────────────── */
    .journey { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .step {
      display: flex;
      gap: 11px;
      padding: 13px 14px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: rgba(14, 18, 30, 0.4);
    }
    .step .n {
      flex: none;
      width: 22px; height: 22px;
      border-radius: 7px;
      display: grid;
      place-items: center;
      font-size: 11px;
      font-weight: 700;
      color: var(--brand-a);
      background: rgba(109, 141, 255, 0.12);
      border: 1px solid rgba(109, 141, 255, 0.3);
      margin-top: 1px;
    }
    .step strong { display: block; font-size: 13px; margin-bottom: 1px; }
    .step span { color: var(--faint); font-size: 12px; line-height: 1.5; display: block; }

    /* ── Work grid: history + receipt ──────────────────────────────── */
    .workgrid { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 14px; align-items: start; }
    .history-list { max-height: 560px; overflow: auto; padding: 8px; }
    .run {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr) auto;
      gap: 4px 12px;
      align-items: center;
      width: 100%;
      padding: 11px 12px;
      border: 1px solid transparent;
      border-radius: 11px;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .run:hover { background: rgba(148, 163, 199, 0.07); border-color: var(--line); }
    .run.selected { background: rgba(109, 141, 255, 0.1); border-color: rgba(109, 141, 255, 0.35); }
    .run-icon {
      grid-row: span 2;
      width: 34px; height: 34px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      color: var(--brand-a);
      background: rgba(109, 141, 255, 0.1);
      border: 1px solid rgba(109, 141, 255, 0.22);
    }
    .run-kind { font-size: 13px; font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .run-meta { grid-column: 2 / 4; font-family: var(--mono); font-size: 10.5px; color: var(--faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .verdict {
      justify-self: end;
      font-family: var(--mono);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      border-radius: 999px;
      padding: 2px 9px;
    }
    .verdict.pass { color: var(--ok); background: rgba(52, 211, 153, 0.12); }
    .verdict.fail { color: var(--bad); background: rgba(251, 113, 133, 0.12); }
    .verdict.stored { color: var(--muted); background: rgba(148, 163, 199, 0.12); }
    .empty {
      display: grid;
      justify-items: center;
      gap: 10px;
      padding: 42px 20px;
      text-align: center;
      color: var(--faint);
      font-size: 13px;
    }
    .empty svg { opacity: 0.5; }
    .empty b { color: var(--muted); font-weight: 650; }

    .seg {
      display: inline-flex;
      gap: 3px;
      padding: 3px;
      border: 1px solid var(--line);
      border-radius: 9px;
      background: rgba(5, 6, 11, 0.5);
    }
    .seg button {
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: var(--muted);
      font: inherit;
      font-size: 12px;
      font-weight: 650;
      padding: 4px 13px;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .seg button.active { background: rgba(109, 141, 255, 0.18); color: var(--ink); }
    .seg button:hover:not(.active) { color: var(--ink); }

    pre#output {
      overflow: auto;
      margin: 0;
      min-height: 380px;
      max-height: 560px;
      padding: 18px 20px;
      background: transparent;
      color: #dbe4f8;
      font-family: var(--mono);
      font-size: 12px;
      line-height: 1.7;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .j-key { color: #8ab4ff; }
    .j-str { color: #7ee0c2; }
    .j-num { color: #fbbf24; }
    .j-bool { color: #c4b5fd; }
    .j-null { color: #fb7185; }

    .readable {
      overflow: auto;
      min-height: 380px;
      max-height: 560px;
      font-size: 13px;
      line-height: 1.55;
    }
    .readable details { border-bottom: 1px solid var(--line); }
    .readable details:last-child { border-bottom: none; }
    .readable summary {
      padding: 11px 18px;
      cursor: pointer;
      font-weight: 600;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 9px;
      user-select: none;
      list-style: none;
      transition: background 0.15s ease;
    }
    .readable summary:hover { background: rgba(148, 163, 199, 0.05); }
    .readable summary::-webkit-details-marker { display: none; }
    .readable summary::before {
      content: "";
      width: 7px; height: 7px;
      border-right: 1.6px solid var(--faint);
      border-bottom: 1.6px solid var(--faint);
      transform: rotate(-45deg);
      transition: transform 0.15s ease;
      flex: none;
    }
    .readable details[open] > summary::before { transform: rotate(45deg); }
    .readable summary .preview { color: var(--faint); font-weight: 450; font-size: 12px; }
    .readable .detail-body { padding: 2px 18px 14px 34px; }
    .r-badge {
      display: inline-block;
      border-radius: 999px;
      padding: 1px 9px;
      font-family: var(--mono);
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .r-badge.pass { background: rgba(52, 211, 153, 0.13); color: var(--ok); }
    .r-badge.fail, .r-badge.high { background: rgba(251, 113, 133, 0.13); color: var(--bad); }
    .r-badge.medium { background: rgba(251, 191, 36, 0.13); color: var(--warn); }
    .r-badge.low { background: rgba(148, 163, 199, 0.13); color: var(--muted); }
    .score-bar-wrap { display: flex; align-items: center; gap: 12px; margin-top: 4px; }
    .score-bar-wrap strong { font-family: var(--mono); font-size: 12.5px; white-space: nowrap; }
    .score-bar { height: 6px; border-radius: 999px; background: rgba(148, 163, 199, 0.14); flex: 1; overflow: hidden; }
    .score-bar-fill { height: 100%; border-radius: 999px; }
    .score-bar-fill.good { background: linear-gradient(90deg, #10b981, var(--ok)); }
    .score-bar-fill.warn { background: linear-gradient(90deg, #d97706, var(--warn)); }
    .score-bar-fill.bad { background: linear-gradient(90deg, #e11d48, var(--bad)); }
    .r-chips { display: flex; gap: 7px; flex-wrap: wrap; }
    .r-chip { border: 1px solid var(--line); border-radius: 7px; padding: 3px 10px; font-size: 12px; color: var(--muted); }
    .r-kv { display: grid; grid-template-columns: 120px 1fr; gap: 4px 14px; }
    .r-kv dt { color: var(--faint); font-size: 12px; }
    .r-kv dd { margin: 0; font-size: 12px; color: var(--muted); word-break: break-word; }
    .r-issue {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 11px 13px;
      margin-bottom: 8px;
      background: rgba(5, 6, 11, 0.4);
    }
    .r-issue:last-child { margin-bottom: 0; }
    .r-issue-head { display: flex; align-items: center; gap: 9px; margin-bottom: 7px; font-weight: 600; font-size: 12.5px; font-family: var(--mono); }
    .r-issue dl { margin: 0; }
    .r-list { padding-left: 18px; margin: 0; color: var(--muted); }
    .r-list li { margin-bottom: 4px; font-size: 12px; }
    .r-text { font-size: 12px; color: var(--muted); white-space: pre-wrap; word-break: break-word; }

    /* ── Connect section ───────────────────────────────────────────── */
    .section-title { margin: 10px 0 0; }
    .section-title p { font-size: 13.5px; margin-top: 4px; }
    .panel-tabs {
      display: inline-flex;
      gap: 3px;
      padding: 3px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: rgba(5, 6, 11, 0.5);
      margin-bottom: 18px;
    }
    .panel-tabs button {
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: var(--muted);
      font: inherit;
      font-size: 12.5px;
      font-weight: 650;
      padding: 6px 16px;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .panel-tabs button.active { background: rgba(109, 141, 255, 0.18); color: var(--ink); }
    .panel-tabs button:hover:not(.active) { color: var(--ink); }
    .tab-pane[hidden] { display: none; }
    .pane-grid { display: grid; grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr); gap: 26px; align-items: start; }
    .pane-copy p { font-size: 13px; line-height: 1.6; }
    .auth-form { display: grid; gap: 12px; }
    .auth-form label { display: grid; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--muted); }
    .auth-form input {
      min-height: 40px;
      border: 1px solid var(--line-strong);
      border-radius: 10px;
      padding: 0 13px;
      font: inherit;
      font-size: 13.5px;
      color: var(--ink);
      background: rgba(5, 6, 11, 0.55);
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .auth-form input::placeholder { color: var(--faint); }
    .auth-form input:focus {
      outline: none;
      border-color: var(--brand-a);
      box-shadow: 0 0 0 3px rgba(109, 141, 255, 0.18);
    }
    .auth-form .btn { justify-self: start; }
    .auth-status { font-size: 12.5px; margin-top: 10px; display: flex; align-items: center; gap: 7px; }
    .auth-status::before { content: ""; width: 7px; height: 7px; border-radius: 50%; flex: none; }
    .auth-status.ready { color: var(--ok); }
    .auth-status.ready::before { background: var(--ok); box-shadow: 0 0 8px rgba(52, 211, 153, 0.7); }
    .auth-status.pending { color: var(--warn); }
    .auth-status.pending::before { background: var(--warn); box-shadow: 0 0 8px rgba(251, 191, 36, 0.6); }

    .setup-panel {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: linear-gradient(180deg, rgba(14, 18, 30, 0.72), rgba(14, 18, 30, 0.38));
      padding: 22px 24px 24px;
    }
    .setup-head { margin-bottom: 18px; }
    .setup-head h2 { margin: 0 0 6px; font-family: var(--display); font-size: 18px; letter-spacing: -0.01em; }
    .setup-head p { margin: 0; color: var(--muted); font-size: 13.5px; line-height: 1.6; }
    .setup-grid { display: grid; grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr); gap: 22px; align-items: start; }
    .source-pane { display: grid; gap: 12px; }
    .source-pane[hidden] { display: none; }
    .source-note { margin: 0; color: var(--faint); font-size: 12.5px; line-height: 1.55; }
    .github-connect {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: rgba(5, 6, 11, 0.45);
      padding: 14px 16px;
    }
    .github-connect strong { display: block; font-size: 13.5px; margin-bottom: 2px; }
    .github-connect span { color: var(--muted); font-size: 12.5px; }
    .instructions-field { display: grid; gap: 8px; }
    .instructions-field label { font-size: 12.5px; font-weight: 650; color: var(--muted); }
    .instructions-field textarea {
      min-height: 132px;
      resize: vertical;
      border: 1px solid var(--line-strong);
      border-radius: 12px;
      padding: 12px 14px;
      font: inherit;
      font-size: 13.5px;
      line-height: 1.55;
      color: var(--ink);
      background: rgba(5, 6, 11, 0.55);
    }
    .instructions-field textarea::placeholder { color: var(--faint); }
    .instructions-field textarea:focus {
      outline: none;
      border-color: var(--brand-a);
      box-shadow: 0 0 0 3px rgba(109, 141, 255, 0.18);
    }
    .code-editor textarea {
      min-height: 280px;
      resize: vertical;
      border: 1px solid var(--line-strong);
      border-radius: 12px;
      padding: 12px 14px;
      font-family: var(--mono);
      font-size: 12px;
      line-height: 1.55;
      color: var(--ink);
      background: rgba(5, 6, 11, 0.55);
      width: 100%;
    }
    .code-editor textarea:focus {
      outline: none;
      border-color: var(--brand-a);
      box-shadow: 0 0 0 3px rgba(109, 141, 255, 0.18);
    }
    .code-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }
    .code-toolbar label { font-size: 12.5px; font-weight: 650; color: var(--muted); margin: 0; }
    .code-diff {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .code-pane {
      border: 1px solid var(--line);
      border-radius: 10px;
      overflow: hidden;
      background: rgba(5, 6, 11, 0.45);
    }
    .code-pane-head {
      padding: 8px 12px;
      border-bottom: 1px solid var(--line);
      font-size: 11px;
      font-weight: 650;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--faint);
    }
    .code-pane pre {
      margin: 0;
      padding: 12px;
      overflow: auto;
      max-height: 320px;
      font-family: var(--mono);
      font-size: 11px;
      line-height: 1.55;
      color: #dbe4f8;
      white-space: pre-wrap;
      word-break: break-word;
    }
    @media (max-width: 900px) {
      .code-diff { grid-template-columns: 1fr; }
    }
    .preview-frame {
      margin-top: 4px;
      border: 1px solid var(--line);
      border-radius: 12px;
      overflow: hidden;
      background: rgba(5, 6, 11, 0.55);
    }
    .preview-frame img { display: block; width: 100%; height: auto; }
    .preview-meta {
      padding: 10px 12px;
      border-top: 1px solid var(--line);
      font-family: var(--mono);
      font-size: 11px;
      color: var(--faint);
      word-break: break-all;
    }
    .preview-empty {
      padding: 18px 14px;
      color: var(--faint);
      font-size: 12.5px;
      line-height: 1.55;
    }

    .foot-note {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--faint);
      font-size: 12.5px;
      padding-bottom: 8px;
    }
    .foot-note code { font-size: 11.5px; }

    .demo-banner {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 16px 18px;
      border: 1px solid rgba(109, 141, 255, 0.35);
      border-radius: var(--radius);
      background: linear-gradient(90deg, rgba(109, 141, 255, 0.12), rgba(139, 92, 246, 0.06));
    }
    .demo-banner-icon {
      flex: none;
      width: 36px; height: 36px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      color: var(--brand-a);
      background: rgba(109, 141, 255, 0.15);
      border: 1px solid rgba(109, 141, 255, 0.3);
    }
    .demo-banner strong { display: block; font-size: 14px; margin-bottom: 4px; }
    .demo-banner p { font-size: 13px; line-height: 1.6; color: var(--muted); }
    .demo-banner kbd {
      display: inline-block;
      font-family: var(--mono);
      font-size: 11.5px;
      padding: 2px 8px;
      border-radius: 6px;
      border: 1px solid var(--line-strong);
      background: rgba(5, 6, 11, 0.5);
      color: var(--ink);
    }

    .welcome {
      padding: 28px 24px;
      text-align: center;
    }
    .welcome-icon {
      width: 48px; height: 48px;
      margin: 0 auto 16px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      color: var(--brand-a);
      background: rgba(109, 141, 255, 0.12);
      border: 1px solid rgba(109, 141, 255, 0.28);
    }
    .welcome h3 { margin: 0 0 8px; font-family: var(--display); font-size: 18px; }
    .welcome p { max-width: 420px; margin: 0 auto 18px; font-size: 13.5px; line-height: 1.65; }
    .welcome-steps {
      display: flex;
      justify-content: center;
      gap: 24px;
      flex-wrap: wrap;
      margin-top: 8px;
    }
    .welcome-step {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12.5px;
      color: var(--muted);
    }
    .welcome-step .n {
      width: 20px; height: 20px;
      border-radius: 6px;
      display: grid;
      place-items: center;
      font-size: 11px;
      font-weight: 700;
      color: var(--brand-a);
      background: rgba(109, 141, 255, 0.12);
      border: 1px solid rgba(109, 141, 255, 0.25);
    }

    @media (max-width: 1080px) {
      .stats { grid-template-columns: 1fr 1fr; }
      .journey { grid-template-columns: 1fr 1fr; }
      .workgrid { grid-template-columns: 1fr; }
      .history-list { max-height: 320px; }
    }
    @media (max-width: 900px) {
      .app { grid-template-columns: 1fr; }
      .side {
        position: static;
        height: auto;
        flex-direction: row;
        align-items: center;
        flex-wrap: wrap;
        gap: 2px 4px;
        border-right: 0;
        border-bottom: 1px solid var(--line);
        padding: 10px 16px;
      }
      .brand { padding: 4px 8px; }
      .side-label { display: none; }
      .side-foot { display: none; }
      .content { padding: 22px 16px 44px; }
      .topbar { padding: 0 16px; }
      .crumbs { display: none; }
      .topbar { justify-content: flex-end; }
    }
    @media (max-width: 640px) {
      .stats, .journey, .pane-grid, .setup-grid { grid-template-columns: 1fr; }
      .pipe-summary { margin-left: 0; width: 100%; }
    }
    @media (prefers-reduced-motion: reduce) {
      * { transition-duration: 0.01ms !important; animation: none !important; }
    }
  </style>
</head>
<body>
  <div class="backdrop" aria-hidden="true">
    <div class="grid-bg"></div>
    <div class="glow"></div>
  </div>

  <div class="app">
    <aside class="side">
      <a class="brand" href="/" title="Back to the morph landing page">
        <span class="mark">m</span><span>morph</span>
      </a>
      <span class="side-label">Review</span>
      <a class="side-link active" href="#overview">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
        Overview
      </a>
      <a class="side-link" href="#history">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
        Runs &amp; receipts
      </a>
      <span class="side-label">Resources</span>
      <a class="side-link" href="/">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8"/><path d="M5 9.5V21h14V9.5"/></svg>
        Landing page
      </a>
      <a class="side-link" href="https://github.com/arnavsri993/morph" target="_blank" rel="noreferrer">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.72.5.1.68-.22.68-.49v-1.7c-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.9-.64.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05a9.4 9.4 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9v2.82c0 .27.18.6.69.49A10.26 10.26 0 0 0 22 12.25C22 6.58 17.52 2 12 2z"/></svg>
        GitHub
      </a>
      <a class="side-link" href="/api/health" target="_blank" rel="noreferrer">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 12h-4l-3 8-6-16-3 8H2"/></svg>
        API health
      </a>
      <div class="side-foot">
        <div class="ws">${workspaceName}</div>
        <div class="pr">${projectName}</div>
        <span class="fixture" id="sourceBadge">● local project</span>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <div class="crumbs"><span>${workspaceName}</span><span class="sep">/</span><b>${projectName}</b></div>
        <div class="top-actions">
          <span class="state-chip" id="stateChip" data-state="idle"><span class="state-dot"></span><span id="reviewState">Idle</span></span>
          ${userBlock}
        </div>
      </header>

      <main class="content">
        <section class="page-head" id="overview">
          <div>
            <h1>Agent branch review</h1>
            <p class="lede">Connect a GitHub repo or give morph a live preview URL, add agent instructions, then run a full review with deterministic repairs and a merge gate verdict.</p>
          </div>
          <div class="actions">
            <button class="btn btn-primary" data-action="studio-review" id="runReviewBtn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>
              Run full review
            </button>
          </div>
        </section>

        <section class="setup-panel" aria-label="Project source and agent instructions">
          <div class="setup-head">
            <h2>Project source</h2>
            <p>Point morph at the agent output you want reviewed. A GitHub repo or preview URL is required before you can run a review.</p>
          </div>
          <div class="panel-tabs" role="tablist" aria-label="Project source">
            <button type="button" class="active" data-source-tab="github" role="tab" aria-selected="true">Connect GitHub</button>
            <button type="button" data-source-tab="url" role="tab" aria-selected="false">Preview URL</button>
          </div>
          <div class="setup-grid">
            <div>
              <div class="source-pane" data-source-pane="github">
                <div class="github-connect">
                  <div>
                    <strong id="githubStatusLabel">${githubConnected ? "GitHub connected" : "Connect GitHub"}</strong>
                    <span id="githubStatusText">${githubConnected ? githubLabel : "Sign in with GitHub to review agent branches from your repos."}</span>
                  </div>
                  ${githubConnected
                    ? `<span class="auth-status ready">Connected</span>`
                    : `<a class="btn btn-ghost" href="/auth/github?returnTo=%2Fstudio">Connect GitHub</a>`}
                </div>
                <label class="auth-form" for="githubRepo">
                  <span>Repository</span>
                  <input id="githubRepo" name="githubRepo" type="text" required autocomplete="off" placeholder="owner/repo or https://github.com/owner/repo">
                </label>
                <p class="source-note">morph clones the repo, scores the UI against its design intelligence database, and re-renders the site with a frontier-grade design profile. The result is served at <code>/transformed</code>.</p>
              </div>
              <div class="source-pane" data-source-pane="url" hidden>
                <form class="auth-form" id="previewForm" onsubmit="return false">
                  <label for="previewUrl">Live preview URL</label>
                  <input id="previewUrl" name="previewUrl" type="url" inputmode="url" autocomplete="url" required placeholder="https://your-app.vercel.app/settings/billing">
                  <p class="source-note">morph uses Playwright to open the page, capture a screenshot, and attach it to the review receipt before scanning for drift.</p>
                </form>
                <div class="preview-frame" id="previewFrame" hidden>
                  <img id="previewImage" alt="Playwright preview capture">
                  <div class="preview-meta" id="previewMeta"></div>
                </div>
                <div class="preview-empty" id="previewPlaceholder">Run a review with a preview URL to see the Playwright capture here.</div>
              </div>
            </div>
            <div class="instructions-field">
              <label for="agentInstructions">Agent instructions</label>
              <textarea id="agentInstructions" name="instructions" placeholder="Tell morph what the agent was asked to build and what to focus on in the review. Example: Review the billing settings screen Cursor generated on this branch. Flag token drift, raw button markup, missing focus states, and mobile overflow risk."></textarea>
            </div>
          </div>
        </section>

        <section class="stats" aria-label="Review metrics">
          <div class="stat"><span class="stat-label">Review score</span><span class="stat-value" id="score">–</span><span class="stat-sub">out of 100 · gate ≥ 95</span></div>
          <div class="stat"><span class="stat-label">Merge gate</span><span class="stat-value" id="gate">–</span><span class="stat-sub">block_on_any_drift</span></div>
          <div class="stat"><span class="stat-label">Fixes applied</span><span class="stat-value" id="fixes">–</span><span class="stat-sub">deterministic patches</span></div>
          <div class="stat"><span class="stat-label">Runs stored</span><span class="stat-value" id="runs">0</span><span class="stat-sub">.morph/runs receipts</span></div>
        </section>

        <section class="pipeline" id="pipeline" hidden aria-label="Latest review pipeline">
          <div class="pipe-stage"><span class="pipe-k">Before</span><span class="pipe-v" id="pipeBefore">–</span></div>
          <span class="pipe-arrow" aria-hidden="true">→</span>
          <div class="pipe-stage"><span class="pipe-k">Repair</span><span class="pipe-v warn" id="pipeFixes">–</span></div>
          <span class="pipe-arrow" aria-hidden="true">→</span>
          <div class="pipe-stage"><span class="pipe-k">After</span><span class="pipe-v" id="pipeAfter">–</span></div>
          <span class="pipe-summary" id="pipeSummary"></span>
        </section>

        <section class="journey" aria-label="How a review works">
          <div class="step"><span class="n">1</span><div><strong>Choose a source</strong><span>Connect GitHub with a repo, or paste a live preview URL for morph to capture with Playwright.</span></div></div>
          <div class="step"><span class="n">2</span><div><strong>Add agent instructions</strong><span>Tell morph what the agent built and what matters for this review.</span></div></div>
          <div class="step"><span class="n">3</span><div><strong>Run full review</strong><span>morph scans for drift, applies fixes on an isolated copy, and stores JSON receipts.</span></div></div>
          <div class="step"><span class="n">4</span><div><strong>Gate verdict</strong><span>Score, merge gate, and before/after proof — ready for a human or CI to decide.</span></div></div>
        </section>

        <section class="workgrid" id="history">
          <div class="panel">
            <div class="panel-head">
              <h2>Review history</h2>
              <span class="hint" id="historyHint">stored locally</span>
            </div>
            <div class="history-list" id="runList">Loading…</div>
          </div>
          <div class="panel" aria-live="polite">
            <div class="panel-head">
              <h2>Receipt</h2>
              <div class="seg" role="tablist" aria-label="Receipt format">
                <button id="toggleReadable" class="active" data-mode="readable" role="tab" aria-selected="true">Readable</button>
                <button id="toggleJson" data-mode="json" role="tab">JSON</button>
              </div>
            </div>
            <pre id="output" style="display:none">Loading…</pre>
            <div id="outputReadable" class="readable"></div>
          </div>
        </section>

        <p class="foot-note">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Full reviews repair an isolated <code>.studio-run</code> copy. A GitHub repo or preview URL is required — morph will not run on a blank or seeded fallback.
        </p>
      </main>
    </div>
  </div>
  <script>
    const output = document.querySelector("#output");
    const outputReadable = document.querySelector("#outputReadable");
    const runList = document.querySelector("#runList");
    const score = document.querySelector("#score");
    const runs = document.querySelector("#runs");
    const gate = document.querySelector("#gate");
    const fixes = document.querySelector("#fixes");
    const reviewState = document.querySelector("#reviewState");
    const stateChip = document.querySelector("#stateChip");
    const pipeline = document.querySelector("#pipeline");
    const pipeBefore = document.querySelector("#pipeBefore");
    const pipeFixes = document.querySelector("#pipeFixes");
    const pipeAfter = document.querySelector("#pipeAfter");
    const pipeSummary = document.querySelector("#pipeSummary");
    const previewUrlInput = document.querySelector("#previewUrl");
    const githubRepoInput = document.querySelector("#githubRepo");
    const agentInstructionsInput = document.querySelector("#agentInstructions");
    const previewFrame = document.querySelector("#previewFrame");
    const previewImage = document.querySelector("#previewImage");
    const previewMeta = document.querySelector("#previewMeta");
    const previewPlaceholder = document.querySelector("#previewPlaceholder");
    const sourceBadge = document.querySelector("#sourceBadge");

    let activeSource = "github";

    document.querySelectorAll("[data-source-tab]").forEach((tabButton) => {
      tabButton.addEventListener("click", () => {
        activeSource = tabButton.dataset.sourceTab || "github";
        document.querySelectorAll("[data-source-tab]").forEach((candidate) => {
          const active = candidate === tabButton;
          candidate.classList.toggle("active", active);
          candidate.setAttribute("aria-selected", active ? "true" : "false");
        });
        document.querySelectorAll("[data-source-pane]").forEach((pane) => {
          pane.hidden = pane.dataset.sourcePane !== activeSource;
        });
        updateSourceBadge();
      });
    });

    function updateSourceBadge() {
      if (!sourceBadge) return;
      if (activeSource === "url") {
        const url = previewUrlInput?.value.trim();
        sourceBadge.textContent = url ? "● preview url" : "● preview url (required)";
      } else {
        const repo = githubRepoInput?.value.trim();
        sourceBadge.textContent = repo ? "● github · " + repo : "● github (repo required)";
      }
    }

    previewUrlInput?.addEventListener("input", updateSourceBadge);
    githubRepoInput?.addEventListener("input", updateSourceBadge);

    function buildReviewRequest() {
      const instructions = agentInstructionsInput?.value.trim() || "";
      if (activeSource === "url") {
        const previewUrl = previewUrlInput?.value.trim() || "";
        if (!previewUrl) throw new Error("Enter a preview URL.");
        return { source: "url", previewUrl, instructions };
      }
      const githubRepo = githubRepoInput?.value.trim() || "";
      if (!githubRepo) throw new Error("Enter a GitHub repository (owner/repo).");
      return { source: "github", githubRepo, instructions };
    }

    function renderPreviewCapture(preview) {
      if (!previewFrame || !previewImage || !previewMeta || !previewPlaceholder) return;
      if (!preview) {
        previewFrame.hidden = true;
        previewPlaceholder.hidden = false;
        return;
      }
      if (preview.status === "captured" && preview.screenshotBase64) {
        previewFrame.hidden = false;
        previewPlaceholder.hidden = true;
        previewImage.src = "data:image/png;base64," + preview.screenshotBase64;
        previewMeta.textContent = (preview.title ? preview.title + " · " : "") + preview.url;
        return;
      }
      previewFrame.hidden = true;
      previewPlaceholder.hidden = false;
      previewPlaceholder.textContent = preview.error || "Preview capture unavailable for this run.";
    }

    let outputMode = "readable";
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
        const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
        output.innerHTML = highlightJson(text);
      }
    }

    function highlightJson(text) {
      const safe = String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return safe.replace(
        /("(?:\\\\.|[^"\\\\])*")(\\s*:)?|\\b(?:true|false)\\b|\\bnull\\b|-?\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b/g,
        function (match, str, colon) {
          if (str !== undefined) return '<span class="' + (colon ? "j-key" : "j-str") + '">' + str + '</span>' + (colon || "");
          if (match === "true" || match === "false") return '<span class="j-bool">' + match + '</span>';
          if (match === "null") return '<span class="j-null">null</span>';
          return '<span class="j-num">' + match + '</span>';
        }
      );
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
      if (p.instructions) {
        html += '<div style="margin-bottom:8px;font-size:12px;color:var(--muted)"><strong style="color:var(--ink)">Instructions:</strong> ' + esc(p.instructions) + '</div>';
      }
      if (p.githubRepo) {
        html += '<div style="margin-bottom:8px;font-size:12px;color:var(--muted)"><strong style="color:var(--ink)">GitHub:</strong> ' + esc(p.githubRepo) + '</div>';
      }
      if (p.transform?.profile) {
        html += '<div style="margin-bottom:8px;font-size:12px;color:var(--muted)"><strong style="color:var(--ink)">Design profile:</strong> '
          + esc(p.transform.profile.name) + ' — ' + esc(p.transform.profile.inspiration || "") + '</div>';
      }
      if (p.transformedPreviewPath) {
        html += '<div style="margin:10px 0"><a class="btn btn-primary" href="' + esc(p.transformedPreviewPath) + '" target="_blank" rel="noreferrer">Open transformed site ↗</a></div>';
      }
      if (p.previewUrl) {
        html += '<div style="margin-bottom:8px;font-size:12px;color:var(--muted)"><strong style="color:var(--ink)">Preview URL:</strong> ' + esc(p.previewUrl) + '</div>';
      }
      if (p.targetFile) {
        html += '<div style="margin-bottom:8px;font-size:12px;color:var(--muted)"><strong style="color:var(--ink)">File:</strong> ' + esc(p.targetFile) + '</div>';
      }
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

      if (p.preview) {
        html += '<details><summary>Playwright preview <span class="preview">' + esc(p.preview.status || "unknown") + '</span></summary>';
        html += '<div class="detail-body">';
        if (p.preview.screenshotBase64) {
          html += '<img alt="Playwright preview" style="width:100%;border-radius:10px;border:1px solid var(--line)" src="data:image/png;base64,' + p.preview.screenshotBase64 + '">';
        } else if (p.preview.error) {
          html += '<span class="r-text">' + esc(p.preview.error) + '</span>';
        }
        html += '</div></details>';
      }

      if (p.codeReview?.file) {
        html += '<details open><summary>Fixed code <span class="preview">' + (p.codeReview.changed ? "changed" : "unchanged") + '</span></summary>';
        html += '<div class="detail-body"><div class="code-diff">';
        html += '<div class="code-pane"><div class="code-pane-head">Before</div><pre>' + esc(p.codeReview.before || "") + '</pre></div>';
        html += '<div class="code-pane"><div class="code-pane-head">After</div><pre>' + esc(p.codeReview.after || "") + '</pre></div>';
        html += '</div></div></details>';
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

    function showWelcome() {
      lastPayload = null;
      output.style.display = "none";
      outputReadable.style.display = "";
      outputReadable.innerHTML = '<div class="welcome">'
        + '<div class="welcome-icon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg></div>'
        + '<h3>Ready to review</h3>'
        + '<p>Connect a GitHub repo or paste a preview URL, add agent instructions, then click <strong>Run full review</strong>.</p>'
        + '<div class="welcome-steps">'
        + '<span class="welcome-step"><span class="n">1</span> Choose source</span>'
        + '<span class="welcome-step"><span class="n">2</span> Add instructions</span>'
        + '<span class="welcome-step"><span class="n">3</span> Gate verdict</span>'
        + '</div></div>';
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

    function setState(label, kind) {
      reviewState.textContent = label;
      stateChip.dataset.state = kind || "idle";
    }

    function verdictOf(runPayload) {
      return runPayload?.finalVerdict || runPayload?.verdict || runPayload?.after?.verdict || "stored";
    }

    function relativeTime(iso) {
      if (!iso) return "";
      const delta = Date.now() - new Date(iso).getTime();
      if (!Number.isFinite(delta) || delta < 0) return "";
      const minutes = Math.floor(delta / 60000);
      if (minutes < 1) return "just now";
      if (minutes < 60) return minutes + "m ago";
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return hours + "h ago";
      return Math.floor(hours / 24) + "d ago";
    }

    function renderPipeline(runPayload) {
      const before = runPayload?.before;
      const after = runPayload?.after;
      const repl = runPayload?.repair?.replacements;
      if (!before || !after) { pipeline.hidden = true; return; }
      pipeline.hidden = false;
      pipeBefore.textContent = (before.verdict || "?").toUpperCase() + " " + (before.score ?? "?") + "/100";
      pipeBefore.className = "pipe-v " + (before.verdict === "pass" ? "ok" : "bad");
      pipeAfter.textContent = (after.verdict || "?").toUpperCase() + " " + (after.score ?? "?") + "/100";
      pipeAfter.className = "pipe-v " + (after.verdict === "pass" ? "ok" : "bad");
      pipeFixes.textContent = (repl ?? 0) + " fixes";
      pipeSummary.textContent = runPayload.ciSummary || "";
    }

    function renderPayload(payload) {
      lastPayload = payload;
      applyOutputMode(payload);
      const runPayload = payload.run?.payload;
      const report = runPayload?.after || runPayload;
      if (report?.score !== undefined) score.textContent = report.score;
      score.className = "stat-value" + (Number(report?.score) >= 95 ? " ok" : report?.score !== undefined ? " bad" : "");
      const finalVerdict = runPayload?.finalVerdict || report?.verdict;
      if (finalVerdict) {
        gate.textContent = finalVerdict === "pass" ? "Open" : "Blocked";
        gate.className = "stat-value " + (finalVerdict === "pass" ? "ok" : "bad");
      }
      const replacements = runPayload?.repair?.replacements ?? (runPayload?.schemaVersion?.includes("repair") ? runPayload.replacements : undefined);
      if (replacements !== undefined) fixes.textContent = replacements;
      renderPipeline(runPayload);
      if (runPayload?.preview) renderPreviewCapture(runPayload.preview);
      if (finalVerdict) {
        setState(finalVerdict === "pass" ? "Gate open" : "Needs review", finalVerdict === "pass" ? "ok" : "warn");
      }
    }

    const RUN_ICONS = {
      "studio-review": '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
      verify: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
      repair: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4.5 4.5 0 0 0-6.4 6.4l-5 5V21h3.3l5-5a4.5 4.5 0 0 0 6.4-6.4l-3 3-2.3-2.3 3-3z"/></svg>',
      loop: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>'
    };

    const RUN_LABELS = {
      "studio-review": "Full review",
      verify: "Inspect",
      repair: "Fix plan",
      "repair-applied": "Repair",
      loop: "Loop"
    };

    let selectedRunId = null;

    async function refreshRuns() {
      const payload = await api("/api/runs");
      runs.textContent = payload.runs.length;
      if (!payload.runs.length) {
        runList.innerHTML = '<div class="empty">'
          + '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M14 2v6h6"/></svg>'
          + '<span><b>No runs yet.</b><br>Run a full review to store your first receipt.</span></div>';
        return;
      }
      runList.innerHTML = "";
      for (const run of payload.runs.slice(0, 12)) {
        const verdict = verdictOf(run.payload);
        const verdictCls = verdict === "pass" ? "pass" : verdict === "fail" ? "fail" : "stored";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "run" + (run.id === selectedRunId ? " selected" : "");
        button.innerHTML =
          '<span class="run-icon">' + (RUN_ICONS[run.kind] || RUN_ICONS.verify) + '</span>'
          + '<span class="run-kind">' + esc(RUN_LABELS[run.kind] || run.kind) + '</span>'
          + '<span class="verdict ' + verdictCls + '">' + esc(verdict) + '</span>'
          + '<span class="run-meta">' + esc(relativeTime(run.createdAt)) + ' · ' + esc(run.id) + '</span>';
        button.addEventListener("click", () => {
          selectedRunId = run.id;
          runList.querySelectorAll(".run").forEach((el) => el.classList.remove("selected"));
          button.classList.add("selected");
          renderPayload({ run });
        });
        runList.appendChild(button);
      }
    }

    function showRaw(text) {
      lastPayload = null;
      output.style.display = "";
      outputReadable.style.display = "none";
      output.textContent = text;
    }

    document.addEventListener("click", async (event) => {
      const trigger = event.target instanceof Element ? event.target.closest("[data-action]") : null;
      if (!trigger) return;

      const action = trigger.dataset.action;
      if (!action) return;
      if (action === "studio-review") {
        outputReadable.innerHTML = '<div class="welcome"><p>Running full review…</p></div>';
        output.style.display = "none";
        outputReadable.style.display = "";
      } else {
        showRaw("Running " + action + "…");
      }
      setState("Running review…", "busy");
      trigger.disabled = true;
      try {
        const route = action === "studio-review"
          ? "/api/studio/review"
          : "/api/runs/" + action;
        const shouldApply = action === "loop" || trigger.dataset.apply === "true";
        const reviewBody = action === "studio-review" ? buildReviewRequest() : { apply: shouldApply };
        const body = JSON.stringify(reviewBody);
        const payload = await api(route, { method: "POST", body });
        selectedRunId = payload.run?.id ?? null;
        renderPayload(payload);
        await refreshRuns();
      } catch (error) {
        showRaw(error.stack || error.message);
        setState("Error", "bad");
      } finally {
        trigger.disabled = false;
      }
    });

    async function boot() {
      try {
        await refreshRuns();
        showWelcome();
        updateSourceBadge();
        setState("Ready — choose a source and run review", "ok");
      } catch (error) {
        const msg = error.message || String(error);
        if (msg.includes("unauthorized") || msg.includes("Sign in")) {
          window.location.href = "/login?returnTo=%2Fstudio";
          return;
        }
        runList.innerHTML = '<div class="empty"><span><b>Could not load runs.</b><br>' + esc(msg) + '</span></div>';
        showRaw(msg);
        setState("Error", "bad");
      }
    }

    boot();
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
