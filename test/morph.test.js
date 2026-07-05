import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  copyFixtureForDemo,
  createReport,
  initProject,
  loadConfig,
  loopProject,
  repairProject
} from "../src/core.js";
import { serveMorph } from "../src/server.js";
import { landingHtml } from "../src/landing.js";
import { extractContent, transformSite } from "../src/transform.js";
import { enrichContent, researchSite } from "../src/site-research.js";
import { assessUiQuality, databaseSummary, selectProfile, selectArchetype, catalogSummary, matchReferenceSites, buildRetrievalPlan, sourceIndexSummary, extractVisualPreferences, planTransform, alignProfileToPreferences } from "../src/design-db/index.js";
import { aiVisionAvailable, analyzeUiReference, applyDesignHints } from "../src/ai-vision.js";
import {
  describeSponsorIntegration,
  isProviderConfigured,
  listSponsorIntegrations,
  resolveProviderOrder
} from "../src/ai-providers.js";
import { getProfile } from "../src/design-db/profiles.js";
import { execFileSync } from "node:child_process";

const repoRoot = path.resolve(import.meta.dirname, "..");

test("product smoke config passes by default", async () => {
  const config = await loadConfig("morph.config.json", repoRoot);
  const report = await createReport(config);

  assert.equal(report.verdict, "pass");
  assert.equal(report.score, 100);
  assert.equal(report.issues.length, 0);
});

test("demo config catches seeded design-system drift with agent-readable patches", async () => {
  const config = await loadConfig("morph.demo.config.json", repoRoot);
  const report = await createReport(config);

  assert.equal(report.verdict, "fail");
  assert.equal(report.summary.high > 0, true);
  assert.equal(report.issues.some((issue) => issue.id === "component-fragmentation"), true);
  assert.equal(report.issues.every((issue) => issue.patch?.replacements?.length), true);
});

test("verify flags icon-only buttons missing an accessible label", async () => {
  const config = await loadConfig("morph.demo.config.json", repoRoot);
  const report = await createReport(config);

  const a11yIssue = report.issues.find((issue) => issue.id === "icon-button-missing-label");
  assert.ok(a11yIssue, "expected icon-button-missing-label finding");
  assert.equal(a11yIssue.type, "interaction_drift");
  assert.equal(a11yIssue.patch.replacements[0].replace.includes("aria-label"), true);
});

test("grading caps repeated low-severity findings without hiding the failing gate", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "morph-grade-"));
  const projectRoot = path.join(tempRoot, "app");
  await mkdir(path.join(projectRoot, "src"), { recursive: true });
  await writeFile(path.join(projectRoot, "tokens.css"), `:root {
  --font-size-sm: 14px;
  --font-size-md: 16px;
  --font-size-lg: 20px;
}\n`);
  await writeFile(path.join(projectRoot, "src/App.tsx"), `import React from "react";

export function App() {
  return (
    <section>
${Array.from({ length: 14 }, (_, index) => `      <p className="text-[${10 + index}.5px]">One-off type ${index}</p>`).join("\n")}
    </section>
  );
}\n`);
  await writeFile(path.join(tempRoot, "morph.config.json"), `${JSON.stringify({
    projectName: "Grade Fixture",
    projectRoot: "app",
    tokenFiles: ["tokens.css"],
    scan: ["src/**/*.tsx"]
  }, null, 2)}\n`);

  const config = await loadConfig("morph.config.json", tempRoot);
  const report = await createReport(config);

  assert.equal(report.summary.low, 14);
  assert.equal(report.grade.model, "severity_type_repeat_cap_v1");
  assert.equal(report.grade.issueFamilies["type-scale-drift"], 4);
  assert.equal(report.grade.cappedIssueFamilies.includes("type-scale-drift"), true);
  assert.equal(report.score, 96);
  assert.equal(report.verdict, "fail");
});

test("repair applies deterministic fixes and verify passes on a temp project", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "morph-test-"));
  const fixtureRoot = path.join(tempRoot, "acme-saas");
  await copyFixtureForDemo(path.join(repoRoot, "fixtures/acme-saas"), fixtureRoot);

  const configPath = path.join(tempRoot, "morph.config.json");
  await writeFile(configPath, `${JSON.stringify({
    projectName: "Acme Temp",
    projectRoot: "acme-saas",
    tokenFiles: ["design-system/tokens.css"],
    scan: ["src/**/*.tsx"]
  }, null, 2)}\n`);

  const config = await loadConfig(configPath, tempRoot);
  const repair = await repairProject(config, { apply: true });
  const after = await createReport(config);

  assert.equal(repair.applied, true);
  assert.equal(repair.replacements > 0, true);
  assert.equal(after.verdict, "pass");
  assert.equal(after.issues.length, 0);
});

test("repair receipt separates applied fixes from superseded candidates", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "morph-repair-receipt-"));
  const fixtureRoot = path.join(tempRoot, "acme-saas");
  await copyFixtureForDemo(path.join(repoRoot, "fixtures/acme-saas"), fixtureRoot);

  const configPath = path.join(tempRoot, "morph.config.json");
  await writeFile(configPath, `${JSON.stringify({
    projectName: "Acme Repair Receipt",
    projectRoot: "acme-saas",
    tokenFiles: ["design-system/tokens.css"],
    scan: ["src/**/*.tsx"]
  }, null, 2)}\n`);

  const config = await loadConfig(configPath, tempRoot);
  const repair = await repairProject(config, { apply: true });

  assert.equal(repair.candidateReplacements > repair.replacements, true);
  assert.equal(repair.skippedReplacements.length > 0, true);
  assert.equal(
    repair.skippedReplacements.some((replacement) => replacement.reason === "superseded_by_prior_replacement"),
    true
  );
  assert.equal(repair.risk, "deterministic_replacements_with_superseded_fixes");
  assert.equal(repair.after.verdict, "pass");
});

test("loop returns a final pass gate after applying deterministic repairs", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "morph-loop-"));
  const fixtureRoot = path.join(tempRoot, "acme-saas");
  await copyFixtureForDemo(path.join(repoRoot, "fixtures/acme-saas"), fixtureRoot);

  const configPath = path.join(tempRoot, "morph.config.json");
  await writeFile(configPath, `${JSON.stringify({
    projectName: "Acme Loop",
    projectRoot: "acme-saas",
    tokenFiles: ["design-system/tokens.css"],
    scan: ["src/**/*.tsx"],
    gate: {
      minScore: 95
    }
  }, null, 2)}\n`);

  const config = await loadConfig(configPath, tempRoot);
  const result = await loopProject(config, { apply: true });

  assert.equal(result.before.verdict, "fail");
  assert.equal(result.finalVerdict, "pass");
  assert.equal(result.passed, true);
  assert.equal(result.repair.replacements > 0, true);
});

test("verify report includes multi-engine scanner metadata", async () => {
  const config = await loadConfig("morph.demo.config.json", repoRoot);
  const report = await createReport(config);

  assert.equal(typeof report.engines, "object");
  assert.equal(report.engines.morph > 0, true);
  assert.equal(report.health?.engine, "buoy");
  assert.equal(typeof report.health?.score, "number");
});

test("init creates product config, env sample, and run store", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "morph-init-"));
  const result = await initProject(tempRoot, { projectName: "Example App" });

  assert.equal(result.projectName, "Example App");
  assert.equal(result.created.includes("morph.config.json"), true);
  assert.equal(result.created.includes(".env.example"), true);
  assert.equal(result.created.includes(path.join(".morph", "runs")), true);
});

test("default brace scan globs include frontend files", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "morph-glob-"));
  const fixtureRoot = path.join(tempRoot, "acme-saas");
  await copyFixtureForDemo(path.join(repoRoot, "fixtures/acme-saas"), fixtureRoot);

  const configPath = path.join(tempRoot, "morph.config.json");
  await writeFile(configPath, `${JSON.stringify({
    projectName: "Acme Glob",
    projectRoot: "acme-saas",
    tokenFiles: ["design-system/tokens.css"]
  }, null, 2)}\n`);

  const config = await loadConfig(configPath, tempRoot);
  const report = await createReport(config);

  assert.equal(report.scan.filesScanned > 0, true);
  assert.equal(report.issues.some((issue) => issue.file === "src/routes/settings/billing.tsx"), true);
});

test("server exposes health, run storage, and invalid JSON errors", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "morph-server-"));
  const fixtureRoot = path.join(tempRoot, "acme-saas");
  await copyFixtureForDemo(path.join(repoRoot, "fixtures/acme-saas"), fixtureRoot);

  const configPath = path.join(tempRoot, "morph.config.json");
  await writeFile(configPath, `${JSON.stringify({
    projectName: "Acme Server",
    projectRoot: "acme-saas",
    morphDir: ".morph",
    tokenFiles: ["design-system/tokens.css"],
    scan: ["src/**/*.tsx"]
  }, null, 2)}\n`);

  const config = await loadConfig(configPath, tempRoot);
  const { server, url } = await serveMorph(config, { host: "127.0.0.1", port: 0, loadEnv: false });

  try {
    const health = await fetchJson(`${url}/api/health`);
    assert.equal(health.ok, true);

    const verifyResponse = await fetch(`${url}/api/runs/verify`, { method: "POST" });
    assert.equal(verifyResponse.status, 201);
    const verifyPayload = await verifyResponse.json();
    assert.equal(verifyPayload.run.kind, "verify");
    assert.equal(verifyPayload.run.payload.verdict, "fail");

    const runs = await fetchJson(`${url}/api/runs`);
    assert.equal(runs.runs.length, 1);

    const invalidResponse = await fetch(`${url}/api/runs/repair`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{"
    });
    assert.equal(invalidResponse.status, 400);
    const invalidPayload = await invalidResponse.json();
    assert.equal(invalidPayload.error, "invalid_json");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("landing page is served at / and the studio dashboard at /studio", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "morph-landing-"));
  const fixtureRoot = path.join(tempRoot, "acme-saas");
  await copyFixtureForDemo(path.join(repoRoot, "fixtures/acme-saas"), fixtureRoot);

  const configPath = path.join(tempRoot, "morph.config.json");
  await writeFile(configPath, `${JSON.stringify({
    projectName: "Acme Landing",
    projectRoot: "acme-saas",
    morphDir: ".morph",
    tokenFiles: ["design-system/tokens.css"],
    scan: ["src/**/*.tsx"]
  }, null, 2)}\n`);

  const config = await loadConfig(configPath, tempRoot);
  const { server, url } = await serveMorph(config, { host: "127.0.0.1", port: 0, loadEnv: false });

  try {
    const landingResponse = await fetch(`${url}/`);
    assert.equal(landingResponse.status, 200);
    const landing = await landingResponse.text();
    assert.equal(landing.includes("Launch Studio"), true);
    assert.equal(landing.includes("Log in"), true);
    for (const navItem of ["Product", "Demo", "Studio", "Pricing", "Docs"]) {
      assert.equal(landing.includes(`>${navItem}</a>`), true, `expected nav link ${navItem}`);
    }
    assert.equal(landing.includes('href="/studio"'), true);

    const studioResponse = await fetch(`${url}/studio`);
    assert.equal(studioResponse.status, 200);
    const studio = await studioResponse.text();
    assert.equal(studio.includes("Run full review"), true);
    assert.equal(studio.includes("Review history"), true);
    assert.equal(studio.includes("Enable GitHub sign-in"), true);
    assert.equal(studio.includes("Save credentials"), true);
    assert.equal(studio.includes("Agent instructions"), true);
    assert.equal(studio.includes("Preview URL"), true);
    assert.equal(studio.includes("Paste UI code"), false);
    assert.equal(studio.includes("Load broken demo"), false);
    assert.equal(studio.includes("morph"), true);
    assert.equal(studio.includes("Narrate review"), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("landing page passes morph anti-slop heuristics", async () => {
  const config = await loadConfig("morph.config.json", repoRoot);
  const html = landingHtml(config, null);
  const css = html.match(/<style>([\s\S]*?)<\/style>/i)?.[1] ?? "";
  const assessment = assessUiQuality(html, css);

  assert.equal(assessment.model, "morph.ui-quality.v3");
  assert.equal(assessment.score >= 95, true, `landing slop score ${assessment.score}: ${assessment.findings.map((f) => f.id).join(", ")}`);
  assert.equal(assessment.findings.some((finding) => finding.id === "gradient-text"), false);
  assert.equal(assessment.findings.some((finding) => finding.id === "overused-font"), false);
});

test("landing page stays public in oauth mode while studio requires sign-in", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "morph-oauth-"));
  const fixtureRoot = path.join(tempRoot, "acme-saas");
  await copyFixtureForDemo(path.join(repoRoot, "fixtures/acme-saas"), fixtureRoot);

  const configPath = path.join(tempRoot, "morph.config.json");
  await writeFile(configPath, `${JSON.stringify({
    projectName: "Acme OAuth",
    projectRoot: "acme-saas",
    morphDir: ".morph",
    tokenFiles: ["design-system/tokens.css"],
    scan: ["src/**/*.tsx"],
    auth: { mode: "oauth" }
  }, null, 2)}\n`);

  const config = await loadConfig(configPath, tempRoot);
  const { server, url } = await serveMorph(config, { host: "127.0.0.1", port: 0, loadEnv: false });

  try {
    const landingResponse = await fetch(`${url}/`);
    assert.equal(landingResponse.status, 200);

    const studioResponse = await fetch(`${url}/studio`, { redirect: "manual" });
    assert.equal(studioResponse.status, 302);
    assert.equal(studioResponse.headers.get("location").startsWith("/login"), true);

    const loginResponse = await fetch(`${url}/login?returnTo=%2Fstudio`);
    assert.equal(loginResponse.status, 200);
    const login = await loginResponse.text();
    assert.equal(login.includes("Log in"), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("github credentials save at runtime and enable the studio connect flow", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "morph-github-auth-"));
  const fixtureRoot = path.join(tempRoot, "acme-saas");
  await copyFixtureForDemo(path.join(repoRoot, "fixtures/acme-saas"), fixtureRoot);

  const configPath = path.join(tempRoot, "morph.config.json");
  await writeFile(configPath, `${JSON.stringify({
    projectName: "Acme GitHub",
    projectRoot: "acme-saas",
    morphDir: ".morph",
    tokenFiles: ["design-system/tokens.css"],
    scan: ["src/**/*.tsx"]
  }, null, 2)}\n`);

  const savedEnv = {
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET
  };
  delete process.env.GITHUB_CLIENT_ID;
  delete process.env.GITHUB_CLIENT_SECRET;

  const config = await loadConfig(configPath, tempRoot);
  const { server, url } = await serveMorph(config, { host: "127.0.0.1", port: 0, loadEnv: false });

  try {
    const before = await fetchJson(`${url}/api/health`);
    assert.equal(before.github.configured, false);

    const saveResponse = await fetch(`${url}/api/auth/github`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId: "Iv1.test-client-id", clientSecret: "ghsec-test-secret" })
    });
    assert.equal(saveResponse.status, 200);
    const saved = await saveResponse.json();
    assert.equal(saved.github.configured, true);
    assert.equal(saved.providers.github, true);

    const studio = await (await fetch(`${url}/studio`)).text();
    assert.equal(studio.includes("Save credentials"), false);
    assert.equal(studio.includes('href="/auth/github?returnTo='), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("google credentials save at runtime and enable the login provider", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "morph-google-"));
  const fixtureRoot = path.join(tempRoot, "acme-saas");
  await copyFixtureForDemo(path.join(repoRoot, "fixtures/acme-saas"), fixtureRoot);

  const configPath = path.join(tempRoot, "morph.config.json");
  await writeFile(configPath, `${JSON.stringify({
    projectName: "Acme Google",
    projectRoot: "acme-saas",
    morphDir: ".morph",
    tokenFiles: ["design-system/tokens.css"],
    scan: ["src/**/*.tsx"]
  }, null, 2)}\n`);

  const savedEnv = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET
  };
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;

  const config = await loadConfig(configPath, tempRoot);
  const { server, url } = await serveMorph(config, { host: "127.0.0.1", port: 0, loadEnv: false });

  try {
    const before = await fetchJson(`${url}/api/health`);
    assert.equal(before.google.configured, false);

    const saveResponse = await fetch(`${url}/api/auth/google`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId: "morph-test.apps.googleusercontent.com", clientSecret: "GOCSPX-test" })
    });
    assert.equal(saveResponse.status, 200);
    const saved = await saveResponse.json();
    assert.equal(saved.google.configured, true);
    assert.equal(saved.providers.google, true);

    const login = await (await fetch(`${url}/login?returnTo=%2Fstudio`)).text();
    assert.equal(login.includes("Continue with Google"), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("studio review scores preview url and shows current vs possible", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "morph-studio-inputs-"));
  const siteDir = path.join(tempRoot, "agent-site");
  await copyFixtureForDemo(path.join(repoRoot, "fixtures/codex-landing"), siteDir);
  const previewUrl = `file://${path.join(siteDir, "index.html")}`;

  const configPath = path.join(tempRoot, "morph.config.json");
  await writeFile(configPath, `${JSON.stringify({
    projectName: "Acme Studio Inputs",
    projectId: "acme-studio-inputs",
    projectRoot: "fixtures/acme-saas",
    morphDir: ".morph",
    tokenFiles: ["design-system/tokens.css"],
    scan: ["src/**/*.tsx"],
    gate: {
      minScore: 95
    }
  }, null, 2)}\n`);

  const config = await loadConfig(configPath, tempRoot);
  const { server, url } = await serveMorph(config, { host: "127.0.0.1", port: 0, loadEnv: false });

  try {
    const response = await fetch(`${url}/api/studio/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "url",
        previewUrl,
        instructions: "Review the agent landing page for UI quality."
      })
    });
    assert.equal(response.status, 201);
    const payload = await response.json();
    const review = payload.run.payload;
    assert.equal(review.source, "url");
    assert.equal(review.previewUrl, previewUrl);
    assert.equal(review.instructions, "Review the agent landing page for UI quality.");
    assert.equal(review.engine, "design_db_transform");
    assert.equal(review.before.score < 40, true);
    assert.equal(review.after.score >= 95, true);
    assert.equal(review.currentScore, review.before.score);
    assert.equal(review.possibleScore, review.after.score);
    assert.equal(review.finalVerdict, "fail");
    assert.equal(review.redesignPasses, true);
    assert.equal(review.transformedPreviewPath, "/transformed/index.html");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("studio review rejects requests without github repo or preview url", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "morph-studio-missing-"));
  const fixtureRoot = path.join(tempRoot, "acme-saas");
  await copyFixtureForDemo(path.join(repoRoot, "fixtures/acme-saas"), fixtureRoot);

  const configPath = path.join(tempRoot, "morph.config.json");
  await writeFile(configPath, `${JSON.stringify({
    projectName: "Acme Studio Missing",
    projectRoot: "acme-saas",
    morphDir: ".morph",
    tokenFiles: ["design-system/tokens.css"],
    scan: ["src/**/*.tsx"]
  }, null, 2)}\n`);

  const config = await loadConfig(configPath, tempRoot);
  const { server, url } = await serveMorph(config, { host: "127.0.0.1", port: 0, loadEnv: false });

  try {
    const response = await fetch(`${url}/api/studio/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}"
    });
    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.error, "missing_project_source");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("studio review repairs fixture agent drift", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "morph-studio-fixture-"));
  const fixtureRoot = path.join(tempRoot, "acme-saas");
  await copyFixtureForDemo(path.join(repoRoot, "fixtures/acme-saas"), fixtureRoot);

  const configPath = path.join(tempRoot, "morph.config.json");
  await writeFile(configPath, `${JSON.stringify({
    projectName: "Acme Studio Fixture",
    projectId: "acme-studio-fixture",
    projectRoot: "acme-saas",
    morphDir: ".morph",
    tokenFiles: ["design-system/tokens.css"],
    scan: ["src/**/*.tsx"],
    componentImports: {
      Button: "src/components/Button.tsx"
    },
    gate: {
      minScore: 95
    }
  }, null, 2)}\n`);

  const config = await loadConfig(configPath, tempRoot);
  const { server, url } = await serveMorph(config, { host: "127.0.0.1", port: 0, loadEnv: false });

  try {
    const response = await fetch(`${url}/api/studio/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "fixture",
        targetFile: "src/routes/settings/billing.tsx"
      })
    });
    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.equal(payload.run.payload.source, "fixture");
    assert.equal(payload.run.payload.before.verdict, "fail");
    assert.equal(payload.run.payload.finalVerdict, "pass");
    assert.equal(payload.run.payload.codeReview.changed, true);
    assert.match(payload.run.payload.codeReview.after, /Button variant="primary"/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("studio review scores url site without mutating source fixture", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "morph-studio-"));
  const siteDir = path.join(tempRoot, "agent-site");
  await copyFixtureForDemo(path.join(repoRoot, "fixtures/codex-landing"), siteDir);
  const previewUrl = `file://${path.join(siteDir, "index.html")}`;
  const sourceBefore = await readFile(path.join(siteDir, "index.html"), "utf8");

  const configPath = path.join(tempRoot, "morph.config.json");
  await writeFile(configPath, `${JSON.stringify({
    projectName: "Acme Studio",
    projectId: "acme-studio",
    projectRoot: "fixtures/acme-saas",
    morphDir: ".morph",
    tokenFiles: ["design-system/tokens.css"],
    scan: ["src/**/*.tsx"],
    gate: {
      minScore: 95
    }
  }, null, 2)}\n`);

  const config = await loadConfig(configPath, tempRoot);
  const { server, url } = await serveMorph(config, { host: "127.0.0.1", port: 0, loadEnv: false });

  try {
    const response = await fetch(`${url}/api/studio/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "url",
        previewUrl
      })
    });
    assert.equal(response.status, 201);
    const payload = await response.json();

    assert.equal(payload.run.kind, "studio-review");
    assert.equal(payload.run.payload.before.verdict, "fail");
    assert.equal(payload.run.payload.finalVerdict, "fail");
    assert.equal(payload.run.payload.redesignPasses, true);
    assert.equal(payload.run.payload.isolated, true);

    const sourceAfter = await readFile(path.join(siteDir, "index.html"), "utf8");
    assert.equal(sourceAfter, sourceBefore);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("design intelligence database exposes profiles and heuristics", () => {
  const summary = databaseSummary();
  assert.equal(summary.profiles >= 16, true);
  assert.equal(summary.heuristics >= 20, true);
  assert.equal(summary.patterns >= 75, true);
  assert.equal(summary.archetypes >= 8, true);
  assert.equal(summary.referenceSites >= 100, true);
  assert.equal(summary.referenceCorpus >= 100, true);
  assert.equal(summary.estimatedSourceSignals >= 4000000, true);
  assert.equal(summary.sourceIndex.families >= 8, true);
  assert.equal(summary.retrievalEngine, "reference_corpus_v2");
  assert.equal(summary.profileIds.includes("aurora-dark"), true);
  assert.equal(summary.profileIds.includes("cobalt-enterprise"), true);
});

test("ui pattern catalog matches reference sites and selects archetypes", () => {
  const catalog = catalogSummary();
  assert.equal(catalog.patterns >= 75, true);
  assert.equal(catalog.referenceSites >= 100, true);

  const stripeMatch = matchReferenceSites("payments checkout like stripe");
  assert.equal(stripeMatch[0]?.site.id, "stripe");

  const archetype = selectArchetype("enterprise security compliance audit sso platform");
  assert.equal(archetype.archetype.id, "enterprise-trust");
  assert.equal(archetype.reason, "keyword_match");
});

test("reference corpus retrieval matches frontier sites to incoming content", async () => {
  const html = await readFile(path.join(repoRoot, "fixtures/codex-landing/index.html"), "utf8");
  const content = extractContent(html);
  const plan = buildRetrievalPlan(
    "TaskPilot plan projects track tasks manage team pricing",
    content
  );

  assert.equal(plan.corpusSize >= 100, true);
  assert.equal(plan.sourceIndex.estimatedSources >= 4000000, true);
  assert.equal(plan.sourceSignals.topDimensions.length >= 1, true);
  assert.equal(plan.sourceSignals.estimatedMatchedSources > 0, true);
  assert.equal(plan.matches.length >= 1, true);
  assert.equal(plan.topReference?.name?.length > 0, true);
  assert.equal(plan.confidence > 0, true);
  assert.equal(plan.patternHints.length >= 3, true);
  assert.equal(plan.industry?.industry, "saas");
});

test("source index summarizes millions of high-end frontend signals", () => {
  const summary = sourceIndexSummary();

  assert.equal(summary.version, "source_index_v1");
  assert.equal(summary.estimatedSources >= 4000000, true);
  assert.equal(summary.families >= 8, true);
  assert.equal(summary.dimensions >= 8, true);
});

test("ai vision degrades gracefully without an api key", async () => {
  const keys = [
    "OPENAI_API_KEY",
    "OPENROUTER_API_KEY",
    "NEBIUS_API_KEY",
    "NVIDIA_API_KEY",
    "AZURE_OPENAI_API_KEY",
    "AZURE_OPENAI_ENDPOINT",
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID"
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  try {
    assert.equal(aiVisionAvailable(), false);
    const result = await analyzeUiReference({ imagePath: "/tmp/nope.png" });
    assert.equal(result.available, false);
    assert.equal(result.reason, "no_api_key");
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test("sponsor integrations describe all bonus tracks", () => {
  const sponsors = listSponsorIntegrations();
  assert.equal(Object.keys(sponsors).sort().join(","), "cloudflare,microsoft,nebius,nvidia,openrouter,suse");
  assert.equal(typeof describeSponsorIntegration("openrouter").role, "string");
  assert.equal(isProviderConfigured("openrouter"), false);
  assert.equal(resolveProviderOrder().length, 0);
});

test("health endpoint exposes sponsor integration status", async () => {
  const config = await loadConfig("morph.config.json", repoRoot);
  const { server, url } = await serveMorph(config, { host: "127.0.0.1", port: 0, loadEnv: false, cwd: repoRoot });
  try {
    const health = await fetchJson(`${url}/api/health`);
    assert.equal(health.ok, true);
    assert.equal(typeof health.sponsorIntegrations, "object");
    assert.equal(typeof health.ai, "object");

    const sponsors = await fetchJson(`${url}/api/sponsors`);
    assert.equal(typeof sponsors.bonusTracks.openrouter, "object");
    assert.equal(typeof sponsors.bonusTracks.suse, "object");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("applyDesignHints merges ai color overrides into a profile", () => {
  const base = getProfile("aurora-dark");
  const merged = applyDesignHints(base, { primaryColor: "#ff0000", mode: "dark" });
  assert.equal(merged.colors.primary, "#ff0000");
  assert.equal(merged.mode, "dark");
});

test("ui quality heuristics flag a fast agent-generated site", async () => {
  const html = await readFile(path.join(repoRoot, "fixtures/codex-landing/index.html"), "utf8");
  const assessment = assessUiQuality(html, "");

  assert.equal(assessment.score < 40, true);
  const ids = assessment.findings.map((finding) => finding.id);
  assert.equal(ids.includes("no-viewport-meta"), true);
  assert.equal(ids.includes("table-or-center-layout"), true);
  assert.equal(ids.includes("no-focus-states"), true);
});

test("content extraction recovers brand, nav, and features from bad markup", async () => {
  const html = await readFile(path.join(repoRoot, "fixtures/codex-landing/index.html"), "utf8");
  const content = extractContent(html);

  assert.equal(content.brand, "TaskPilot");
  assert.equal(content.nav.length >= 3, true);
  assert.equal(content.features.some((feature) => feature.title === "Task Boards"), true);
  assert.equal(content.hero.ctas[0].label, "Get Started");
  assert.equal(content.testimonial.author, "A happy customer");
});

test("profile selection matches content keywords and honors explicit choice", () => {
  const saas = selectProfile("plan projects, track tasks, and manage your team");
  assert.equal(saas.profile.id, "halcyon-blue");
  assert.equal(["keyword_match", "reference_site", "reference_corpus"].includes(saas.reason), true);

  const dev = selectProfile("an api platform for developers to deploy code");
  assert.equal(dev.profile.id, "aurora-dark");

  const explicit = selectProfile("anything at all", "monolith-mono");
  assert.equal(explicit.profile.id, "monolith-mono");
  assert.equal(explicit.reason, "explicit");

  const fallback = selectProfile("zzz qqq");
  assert.equal(fallback.profile.id, "aurora-dark");
  assert.equal(fallback.reason, "default_flagship");
});

test("site research maps audience, structure, and enriches content before transform", () => {
  const html = `<!doctype html>
<html class="dark">
<head>
  <title>Cerebral Valley — AI community</title>
  <meta name="description" content="Community for AI builders, events, and meetups in San Francisco.">
  <meta property="og:site_name" content="Cerebral Valley">
</head>
<body style="background:#0a0a0a;color:#fff">
  <nav><a href="/events">Events</a><a href="/community">Community</a><a href="/jobs">Jobs</a></nav>
  <h1>Cerebral Valley</h1>
  <p>The home for AI builders, hackathons, and demo days across the Bay Area.</p>
  <h2>Upcoming events</h2>
  <p>Weekly meetups, founder dinners, and large-scale AI summits.</p>
  <ul><li>Builder night — March 12</li><li>Demo day — April 3</li></ul>
  <h3>Community programs</h3>
  <p>Membership, job board, and curated introductions for founders.</p>
  <img alt="OpenAI logo" src="/openai.svg">
  <img alt="Anthropic logo" src="/anthropic.svg">
  <img alt="Scale logo" src="/scale.svg">
</body>
</html>`;

  const research = researchSite(html, "body { background: #0a0a0a; color-scheme: dark; }");
  assert.equal(research.audience.some((item) => item.id === "ai-community"), true);
  assert.equal(research.events.length >= 1, true);
  assert.equal(research.navLinks.length >= 3, true);
  assert.equal(research.cards.length >= 2, true);

  const content = enrichContent(extractContent(html), research);
  assert.equal(content.features.length >= 2, true);
  assert.equal(content.sections.length >= 1, true);
  assert.equal(content.logoPartners?.length >= 3, true);
  assert.equal(content.research?.summary?.includes("Cerebral Valley"), true);
});

test("enrich content does not duplicate hero or section headings as features", async () => {
  const html = await readFile(path.join(repoRoot, "fixtures/codex-landing/index.html"), "utf8");
  const research = researchSite(html, "");
  const content = enrichContent(extractContent(html), research);

  assert.equal(content.features.length, 4);
  assert.equal(content.features.some((feature) => feature.title === "Organize your work in one place"), false);
  assert.equal(content.features.some((feature) => feature.title === "Features"), false);
  assert.equal(content.features.some((feature) => feature.title === "Pricing"), false);
  assert.equal(content.hero?.eyebrow, null);
});

test("visual preferences detect dark sites and preserve mode during transform", async () => {
  const darkHtml = `<!doctype html>
<html class="dark" style="color-scheme: dark">
<head>
  <title>Cerebral Valley</title>
  <meta name="theme-color" content="#0a0a0a">
  <style>
    :root { --primary: #8b5cf6; --bg: #0a0a0a; color-scheme: dark; }
    body { background: #0a0a0a; color: #f5f5f5; }
    button { background: #8b5cf6; color: #fff; }
  </style>
</head>
<body>
  <h1>Cerebral Valley</h1>
  <p>Community for AI builders, events, and meetups.</p>
  <button>Join the community</button>
</body>
</html>`;

  const prefs = extractVisualPreferences(darkHtml, "");
  assert.equal(prefs.mode, "dark");
  assert.equal(prefs.primaryColor, "#8b5cf6");

  const halcyon = getProfile("halcyon-blue");
  const aligned = alignProfileToPreferences(halcyon, prefs, { matchedKeywords: ["community", "event"] });
  assert.equal(aligned.mode, "dark");
  assert.notEqual(aligned.id, "halcyon-blue");

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "morph-dark-transform-"));
  const inputDir = path.join(tempRoot, "site");
  const outputDir = path.join(tempRoot, "out");
  await mkdir(inputDir, { recursive: true });
  await writeFile(path.join(inputDir, "index.html"), darkHtml);

  const receipt = await transformSite(inputDir, outputDir);
  assert.equal(receipt.visualPreferences.mode, "dark");
  assert.equal(receipt.profile.mode, "dark");
  assert.equal(receipt.after.score >= 95, true);

  const outputCss = await readFile(path.join(outputDir, "morph-theme.css"), "utf8");
  const bgMatch = outputCss.match(/--bg:\s*(#[0-9a-f]{6}|rgba?\([^)]+\))/i)?.[1] ?? "";
  const bgLum = bgMatch.startsWith("#")
    ? (() => {
      const hex = bgMatch.slice(1);
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    })()
    : 1;
  assert.equal(bgLum < 0.35, true);
});

test("plan transform keeps light sites on light profiles", () => {
  const content = extractContent(`<html><body><h1>TaskPilot</h1><p>Plan projects and manage your team.</p></body></html>`);
  const plan = planTransform(content, {
    visualPreferences: { mode: "light", primaryColor: "#22c55e" }
  });
  assert.equal(plan.profile.profile.mode, "light");
});

test("transform re-renders an ugly site into a passing design-database page", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "morph-transform-"));
  const inputDir = path.join(tempRoot, "site");
  const outputDir = path.join(tempRoot, "out");
  await copyFixtureForDemo(path.join(repoRoot, "fixtures/codex-landing"), inputDir);

  const receipt = await transformSite(inputDir, outputDir);

  assert.equal(receipt.schemaVersion, "morph.transform.v1");
  assert.equal(receipt.before.score < 40, true);
  assert.equal(receipt.after.score >= 95, true);
  assert.equal(receipt.verdict, "pass");
  assert.equal(receipt.profile.id, "halcyon-blue");
  assert.equal(typeof receipt.archetype.id, "string");
  assert.equal(receipt.patterns.length >= 3, true);
  assert.equal(receipt.retrieval.corpusSize >= 100, true);
  assert.equal(receipt.retrieval.estimatedSourceSignals >= 4000000, true);
  assert.equal(receipt.retrieval.highEndDimensions.length >= 1, true);
  assert.equal(receipt.retrieval.confidence > 0, true);

  const outputHtml = await readFile(path.join(outputDir, "index.html"), "utf8");
  const outputCss = await readFile(path.join(outputDir, "morph-theme.css"), "utf8");
  assert.equal(outputHtml.includes("TaskPilot"), true);
  assert.equal(outputHtml.includes("Drag and drop tasks between columns"), true);
  assert.equal(outputHtml.includes('name="viewport"'), true);
  assert.equal(outputCss.includes("--primary"), true);
  assert.equal(outputCss.includes("focus-visible"), true);
  assert.equal(outputCss.includes("@media"), true);
});

test("studio github review clones the repo, transforms it, and serves the result", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "morph-github-"));
  const bareRepoDir = path.join(tempRoot, "agent-site");
  await copyFixtureForDemo(path.join(repoRoot, "fixtures/codex-landing"), bareRepoDir);
  execFileSync("git", ["init", "--quiet"], { cwd: bareRepoDir });
  execFileSync("git", ["add", "."], { cwd: bareRepoDir });
  execFileSync("git", ["-c", "user.email=test@morph.dev", "-c", "user.name=morph Test", "commit", "--quiet", "-m", "fast codex site"], { cwd: bareRepoDir });

  const fixtureRoot = path.join(tempRoot, "acme-saas");
  await copyFixtureForDemo(path.join(repoRoot, "fixtures/acme-saas"), fixtureRoot);
  const configPath = path.join(tempRoot, "morph.config.json");
  await writeFile(configPath, `${JSON.stringify({
    projectName: "Acme GitHub Transform",
    projectRoot: "acme-saas",
    morphDir: ".morph",
    tokenFiles: ["design-system/tokens.css"],
    scan: ["src/**/*.tsx"]
  }, null, 2)}\n`);

  const config = await loadConfig(configPath, tempRoot);
  const { server, url } = await serveMorph(config, { host: "127.0.0.1", port: 0, loadEnv: false });

  try {
    const response = await fetch(`${url}/api/studio/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "github",
        githubRepo: `file://${bareRepoDir}`,
        instructions: "Make this look like a frontier company built it."
      })
    });
    assert.equal(response.status, 201);
    const payload = await response.json();
    const review = payload.run.payload;

    assert.equal(review.engine, "design_db_transform");
    assert.equal(review.before.verdict, "fail");
    assert.equal(review.finalVerdict, "fail");
    assert.equal(review.redesignPasses, true);
    assert.equal(review.transform.profile.id, "halcyon-blue");
    assert.equal(review.transformedPreviewPath, "/transformed/index.html");
    assert.equal(review.codeReview.changed, true);

    const previewResponse = await fetch(`${url}/transformed/index.html`);
    assert.equal(previewResponse.status, 200);
    assert.equal(previewResponse.headers.get("content-type").includes("text/html"), true);
    const previewHtml = await previewResponse.text();
    assert.equal(previewHtml.includes("TaskPilot"), true);
    assert.equal(previewHtml.includes("morph-theme.css"), true);

    const cssResponse = await fetch(`${url}/transformed/morph-theme.css`);
    assert.equal(cssResponse.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

async function fetchJson(url) {
  const response = await fetch(url);
  assert.equal(response.ok, true);
  return response.json();
}
