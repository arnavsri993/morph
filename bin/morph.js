#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import {
  createReport,
  formatHumanReport,
  initProject,
  loadConfig,
  loopProject,
  repairProject,
  storeRun
} from "../src/core.js";
import { serveMorph } from "../src/server.js";

function parseArgs(argv) {
  const args = {
    command: argv[2] === "--help" || argv[2] === "-h" ? "help" : argv[2] ?? "help",
    config: "morph.config.json",
    output: null,
    json: false,
    apply: false,
    noFail: false,
    store: false,
    force: false,
    host: null,
    port: null,
    projectName: null
  };

  for (let i = 3; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--config") args.config = argv[++i];
    else if (arg === "--output") args.output = argv[++i];
    else if (arg === "--json") args.json = true;
    else if (arg === "--apply") args.apply = true;
    else if (arg === "--no-fail") args.noFail = true;
    else if (arg === "--store") args.store = true;
    else if (arg === "--force") args.force = true;
    else if (arg === "--host") args.host = argv[++i];
    else if (arg === "--port") args.port = argv[++i];
    else if (arg === "--project-name") args.projectName = argv[++i];
    else if (arg === "--help" || arg === "-h") args.command = "help";
  }

  return args;
}

function printHelp() {
  console.log(`Morph

Usage:
  morph init [--project-name "Acme"] [--force] [--json]
  morph verify --config morph.config.json [--json] [--output report.json] [--store] [--no-fail]
  morph repair --config morph.config.json [--apply] [--json] [--store]
  morph loop --config morph.config.json [--apply] [--json] [--store] [--no-fail]
  morph demo
  morph serve --config morph.config.json [--host 127.0.0.1] [--port 4177]

Commands:
  init     Create morph.config.json, .morph/runs, and safe env examples.
  verify   Scan a frontend fixture and emit design-system drift reports.
  repair   Generate or apply deterministic patch suggestions from the report.
  loop     Verify, repair, verify again, and emit a final pass/fail gate.
  demo     Run the bundled Acme SaaS judge demo.
  serve    Start the local Morph control plane and JSON API.
`);
}

function printHumanReport(report) {
  console.log(formatHumanReport(report));
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.command === "help") {
    printHelp();
    return;
  }

  if (args.command === "init") {
    const result = await initProject(process.cwd(), {
      force: args.force,
      projectName: args.projectName
    });
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(`Initialized Morph for ${result.projectName}.`);
      for (const item of result.created) console.log(`- ${item}`);
    }
    return;
  }

  if (args.command === "demo") {
    await import("../scripts/demo.mjs");
    return;
  }

  const config = await loadConfig(args.config, process.cwd());

  if (args.command === "verify") {
    const report = await createReport(config);
    const output = args.output ?? config.report?.defaultOutput ?? null;
    if (output) {
      await writeFile(config.resolveFromConfig(output), `${JSON.stringify(report, null, 2)}\n`);
    }
    if (args.store) {
      const stored = await storeRun(config, "verify", report);
      if (!args.json) console.log(`Stored run: ${stored.file}`);
    }
    if (args.json) console.log(JSON.stringify(report, null, 2));
    else printHumanReport(report);
    if (report.verdict !== "pass" && !args.noFail) process.exitCode = 1;
    return;
  }

  if (args.command === "repair") {
    const result = await repairProject(config, { apply: args.apply });
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(args.apply ? "Applied Morph repair plan." : "Generated Morph repair plan.");
      console.log(`${result.patches.length} file patch(es), ${result.replacements} replacement(s).`);
      for (const patch of result.patches) console.log(`- ${patch.file}`);
    }
    if (args.store) {
      const stored = await storeRun(config, "repair", result);
      if (!args.json) console.log(`Stored run: ${stored.file}`);
    }
    return;
  }

  if (args.command === "loop") {
    const result = await loopProject(config, { apply: args.apply });
    if (args.store) {
      const stored = await storeRun(config, "loop", result);
      if (!args.json) result.storedAt = stored.file;
    }
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(`Morph loop ${result.finalVerdict.toUpperCase()}.`);
      console.log(`Before: ${result.before.verdict} (${result.before.score}/100), ${result.before.issues.length} issue(s)`);
      console.log(`Repair: ${result.repair.replacements} replacement(s), apply=${result.applied}`);
      console.log(`After: ${result.after.verdict} (${result.after.score}/100), ${result.after.issues.length} issue(s)`);
      console.log(result.ciSummary);
    }
    if (!result.passed && !args.noFail) process.exitCode = 1;
    return;
  }

  if (args.command === "serve") {
    const { url } = await serveMorph(config, {
      host: args.host,
      port: args.port
    });
    console.log(`Morph control plane: ${url}`);
    console.log("Press Ctrl+C to stop.");
    return;
  }

  printHelp();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
