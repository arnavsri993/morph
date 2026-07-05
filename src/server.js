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
          scanners: {
            morph: "native drift + patch engine",
            buoy: "@buoy-design/core health scoring",
            eslint: "tailwind-palette-guard + metamask design-tokens",
            axe: "axe-core accessibility (HTML)"
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
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      color-scheme: dark;
      --bg: #09090b;
      --surface: rgba(24, 24, 27, 0.55);
      --surface-solid: #18181b;
      --ink: #fafafa;
      --muted: #a1a1aa;
      --faint: #71717a;
      --line: rgba(255, 255, 255, 0.08);
      --line-strong: rgba(255, 255, 255, 0.14);
      --brand-a: #818cf8;
      --brand-b: #a78bfa;
      --cyan: #22d3ee;
      --ok: #4ade80;
      --bad: #f87171;
      --warn: #fbbf24;
      --font: "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      --radius: 20px;
      --radius-sm: 12px;
      --page-pad: clamp(24px, 5vw, 64px);
      --section-gap: 56px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: var(--font);
      font-size: 16px;
      line-height: 1.7;
      -webkit-font-smoothing: antialiased;
    }
    ::selection { background: rgba(129, 140, 248, 0.35); }
    :focus-visible { outline: 2px solid var(--cyan); outline-offset: 3px; border-radius: 8px; }
    a { color: inherit; }
    code { font-family: var(--mono); font-size: 0.86em; color: var(--cyan); }

    .backdrop { position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; }
    .aurora {
      position: absolute;
      width: 140%;
      height: 140%;
      left: -20%;
      top: -30%;
      background:
        radial-gradient(ellipse 40% 35% at 20% 20%, rgba(129, 140, 248, 0.18), transparent 70%),
        radial-gradient(ellipse 35% 30% at 80% 10%, rgba(167, 139, 250, 0.14), transparent 70%),
        radial-gradient(ellipse 30% 25% at 60% 80%, rgba(34, 211, 238, 0.08), transparent 70%);
      animation: aurora-drift 24s ease-in-out infinite alternate;
    }
    @keyframes aurora-drift {
      to { transform: translate3d(2%, 3%, 0) scale(1.04); }
    }
    .grid-bg {
      position: absolute; inset: 0;
      background-image: radial-gradient(rgba(255, 255, 255, 0.09) 1px, transparent 1px);
      background-size: 32px 32px;
      -webkit-mask-image: radial-gradient(ellipse 90% 60% at 50% 0%, black 20%, transparent 80%);
      mask-image: radial-gradient(ellipse 90% 60% at 50% 0%, black 20%, transparent 80%);
      opacity: 0.35;
    }

    /* ── Top nav ───────────────────────────────────────────────────── */
    .nav {
      position: sticky;
      top: 0;
      z-index: 40;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      min-height: 72px;
      padding: 0 var(--page-pad);
      border-bottom: 1px solid var(--line);
      background: rgba(9, 9, 11, 0.72);
      -webkit-backdrop-filter: blur(20px) saturate(1.4);
      backdrop-filter: blur(20px) saturate(1.4);
    }
    .nav-left { display: flex; align-items: center; gap: 32px; min-width: 0; }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 600;
      font-size: 15px;
      letter-spacing: -0.02em;
      text-decoration: none;
      color: var(--ink);
      flex: none;
    }
    .mark {
      width: 32px; height: 32px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      font-size: 14px;
      font-weight: 700;
      color: #fff;
      background: linear-gradient(135deg, var(--brand-a), var(--brand-b));
      box-shadow: 0 0 24px -4px rgba(129, 140, 248, 0.6);
    }
    .nav-links { display: flex; align-items: center; gap: 4px; }
    .nav-link {
      color: var(--muted);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      padding: 8px 14px;
      border-radius: 999px;
      transition: color 0.2s ease, background 0.2s ease;
    }
    .nav-link:hover { color: var(--ink); background: rgba(255, 255, 255, 0.05); }
    .nav-link.active { color: var(--ink); background: rgba(255, 255, 255, 0.08); }
    .nav-right { display: flex; align-items: center; gap: 16px; flex: none; }
    .project-pill {
      display: none;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border: 1px solid var(--line);
      border-radius: 999px;
      font-size: 13px;
      color: var(--muted);
      background: rgba(255, 255, 255, 0.03);
    }
    .project-pill b { color: var(--ink); font-weight: 600; }
    .state-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 6px 14px;
      font-size: 13px;
      font-weight: 500;
      color: var(--muted);
      white-space: nowrap;
      background: rgba(255, 255, 255, 0.03);
    }
    .state-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--faint); transition: background 0.2s ease, box-shadow 0.2s ease; }
    .state-chip[data-state="ok"] .state-dot { background: var(--ok); box-shadow: 0 0 12px rgba(74, 222, 128, 0.7); }
    .state-chip[data-state="warn"] .state-dot { background: var(--warn); box-shadow: 0 0 12px rgba(251, 191, 36, 0.6); }
    .state-chip[data-state="busy"] .state-dot { background: var(--cyan); box-shadow: 0 0 12px rgba(34, 211, 238, 0.7); animation: pulse 1.2s ease-in-out infinite; }
    .state-chip[data-state="bad"] .state-dot { background: var(--bad); box-shadow: 0 0 12px rgba(248, 113, 113, 0.7); }
    @keyframes pulse { 50% { opacity: 0.35; } }
    .user-chip { display: flex; align-items: center; gap: 10px; }
    .user-avatar {
      width: 32px; height: 32px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      font-size: 13px;
      font-weight: 600;
      color: #fff;
      background: linear-gradient(135deg, var(--brand-a), var(--brand-b));
    }
    .user-name { font-size: 14px; font-weight: 500; color: var(--muted); }
    .top-link {
      color: var(--muted);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition: color 0.2s ease;
      white-space: nowrap;
    }
    .top-link:hover { color: var(--ink); }

    .page { padding: 48px var(--page-pad) 96px; }
    .content {
      display: grid;
      gap: var(--section-gap);
      width: 100%;
      max-width: 920px;
      margin: 0 auto;
    }

    /* ── Page head ─────────────────────────────────────────────────── */
    .page-head { display: grid; gap: 28px; }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      width: fit-content;
      padding: 6px 14px 6px 8px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.03);
      color: var(--muted);
      font-size: 13px;
      font-weight: 500;
    }
    .eyebrow-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: var(--ok);
      box-shadow: 0 0 12px rgba(74, 222, 128, 0.6);
    }
    h1 {
      margin: 0;
      font-size: clamp(36px, 5vw, 52px);
      line-height: 1.05;
      letter-spacing: -0.03em;
      font-weight: 600;
    }
    .title-gradient {
      background: linear-gradient(to right, #fafafa, #a1a1aa 45%, #818cf8 80%, #a78bfa);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .lede { margin: 0; color: var(--muted); font-size: 17px; line-height: 1.75; max-width: 56ch; }
    .lede code { font-size: 0.9em; }
    h2 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.02em; }
    h3 { margin: 0 0 8px; font-size: 16px; font-weight: 600; }
    p { margin: 0; color: var(--muted); }

    .actions { display: flex; flex-wrap: wrap; gap: 12px; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      min-height: 48px;
      padding: 0 22px;
      border-radius: 999px;
      border: 1px solid transparent;
      font: inherit;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      text-decoration: none;
      white-space: nowrap;
      transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
    }
    .btn svg { flex: none; }
    .btn:active { transform: translateY(1px); }
    .btn-primary {
      position: relative;
      color: #fff;
      background: linear-gradient(135deg, var(--brand-a), var(--brand-b));
      box-shadow: 0 0 40px -8px rgba(129, 140, 248, 0.7);
      overflow: hidden;
    }
    .btn-primary::before {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      padding: 1px;
      background: linear-gradient(135deg, rgba(255,255,255,0.5), transparent 50%, rgba(255,255,255,0.2));
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
    }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 0 56px -8px rgba(129, 140, 248, 0.85); }
    .btn-ghost {
      color: var(--ink);
      background: rgba(255, 255, 255, 0.04);
      border-color: var(--line-strong);
    }
    .btn-ghost:hover { border-color: rgba(255, 255, 255, 0.22); background: rgba(255, 255, 255, 0.07); }
    .btn[disabled] { opacity: 0.5; cursor: wait; transform: none !important; }

    /* ── Spotlight cards ───────────────────────────────────────────── */
    .spotlight {
      position: relative;
      overflow: hidden;
      border-radius: var(--radius);
      border: 1px solid var(--line);
      background: var(--surface);
      -webkit-backdrop-filter: blur(16px);
      backdrop-filter: blur(16px);
    }
    .spotlight::before {
      content: "";
      position: absolute;
      inset: 0;
      background: radial-gradient(480px circle at var(--spot-x, 50%) var(--spot-y, 0%), rgba(129, 140, 248, 0.12), transparent 45%);
      opacity: 0;
      transition: opacity 0.45s ease;
      pointer-events: none;
      z-index: 0;
    }
    .spotlight:hover::before { opacity: 1; }
    .spotlight > * { position: relative; z-index: 1; }

    .panel {
      position: relative;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--surface);
      -webkit-backdrop-filter: blur(16px);
      backdrop-filter: blur(16px);
    }
    .panel-pad { padding: 32px; }
    .panel-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 20px 28px;
      border-bottom: 1px solid var(--line);
    }
    .panel-head .hint { font-size: 13px; color: var(--faint); }

    .stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
    .stat {
      position: relative;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--surface);
      padding: 28px 32px;
      display: grid;
      gap: 8px;
      -webkit-backdrop-filter: blur(16px);
      backdrop-filter: blur(16px);
      transition: border-color 0.25s ease, transform 0.25s ease;
    }
    .stat::before {
      content: "";
      position: absolute;
      inset: 0;
      background: radial-gradient(400px circle at var(--spot-x, 50%) var(--spot-y, 0%), rgba(129, 140, 248, 0.1), transparent 50%);
      opacity: 0;
      transition: opacity 0.45s ease;
      pointer-events: none;
    }
    .stat:hover { border-color: rgba(255, 255, 255, 0.14); transform: translateY(-2px); }
    .stat:hover::before { opacity: 1; }
    .stat-label { font-size: 13px; font-weight: 500; color: var(--faint); }
    .stat-value {
      font-size: 40px;
      font-weight: 600;
      letter-spacing: -0.03em;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
    }
    .stat-value.ok { color: var(--ok); }
    .stat-value.bad { color: var(--bad); }
    .stat-sub { font-size: 13px; color: var(--faint); font-family: var(--mono); }

    .pipeline {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 16px 24px;
      padding: 20px 28px;
      border: 1px solid rgba(129, 140, 248, 0.2);
      border-radius: var(--radius);
      background: linear-gradient(90deg, rgba(129, 140, 248, 0.06), rgba(167, 139, 250, 0.03));
    }
    .pipeline[hidden] { display: none; }
    .pipe-stage { display: flex; align-items: baseline; gap: 10px; }
    .pipe-k { font-size: 12px; font-weight: 500; color: var(--faint); text-transform: uppercase; letter-spacing: 0.06em; }
    .pipe-v { font-family: var(--mono); font-size: 14px; font-weight: 600; }
    .pipe-v.ok { color: var(--ok); }
    .pipe-v.bad { color: var(--bad); }
    .pipe-v.warn { color: var(--warn); }
    .pipe-arrow { color: var(--faint); font-size: 18px; }
    .pipe-summary { margin-left: auto; font-size: 14px; color: var(--muted); }

    .workgrid { display: grid; gap: 28px; }
    .history-list { max-height: 420px; overflow: auto; padding: 12px; }
    .run {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr) auto;
      gap: 6px 16px;
      align-items: center;
      width: 100%;
      padding: 16px 18px;
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
      transition: background 0.2s ease, border-color 0.2s ease;
    }
    .run:hover { background: rgba(255, 255, 255, 0.04); border-color: var(--line); }
    .run.selected { background: rgba(129, 140, 248, 0.08); border-color: rgba(129, 140, 248, 0.25); }
    .run-icon {
      grid-row: span 2;
      width: 40px; height: 40px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      color: var(--brand-a);
      background: rgba(129, 140, 248, 0.1);
      border: 1px solid rgba(129, 140, 248, 0.18);
    }
    .run-kind { font-size: 15px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .run-meta { grid-column: 2 / 4; font-family: var(--mono); font-size: 12px; color: var(--faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .verdict {
      justify-self: end;
      font-family: var(--mono);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      border-radius: 999px;
      padding: 4px 12px;
    }
    .verdict.pass { color: var(--ok); background: rgba(74, 222, 128, 0.1); }
    .verdict.fail { color: var(--bad); background: rgba(248, 113, 113, 0.1); }
    .verdict.stored { color: var(--muted); background: rgba(255, 255, 255, 0.06); }
    .empty {
      display: grid;
      justify-items: center;
      gap: 14px;
      padding: 64px 32px;
      text-align: center;
      color: var(--faint);
      font-size: 15px;
    }
    .empty svg { opacity: 0.4; }
    .empty b { color: var(--muted); font-weight: 500; }

    .seg {
      display: inline-flex;
      gap: 4px;
      padding: 4px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.03);
    }
    .seg button {
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: var(--muted);
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      padding: 6px 16px;
      cursor: pointer;
      transition: background 0.2s ease, color 0.2s ease;
    }
    .seg button.active { background: rgba(255, 255, 255, 0.1); color: var(--ink); }
    .seg button:hover:not(.active) { color: var(--ink); }

    pre#output {
      overflow: auto;
      margin: 0;
      min-height: 360px;
      max-height: 520px;
      padding: 24px 28px;
      background: transparent;
      color: #e4e4e7;
      font-family: var(--mono);
      font-size: 13px;
      line-height: 1.75;
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
      min-height: 360px;
      max-height: 520px;
      font-size: 14px;
      line-height: 1.65;
    }
    .readable details { border-bottom: 1px solid var(--line); }
    .readable details:last-child { border-bottom: none; }
    .readable summary {
      padding: 16px 28px;
      cursor: pointer;
      font-weight: 500;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 12px;
      user-select: none;
      list-style: none;
      transition: background 0.2s ease;
    }
    .readable summary:hover { background: rgba(255, 255, 255, 0.03); }
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
    .readable .detail-body { padding: 4px 28px 20px 40px; }
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

    /* ── Setup section ─────────────────────────────────────────────── */
    .section-title { margin: 0; }
    .section-title p { font-size: 15px; margin-top: 8px; line-height: 1.7; }
    .panel-tabs {
      display: inline-flex;
      gap: 4px;
      padding: 4px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.03);
      margin-bottom: 32px;
    }
    .panel-tabs button {
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: var(--muted);
      font: inherit;
      font-size: 14px;
      font-weight: 500;
      padding: 8px 20px;
      cursor: pointer;
      transition: background 0.2s ease, color 0.2s ease;
    }
    .panel-tabs button.active { background: rgba(255, 255, 255, 0.1); color: var(--ink); }
    .panel-tabs button:hover:not(.active) { color: var(--ink); }
    .tab-pane[hidden] { display: none; }
    .setup-panel {
      position: relative;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--surface);
      padding: 36px 40px 40px;
      -webkit-backdrop-filter: blur(16px);
      backdrop-filter: blur(16px);
    }
    .setup-panel::before {
      content: "";
      position: absolute;
      inset: 0;
      background: radial-gradient(600px circle at var(--spot-x, 50%) var(--spot-y, 0%), rgba(129, 140, 248, 0.08), transparent 50%);
      opacity: 0;
      transition: opacity 0.45s ease;
      pointer-events: none;
    }
    .setup-panel:hover::before { opacity: 1; }
    .setup-head { margin-bottom: 28px; position: relative; display: grid; gap: 10px; }
    .setup-head .source-badge { justify-self: start; margin-top: 4px; }
    .project-pill .sep { opacity: 0.35; }
    .setup-head h2 { margin: 0 0 10px; font-size: 22px; letter-spacing: -0.02em; }
    .setup-head p { margin: 0; color: var(--muted); font-size: 15px; line-height: 1.7; }
    .setup-stack { display: grid; gap: 32px; position: relative; }
    .source-pane { display: grid; gap: 20px; }
    .source-pane[hidden] { display: none; }
    .source-note { margin: 0; color: var(--faint); font-size: 14px; line-height: 1.7; }
    .github-connect {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: rgba(255, 255, 255, 0.02);
      padding: 20px 24px;
    }
    .github-connect strong { display: block; font-size: 15px; margin-bottom: 4px; font-weight: 500; }
    .github-connect span { color: var(--muted); font-size: 14px; }
    .auth-form { display: grid; gap: 10px; }
    .auth-form label { display: grid; gap: 10px; font-size: 14px; font-weight: 500; color: var(--muted); }
    .auth-form input {
      min-height: 52px;
      border: 1px solid var(--line-strong);
      border-radius: var(--radius-sm);
      padding: 0 18px;
      font: inherit;
      font-size: 15px;
      color: var(--ink);
      background: rgba(9, 9, 11, 0.6);
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .auth-form input::placeholder { color: var(--faint); }
    .auth-form input:focus {
      outline: none;
      border-color: var(--brand-a);
      box-shadow: 0 0 0 4px rgba(129, 140, 248, 0.15);
    }
    .auth-form .btn { justify-self: start; }
    .auth-status { font-size: 14px; display: flex; align-items: center; gap: 8px; }
    .auth-status::before { content: ""; width: 8px; height: 8px; border-radius: 50%; flex: none; }
    .auth-status.ready { color: var(--ok); }
    .auth-status.ready::before { background: var(--ok); box-shadow: 0 0 12px rgba(74, 222, 128, 0.6); }
    .auth-status.pending { color: var(--warn); }
    .auth-status.pending::before { background: var(--warn); box-shadow: 0 0 12px rgba(251, 191, 36, 0.5); }
    .instructions-field { display: grid; gap: 12px; }
    .instructions-field label { font-size: 14px; font-weight: 500; color: var(--muted); }
    .instructions-field textarea {
      min-height: 160px;
      resize: vertical;
      border: 1px solid var(--line-strong);
      border-radius: var(--radius-sm);
      padding: 18px 20px;
      font: inherit;
      font-size: 15px;
      line-height: 1.65;
      color: var(--ink);
      background: rgba(9, 9, 11, 0.6);
    }
    .instructions-field textarea::placeholder { color: var(--faint); }
    .instructions-field textarea:focus {
      outline: none;
      border-color: var(--brand-a);
      box-shadow: 0 0 0 4px rgba(129, 140, 248, 0.15);
    }
    .source-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-family: var(--mono);
      font-size: 12px;
      color: var(--warn);
      background: rgba(251, 191, 36, 0.08);
      border: 1px solid rgba(251, 191, 36, 0.2);
      border-radius: 999px;
      padding: 6px 14px;
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
      margin-top: 8px;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      overflow: hidden;
      background: rgba(9, 9, 11, 0.5);
    }
    .preview-frame img { display: block; width: 100%; height: auto; }
    .preview-meta {
      padding: 14px 18px;
      border-top: 1px solid var(--line);
      font-family: var(--mono);
      font-size: 12px;
      color: var(--faint);
      word-break: break-all;
    }
    .preview-empty {
      padding: 24px 20px;
      color: var(--faint);
      font-size: 14px;
      line-height: 1.7;
      border: 1px dashed var(--line);
      border-radius: var(--radius-sm);
      text-align: center;
    }

    .foot-note {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      color: var(--faint);
      font-size: 14px;
      line-height: 1.7;
      padding: 20px 24px;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: rgba(255, 255, 255, 0.02);
    }
    .foot-note code { font-size: 13px; }
    .foot-note svg { flex: none; margin-top: 3px; opacity: 0.5; }

    .welcome {
      padding: 56px 40px;
      text-align: center;
    }
    .welcome-icon {
      width: 56px; height: 56px;
      margin: 0 auto 20px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      color: var(--brand-a);
      background: rgba(129, 140, 248, 0.1);
      border: 1px solid rgba(129, 140, 248, 0.2);
    }
    .welcome h3 { margin: 0 0 12px; font-size: 20px; font-weight: 600; }
    .welcome p { max-width: 440px; margin: 0 auto 24px; font-size: 15px; line-height: 1.7; }

    @media (min-width: 900px) {
      .project-pill { display: inline-flex; }
    }
    @media (max-width: 720px) {
      .stats { grid-template-columns: 1fr; }
      .nav-links { display: none; }
      .user-name { display: none; }
      .setup-panel { padding: 28px 24px; }
      .panel-head { padding: 16px 20px; }
    }
    @media (max-width: 640px) {
      .pipe-summary { margin-left: 0; width: 100%; }
    }
    @media (prefers-reduced-motion: reduce) {
      * { transition-duration: 0.01ms !important; animation: none !important; }
    }
  </style>
</head>
<body>
  <div class="backdrop" aria-hidden="true">
    <div class="aurora"></div>
    <div class="grid-bg"></div>
  </div>

  <header class="nav">
    <div class="nav-left">
      <a class="brand" href="/" title="Back to morph">
        <span class="mark">m</span><span>morph</span>
      </a>
      <nav class="nav-links" aria-label="Studio">
        <a class="nav-link active" href="#overview">Overview</a>
        <a class="nav-link" href="#history">History</a>
      </nav>
    </div>
    <div class="nav-right">
      <span class="project-pill"><span>${workspaceName}</span><span class="sep">/</span><b>${projectName}</b></span>
      <span class="state-chip" id="stateChip" data-state="idle"><span class="state-dot"></span><span id="reviewState">Idle</span></span>
      ${userBlock}
    </div>
  </header>

  <div class="page">
    <main class="content">
      <section class="page-head" id="overview">
        <div class="eyebrow"><span class="eyebrow-dot"></span> Morph Studio</div>
        <h1><span class="title-gradient">Review agent UI</span><br>before it ships.</h1>
        <p class="lede">Connect a repo or preview URL, describe what the agent built, and get a deterministic drift scan with repairs and a merge gate verdict.</p>
        <div class="actions">
          <button class="btn btn-primary" data-action="studio-review" id="runReviewBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>
            Run full review
          </button>
        </div>
      </section>

      <section class="setup-panel spotlight" aria-label="Project source and agent instructions">
        <div class="setup-head">
          <h2>Project source</h2>
          <p>Point morph at the agent output you want reviewed.</p>
          <span class="source-badge" id="sourceBadge">local project</span>
        </div>
        <div class="panel-tabs" role="tablist" aria-label="Project source">
          <button type="button" class="active" data-source-tab="github" role="tab" aria-selected="true">GitHub</button>
          <button type="button" data-source-tab="url" role="tab" aria-selected="false">Preview URL</button>
        </div>
        <div class="setup-stack">
          <div class="source-pane" data-source-pane="github">
            <div class="github-connect">
              <div>
                <strong id="githubStatusLabel">${githubConnected ? "GitHub connected" : "Connect GitHub"}</strong>
                <span id="githubStatusText">${githubConnected ? githubLabel : "Sign in to review agent branches from your repos."}</span>
              </div>
              ${githubConnected
                ? `<span class="auth-status ready">Connected</span>`
                : `<a class="btn btn-ghost" href="/auth/github?returnTo=%2Fstudio">Connect GitHub</a>`}
            </div>
            <label class="auth-form" for="githubRepo">
              <span>Repository</span>
              <input id="githubRepo" name="githubRepo" type="text" required autocomplete="off" placeholder="owner/repo">
            </label>
            <p class="source-note">morph clones the repo, scores UI drift, and can re-render with a frontier design profile at <code>/transformed</code>.</p>
          </div>
          <div class="source-pane" data-source-pane="url" hidden>
            <form class="auth-form" id="previewForm" onsubmit="return false">
              <label for="previewUrl">Live preview URL</label>
              <input id="previewUrl" name="previewUrl" type="url" inputmode="url" autocomplete="url" required placeholder="https://your-app.vercel.app/page">
            </form>
            <p class="source-note">morph captures a Playwright screenshot and attaches it to the review receipt.</p>
            <div class="preview-frame" id="previewFrame" hidden>
              <img id="previewImage" alt="Playwright preview capture">
              <div class="preview-meta" id="previewMeta"></div>
            </div>
            <div class="preview-empty" id="previewPlaceholder">Run a review to see the capture here.</div>
          </div>
          <div class="instructions-field">
            <label for="agentInstructions">Agent instructions</label>
            <textarea id="agentInstructions" name="instructions" placeholder="What did the agent build? What should morph focus on — token drift, components, focus states, layout?"></textarea>
          </div>
        </div>
      </section>

      <section class="stats" aria-label="Review metrics">
        <div class="stat spotlight"><span class="stat-label">Review score</span><span class="stat-value" id="score">–</span><span class="stat-sub">out of 100 · gate ≥ 95</span></div>
        <div class="stat spotlight"><span class="stat-label">Merge gate</span><span class="stat-value" id="gate">–</span><span class="stat-sub">block_on_any_drift</span></div>
        <div class="stat spotlight"><span class="stat-label">Fixes applied</span><span class="stat-value" id="fixes">–</span><span class="stat-sub">deterministic patches</span></div>
        <div class="stat spotlight"><span class="stat-label">Runs stored</span><span class="stat-value" id="runs">0</span><span class="stat-sub">.morph/runs receipts</span></div>
      </section>

      <section class="pipeline spotlight" id="pipeline" hidden aria-label="Latest review pipeline">
        <div class="pipe-stage"><span class="pipe-k">Before</span><span class="pipe-v" id="pipeBefore">–</span></div>
        <span class="pipe-arrow" aria-hidden="true">→</span>
        <div class="pipe-stage"><span class="pipe-k">Repair</span><span class="pipe-v warn" id="pipeFixes">–</span></div>
        <span class="pipe-arrow" aria-hidden="true">→</span>
        <div class="pipe-stage"><span class="pipe-k">After</span><span class="pipe-v" id="pipeAfter">–</span></div>
        <span class="pipe-summary" id="pipeSummary"></span>
      </section>

      <section class="workgrid" id="history">
        <div class="panel spotlight">
          <div class="panel-head">
            <h2>Review history</h2>
            <span class="hint" id="historyHint">stored locally</span>
          </div>
          <div class="history-list" id="runList">Loading…</div>
        </div>
        <div class="panel spotlight" aria-live="polite">
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span>Full reviews repair an isolated <code>.studio-run</code> copy. A GitHub repo or preview URL is required.</span>
      </p>
    </main>
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
        sourceBadge.textContent = url ? "preview url · " + url : "preview url required";
      } else {
        const repo = githubRepoInput?.value.trim();
        sourceBadge.textContent = repo ? "github · " + repo : "github repo required";
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

      if (report.health?.score != null) {
        html += '<div style="margin-bottom:10px;padding:10px;border:1px solid var(--line);border-radius:10px;font-size:12px">';
        html += '<strong>Buoy health</strong> · ' + esc(String(report.health.score)) + '/100';
        if (report.health.tier) html += ' · ' + esc(report.health.tier);
        if (Array.isArray(report.health.suggestions) && report.health.suggestions.length) {
          html += '<ul class="r-list" style="margin-top:6px">' + report.health.suggestions.slice(0, 3).map((item) => '<li>' + esc(item) + '</li>').join("") + '</ul>';
        }
        html += '</div>';
      }

      if (report.engines) {
        html += '<div class="r-chips" style="margin-bottom:10px">';
        for (const [engine, count] of Object.entries(report.engines)) {
          if (engine === "merged") continue;
          html += '<span class="r-chip">' + esc(engine) + ': ' + esc(String(count)) + '</span>';
        }
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
        + '<p>Connect a source, add instructions, then run a full review to see your receipt here.</p>'
        + '</div>';
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

    document.querySelectorAll(".spotlight, .stat, .setup-panel").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const rect = el.getBoundingClientRect();
        el.style.setProperty("--spot-x", ((e.clientX - rect.left) / rect.width * 100) + "%");
        el.style.setProperty("--spot-y", ((e.clientY - rect.top) / rect.height * 100) + "%");
      });
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
