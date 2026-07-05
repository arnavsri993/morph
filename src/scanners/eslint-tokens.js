import { ESLint } from "eslint";
import tsParser from "@typescript-eslint/parser";
import tailwindPaletteGuard from "eslint-plugin-tailwind-palette-guard";
import * as metamaskDesignTokens from "@metamask/eslint-plugin-design-tokens";
import { morphIssue } from "./issue.js";

const RULE_MAP = {
  "tailwind-palette-guard/no-palette-colors": {
    id: "eslint-palette-color",
    type: "design_drift",
    severity: "high",
    intent: "agent_added_visual_style_without_design_system_backing"
  },
  "tailwind-palette-guard/no-inline-color-styles": {
    id: "eslint-inline-color",
    type: "design_drift",
    severity: "medium",
    intent: "agent_used_inline_style_instead_of_tokens"
  },
  "@metamask/design-tokens/color-no-hex": {
    id: "eslint-hex-color",
    type: "design_drift",
    severity: "high",
    intent: "agent_added_visual_style_without_design_system_backing"
  }
};

function buildReplacements(message, grammar) {
  const replacements = [];
  const hexMatch = message.match(/#[0-9a-fA-F]{6}\b/);
  if (!hexMatch) return replacements;

  const hex = hexMatch[0].toLowerCase();
  const primary = grammar.tokens["color-primary"] ?? "var(--color-primary)";
  const foreground = grammar.tokens["color-primary-foreground"] ?? "var(--color-primary-foreground)";

  replacements.push(
    { find: `bg-[${hex}]`, replace: `bg-[var(--color-primary)]` },
    { find: `bg-[${hex.toUpperCase()}]`, replace: `bg-[var(--color-primary)]` },
    { find: `text-[${hex}]`, replace: `text-[var(--color-primary-foreground)]` },
    { find: `text-[${hex.toUpperCase()}]`, replace: `text-[var(--color-primary-foreground)]` },
    { find: hex, replace: primary.includes("var(") ? primary : `var(--color-primary)` }
  );

  if (hex === "#7c3aed") {
    replacements.unshift(
      { find: "bg-[#7c3aed]", replace: "bg-[var(--color-primary)]" },
      { find: "text-[#faf5ff]", replace: `text-[var(--color-primary-foreground)]` }
    );
  }

  return replacements.filter((replacement, index, list) =>
    list.findIndex((item) => item.find === replacement.find) === index
  );
}

export async function scanWithEslint(files, projectRoot, grammar) {
  if (!files.length) return [];

  const eslint = new ESLint({
    cwd: projectRoot,
    overrideConfigFile: true,
    overrideConfig: [{
      files: ["**/*.{tsx,jsx,ts,js}"],
      languageOptions: {
        parser: tsParser,
        parserOptions: {
          ecmaFeatures: { jsx: true },
          ecmaVersion: "latest",
          sourceType: "module"
        }
      },
      plugins: {
        "tailwind-palette-guard": tailwindPaletteGuard,
        "@metamask/design-tokens": metamaskDesignTokens
      },
      rules: {
        "tailwind-palette-guard/no-palette-colors": "warn",
        "tailwind-palette-guard/no-inline-color-styles": "warn",
        "@metamask/design-tokens/color-no-hex": "warn"
      }
    }]
  });

  const results = await eslint.lintFiles(files.map((file) => file.absolute));
  const issues = [];

  for (const result of results) {
    const relativeFile = result.filePath.slice(projectRoot.length + 1).split("\\").join("/");
    for (const message of result.messages) {
      if (message.fatal || !message.ruleId) continue;
      const mapping = RULE_MAP[message.ruleId];
      if (!mapping) continue;

      issues.push(morphIssue({
        ...mapping,
        file: relativeFile,
        line: message.line,
        reason: message.message,
        suggestedFix: "Replace hardcoded color with a semantic design token.",
        evidence: message.message,
        engine: "eslint",
        replacements: buildReplacements(message.message, grammar)
      }));
    }
  }

  return issues;
}
