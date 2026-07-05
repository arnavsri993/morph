export function morphIssue(input) {
  return {
    id: input.id,
    type: input.type ?? "design_drift",
    severity: input.severity,
    file: input.file,
    line: input.line ?? 1,
    reason: input.reason,
    suggestedFix: input.suggestedFix,
    evidence: input.evidence ?? "",
    classification: input.classification ?? "accidental_drift",
    intent: input.intent ?? "unknown_agent_intent",
    engine: input.engine ?? "morph",
    patch: {
      file: input.file,
      replacements: input.replacements ?? []
    }
  };
}

export function lineFromIndex(source, index) {
  if (index == null || index < 0) return 1;
  return source.slice(0, index).split("\n").length;
}

export function dedupeIssues(issues) {
  const seen = new Map();
  for (const issue of issues) {
    const key = `${issue.file}\0${issue.id}\0${issue.line}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, issue);
      continue;
    }
    const morphPatch = existing.patch?.replacements?.length ?? 0;
    const nextPatch = issue.patch?.replacements?.length ?? 0;
    if (nextPatch > morphPatch || existing.engine !== "morph" && issue.engine === "morph") {
      seen.set(key, issue);
    }
  }
  return [...seen.values()];
}

export function severityRank(severity) {
  return ({ high: 3, medium: 2, low: 1, info: 0 }[severity] ?? 0);
}
