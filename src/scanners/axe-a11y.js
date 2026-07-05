import { readFile } from "node:fs/promises";
import axe from "axe-core";
import { JSDOM } from "jsdom";
import { morphIssue } from "./issue.js";

const IMPACT_SEVERITY = {
  critical: "high",
  serious: "high",
  moderate: "medium",
  minor: "low"
};

export async function scanHtmlWithAxe(files) {
  const issues = [];
  for (const file of files) {
    if (!file.relative.endsWith(".html")) continue;
    let html = "";
    try {
      html = await readFile(file.absolute, "utf8");
    } catch {
      continue;
    }

    const dom = new JSDOM(html, { runScripts: "outside-only" });
    const results = await axe.run(dom.window.document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "best-practice"]
      }
    });

    for (const violation of results.violations) {
      for (const node of violation.nodes.slice(0, 3)) {
        issues.push(morphIssue({
          id: `axe-${violation.id}`,
          type: "interaction_drift",
          severity: IMPACT_SEVERITY[violation.impact] ?? "medium",
          file: file.relative,
          line: 1,
          reason: `${violation.help}: ${node.failureSummary ?? violation.description}`,
          suggestedFix: violation.helpUrl ? `See ${violation.helpUrl}` : violation.help,
          intent: "agent_shipped_accessibility_regression",
          engine: "axe",
          replacements: buildAxeReplacements(violation.id, html, node.html)
        }));
      }
    }
  }
  return issues;
}

function buildAxeReplacements(ruleId, html, snippet) {
  if (ruleId === "button-name" && snippet?.includes("<button") && !snippet.includes("aria-label")) {
    return [{ find: "<button", replace: '<button aria-label="Action"' }];
  }
  if (ruleId === "image-alt" && snippet?.includes("<img") && !snippet.includes("alt=")) {
    return [{ find: "<img", replace: '<img alt=""' }];
  }
  if (ruleId === "html-has-lang" && !/<html[^>]*lang=/i.test(html)) {
    return [{ find: "<html", replace: '<html lang="en"' }];
  }
  return [];
}
