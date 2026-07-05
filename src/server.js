import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
  billingPageHtml,
  createBillingManager,
  readBillingState
} from "./billing.js";
import { brandLink, brandStyles, headLinks, headerBarStyles } from "./brand.js";
import {
  CHROME_THEME_COLOR,
  backdropHtml,
  backdropStyles,
  buttonStyles,
  chromeReset,
  chromeTokens,
  mobileNavScript,
  reducedMotionStyles,
  shellStyles
} from "./chrome.js";
import { landingHtml } from "./landing.js";
import { fetchPageForTransform } from "./preview.js";
import { transformSite } from "./transform.js";
import { cloneRepo } from "./github.js";

export async function createMorphHandler(config, options = {}) {
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
  const auth = createAuthManager(config, runtimeAuth);
  const billing = createBillingManager(config);

  return async (request, response) => {
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

      if (request.method === "GET" && url.pathname.startsWith("/assets/")) {
        return serveAsset(response, url.pathname);
      }

      if (request.method === "GET" && url.pathname === "/") {
        return sendHtml(response, landingHtml(config, session));
      }

      if (request.method === "GET" && (url.pathname === "/studio" || url.pathname === "/studio/")) {
        return sendHtml(response, await dashboardHtml(config, session, runtimeAuth, auth.getAppUrl(request, host, port)));
      }

      if (request.method === "GET" && url.pathname === "/billing") {
        const billingState = await readBillingState(config);
        return sendHtml(response, billingPageHtml({
          subscription: billingState
        }));
      }

      if (request.method === "GET" && url.pathname === "/api/health") {
        const github = getGithubCredentials(runtimeAuth);
        const google = getGoogleCredentials(runtimeAuth);
        return sendJson(response, 200, {
          ok: true,
          product: "morph",
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

      if (request.method === "GET" && url.pathname === "/api/billing") {
        const state = await readBillingState(config);
        return sendJson(response, 200, {
          billingMode: billing.getBillingMode(),
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
          githubToken: session?.githubToken ?? null,
          instructions: body.instructions,
          referenceImage: body.referenceImage,
          generateReference: body.generateReference
        });
        const stored = await storeRun(config, "studio-review", review);
        return sendJson(response, 201, { run: stored });
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
        const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"));
        if (returnTo.startsWith("/studio")) {
          const separator = returnTo.includes("?") ? "&" : "?";
          return redirect(response, `${returnTo}${separator}error=${encodeURIComponent(error.message)}`);
        }
        const encodedReturnTo = encodeURIComponent(returnTo);
        return redirect(response, `/login?error=${encodeURIComponent(error.message)}&returnTo=${encodedReturnTo}`);
      }
      return sendJson(response, error.statusCode ?? 500, {
        error: error.code ?? "server_error",
        message: error.message
      });
    }
  };
}

export async function serveMorph(config, options = {}) {
  const handler = await createMorphHandler(config, options);
  const host = options.host ?? config.server?.host ?? "127.0.0.1";
  const port = Number(options.port ?? config.server?.port ?? 4177);
  const server = createServer(handler);
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
  const targetFile = normalizeReviewTargetFile(options.targetFile);
  let source = String(options.source ?? "").trim();

  if (source !== "fixture") {
    const resolved = resolveStudioSource(options);
    if (resolved.source === "github" || resolved.source === "url") {
      return runTransformReview(config, {
        source: resolved.source,
        githubRepo: resolved.githubRepo,
        previewUrl: resolved.previewUrl,
        githubToken: options.githubToken ?? null,
        instructions,
        referenceImage: options.referenceImage,
        generateReference: options.generateReference
      });
    }
    source = resolved.source;
  }

  const studioRoot = path.join(os.tmpdir(), ".studio-run");
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
  const reviewFilePath = path.join(studioProjectRoot, targetFile);
  const codeBefore = await readFile(reviewFilePath, "utf8");
  const before = await createReport(studioConfig);
  const repair = await repairProject(studioConfig, { apply: true });
  const after = repair.after ?? await createReport(studioConfig);
  const codeAfter = await readFile(reviewFilePath, "utf8");

  const userJourney = [];
  if (source === "fixture") {
    userJourney.push(`Scan seeded agent drift in ${targetFile}.`);
  }
  if (instructions) {
    userJourney.push(`Apply agent instructions: ${instructions.length > 140 ? `${instructions.slice(0, 140)}…` : instructions}`);
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
    engine: "design_system_repair",
    instructions: instructions || null,
    githubRepo: null,
    previewUrl: null,
    preview: null,
    currentScore: before.score,
    possibleScore: after.score,
    targetFile,
    codeReview: {
      file: targetFile,
      before: codeBefore,
      after: codeAfter,
      changed: codeBefore !== codeAfter
    },
    sourceProjectRoot: path.relative(config.configDir, config.projectRoot),
    studioProjectRoot: path.relative(studioRoot, studioProjectRoot),
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

async function runTransformReview(config, {
  source,
  githubRepo = null,
  previewUrl = null,
  githubToken = null,
  instructions,
  referenceImage,
  generateReference
}) {
  const studioRoot = path.join(os.tmpdir(), ".studio-run");
  const checkoutRoot = path.join(studioRoot, "checkout");
  const transformedRoot = path.join(studioRoot, "transformed");
  await mkdir(studioRoot, { recursive: true });

  let preview = null;
  if (source === "github") {
    try {
      await cloneRepo(githubRepo, checkoutRoot, { token: githubToken || undefined });
    } catch (error) {
      throw new HttpError(422, "github_clone_failed", `Could not clone ${githubRepo}: ${error.message}`);
    }
  } else {
    preview = await fetchPageForTransform(previewUrl, checkoutRoot);
    if (preview.status !== "captured") {
      throw new HttpError(422, "url_fetch_failed", preview.error || "Could not fetch the preview URL.");
    }
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
  const userJourney = source === "github"
    ? [
        `Clone agent repo ${githubRepo} (shallow).`,
        `Score the current UI: ${before.score}/100.`,
        "Research the live site: meta, audience, navigation, sections, events, partners, and social proof.",
        `Mapped ${transform.siteResearch?.cardCount ?? 0} content blocks and ${transform.siteResearch?.topics?.length ?? 0} key topics before redesign.`,
        `Select the best-matching profile from the design intelligence database: ${transform.profile.name} (${transform.profile.inspiration}).`,
        "Preserve visible preferences from the original site: color mode, brand colors, and content structure.",
        "Re-render the site with the profile's full design system: type scale, palette, spacing rhythm, components, motion, responsive rules.",
        `Possible score after redesign: ${after.score}/100. Preview at /transformed/index.html.`
      ]
    : [
        `Fetch live site at ${previewUrl}.`,
        `Score the current UI: ${before.score}/100.`,
        "Research the live site: meta, audience, navigation, sections, events, partners, and social proof.",
        `Mapped ${transform.siteResearch?.cardCount ?? 0} content blocks and ${transform.siteResearch?.topics?.length ?? 0} key topics before redesign.`,
        `Select the best-matching profile from the design intelligence database: ${transform.profile.name} (${transform.profile.inspiration}).`,
        "Preserve visible preferences from the original site: color mode, brand colors, and content structure.",
        "Re-render the site with the profile's full design system: type scale, palette, spacing rhythm, components, motion, responsive rules.",
        `Possible score after redesign: ${after.score}/100. Preview at /transformed/index.html.`
      ];

  return {
    schemaVersion: "morph.studio-review.v1",
    generatedAt: new Date().toISOString(),
    project: config.projectName,
    isolated: true,
    source,
    engine: "design_db_transform",
    instructions: instructions || null,
    githubRepo: source === "github" ? githubRepo : null,
    previewUrl: source === "url" ? previewUrl : null,
    preview,
    currentScore: before.score,
    possibleScore: after.score,
    targetFile: transform.codeReview.file,
    codeReview: transform.codeReview,
    transform: {
      profile: transform.profile,
      designDatabase: transform.designDatabase,
      content: transform.content,
      siteResearch: transform.siteResearch,
      improvement: transform.improvement,
      outputFiles: transform.output.files
    },
    transformedPreviewPath: "/transformed/index.html",
    userJourney,
    before,
    repair: {
      runId: null,
      applied: true,
      replacements: transform.before.findings.length,
      patches: [{ file: "index.html", replacements: [] }, { file: "morph-theme.css", replacements: [] }],
      risk: "full_rerender_from_design_database"
    },
    after,
    redesignVerdict: after.verdict,
    redesignPasses: after.verdict === "pass",
    finalVerdict: before.verdict,
    passed: before.verdict === "pass",
    ciSummary: `Current UI ${before.score}/100${before.verdict === "pass" ? " passes" : " fails"} the gate. After redesign: ${after.score}/100. ${transform.summary}`
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
      suggestedFix: "Handled by the morph design-database transform."
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

const ASSETS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "assets");

async function serveAsset(response, pathname) {
  const relative = decodeURIComponent(pathname.replace(/^\/assets\/?/, ""));
  if (!relative || relative.includes("..")) {
    return sendJson(response, 400, { error: "invalid_path" });
  }
  const target = path.resolve(ASSETS_DIR, relative);
  if (!target.startsWith(ASSETS_DIR + path.sep)) {
    return sendJson(response, 400, { error: "invalid_path" });
  }
  try {
    const body = await readFile(target);
    const type = TRANSFORMED_CONTENT_TYPES[path.extname(target).toLowerCase()] ?? "application/octet-stream";
    response.writeHead(200, { "content-type": type, "cache-control": "public, max-age=86400" });
    response.end(body);
  } catch {
    return sendJson(response, 404, { error: "not_found" });
  }
}

async function serveTransformedFile(response, _config, pathname) {
  const transformedRoot = path.resolve(os.tmpdir(), ".studio-run/transformed");
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

function isGithubRepoReference(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return false;
  if (/^[\w.-]+\/[\w.-]+$/.test(raw)) return true;
  return /github\.com\/[^/?#]+\/[^/?#]+/i.test(raw);
}

function looksLikePreviewUrl(value) {
  const raw = String(value ?? "").trim();
  if (!/^https?:\/\//i.test(raw)) return false;
  return !isGithubRepoReference(raw);
}

function normalizeReviewTargetFile(value) {
  const candidate = String(value ?? DEFAULT_REVIEW_FILE).trim().replace(/^\/+/, "");
  if (!candidate || candidate.includes("..")) {
    throw new HttpError(400, "invalid_target_file", "Target file must be a relative path inside the project.");
  }
  return candidate;
}

function resolveStudioSource(options) {
  const previewUrl = String(options.previewUrl ?? "").trim();
  const githubRepo = normalizeGithubRepo(options.githubRepo);
  let source = String(options.source ?? "").trim();

  if (!source) {
    if (previewUrl && githubRepo) {
      throw new HttpError(400, "ambiguous_source", "Provide either a GitHub repo or a preview URL, not both.");
    }
    if (previewUrl) source = "url";
    else if (githubRepo) {
      if (looksLikePreviewUrl(githubRepo)) {
        return { source: "url", previewUrl: String(options.githubRepo ?? "").trim(), githubRepo: null };
      }
      source = "github";
    } else {
      throw new HttpError(400, "missing_project_source", "Connect a GitHub repo or provide a preview URL before running a review.");
    }
  }

  if (source === "github" && !previewUrl && looksLikePreviewUrl(githubRepo)) {
    return { source: "url", previewUrl: String(options.githubRepo ?? "").trim(), githubRepo: null };
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
      mode: billing.getBillingMode()
    }
  };
}


function renderGithubConnectBlock({ githubConnected, githubLabel, githubConfigured, appUrl }) {
  if (githubConnected) {
    return `<div class="github-connect">
              <div>
                <strong id="githubStatusLabel">GitHub connected</strong>
                <span id="githubStatusText">Signed in as ${githubLabel}. Private repos can be cloned for review.</span>
              </div>
              <span class="auth-status ready">Connected</span>
            </div>`;
  }

  if (!githubConfigured) {
    return `<div class="github-connect">
              <div>
                <strong>Enable GitHub sign-in</strong>
                <span>Save OAuth credentials below, then connect your GitHub account for private repos.</span>
              </div>
            </div>
            <form class="auth-form" id="githubOAuthForm">
              <label for="githubClientId">GitHub OAuth Client ID
                <input id="githubClientId" name="clientId" type="text" required autocomplete="off" placeholder="Iv1.…">
              </label>
              <label for="githubClientSecret">GitHub OAuth Client Secret
                <input id="githubClientSecret" name="clientSecret" type="password" required autocomplete="off" placeholder="••••••••">
              </label>
              <button type="submit" class="btn btn-ghost">Save credentials</button>
              <p class="auth-status pending" id="githubOAuthStatus" hidden></p>
            </form>
            <p class="github-setup-note">Create an OAuth App at <a href="https://github.com/settings/developers" target="_blank" rel="noreferrer">github.com/settings/developers</a> with callback <code>${appUrl}/auth/github/callback</code>. Public repos work without sign-in.</p>`;
  }

  return `<div class="github-connect">
            <div>
              <strong id="githubStatusLabel">Connect GitHub</strong>
              <span id="githubStatusText">Sign in for private repos. Public repos clone without sign-in.</span>
            </div>
            <a class="btn btn-ghost" href="/auth/github?returnTo=${encodeURIComponent("/studio?source=github")}">Connect GitHub</a>
          </div>`;
}

async function dashboardHtml(config, session, runtimeAuth, appUrl) {
  const githubConnected = session?.provider === "github";
  const githubLabel = githubConnected ? escapeHtml(session.name || session.email || "GitHub account") : "";
  const githubConfigured = isGithubConfigured(runtimeAuth);
  const safeAppUrl = escapeHtml(appUrl);
  const githubConnectBlock = renderGithubConnectBlock({
    githubConnected,
    githubLabel,
    githubConfigured,
    appUrl: safeAppUrl
  });
  const userBlock = session
    ? `<div class="user-chip"><span class="user-avatar" aria-hidden="true">${escapeHtml((session.name || session.email || "?").slice(0, 1).toUpperCase())}</span><span class="user-name">${escapeHtml(session.name || session.email)}</span></div><a class="top-link" href="/auth/logout">Sign out</a>`
    : `<a class="top-link" href="/login?returnTo=%2Fstudio">Log in</a>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>morph Studio</title>
  <meta name="theme-color" content="${CHROME_THEME_COLOR}">
  ${headLinks()}
  <style>
    ${chromeTokens(`
      --drift-visual: #f472b6;
      --drift-visual-dim: rgba(244, 114, 182, 0.14);
      --drift-component: #818cf8;
      --drift-component-dim: rgba(129, 140, 248, 0.14);
      --drift-interaction: #22d3ee;
      --drift-interaction-dim: rgba(34, 211, 238, 0.14);
      --drift-responsive: #c084fc;
      --drift-responsive-dim: rgba(192, 132, 252, 0.14);
    `)}
    ${chromeReset({ fontSize: "15px" })}
    ${backdropStyles()}
    ${shellStyles()}
    ${buttonStyles()}
    .skip-link {
      position: absolute;
      left: -9999px;
      top: 12px;
      z-index: 100;
      padding: 10px 18px;
      border-radius: var(--radius-sm);
      background: var(--surface-elevated);
      color: var(--ink);
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
      box-shadow: var(--shadow-md);
    }
    .skip-link:focus { left: 12px; }
    a { color: inherit; }
    code { font-family: var(--mono); font-size: 0.86em; color: var(--cyan); }
    ${headerBarStyles()}
    .nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      min-height: 72px;
      padding: 0 var(--page-pad);
      flex-wrap: wrap;
    }
    .site-header.nav .mobile-menu { width: 100%; flex-basis: 100%; }
    .nav-left { display: flex; align-items: center; gap: 32px; min-width: 0; }
    ${brandStyles()}
    .nav-right { display: flex; align-items: center; gap: 16px; flex: none; }
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

    .page { padding: clamp(40px, 5vw, 56px) var(--page-pad) clamp(80px, 8vw, 112px); }
    .content {
      display: grid;
      gap: var(--section-gap);
      width: 100%;
      max-width: min(1040px, 100%);
      margin: 0 auto;
    }

    /* ── Page head ─────────────────────────────────────────────────── */
    .page-head { display: grid; gap: 36px; }
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
    .lede { margin: 0; color: var(--muted); font-size: 17px; line-height: 1.8; max-width: 62ch; }
    .lede code { font-size: 0.9em; }
    h2 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.02em; }
    h3 { margin: 0 0 8px; font-size: 16px; font-weight: 600; }
    p { margin: 0; color: var(--muted); }

    .actions { display: flex; flex-wrap: wrap; gap: 12px; }
    .btn[disabled] { opacity: 0.5; cursor: wait; transform: none !important; }

    /* ── Spotlight cards ───────────────────────────────────────────── */
    .spotlight {
      position: relative;
      overflow: hidden;
      border-radius: var(--radius);
      border: 1px solid var(--line);
      background: var(--surface);
      -webkit-backdrop-filter: blur(20px);
      backdrop-filter: blur(20px);
      box-shadow: var(--shadow-sm);
      transition: border-color 0.25s ease, box-shadow 0.25s ease;
    }
    .spotlight:hover { border-color: var(--line-strong); box-shadow: var(--shadow-md); }
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
      -webkit-backdrop-filter: blur(20px);
      backdrop-filter: blur(20px);
      box-shadow: var(--shadow-sm);
    }
    .panel-pad { padding: 32px; }
    .panel-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 24px;
      border-bottom: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.015);
    }
    .panel-head h2 { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
    .panel-head .hint { font-size: 12px; color: var(--faint); font-family: var(--mono); }

    .stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
    .stat {
      position: relative;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--surface);
      padding: 24px 28px;
      display: grid;
      gap: 6px;
      -webkit-backdrop-filter: blur(20px);
      backdrop-filter: blur(20px);
      box-shadow: var(--shadow-sm);
      transition: border-color 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease;
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
    .stat:hover { border-color: rgba(255, 255, 255, 0.14); transform: translateY(-2px); box-shadow: var(--shadow-md); }
    .stat:hover::before { opacity: 1; }
    .stat-label { font-size: 12px; font-weight: 500; color: var(--faint); text-transform: uppercase; letter-spacing: 0.05em; }
    .stat-value {
      font-size: clamp(32px, 4vw, 40px);
      font-weight: 600;
      letter-spacing: -0.03em;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
    }
    .stat-value.ok { color: var(--ok); text-shadow: 0 0 24px rgba(74, 222, 128, 0.25); }
    .stat-value.bad { color: var(--bad); text-shadow: 0 0 24px rgba(248, 113, 113, 0.2); }
    .stat-value.warn { color: var(--warn); text-shadow: 0 0 24px rgba(251, 191, 36, 0.2); }
    .stat-sub { font-size: 12px; color: var(--faint); font-family: var(--mono); letter-spacing: -0.01em; }

    .pipeline {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 14px 20px;
      padding: 18px 24px;
      border: 1px solid rgba(129, 140, 248, 0.22);
      border-radius: var(--radius);
      background: linear-gradient(90deg, rgba(129, 140, 248, 0.07), rgba(167, 139, 250, 0.04));
      box-shadow: var(--shadow-sm);
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
    @media (min-width: 980px) {
      .workgrid { grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr); align-items: start; }
    }
    .history-list {
      max-height: 440px;
      overflow: auto;
      padding: 8px;
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
    }
    .history-list::-webkit-scrollbar { width: 6px; }
    .history-list::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.12); border-radius: 999px; }
    .history-list::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
    .run {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr) auto;
      gap: 4px 14px;
      align-items: center;
      width: 100%;
      padding: 14px 16px;
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
      transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
    }
    .run + .run { margin-top: 2px; }
    .run:hover { background: rgba(255, 255, 255, 0.04); border-color: var(--line); }
    .run:focus-visible { outline: 2px solid var(--brand-a); outline-offset: -2px; }
    .run.selected {
      background: rgba(129, 140, 248, 0.1);
      border-color: rgba(129, 140, 248, 0.28);
      box-shadow: inset 3px 0 0 var(--brand-a);
    }
    .run-icon {
      grid-row: span 2;
      width: 40px; height: 40px;
      border-radius: var(--radius-sm);
      display: grid;
      place-items: center;
      color: var(--brand-a);
      background: rgba(129, 140, 248, 0.1);
      border: 1px solid rgba(129, 140, 248, 0.2);
      transition: background 0.18s ease, border-color 0.18s ease;
    }
    .run:hover .run-icon, .run.selected .run-icon {
      background: rgba(129, 140, 248, 0.16);
      border-color: rgba(129, 140, 248, 0.32);
    }
    .run-kind { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.01em; }
    .run-meta { grid-column: 2 / 4; font-family: var(--mono); font-size: 11px; color: var(--faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .verdict {
      justify-self: end;
      font-family: var(--mono);
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      border-radius: 999px;
      padding: 4px 10px;
      border: 1px solid transparent;
    }
    .verdict.pass { color: var(--ok); background: var(--ok-dim); border-color: rgba(74, 222, 128, 0.22); }
    .verdict.fail { color: var(--bad); background: var(--bad-dim); border-color: rgba(248, 113, 113, 0.22); }
    .verdict.stored { color: var(--muted); background: rgba(255, 255, 255, 0.05); border-color: var(--line); }
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
      font-size: 12px;
      font-weight: 500;
      padding: 6px 14px;
      cursor: pointer;
      transition: background 0.18s ease, color 0.18s ease;
    }
    .seg button.active { background: rgba(255, 255, 255, 0.1); color: var(--ink); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08); }
    .seg button:hover:not(.active) { color: var(--ink); background: rgba(255, 255, 255, 0.04); }
    .seg button:focus-visible { outline-offset: -2px; }

    pre#output {
      overflow: auto;
      margin: 0;
      min-height: 360px;
      max-height: 560px;
      padding: 20px 24px;
      background: rgba(6, 6, 8, 0.5);
      color: #e4e4e7;
      font-family: var(--mono);
      font-size: 12.5px;
      line-height: 1.7;
      white-space: pre-wrap;
      word-break: break-word;
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
    }
    pre#output::-webkit-scrollbar { width: 6px; height: 6px; }
    pre#output::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.12); border-radius: 999px; }
    .j-key { color: #8ab4ff; }
    .j-str { color: #7ee0c2; }
    .j-num { color: #fbbf24; }
    .j-bool { color: #c4b5fd; }
    .j-null { color: #fb7185; }

    .readable {
      overflow: auto;
      min-height: 360px;
      max-height: 560px;
      font-size: 13.5px;
      line-height: 1.6;
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
    }
    .readable::-webkit-scrollbar { width: 6px; }
    .readable::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.12); border-radius: 999px; }
    .readable details { border-bottom: 1px solid var(--line); }
    .readable details:last-child { border-bottom: none; }
    .readable summary {
      padding: 14px 24px;
      cursor: pointer;
      font-weight: 500;
      font-size: 13.5px;
      display: flex;
      align-items: center;
      gap: 10px;
      user-select: none;
      list-style: none;
      transition: background 0.18s ease, color 0.18s ease;
    }
    .readable summary:hover { background: rgba(255, 255, 255, 0.03); color: var(--ink); }
    .readable summary:focus-visible { outline-offset: -2px; background: rgba(255, 255, 255, 0.04); }
    .readable details[open] > summary { background: rgba(255, 255, 255, 0.025); border-bottom: 1px solid var(--line); }
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
    .readable .detail-body { padding: 16px 24px 20px 32px; }
    .r-badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 2px 9px;
      font-family: var(--mono);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      border: 1px solid transparent;
      line-height: 1.4;
    }
    .r-badge.pass { background: var(--ok-dim); color: var(--ok); border-color: rgba(74, 222, 128, 0.25); }
    .r-badge.fail, .r-badge.high { background: var(--bad-dim); color: var(--bad); border-color: rgba(248, 113, 113, 0.25); }
    .r-badge.medium { background: var(--warn-dim); color: var(--warn); border-color: rgba(251, 191, 36, 0.25); }
    .r-badge.low { background: rgba(148, 163, 184, 0.12); color: #94a3b8; border-color: rgba(148, 163, 184, 0.22); }
    .drift-badge {
      display: inline-flex;
      align-items: center;
      border-radius: var(--radius-xs);
      padding: 2px 8px;
      font-family: var(--mono);
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      border: 1px solid transparent;
      line-height: 1.4;
    }
    .drift-badge.drift-visual { color: var(--drift-visual); background: var(--drift-visual-dim); border-color: rgba(244, 114, 182, 0.28); }
    .drift-badge.drift-component { color: var(--drift-component); background: var(--drift-component-dim); border-color: rgba(129, 140, 248, 0.28); }
    .drift-badge.drift-interaction { color: var(--drift-interaction); background: var(--drift-interaction-dim); border-color: rgba(34, 211, 238, 0.28); }
    .drift-badge.drift-responsive { color: var(--drift-responsive); background: var(--drift-responsive-dim); border-color: rgba(192, 132, 252, 0.28); }
    .drift-badge.drift-other { color: var(--muted); background: rgba(255, 255, 255, 0.05); border-color: var(--line); }
    .score-bar-wrap { display: flex; align-items: center; gap: 12px; margin-top: 4px; }
    .score-bar-wrap strong { font-family: var(--mono); font-size: 12.5px; white-space: nowrap; }
    .score-bar { height: 6px; border-radius: 999px; background: rgba(148, 163, 199, 0.14); flex: 1; overflow: hidden; }
    .score-bar-fill { height: 100%; border-radius: 999px; }
    .score-bar-fill.good { background: linear-gradient(90deg, #10b981, var(--ok)); }
    .score-bar-fill.warn { background: linear-gradient(90deg, #d97706, var(--warn)); }
    .score-bar-fill.bad { background: linear-gradient(90deg, #e11d48, var(--bad)); }
    .r-chips { display: flex; gap: 8px; flex-wrap: wrap; }
    .r-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--line);
      border-radius: var(--radius-xs);
      padding: 4px 10px;
      font-size: 12px;
      color: var(--muted);
      background: rgba(255, 255, 255, 0.02);
      transition: border-color 0.18s ease, background 0.18s ease;
    }
    .r-chip:hover { border-color: var(--line-strong); background: rgba(255, 255, 255, 0.04); }
    .r-kv { display: grid; grid-template-columns: minmax(88px, 120px) 1fr; gap: 6px 14px; }
    .r-kv dt { color: var(--faint); font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; }
    .r-kv dd { margin: 0; font-size: 12.5px; color: var(--muted); word-break: break-word; line-height: 1.55; }
    .r-issue {
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      padding: 12px 14px;
      margin-bottom: 8px;
      background: rgba(6, 6, 8, 0.45);
      border-left-width: 3px;
      transition: border-color 0.18s ease, background 0.18s ease;
    }
    .r-issue:hover { background: rgba(255, 255, 255, 0.025); border-color: var(--line-strong); }
    .r-issue.r-sev-high { border-left-color: var(--bad); }
    .r-issue.r-sev-medium { border-left-color: var(--warn); }
    .r-issue.r-sev-low { border-left-color: #94a3b8; }
    .r-issue:last-child { margin-bottom: 0; }
    .r-issue-head {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
      font-weight: 600;
      font-size: 12px;
      font-family: var(--mono);
    }
    .r-issue-id { color: var(--ink); font-weight: 500; letter-spacing: -0.01em; }
    .r-issue dl { margin: 0; }
    .r-list { padding-left: 18px; margin: 0; color: var(--muted); }
    .r-list li { margin-bottom: 6px; font-size: 12.5px; line-height: 1.55; }
    .r-list li::marker { color: var(--faint); }
    .r-text { font-size: 12.5px; color: var(--muted); white-space: pre-wrap; word-break: break-word; line-height: 1.6; }

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
    .panel-tabs button:hover:not(.active) { color: var(--ink); background: rgba(255, 255, 255, 0.04); }
    .panel-tabs button:focus-visible { outline-offset: -2px; }
    .tab-pane[hidden] { display: none; }
    .setup-panel {
      position: relative;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--surface);
      padding: 32px 36px 36px;
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
    .setup-head { margin-bottom: 32px; position: relative; display: grid; gap: 12px; }
    .setup-head .source-badge { justify-self: start; margin-top: 4px; }
    .setup-head h2 { margin: 0 0 10px; font-size: 22px; letter-spacing: -0.02em; }
    .setup-head p { margin: 0; color: var(--muted); font-size: 15px; line-height: 1.7; }
    .setup-stack { display: grid; gap: 40px; position: relative; }
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
    .github-connect span { color: var(--muted); font-size: 14px; line-height: 1.65; }
    .github-setup-note {
      margin: 0;
      color: var(--faint);
      font-size: 14px;
      line-height: 1.75;
    }
    .github-setup-note a { color: var(--cyan); text-decoration: none; }
    .github-setup-note a:hover { text-decoration: underline; }
    .github-setup-note code { font-size: 12px; word-break: break-all; }
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
      border-radius: var(--radius-sm);
      padding: 16px 18px;
      font-family: var(--mono);
      font-size: 12.5px;
      line-height: 1.6;
      color: var(--ink);
      background: rgba(6, 6, 8, 0.65);
      width: 100%;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .code-editor textarea:focus {
      outline: none;
      border-color: var(--brand-a);
      box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.15);
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
      border-radius: var(--radius-sm);
      overflow: hidden;
      background: rgba(6, 6, 8, 0.55);
      box-shadow: var(--shadow-sm);
    }
    .code-pane-head {
      padding: 10px 14px;
      border-bottom: 1px solid var(--line);
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--faint);
      background: rgba(255, 255, 255, 0.02);
    }
    .code-pane pre {
      margin: 0;
      padding: 14px 16px;
      overflow: auto;
      max-height: 320px;
      font-family: var(--mono);
      font-size: 11.5px;
      line-height: 1.6;
      color: #e4e4e7;
      white-space: pre-wrap;
      word-break: break-word;
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
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

    /* ── Studio review receipt ─────────────────────────────────────── */
    .review-hero {
      padding: 18px 24px 16px;
      border-bottom: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(129, 140, 248, 0.04) 0%, transparent 100%);
    }
    .review-verdict-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 10px;
    }
    .review-summary { color: var(--muted); font-size: 12.5px; line-height: 1.5; }
    .review-meta { margin-bottom: 8px; font-size: 12.5px; color: var(--muted); line-height: 1.55; }
    .review-meta strong { color: var(--ink); font-weight: 500; }
    .review-action { margin: 20px 0 10px; }
    .review-action .btn-transform-preview {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      max-width: 440px;
      min-height: 56px;
      padding: 16px 28px;
      font-size: 17px;
      font-weight: 700;
      letter-spacing: -0.01em;
      border-radius: var(--radius-pill);
      box-shadow: var(--shadow-md), 0 0 0 1px rgba(124, 124, 248, 0.18);
    }
    .review-action .btn-transform-preview:hover {
      transform: translateY(-1px);
      box-shadow: var(--shadow-lg), 0 0 32px rgba(124, 124, 248, 0.22);
    }
    .research-brief {
      margin: 0;
      padding: 14px 16px;
      border-radius: var(--radius-md);
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.03);
      font-family: var(--mono);
      font-size: 12.5px;
      line-height: 1.55;
      white-space: pre-wrap;
      color: var(--ink-secondary);
    }
    .review-pipeline {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
      font-size: 12px;
      padding-top: 4px;
    }
    .review-pipeline-arrow { color: var(--faint); font-size: 14px; }
    .review-pipeline-step { display: inline-flex; align-items: center; gap: 6px; }
    .review-pipeline-note { color: var(--ok); font-size: 11px; margin-left: 2px; }
    .health-card {
      margin-bottom: 12px;
      padding: 12px 14px;
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      font-size: 12.5px;
      background: rgba(255, 255, 255, 0.02);
    }
    .health-card strong { color: var(--ink); font-weight: 600; }
    .gate-row { margin-bottom: 12px; font-size: 12.5px; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
    .patch-title { font-size: 12px; font-weight: 600; display: block; margin-bottom: 6px; color: var(--ink); }

    @media (min-width: 900px) {
      .stats { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px; }
    }
    @media (max-width: 768px) {
      .nav { min-height: 64px; gap: 12px; }
      .nav-left { gap: 16px; }
      .page-head { gap: 24px; }
      h1 { font-size: clamp(28px, 8vw, 36px); }
      .lede { font-size: 15px; }
      .setup-panel { padding: 24px 20px; }
      .panel-head { flex-wrap: wrap; gap: 12px; }
      .workgrid { gap: 20px; }
      .history-list, pre#output, .readable { max-height: 360px; min-height: 280px; }
    }
    @media (max-width: 720px) {
      .stats { grid-template-columns: 1fr; }
      .setup-panel { padding: 28px 24px; }
      .panel-head { padding: 16px 20px; }
    }
    @media (max-width: 640px) {
      .pipe-summary { margin-left: 0; width: 100%; }
    }
    ${reducedMotionStyles()}

  </style>
</head>
<body>
  <a class="skip-link" href="#overview">Skip to content</a>
  ${backdropHtml()}

  <header class="site-header nav">
    <div class="nav-left">
      ${brandLink("/")}
      <nav class="nav-links" aria-label="Studio sections">
        <a class="nav-link active" href="#overview" aria-current="page">Overview</a>
        <a class="nav-link" href="#history">History</a>
      </nav>
    </div>
    <div class="nav-right">
      ${userBlock}
      <button class="nav-toggle" id="navToggle" type="button" aria-expanded="false" aria-controls="mobileMenu" aria-label="Open menu">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      </button>
    </div>
    <div class="mobile-menu" id="mobileMenu">
      <a href="#overview">Overview</a>
      <a href="#history">History</a>
      ${session ? `<a href="/auth/logout">Sign out</a>` : `<a href="/login?returnTo=%2Fstudio">Log in</a>`}
    </div>
  </header>

  <div class="page">
    <main class="content">
      <section class="page-head" id="overview">
        <div class="eyebrow"><span class="eyebrow-dot"></span> morph Studio</div>
        <h1><span class="title-gradient">Review agent UI</span><br>before it ships.</h1>
        <p class="lede">Connect a GitHub repo or preview URL, run a full review, and watch morph score your site, apply a redesign, and return a passing merge gate with before/after proof.</p>
      </section>

      <section class="setup-panel spotlight" aria-label="Project source and agent instructions">
        <div class="setup-head">
          <h2>Project source</h2>
          <p>Point morph at your repo or live preview. It scores the current UI, shows the possible score after redesign, and proves the branch is safe to review.</p>
          <span class="source-badge" id="sourceBadge">github repo required</span>
        </div>
        <div class="panel-tabs" role="tablist" aria-label="Project source">
          <button type="button" class="active" data-source-tab="github" role="tab" aria-selected="true">GitHub</button>
          <button type="button" data-source-tab="url" role="tab" aria-selected="false">Preview URL</button>
        </div>
        <div class="setup-stack">
          <div class="source-pane" data-source-pane="github">
            ${githubConnectBlock}
            <label class="auth-form" for="githubRepo">
              <span>Repository</span>
              <input id="githubRepo" name="githubRepo" type="text" required autocomplete="off" placeholder="owner/repo">
            </label>
            <p class="source-note">morph clones the repo, scores the current UI, and shows the possible score after a full redesign at <code>/transformed</code>. Public repos work without sign-in; connect GitHub for private repos.</p>
          </div>
          <div class="source-pane" data-source-pane="url" hidden>
            <form class="auth-form" id="previewForm">
              <label for="previewUrl">Web URL</label>
              <input id="previewUrl" name="previewUrl" type="url" inputmode="url" autocomplete="url" required placeholder="https://cerebralvalley.ai">
            </form>
            <p class="source-note">morph fetches your live site, scores the current UI, and shows the possible score after a full redesign at <code>/transformed</code>.</p>
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
          <div class="actions">
            <button type="button" class="btn btn-primary" data-action="studio-review" id="runReviewBtn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>
              Run full review
            </button>
          </div>
        </div>
      </section>

      <section class="stats" aria-label="Review metrics">
        <div class="stat spotlight"><span class="stat-label">Current score</span><span class="stat-value" id="score">–</span><span class="stat-sub">your site today · gate ≥ 95</span></div>
        <div class="stat spotlight"><span class="stat-label">After redesign</span><span class="stat-value" id="possibleScore">–</span><span class="stat-sub">possible with morph</span></div>
        <div class="stat spotlight"><span class="stat-label">Merge gate</span><span class="stat-value" id="gate">–</span><span class="stat-sub">based on current score</span></div>
        <div class="stat spotlight"><span class="stat-label">Issues found</span><span class="stat-value" id="fixes">–</span><span class="stat-sub">in current UI</span></div>
      </section>

      <section class="pipeline spotlight" id="pipeline" hidden aria-label="Latest review pipeline">
        <div class="pipe-stage"><span class="pipe-k">Current</span><span class="pipe-v" id="pipeBefore">–</span></div>
        <span class="pipe-arrow" aria-hidden="true">→</span>
        <div class="pipe-stage"><span class="pipe-k">Redesign</span><span class="pipe-v warn" id="pipeFixes">–</span></div>
        <span class="pipe-arrow" aria-hidden="true">→</span>
        <div class="pipe-stage"><span class="pipe-k">Possible</span><span class="pipe-v" id="pipeAfter">–</span></div>
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
        <span>GitHub and Preview URL score your actual site (current → possible after redesign).</span>
      </p>
    </main>
  </div>
  <script>
    (function () {
      ${mobileNavScript()}
    })();

    const output = document.querySelector("#output");
    const outputReadable = document.querySelector("#outputReadable");
    const runList = document.querySelector("#runList");
    const score = document.querySelector("#score");
    const possibleScore = document.querySelector("#possibleScore");
    const gate = document.querySelector("#gate");
    const fixes = document.querySelector("#fixes");
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

    function activateSourceTab(sourceName) {
      activeSource = sourceName;
      document.querySelectorAll("[data-source-tab]").forEach((candidate) => {
        const active = candidate.dataset.sourceTab === sourceName;
        candidate.classList.toggle("active", active);
        candidate.setAttribute("aria-selected", active ? "true" : "false");
      });
      document.querySelectorAll("[data-source-pane]").forEach((pane) => {
        pane.hidden = pane.dataset.sourcePane !== sourceName;
      });
      updateSourceBadge();
    }

    document.querySelectorAll("[data-source-tab]").forEach((tabButton) => {
      tabButton.addEventListener("click", () => {
        activateSourceTab(tabButton.dataset.sourceTab || "github");
      });
    });

    const initialSource = new URLSearchParams(window.location.search).get("source");
    if (initialSource === "github" || initialSource === "url") {
      activateSourceTab(initialSource);
    }

    const githubOAuthForm = document.querySelector("#githubOAuthForm");
    const githubOAuthStatus = document.querySelector("#githubOAuthStatus");
    githubOAuthForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const clientId = document.querySelector("#githubClientId")?.value.trim() || "";
      const clientSecret = document.querySelector("#githubClientSecret")?.value.trim() || "";
      if (!clientId || !clientSecret) return;
      if (githubOAuthStatus) {
        githubOAuthStatus.hidden = false;
        githubOAuthStatus.textContent = "Saving credentials…";
        githubOAuthStatus.className = "auth-status pending";
      }
      try {
        await api("/api/auth/github", {
          method: "POST",
          body: JSON.stringify({ clientId, clientSecret })
        });
        window.location.href = "/studio?source=github";
      } catch (error) {
        if (githubOAuthStatus) {
          githubOAuthStatus.textContent = error.message || "Could not save GitHub credentials.";
          githubOAuthStatus.className = "auth-status pending";
        }
      }
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

    function looksLikeHttpUrl(value) {
      return /^https?:\\/\\//i.test(String(value ?? "").trim());
    }

    function isGithubRepoInput(value) {
      const raw = String(value ?? "").trim();
      if (!raw) return false;
      if (/^[\\w.-]+\\/[\\w.-]+$/.test(raw)) return true;
      return /github\\.com\\//i.test(raw);
    }

    previewUrlInput?.addEventListener("input", () => {
      if (looksLikeHttpUrl(previewUrlInput?.value)) {
        activateSourceTab("url");
      }
      updateSourceBadge();
    });
    githubRepoInput?.addEventListener("input", updateSourceBadge);

    document.querySelector("#previewForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      activateSourceTab("url");
      document.querySelector("#runReviewBtn")?.click();
    });
    previewUrlInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        activateSourceTab("url");
        document.querySelector("#runReviewBtn")?.click();
      }
    });

    function buildReviewRequest() {
      const instructions = agentInstructionsInput?.value.trim() || "";
      const previewUrl = previewUrlInput?.value.trim() || "";
      const githubRepo = githubRepoInput?.value.trim() || "";

      if (looksLikeHttpUrl(previewUrl)) {
        return { source: "url", previewUrl, instructions };
      }
      if (looksLikeHttpUrl(githubRepo) && !isGithubRepoInput(githubRepo)) {
        return { source: "url", previewUrl: githubRepo, instructions };
      }
      if (activeSource === "url") {
        if (!previewUrl) throw new Error("Enter a web URL or switch to GitHub.");
        return { source: "url", previewUrl, instructions };
      }
      if (!githubRepo) throw new Error("Enter a GitHub repository (owner/repo) or switch to Web URL.");
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

    function driftBadge(type) {
      const t = String(type || "").toLowerCase();
      const map = {
        design_drift: { cls: "drift-visual", label: "visual" },
        visual_drift: { cls: "drift-visual", label: "visual" },
        component_drift: { cls: "drift-component", label: "component" },
        interaction_drift: { cls: "drift-interaction", label: "interaction" },
        responsive_drift: { cls: "drift-responsive", label: "responsive" }
      };
      const m = map[t] || { cls: "drift-other", label: t.replace(/_drift$/, "").replace(/_/g, " ") || "drift" };
      return '<span class="drift-badge ' + m.cls + '">' + esc(m.label) + '</span>';
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

      let html = '<div class="review-hero">';
      html += '<div class="review-verdict-row">';
      html += badge(p.finalVerdict || "unknown", vCls);
      html += '<span class="review-summary">' + esc(p.ciSummary || "") + '</span>';
      html += '</div>';
      if (p.instructions) {
        html += '<div class="review-meta"><strong>Instructions:</strong> ' + esc(p.instructions) + '</div>';
      }
      if (p.githubRepo) {
        html += '<div class="review-meta"><strong>GitHub:</strong> ' + esc(p.githubRepo) + '</div>';
      }
      if (p.transform?.profile) {
        html += '<div class="review-meta"><strong>Design profile:</strong> '
          + esc(p.transform.profile.name) + ' — ' + esc(p.transform.profile.inspiration || "") + '</div>';
      }
      if (p.transformedPreviewPath) {
        html += '<div class="review-action"><a class="btn btn-primary btn-lg btn-transform-preview" href="' + esc(p.transformedPreviewPath) + '" target="_blank" rel="noreferrer">View transformed site ↗</a></div>';
      }
      if (p.transform?.siteResearch?.summary) {
        html += '<details open><summary>Site research <span class="preview">before redesign</span></summary>';
        html += '<div class="detail-body"><pre class="research-brief">' + esc(p.transform.siteResearch.summary) + '</pre></div></details>';
      }
      if (p.previewUrl) {
        html += '<div class="review-meta"><strong>Preview URL:</strong> ' + esc(p.previewUrl) + '</div>';
      }
      if (p.targetFile) {
        html += '<div class="review-meta"><strong>File:</strong> ' + esc(p.targetFile) + '</div>';
      }
      html += '<div class="review-pipeline">';
      html += pipelineStep("Current", before?.score);
      html += '<span class="review-pipeline-arrow" aria-hidden="true">→</span>';
      html += '<span class="review-summary">' + esc(p.engine === "design_db_transform"
        ? (p.transform?.profile?.name || "Redesign")
        : String(repair?.replacements ?? 0) + " fixes") + '</span>';
      html += '<span class="review-pipeline-arrow" aria-hidden="true">→</span>';
      html += pipelineStep("Possible", after?.score);
      if (p.redesignPasses && p.finalVerdict !== "pass") {
        html += '<span class="review-pipeline-note">would pass after redesign</span>';
      }
      html += '</div>';
      html += '</div>';

      // Before section (open by default when there are issues)
      const hasIssues = Array.isArray(before?.issues) && before.issues.length > 0;
      html += '<details' + (hasIssues ? " open" : "") + '>';
      html += '<summary>Current UI <span class="preview">' + badge(before?.verdict || "?", before?.verdict === "pass" ? "pass" : "fail") + ' &nbsp;' + esc(String(before?.score ?? "?")) + '/100</span></summary>';
      html += '<div class="detail-body">' + renderReportBody(before) + '</div></details>';

      // Repair section
      html += '<details><summary>Repair <span class="preview">' + esc(String(repair?.replacements ?? 0)) + ' replacements applied</span></summary>';
      html += '<div class="detail-body">' + renderRepairBody(repair) + '</div></details>';

      // After section
      html += '<details><summary>After redesign <span class="preview">' + badge(after?.verdict || "?", after?.verdict === "pass" ? "pass" : "fail") + ' &nbsp;' + esc(String(after?.score ?? "?")) + '/100</span></summary>';
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

    function pipelineStep(label, score) {
      const n = Number(score);
      const cls = n >= 95 ? "pass" : "fail";
      return '<span class="review-pipeline-step">' + esc(label) + ': ' + badge(n >= 95 ? "pass" : "fail", cls) + ' <strong>' + esc(String(score ?? "?")) + '</strong>/100</span>';
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
        html += '<div class="gate-row">';
        html += 'Merge gate: ' + badge(g.passed ? "passed" : "blocked", g.passed ? "pass" : "fail");
        html += '<span class="review-summary">threshold ' + esc(String(g.threshold)) + '/100</span>';
        html += '</div>';
      }

      if (report.health?.score != null) {
        html += '<div class="health-card">';
        html += '<strong>Buoy health</strong> · ' + esc(String(report.health.score)) + '/100';
        if (report.health.tier) html += ' · ' + esc(report.health.tier);
        if (Array.isArray(report.health.suggestions) && report.health.suggestions.length) {
          html += '<ul class="r-list" style="margin-top:8px">' + report.health.suggestions.slice(0, 3).map((item) => '<li>' + esc(item) + '</li>').join("") + '</ul>';
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
          const drift = issue.type ? driftBadge(issue.type) : "";
          return '<div class="r-issue r-sev-' + sev + '">' +
            '<div class="r-issue-head">' + badge(issue.severity, sev) + drift + '<span class="r-issue-id">' + esc(issue.id || "") + '</span></div>' +
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
        html += '<strong class="patch-title">Patched files</strong>';
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
        + '<p>Connect a GitHub repo or enter a preview URL, then click <strong>Run full review</strong> to score your site, see the redesign delta, and get the merge gate.</p>'
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
      const isTransform = runPayload?.engine === "design_db_transform";
      const issueCount = isTransform
        ? (before?.issues?.length ?? runPayload?.repair?.replacements ?? 0)
        : (runPayload?.repair?.replacements ?? 0);
      if (!before || !after) { pipeline.hidden = true; return; }
      pipeline.hidden = false;
      pipeBefore.textContent = (before.score ?? "?") + "/100";
      pipeBefore.className = "pipe-v " + (Number(before.score) >= 95 ? "ok" : "bad");
      pipeAfter.textContent = (after.score ?? "?") + "/100";
      pipeAfter.className = "pipe-v " + (Number(after.score) >= 95 ? "ok" : "bad");
      pipeFixes.textContent = isTransform
        ? (runPayload?.transform?.profile?.name || "design profile")
        : (issueCount + " fixes");
      pipeSummary.textContent = runPayload.ciSummary || "";
    }

    function renderPayload(payload) {
      lastPayload = payload;
      applyOutputMode(payload);
      const runPayload = payload.run?.payload;
      const before = runPayload?.before;
      const after = runPayload?.after;
      const current = before?.score ?? runPayload?.currentScore;
      const possible = after?.score ?? runPayload?.possibleScore;
      if (current !== undefined) {
        score.textContent = current;
        score.className = "stat-value" + (Number(current) >= 95 ? " ok" : " bad");
      }
      if (possible !== undefined) {
        possibleScore.textContent = possible;
        possibleScore.className = "stat-value" + (Number(possible) >= 95 ? " ok" : possible !== undefined ? " warn" : "");
      } else {
        possibleScore.textContent = "–";
        possibleScore.className = "stat-value";
      }
      const finalVerdict = runPayload?.finalVerdict || before?.verdict;
      if (finalVerdict) {
        gate.textContent = finalVerdict === "pass" ? "Open" : "Blocked";
        gate.className = "stat-value " + (finalVerdict === "pass" ? "ok" : "bad");
      }
      const issueCount = before?.issues?.length ?? runPayload?.repair?.replacements;
      if (issueCount !== undefined) fixes.textContent = issueCount;
      renderPipeline(runPayload);
      if (runPayload?.preview) renderPreviewCapture(runPayload.preview);
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
      } catch (error) {
        const msg = error.message || String(error);
        if (msg.includes("unauthorized") || msg.includes("Sign in")) {
          window.location.href = "/login?returnTo=%2Fstudio";
          return;
        }
        runList.innerHTML = '<div class="empty"><span><b>Could not load runs.</b><br>' + esc(msg) + '</span></div>';
        showRaw(msg);
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
