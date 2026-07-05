import { existsSync } from "node:fs";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import {
  buildAgentRules,
  dedupeIssues,
  enrichGrammarFromTokens,
  runExternalScanners,
  writeAgentRules
} from "./scanners/index.js";

const SEVERITY_DEDUCTION = {
  high: 5.5,
  medium: 2.75,
  low: 1
};

const TYPE_DEDUCTION_MULTIPLIER = {
  design_drift: 1,
  component_drift: 1.25,
  interaction_drift: 1.15,
  responsive_drift: 1.1
};

const SEVERITY_FAMILY_CAP = {
  high: 18,
  medium: 10,
  low: 4
};

const REPEAT_DEDUCTION_FACTORS = [1, 0.6, 0.35];

export function parseConfig(parsed, configPath) {
  const absoluteConfigPath = path.resolve(configPath);
  const configDir = path.dirname(absoluteConfigPath);
  const projectRoot = path.resolve(configDir, parsed.projectRoot);

  return {
    ...parsed,
    configPath: absoluteConfigPath,
    configDir,
    projectRoot,
    morphDir: path.resolve(configDir, parsed.morphDir ?? ".morph"),
    resolveFromConfig(relativePath) {
      return path.resolve(configDir, relativePath);
    },
    resolveFromProject(relativePath) {
      return path.resolve(projectRoot, relativePath);
    }
  };
}

export async function loadConfig(configPath, cwd = process.cwd()) {
  const absoluteConfigPath = path.resolve(cwd, configPath);
  const raw = await readFile(absoluteConfigPath, "utf8");
  const parsed = JSON.parse(raw);
  return parseConfig(parsed, absoluteConfigPath);
}

export async function createReport(config, options = {}) {
  const startedAt = new Date();
  const baseGrammar = await loadGrammar(config);
  const grammar = await enrichGrammarFromTokens(config, baseGrammar);
  const files = await findScanFiles(config);
  const scanFiles = files.map((absoluteFile) => ({
    absolute: absoluteFile,
    relative: path.relative(config.projectRoot, absoluteFile).split(path.sep).join("/")
  }));
  const nativeIssues = [];

  for (const file of scanFiles) {
    const source = await readFile(file.absolute, "utf8");
    nativeIssues.push(...scanSource(file.relative, source, grammar));
  }

  const external = await runExternalScanners(config, scanFiles, grammar);
  const filteredExternal = external.issues.filter((issue) => {
    if (!/color|eslint|palette|hex/i.test(issue.id)) return true;
    return !nativeIssues.some((nativeIssue) =>
      nativeIssue.file === issue.file
      && /color|palette|hex/i.test(nativeIssue.id)
    );
  });
  const issues = dedupeIssues([...nativeIssues, ...filteredExternal]);

  const grade = calculateGrade(issues);
  const score = grade.score;
  const gateThreshold = config.gate?.minScore ?? 95;
  const report = {
    schemaVersion: "morph.report.v1",
    runId: options.runId ?? createRunId("verify"),
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    workspace: config.workspace ?? {
      id: "local",
      name: "Local Workspace",
      authMode: "dev"
    },
    projectId: config.projectId ?? slugify(config.projectName),
    project: config.projectName,
    verdict: score >= gateThreshold && issues.length === 0 ? "pass" : "fail",
    score,
    grade,
    summary: summarizeIssues(issues),
    gate: {
      threshold: gateThreshold,
      passed: score >= gateThreshold && issues.length === 0,
      mergePolicy: config.gate?.mergePolicy ?? "block_on_any_drift"
    },
    ciSummary: buildCiSummary(score, issues),
    grammar: {
      tokenFiles: config.tokenFiles,
      colors: grammar.colors,
      spacing: grammar.spacing,
      radius: grammar.radius,
      fontSize: grammar.fontSize,
      components: Object.keys(config.componentImports ?? {})
    },
    scan: {
      filesScanned: files.length,
      globs: config.scan ?? ["src/**/*.{tsx,jsx,html}"]
    },
    engines: {
      morph: nativeIssues.length,
      ...external.engines,
      merged: issues.length
    },
    health: external.health,
    issues,
    remediation: buildRemediationPlan(issues),
    nextActions: issues.length
      ? [
          "Run morph repair --apply on an agent branch.",
          "Re-run morph verify until the report passes.",
          "Promote intentional new patterns into tokens instead of merging one-off UI."
        ]
      : [
          "Design-system grammar matched. Safe to hand to human review."
        ],
    humanReport: ""
  };

  report.humanReport = formatHumanReport(report);
  return report;
}

export async function repairProject(config, options = {}) {
  const report = await createReport(config, { runId: options.runId ?? createRunId("repair-base") });
  const grouped = new Map();

  for (const issue of report.issues) {
    if (!issue.patch?.replacements?.length) continue;
    const existing = grouped.get(issue.file) ?? [];
    existing.push(...issue.patch.replacements.map((replacement) => ({
      ...replacement,
      issueId: issue.id
    })));
    grouped.set(issue.file, existing);
  }

  const patches = [];
  const skippedReplacements = [];
  let candidateReplacements = 0;
  let replacements = 0;

  for (const [relativeFile, fileReplacements] of grouped.entries()) {
    const absoluteFile = config.resolveFromProject(relativeFile);
    const originalSource = await readFile(absoluteFile, "utf8");
    const result = applyRepairReplacements(originalSource, fileReplacements);
    candidateReplacements += result.candidates;
    replacements += result.applied.length;
    skippedReplacements.push(...result.skipped.map((replacement) => ({
      ...replacement,
      file: relativeFile
    })));

    if (result.applied.length) {
      patches.push({
        file: relativeFile,
        replacements: result.applied
      });
      if (options.apply) await writeFile(absoluteFile, result.source);
    }
  }

  const after = options.apply ? await createReport(config) : null;
  const skippedSuperseded = skippedReplacements.some((replacement) => replacement.reason === "superseded_by_prior_replacement");
  return {
    schemaVersion: "morph.repair.v1",
    runId: options.repairId ?? createRunId(options.apply ? "repair-applied" : "repair-plan"),
    generatedAt: new Date().toISOString(),
    project: config.projectName,
    applied: Boolean(options.apply),
    basedOnScore: report.score,
    basedOnRunId: report.runId,
    patches,
    candidateReplacements,
    replacements,
    skippedReplacements,
    risk: patches.length
      ? skippedSuperseded
        ? "deterministic_replacements_with_superseded_fixes"
        : "deterministic_replacements_only"
      : "no_applicable_patch",
    instructions: options.apply
      ? "Patch applied. Re-run morph verify before merge."
      : "Review this patch plan, then run morph repair --apply or morph loop --apply.",
    after
  };
}

function applyRepairReplacements(originalSource, replacements) {
  let source = originalSource;
  const applied = [];
  const skipped = [];
  const orderedReplacements = dedupeReplacements(replacements)
    .map((replacement, index) => ({ ...replacement, index }))
    .sort((left, right) => right.find.length - left.find.length || left.index - right.index);

  for (const replacement of orderedReplacements) {
    const cleanReplacement = {
      find: replacement.find,
      replace: replacement.replace
    };
    const skippedReplacement = {
      ...cleanReplacement,
      issueId: replacement.issueId ?? null
    };

    if (!replacement.find) {
      skipped.push({
        ...skippedReplacement,
        reason: "empty_find"
      });
      continue;
    }

    if (replacement.find === replacement.replace) {
      skipped.push({
        ...skippedReplacement,
        reason: "no_op"
      });
      continue;
    }

    if (!source.includes(replacement.find)) {
      skipped.push({
        ...skippedReplacement,
        reason: originalSource.includes(replacement.find)
          ? "superseded_by_prior_replacement"
          : "not_found"
      });
      continue;
    }

    source = source.split(replacement.find).join(replacement.replace);
    applied.push(cleanReplacement);
  }

  return {
    source,
    applied,
    skipped,
    candidates: orderedReplacements.length
  };
}

export async function loopProject(config, options = {}) {
  const before = await createReport(config, { runId: createRunId("loop-before") });
  const repair = await repairProject(config, {
    apply: Boolean(options.apply),
    runId: before.runId,
    repairId: createRunId(options.apply ? "loop-repair-applied" : "loop-repair-plan")
  });
  const after = options.apply
    ? repair.after
    : await createReport(config, { runId: createRunId("loop-after-dry-run") });

  return {
    schemaVersion: "morph.loop.v1",
    runId: createRunId("loop"),
    generatedAt: new Date().toISOString(),
    project: config.projectName,
    applied: Boolean(options.apply),
    before,
    repair: {
      runId: repair.runId,
      replacements: repair.replacements,
      patches: repair.patches,
      risk: repair.risk
    },
    after,
    finalVerdict: after.verdict,
    passed: after.verdict === "pass",
    ciSummary: after.verdict === "pass"
      ? "Morph loop passed after deterministic repair."
      : "Morph loop still fails. Escalate remaining findings to a human or expand grammar rules."
  };
}

export async function copyFixtureForDemo(source, destination) {
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true, force: true });
}

export async function initProject(targetDir = process.cwd(), options = {}) {
  const absoluteTarget = path.resolve(targetDir);
  const projectName = options.projectName ?? path.basename(absoluteTarget);
  const morphDir = path.join(absoluteTarget, ".morph");
  const reportsDir = path.join(morphDir, "runs");
  const configPath = path.join(absoluteTarget, "morph.config.json");
  const envPath = path.join(absoluteTarget, ".env.example");
  const created = [];

  await mkdir(reportsDir, { recursive: true });
  created.push(path.relative(absoluteTarget, reportsDir));

  if (!existsSync(configPath) || options.force) {
    await writeFile(configPath, `${JSON.stringify(defaultConfig(projectName), null, 2)}\n`);
    created.push("morph.config.json");
  }

  if (!existsSync(envPath) || options.force) {
    await writeFile(envPath, defaultEnvExample());
    created.push(".env.example");
  }

  let agentFiles = [];
  try {
    const config = await loadConfig(configPath, absoluteTarget);
    const grammar = await enrichGrammarFromTokens(config, await loadGrammar(config));
    const rules = buildAgentRules({
      projectName,
      grammar,
      componentImports: config.componentImports ?? {}
    });
    agentFiles = await writeAgentRules(absoluteTarget, rules);
    created.push(...agentFiles);
  } catch {
    // Token files may not exist yet on first init.
  }

  return {
    schemaVersion: "morph.init.v1",
    projectName,
    root: absoluteTarget,
    created,
    agentRules: agentFiles,
    nextActions: [
      "Edit morph.config.json to point at your frontend and token files.",
      "Review AGENTS.md and .cursor/rules/morph-design-system.mdc for agent guardrails.",
      "Run morph verify --json --store.",
      "Use morph loop --apply in CI on agent branches."
    ]
  };
}

export async function storeRun(config, kind, payload) {
  const runsDir = path.join(config.morphDir, "runs");
  await mkdir(runsDir, { recursive: true });
  const runId = payload.runId ?? createRunId(kind);
  const record = {
    id: runId,
    kind,
    projectId: payload.projectId ?? config.projectId ?? slugify(config.projectName),
    project: payload.project ?? config.projectName,
    createdAt: new Date().toISOString(),
    payload
  };
  const file = path.join(runsDir, `${runId}.json`);
  await writeFile(file, `${JSON.stringify(record, null, 2)}\n`);
  return {
    ...record,
    file
  };
}

export async function listRuns(config) {
  const runsDir = path.join(config.morphDir, "runs");
  if (!existsSync(runsDir)) return [];
  const entries = await readdir(runsDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(runsDir, entry.name));

  const records = [];
  for (const file of files) {
    try {
      records.push(JSON.parse(await readFile(file, "utf8")));
    } catch {
      records.push({
        id: path.basename(file, ".json"),
        kind: "unreadable",
        file
      });
    }
  }

  return records.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
}

export function formatHumanReport(report) {
  const lines = [
    `${report.project}: ${report.verdict.toUpperCase()} (${report.score}/100)`,
    report.ciSummary
  ];
  if (!report.issues.length) return lines.join("\n");

  for (const issueItem of report.issues) {
    lines.push(`- [${issueItem.severity}] ${issueItem.id} ${issueItem.file}:${issueItem.line}`);
    lines.push(`  ${issueItem.reason}`);
    lines.push(`  Intent: ${issueItem.intent}`);
    lines.push(`  Fix: ${issueItem.suggestedFix}`);
  }
  return lines.join("\n");
}

async function loadGrammar(config) {
  const tokens = {};
  for (const tokenFile of config.tokenFiles ?? []) {
    const absoluteFile = config.resolveFromProject(tokenFile);
    const source = await readFile(absoluteFile, "utf8");
    for (const match of source.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
      tokens[match[1]] = match[2].trim();
    }
  }

  const pick = (prefix) =>
    Object.fromEntries(
      Object.entries(tokens)
        .filter(([name]) => name.startsWith(prefix))
        .map(([name, value]) => [`--${name}`, value])
    );

  return {
    tokens,
    colors: pick("color-"),
    spacing: pick("space-"),
    radius: pick("radius-"),
    fontSize: pick("font-size-"),
    shadows: pick("shadow-")
  };
}

async function findScanFiles(config) {
  const allFiles = await walk(config.projectRoot);
  const extensions = new Set([".tsx", ".jsx", ".html"]);
  const scanGlobs = config.scan ?? ["src/**/*.tsx", "src/**/*.jsx", "**/*.html"];
  return allFiles.filter((file) => {
    const relativeFile = path.relative(config.projectRoot, file).split(path.sep).join("/");
    return extensions.has(path.extname(file)) && scanGlobs.some((glob) => matchesScanGlob(relativeFile, glob));
  });
}

async function walk(directory) {
  const directoryStat = await stat(directory);
  if (!directoryStat.isDirectory()) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (["node_modules", ".git", ".morph", "dist", "build"].includes(entry.name)) continue;
    if (entry.isDirectory()) files.push(...await walk(absolutePath));
    else files.push(absolutePath);
  }

  return files;
}

function scanSource(file, source, grammar) {
  const issues = [];
  issues.push(...detectHardcodedColors(file, source, grammar));
  issues.push(...detectSpacing(file, source, grammar));
  issues.push(...detectRadius(file, source, grammar));
  issues.push(...detectType(file, source, grammar));
  issues.push(...detectRawButtons(file, source));
  issues.push(...detectFocusRegression(file, source));
  issues.push(...detectResponsiveRisk(file, source));
  issues.push(...detectShadowDrift(file, source));
  issues.push(...detectIconButtonMissingLabel(file, source));
  return issues;
}

function detectHardcodedColors(file, source, grammar) {
  const allowed = new Set(Object.values(grammar.colors).map((value) => value.toLowerCase()));
  const seen = new Set();
  for (const match of source.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
    const value = match[0].toLowerCase();
    if (!allowed.has(value)) seen.add(value);
  }
  if (!seen.size) return [];
  const colors = [...seen].join(", ");
  return [
    issue({
      id: "hardcoded-color",
      type: "design_drift",
      severity: "high",
      file,
      source,
      index: source.indexOf([...seen][0]),
      reason: `Found hardcoded color(s) ${colors} outside the product token set.`,
      suggestedFix: "Replace one-off colors with semantic color tokens.",
      intent: "agent_added_visual_style_without_design_system_backing",
      replacements: [
        { find: "bg-[#7c3aed]", replace: "bg-[var(--color-primary)]" },
        { find: "text-[#faf5ff]", replace: "text-[var(--color-primary-foreground)]" }
      ]
    })
  ];
}

function detectSpacing(file, source, grammar) {
  const allowed = new Set(Object.values(grammar.spacing));
  const replacements = [];
  let firstIndex = -1;
  let firstMatch = "";
  for (const match of source.matchAll(/\b(?:p|px|py|pt|pr|pb|pl|m|mx|my|gap|space-y|space-x)-\[(\d+)px\]/g)) {
    const value = `${match[1]}px`;
    if (allowed.has(value)) continue;
    if (firstIndex === -1) {
      firstIndex = match.index;
      firstMatch = match[0];
    }
    replacements.push({ find: match[0], replace: match[0].replace(/\[\d+px\]/, "[var(--space-4)]") });
  }
  if (!replacements.length) return [];
  return [
    issue({
      id: "off-scale-spacing",
      type: "design_drift",
      severity: "medium",
      file,
      source,
      index: firstIndex,
      reason: `${firstMatch} and related arbitrary spacing values are not on the product spacing scale.`,
      suggestedFix: "Snap spacing to the nearest design-system token.",
      intent: "agent_used_pixel_perfect_local_guess_instead_of_spacing_scale",
      replacements: dedupeReplacements(replacements)
    })
  ];
}

function detectRadius(file, source, grammar) {
  const allowed = new Set(Object.values(grammar.radius));
  const replacements = [];
  let firstIndex = -1;
  let firstMatch = "";
  for (const match of source.matchAll(/\brounded(?:-[a-z]+)?-\[(\d+)px\]/g)) {
    const value = `${match[1]}px`;
    if (allowed.has(value)) continue;
    if (firstIndex === -1) {
      firstIndex = match.index;
      firstMatch = match[0];
    }
    replacements.push({ find: match[0], replace: "rounded-[var(--radius-card)]" });
  }
  if (!replacements.length) return [];
  return [
    issue({
      id: "radius-drift",
      type: "design_drift",
      severity: "high",
      file,
      source,
      index: firstIndex,
      reason: `${firstMatch} introduces a radius not used by the design system.`,
      suggestedFix: "Use the product card radius token.",
      intent: "agent_changed_shape_language",
      replacements: dedupeReplacements(replacements)
    })
  ];
}

function detectType(file, source, grammar) {
  const allowed = new Set(Object.values(grammar.fontSize));
  const issues = [];
  for (const match of source.matchAll(/\btext-\[(\d+(?:\.\d+)?)px\]/g)) {
    const value = `${match[1]}px`;
    if (allowed.has(value)) continue;
    issues.push(issue({
      id: "type-scale-drift",
      type: "design_drift",
      severity: "low",
      file,
      source,
      index: match.index,
      reason: `${match[0]} bypasses the product type scale.`,
      suggestedFix: "Use a named text size from the system.",
      intent: "agent_created_one_off_typography",
      replacements: [
        { find: match[0], replace: "text-sm" }
      ]
    }));
  }
  return issues;
}

function detectRawButtons(file, source) {
  if (file === "src/components/Button.tsx") return [];
  const blocks = [...source.matchAll(/<button\b[\s\S]*?<\/button>/g)];
  const buttonBlock = blocks.find((match) => !/<svg\b/.test(match[0]))?.[0];
  if (!buttonBlock) return [];
  const replacements = [];
  replacements.push({
    find: buttonBlock,
    replace: '<Button variant="primary">Update plan</Button>'
  });
  if (!source.includes("components/Button")) {
    replacements.push({
      find: "import React from \"react\";\n",
      replace: "import React from \"react\";\nimport { Button } from \"../../components/Button\";\n"
    });
  }
  return [
    issue({
      id: "component-fragmentation",
      type: "component_drift",
      severity: "high",
      file,
      source,
      index: source.indexOf(buttonBlock),
      reason: "Raw button markup bypasses the product Button component and its states.",
      suggestedFix: "Use the shared Button component so hierarchy, focus, and disabled states stay consistent.",
      intent: "agent_reimplemented_existing_component",
      replacements
    })
  ];
}

function detectFocusRegression(file, source) {
  if (!source.includes("focus:outline-none")) return [];
  return [
    issue({
      id: "focus-state-regression",
      type: "interaction_drift",
      severity: "medium",
      file,
      source,
      index: source.indexOf("focus:outline-none"),
      reason: "Focus outline was removed without a product focus-visible replacement.",
      suggestedFix: "Use the shared focus-visible ring token.",
      intent: "agent_removed_accessibility_state",
      replacements: [
        {
          find: "focus:outline-none",
          replace: "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
        }
      ]
    })
  ];
}

function detectResponsiveRisk(file, source) {
  const issues = [];
  for (const match of source.matchAll(/\bmin-w-\[(\d+)px\]/g)) {
    if (Number(match[1]) <= 360) continue;
    issues.push(issue({
      id: "mobile-overflow-risk",
      type: "responsive_drift",
      severity: "medium",
      file,
      source,
      index: match.index,
      reason: `${match[0]} can force overflow on mobile settings screens.`,
      suggestedFix: "Use min-w-0 so the layout can shrink inside responsive containers.",
      intent: "agent_optimized_for_desktop_snapshot_only",
      replacements: [
        { find: match[0], replace: "min-w-0" }
      ]
    }));
  }
  return issues;
}

function detectShadowDrift(file, source) {
  if (!source.includes("shadow-2xl")) return [];
  return [
    issue({
      id: "elevation-drift",
      type: "design_drift",
      severity: "low",
      file,
      source,
      index: source.indexOf("shadow-2xl"),
      reason: "shadow-2xl is heavier than the product card elevation.",
      suggestedFix: "Use the system card shadow token.",
      intent: "agent_added_unapproved_elevation",
      replacements: [
        { find: "shadow-2xl", replace: "shadow-[var(--shadow-card)]" }
      ]
    })
  ];
}

function detectIconButtonMissingLabel(file, source) {
  const issues = [];
  for (const match of source.matchAll(/<button\b[^>]*>\s*(<svg\b[\s\S]*?<\/svg>)\s*<\/button>/g)) {
    const openTag = match[0].slice(0, match[0].indexOf(">") + 1);
    if (/\baria-label=/.test(openTag)) continue;
    issues.push(issue({
      id: "icon-button-missing-label",
      type: "interaction_drift",
      severity: "medium",
      file,
      source,
      index: match.index,
      reason: "Icon-only button has no accessible name for screen readers.",
      suggestedFix: "Add an aria-label describing the button's action.",
      intent: "agent_shipped_icon_button_without_accessible_name",
      replacements: [
        { find: openTag, replace: openTag.replace(/<button\b/, '<button aria-label="Action"') }
      ]
    }));
  }
  return issues;
}

function issue(input) {
  return {
    id: input.id,
    type: input.type,
    severity: input.severity,
    file: input.file,
    line: lineNumber(input.source, input.index),
    reason: input.reason,
    suggestedFix: input.suggestedFix,
    evidence: input.index >= 0 ? input.source.slice(input.index, input.index + 96).split("\n")[0] : "",
    classification: "accidental_drift",
    intent: input.intent ?? "unknown_agent_intent",
    patch: {
      file: input.file,
      replacements: input.replacements
    }
  };
}

function lineNumber(source, index) {
  if (index < 0) return 1;
  return source.slice(0, index).split("\n").length;
}

function calculateGrade(issues) {
  const issueRepeatCounts = new Map();
  const familyDeductions = new Map();
  const deductions = [];
  let totalDeduction = 0;

  for (const issueItem of issues) {
    const repeatKey = `${issueItem.file}\0${issueItem.id}`;
    const repeatCount = (issueRepeatCounts.get(repeatKey) ?? 0) + 1;
    issueRepeatCounts.set(repeatKey, repeatCount);

    const base = SEVERITY_DEDUCTION[issueItem.severity] ?? 0;
    const typeMultiplier = TYPE_DEDUCTION_MULTIPLIER[issueItem.type] ?? 1;
    const repeatFactor = repeatFactorFor(repeatCount);
    const proposedDeduction = roundGradeNumber(base * typeMultiplier * repeatFactor);
    const familyCap = SEVERITY_FAMILY_CAP[issueItem.severity] ?? proposedDeduction;
    const currentFamilyDeduction = familyDeductions.get(issueItem.id) ?? 0;
    const availableFamilyDeduction = Math.max(0, familyCap - currentFamilyDeduction);
    const deduction = roundGradeNumber(Math.min(proposedDeduction, availableFamilyDeduction));

    familyDeductions.set(issueItem.id, roundGradeNumber(currentFamilyDeduction + deduction));
    totalDeduction = roundGradeNumber(totalDeduction + deduction);
    deductions.push({
      issueId: issueItem.id,
      file: issueItem.file,
      severity: issueItem.severity,
      type: issueItem.type,
      repeatIndex: repeatCount,
      repeatFactor,
      proposedDeduction,
      deduction
    });
  }

  const filesAffected = new Set(issues.map((issueItem) => issueItem.file)).size;
  const breadthPenalty = roundGradeNumber(Math.min(6, Math.max(0, filesAffected - 1) * 1.5));
  totalDeduction = roundGradeNumber(totalDeduction + breadthPenalty);

  return {
    model: "severity_type_repeat_cap_v1",
    score: Math.max(0, Math.round(100 - totalDeduction)),
    totalDeduction,
    breadthPenalty,
    filesAffected,
    issueFamilies: Object.fromEntries([...familyDeductions.entries()].sort()),
    deductionsBySeverity: summarizeDeductions(deductions, "severity"),
    deductionsByType: summarizeDeductions(deductions, "type"),
    cappedIssueFamilies: [...familyDeductions.entries()]
      .filter(([issueId, deduction]) => {
        const severity = issues.find((issueItem) => issueItem.id === issueId)?.severity;
        return deduction >= (SEVERITY_FAMILY_CAP[severity] ?? Infinity);
      })
      .map(([issueId]) => issueId)
      .sort(),
    deductions
  };
}

function summarizeDeductions(deductions, key) {
  const summary = key === "severity"
    ? { high: 0, medium: 0, low: 0 }
    : {};

  for (const deduction of deductions) {
    const name = deduction[key] ?? "unknown";
    summary[name] = roundGradeNumber((summary[name] ?? 0) + deduction.deduction);
  }

  return summary;
}

function repeatFactorFor(repeatCount) {
  return REPEAT_DEDUCTION_FACTORS[repeatCount - 1] ?? 0.2;
}

function roundGradeNumber(value) {
  return Math.round(value * 100) / 100;
}

function summarizeIssues(issues) {
  const summary = {
    total: issues.length,
    high: 0,
    medium: 0,
    low: 0
  };
  for (const issueItem of issues) summary[issueItem.severity] += 1;
  return summary;
}

function dedupeReplacements(replacements) {
  const seen = new Set();
  return replacements.filter((replacement) => {
    const key = `${replacement.find}\0${replacement.replace}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function pathExists(filePath) {
  return existsSync(filePath);
}

function buildRemediationPlan(issues) {
  const files = new Map();
  for (const issueItem of issues) {
    const existing = files.get(issueItem.file) ?? {
      file: issueItem.file,
      issues: [],
      replacements: []
    };
    existing.issues.push(issueItem.id);
    existing.replacements.push(...(issueItem.patch?.replacements ?? []));
    files.set(issueItem.file, existing);
  }

  return {
    canAutoRepair: [...files.values()].every((filePlan) => filePlan.replacements.length > 0),
    files: [...files.values()].map((filePlan) => ({
      ...filePlan,
      replacements: dedupeReplacements(filePlan.replacements)
    }))
  };
}

function buildCiSummary(score, issues) {
  if (!issues.length) return `PASS: score ${score}/100, no design-system drift detected.`;
  const summary = summarizeIssues(issues);
  return [
    `FAIL: score ${score}/100.`,
    `${summary.high} high, ${summary.medium} medium, ${summary.low} low finding(s).`,
    "Block merge until Morph repair or explicit grammar approval."
  ].join(" ");
}

function matchesScanGlob(relativeFile, glob) {
  return globToRegExp(glob.replace(/\\/g, "/")).test(relativeFile);
}

function globToRegExp(glob) {
  let pattern = "";
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];
    const next = glob[i + 1];
    const afterNext = glob[i + 2];

    if (char === "*" && next === "*" && afterNext === "/") {
      pattern += "(?:.*/)?";
      i += 2;
    } else if (char === "*" && next === "*") {
      pattern += ".*";
      i += 1;
    } else if (char === "*") {
      pattern += "[^/]*";
    } else if (char === "{") {
      const close = glob.indexOf("}", i + 1);
      if (close === -1) {
        pattern += "\\{";
      } else {
        const choices = glob
          .slice(i + 1, close)
          .split(",")
          .map(escapeRegExp)
          .join("|");
        pattern += `(${choices})`;
        i = close;
      }
    } else {
      pattern += escapeRegExp(char);
    }
  }
  return new RegExp(`^${pattern}$`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function defaultConfig(projectName) {
  return {
    projectName,
    projectId: slugify(projectName),
    projectRoot: ".",
    morphDir: ".morph",
    workspace: {
      id: "dev-workspace",
      name: "Development Workspace",
      authMode: "dev"
    },
    tokenFiles: [
      "src/styles/tokens.css"
    ],
    scan: [
      "src/**/*.tsx",
      "src/**/*.jsx",
      "**/*.html"
    ],
    componentImports: {},
    gate: {
      minScore: 95,
      mergePolicy: "block_on_any_drift"
    },
    report: {
      defaultOutput: ".morph/latest-report.json"
    },
    server: {
      host: "127.0.0.1",
      port: 4177
    },
    auth: {
      mode: "dev",
      sessionCookieName: "morph_session"
    },
    billing: {
      provider: "stripe",
      mode: "stub"
    }
  };
}

function defaultEnvExample() {
  return `# Morph product shell
MORPH_AUTH_MODE=dev
AUTH_SECRET=replace-with-a-long-random-value

# OAuth provider examples for production shells
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Stripe billing stubs. Never commit real values.
STRIPE_SECRET_KEY=sk_test_replace_me
STRIPE_WEBHOOK_SECRET=whsec_replace_me
STRIPE_PRICE_ID=price_replace_me

# Optional product URL used by checkout redirects
MORPH_APP_URL=http://localhost:3000

# Optional AI vision for design-db transform (reference images / mockup generation)
OPENAI_API_KEY=
# MORPH_AI_BASE_URL=https://api.openai.com/v1
`;
}

function createRunId(prefix) {
  return `${prefix}-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${Math.random().toString(16).slice(2, 8)}`;
}

function slugify(value) {
  return String(value ?? "project")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "project";
}
