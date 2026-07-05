import { readFile } from "node:fs/promises";
import {
  calculateHealthScorePillar,
  findCloseMatches,
  generateAuditReport,
  parseCssValues
} from "@buoy-design/core";
import { morphIssue } from "./issue.js";

function mapCategory(category) {
  if (category === "font-size" || category === "font-family") return "typography";
  if (category === "radius") return "radius";
  if (category === "color" || category === "spacing") return category;
  return null;
}

function tokenValues(grammar) {
  return [
    ...Object.values(grammar.colors ?? {}),
    ...Object.values(grammar.spacing ?? {}),
    ...Object.values(grammar.radius ?? {}),
    ...Object.values(grammar.fontSize ?? {})
  ];
}

export async function enrichGrammarFromTokens(config, grammar) {
  const merged = { ...grammar.tokens };
  for (const tokenFile of config.tokenFiles ?? []) {
    const absoluteFile = config.resolveFromProject(tokenFile);
    try {
      const css = await readFile(absoluteFile, "utf8");
      for (const match of css.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
        merged[match[1]] = match[2].trim();
      }
      const parsed = parseCssValues(css);
      for (const value of parsed.values) {
        if (value.category !== "color") continue;
        const name = value.property?.replace(/^--/, "");
        if (name && !merged[name]) merged[name] = value.rawValue ?? value.value;
      }
    } catch {
      // Token file may not exist during init.
    }
  }

  const pick = (prefix) =>
    Object.fromEntries(
      Object.entries(merged)
        .filter(([name]) => name.startsWith(prefix))
        .map(([name, value]) => [`--${name}`, value])
    );

  return {
    tokens: merged,
    colors: pick("color-"),
    spacing: pick("space-"),
    radius: pick("radius-"),
    fontSize: pick("font-size-"),
    shadows: pick("shadow-")
  };
}

export async function scanCssHealth(config, files, grammar) {
  const tokenSet = new Set(tokenValues(grammar).map((value) => value.toLowerCase()));
  const auditValues = [];
  const issues = [];

  for (const file of files) {
    if (!file.relative.endsWith(".css")) continue;
    let css = "";
    try {
      css = await readFile(file.absolute, "utf8");
    } catch {
      continue;
    }
    const parsed = parseCssValues(css);
    for (const value of parsed.values) {
      const category = mapCategory(value.category);
      if (!category) continue;
      if (tokenSet.has(String(value.value).toLowerCase())) continue;
      auditValues.push({
        category,
        value: value.value,
        file: file.relative,
        line: value.line ?? 1
      });
    }
  }

  if (!auditValues.length) {
    return { issues, health: buildHealthFromMetrics(emptyMetrics(grammar)) };
  }

  const audit = generateAuditReport(auditValues);
  const hardcodedColors = auditValues.filter((value) => value.category === "color");
  if (hardcodedColors.length) {
    const grouped = new Map();
    for (const entry of hardcodedColors) {
      grouped.set(entry.file, (grouped.get(entry.file) ?? 0) + 1);
    }
    for (const [file, count] of grouped.entries()) {
      issues.push(morphIssue({
        id: "buoy-hardcoded-css-value",
        type: "design_drift",
        severity: count >= 3 ? "high" : "medium",
        file,
        line: hardcodedColors.find((entry) => entry.file === file)?.line ?? 1,
        reason: `${count} hardcoded CSS value(s) bypass the token system (Buoy CSS audit).`,
        suggestedFix: "Replace raw CSS values with var(--token) references.",
        intent: "agent_bypassed_token_layer_in_stylesheet",
        engine: "buoy",
        replacements: []
      }));
    }
  }

  const closeMatches = findCloseMatches(
    [...new Set(auditValues.map((value) => value.value))],
    [...tokenSet],
    "color"
  );
  for (const match of closeMatches.slice(0, 3)) {
    issues.push(morphIssue({
      id: "buoy-near-miss-token",
      type: "design_drift",
      severity: "low",
      file: auditValues.find((value) => value.value === match.value)?.file ?? "styles",
      line: 1,
      reason: `"${match.value}" is close to token "${match.closeTo}" — likely a typo (${match.distance} away).`,
      suggestedFix: `Use ${match.closeTo} instead of the near-miss value.`,
      intent: "agent_typoed_token_value",
      engine: "buoy",
      replacements: [{ find: match.value, replace: match.closeTo }]
    }));
  }

  const metrics = {
    componentCount: Math.max(1, files.filter((file) => /\.(tsx|jsx)$/.test(file.relative)).length),
    tokenCount: Object.keys(grammar.tokens ?? {}).length,
    hardcodedValueCount: hardcodedColors.length,
    unusedTokenCount: 0,
    namingInconsistencyCount: 0,
    criticalCount: 0,
    hasUtilityFramework: files.some((file) => file.relative.endsWith(".tsx")),
    hasDesignSystemLibrary: false,
    totalDriftCount: auditValues.length
  };

  return {
    issues,
    health: {
      ...buildHealthFromMetrics(metrics),
      audit: {
        score: audit.score,
        uniqueValues: audit.totals.uniqueValues,
        filesAffected: audit.totals.filesAffected
      }
    }
  };
}

function emptyMetrics(grammar) {
  return {
    componentCount: 1,
    tokenCount: Object.keys(grammar.tokens ?? {}).length,
    hardcodedValueCount: 0,
    unusedTokenCount: 0,
    namingInconsistencyCount: 0,
    criticalCount: 0,
    hasUtilityFramework: false,
    hasDesignSystemLibrary: false,
    totalDriftCount: 0
  };
}

function buildHealthFromMetrics(metrics) {
  const pillar = calculateHealthScorePillar(metrics);
  return {
    engine: "buoy",
    score: pillar.score,
    tier: pillar.tier,
    pillars: pillar.pillars,
    suggestions: pillar.suggestions,
    metrics: pillar.metrics
  };
}
