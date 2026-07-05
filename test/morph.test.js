import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
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

const repoRoot = path.resolve(import.meta.dirname, "..");

test("verify catches seeded design-system drift with agent-readable patches", async () => {
  const config = await loadConfig("morph.config.json", repoRoot);
  const report = await createReport(config);

  assert.equal(report.verdict, "fail");
  assert.equal(report.summary.high > 0, true);
  assert.equal(report.issues.some((issue) => issue.id === "component-fragmentation"), true);
  assert.equal(report.issues.every((issue) => issue.patch?.replacements?.length), true);
});

test("verify flags icon-only buttons missing an accessible label", async () => {
  const config = await loadConfig("morph.config.json", repoRoot);
  const report = await createReport(config);

  const a11yIssue = report.issues.find((issue) => issue.id === "icon-button-missing-label");
  assert.ok(a11yIssue, "expected icon-button-missing-label finding");
  assert.equal(a11yIssue.type, "interaction_drift");
  assert.equal(a11yIssue.patch.replacements[0].replace.includes("aria-label"), true);
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
    assert.equal(studio.includes("Connect GitHub"), true);
    assert.equal(studio.includes("Agent instructions"), true);
    assert.equal(studio.includes("Preview URL"), true);
    assert.equal(studio.includes("morph"), true);
    assert.equal(studio.includes("Narrate review"), false);
    assert.equal(studio.includes("Load broken demo"), false);
    assert.equal(studio.includes("Paste UI code"), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
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

test("stripe checkout stays stubbed until configured and webhooks verify signatures", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "morph-stripe-"));
  const fixtureRoot = path.join(tempRoot, "acme-saas");
  await copyFixtureForDemo(path.join(repoRoot, "fixtures/acme-saas"), fixtureRoot);

  const configPath = path.join(tempRoot, "morph.config.json");
  await writeFile(configPath, `${JSON.stringify({
    projectName: "Acme Stripe",
    projectRoot: "acme-saas",
    morphDir: ".morph",
    tokenFiles: ["design-system/tokens.css"],
    scan: ["src/**/*.tsx"]
  }, null, 2)}\n`);

  const savedEnv = {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET
  };
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_PRICE_ID;
  delete process.env.STRIPE_WEBHOOK_SECRET;

  const config = await loadConfig(configPath, tempRoot);
  const { server, url } = await serveMorph(config, { host: "127.0.0.1", port: 0, loadEnv: false });

  try {
    const stubCheckout = await fetch(`${url}/api/billing/checkout`, { method: "POST" });
    assert.equal(stubCheckout.status, 200);
    assert.equal((await stubCheckout.json()).mode, "stub");

    const stubWebhook = await fetch(`${url}/api/webhooks/stripe`, {
      method: "POST",
      body: JSON.stringify({ type: "checkout.session.completed" })
    });
    assert.equal((await stubWebhook.json()).mode, "stub");

    const webhookSecret = "whsec_morph_test_secret";
    const saveResponse = await fetch(`${url}/api/billing/stripe`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secretKey: "sk_test_morph123", priceId: "price_morph123", webhookSecret })
    });
    assert.equal(saveResponse.status, 200);
    const saved = await saveResponse.json();
    assert.equal(saved.stripe.checkoutConfigured, true);
    assert.equal(saved.stripe.webhookConfigured, true);

    const event = JSON.stringify({
      id: "evt_test_1",
      type: "checkout.session.completed",
      data: { object: { customer: "cus_123", subscription: "sub_123", customer_details: { email: "dev@acme.test" } } }
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", webhookSecret).update(`${timestamp}.${event}`, "utf8").digest("hex");

    const verifiedResponse = await fetch(`${url}/api/webhooks/stripe`, {
      method: "POST",
      headers: { "stripe-signature": `t=${timestamp},v1=${signature}` },
      body: event
    });
    assert.equal(verifiedResponse.status, 200);
    const verified = await verifiedResponse.json();
    assert.equal(verified.verified, true);
    assert.equal(verified.subscription.plan, "team");
    assert.equal(verified.subscription.status, "active");

    const badResponse = await fetch(`${url}/api/webhooks/stripe`, {
      method: "POST",
      headers: { "stripe-signature": `t=${timestamp},v1=${"0".repeat(64)}` },
      body: event
    });
    assert.equal(badResponse.status, 400);
    assert.equal((await badResponse.json()).error, "signature_mismatch");

    const billingState = await fetchJson(`${url}/api/billing`);
    assert.equal(billingState.subscription.plan, "team");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("studio review accepts preview url and agent instructions", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "morph-studio-inputs-"));
  const fixtureRoot = path.join(tempRoot, "acme-saas");
  await copyFixtureForDemo(path.join(repoRoot, "fixtures/acme-saas"), fixtureRoot);

  const configPath = path.join(tempRoot, "morph.config.json");
  await writeFile(configPath, `${JSON.stringify({
    projectName: "Acme Studio Inputs",
    projectId: "acme-studio-inputs",
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
        source: "url",
        previewUrl: "https://example.com/billing",
        instructions: "Review the agent billing screen for token drift."
      })
    });
    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.equal(payload.run.payload.source, "url");
    assert.equal(payload.run.payload.previewUrl, "https://example.com/billing");
    assert.equal(payload.run.payload.instructions, "Review the agent billing screen for token drift.");
    assert.equal(payload.run.payload.preview?.url, "https://example.com/billing");
    assert.equal(payload.run.payload.finalVerdict, "pass");
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

test("studio review repairs an isolated copy without mutating source fixture", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "morph-studio-"));
  const fixtureRoot = path.join(tempRoot, "acme-saas");
  await copyFixtureForDemo(path.join(repoRoot, "fixtures/acme-saas"), fixtureRoot);

  const configPath = path.join(tempRoot, "morph.config.json");
  await writeFile(configPath, `${JSON.stringify({
    projectName: "Acme Studio",
    projectId: "acme-studio",
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

  const driftedFile = path.join(fixtureRoot, "src/routes/settings/billing.tsx");
  const sourceBefore = await readFile(driftedFile, "utf8");
  const config = await loadConfig(configPath, tempRoot);
  const { server, url } = await serveMorph(config, { host: "127.0.0.1", port: 0, loadEnv: false });

  try {
    const response = await fetch(`${url}/api/studio/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "url",
        previewUrl: "https://example.com/billing"
      })
    });
    assert.equal(response.status, 201);
    const payload = await response.json();

    assert.equal(payload.run.kind, "studio-review");
    assert.equal(payload.run.payload.before.verdict, "fail");
    assert.equal(payload.run.payload.finalVerdict, "pass");
    assert.equal(payload.run.payload.isolated, true);

    const sourceAfter = await readFile(driftedFile, "utf8");
    assert.equal(sourceAfter, sourceBefore);

    const sourceReport = await createReport(config);
    assert.equal(sourceReport.verdict, "fail");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

async function fetchJson(url) {
  const response = await fetch(url);
  assert.equal(response.ok, true);
  return response.json();
}
