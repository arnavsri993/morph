import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  copyFixtureForDemo,
  createReport,
  loadConfig,
  repairProject
} from "../src/core.js";

const root = path.resolve(import.meta.dirname, "..");
const sourceFixture = path.join(root, "fixtures/acme-saas");
const demoRoot = path.join(root, ".demo-run/acme-saas");
const demoConfigPath = path.join(root, ".demo-run/morph.config.json");
const reportsDir = path.join(root, "demo/reports");

await copyFixtureForDemo(sourceFixture, demoRoot);
await mkdir(path.dirname(demoConfigPath), { recursive: true });
await mkdir(reportsDir, { recursive: true });

await writeFile(demoConfigPath, `${JSON.stringify({
  projectName: "Acme Control Plane Demo Copy",
  projectId: "acme-control-plane-demo",
  projectRoot: "acme-saas",
  morphDir: ".morph",
  workspace: {
    id: "raise-demo-workspace",
    name: "RAISE Summit Demo Workspace",
    authMode: "dev"
  },
  tokenFiles: ["design-system/tokens.css"],
  scan: ["src/**/*.tsx"],
  componentImports: {
    Button: "src/components/Button.tsx"
  },
  gate: {
    minScore: 95,
    mergePolicy: "block_on_any_drift"
  },
  report: {
    defaultOutput: "../demo/reports/demo-before.json"
  },
  auth: {
    mode: "dev"
  },
  billing: {
    provider: "stripe",
    mode: "stub"
  }
}, null, 2)}\n`);

const config = await loadConfig(demoConfigPath, path.dirname(demoConfigPath));
const before = await createReport(config);
await writeFile(path.join(reportsDir, "demo-before.json"), `${JSON.stringify(before, null, 2)}\n`);

const repair = await repairProject(config, { apply: true });
await writeFile(path.join(reportsDir, "demo-repair.json"), `${JSON.stringify(repair, null, 2)}\n`);

const after = await createReport(config);
await writeFile(path.join(reportsDir, "demo-after.json"), `${JSON.stringify(after, null, 2)}\n`);

console.log("Morph demo complete.");
console.log(`Before: ${before.verdict} (${before.score}/100), ${before.issues.length} issue(s)`);
console.log(`Repair: ${repair.replacements} replacement(s) across ${repair.patches.length} file(s)`);
console.log(`After: ${after.verdict} (${after.score}/100), ${after.issues.length} issue(s)`);
console.log("Reports written to demo/reports/.");
