import { scanWithEslint } from "./eslint-tokens.js";
import { enrichGrammarFromTokens, scanCssHealth } from "./buoy-health.js";
import { scanHtmlWithAxe } from "./axe-a11y.js";
import { dedupeIssues } from "./issue.js";

export { buildAgentRules, writeAgentRules } from "./agent-rules.js";
export { assessCssHealth, mergeUiQualityAssessments, assessFullUiQuality } from "./design-health.js";
export { enrichGrammarFromTokens } from "./buoy-health.js";
export { dedupeIssues } from "./issue.js";

export async function runExternalScanners(config, files, grammar) {
  const enrichedGrammar = await enrichGrammarFromTokens(config, grammar);
  const tsxFiles = files.filter((file) => /\.(tsx|jsx)$/.test(file.relative));
  const allFiles = files;

  const [eslintIssues, cssHealth, axeIssues] = await Promise.all([
    scanWithEslint(tsxFiles, config.projectRoot, enrichedGrammar),
    scanCssHealth(config, allFiles, enrichedGrammar),
    scanHtmlWithAxe(allFiles)
  ]);

  const externalIssues = dedupeIssues([
    ...eslintIssues,
    ...cssHealth.issues,
    ...axeIssues
  ]);

  return {
    grammar: enrichedGrammar,
    issues: externalIssues,
    health: cssHealth.health,
    engines: {
      eslint: eslintIssues.length,
      buoy: cssHealth.issues.length,
      axe: axeIssues.length
    }
  };
}
