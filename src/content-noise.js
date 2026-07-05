const ACCESSIBILITY_NOISE = /^(?:skip to(?: main content| content| navigation)?|keyboard shortcuts?|main content|beginning of|end of|dialog window|navigation menu|accessibility)/i;

export function isAccessibilityNoise(text) {
  const value = String(text ?? "").trim();
  if (!value) return true;
  if (value.length > 80) return false;
  if (ACCESSIBILITY_NOISE.test(value)) return true;
  if (/\b(?:shift|opt|ctrl|cmd|alt)\s*\+\s*/i.test(value)) return true;
  if (/^search opt \+/i.test(value)) return true;
  return false;
}
