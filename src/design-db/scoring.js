// Shared UI quality scoring thresholds for morph transform and Studio review.

export const TRANSFORM_PASS_SCORE = 80;

/** Input sites at or above this score skip full template re-render unless forced. */
export const TRANSFORM_PRESERVE_SCORE = 78;

/** Rules that indicate broken UX — block a pass even when the numeric score is high. */
export const TRANSFORM_BLOCKING_FINDINGS = new Set([
  "no-viewport-meta",
  "table-or-center-layout",
  "missing-image-alts"
]);

export function transformVerdict(assessment) {
  if (assessment.score < TRANSFORM_PASS_SCORE) return "fail";
  if (assessment.findings.some((finding) =>
    finding.severity === "high" && TRANSFORM_BLOCKING_FINDINGS.has(finding.id)
  )) {
    return "fail";
  }
  return "pass";
}
