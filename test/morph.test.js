import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
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
  const { server, url } = await serveMorph(config, { host: "127.0.0.1", port: 0 });

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

async function fetchJson(url) {
  const response = await fetch(url);
  assert.equal(response.ok, true);
  return response.json();
}
