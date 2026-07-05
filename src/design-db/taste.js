// Taste dials — inspired by Leonxlnx Taste Skill (design variance, motion
// intensity, visual density). The transform engine reads the brief and sets
// dials before generating output so pages feel deliberate, not templated.

const DIAL_MIN = 1;
const DIAL_MAX = 10;

export const DEFAULT_TASTE = {
  designVariance: 6,
  motionIntensity: 4,
  visualDensity: 4
};

export function resolveTaste(content, options = {}) {
  if (options.taste) return normalizeTaste(options.taste);

  let { designVariance, motionIntensity, visualDensity } = DEFAULT_TASTE;
  const instructions = String(options.instructions ?? "").toLowerCase();
  const text = [
    content?.brand,
    content?.hero?.headline,
    content?.hero?.subhead,
    content?.description,
    instructions
  ].filter(Boolean).join(" ").toLowerCase();

  if (/\b(?:minimal|quiet|calm|simple|clean|refined)\b/.test(instructions)) {
    designVariance = 3;
    motionIntensity = 2;
    visualDensity = 3;
  }
  if (/\b(?:bold|dramatic|delight|playful|expressive|vibrant)\b/.test(instructions)) {
    designVariance = 8;
    motionIntensity = 7;
    visualDensity = 6;
  }
  if (/\b(?:dense|dashboard|data|admin|console|tool)\b/.test(text)) {
    visualDensity = 8;
    motionIntensity = 2;
    designVariance = 4;
  }
  if (/\b(?:editorial|magazine|portfolio|creative|agency)\b/.test(text)) {
    designVariance = 8;
    motionIntensity = 5;
    visualDensity = 4;
  }
  if (/\b(?:frontier|polish|premium|high-end|world-class)\b/.test(instructions)) {
    motionIntensity = 4;
    designVariance = 5;
    visualDensity = 4;
  }

  return normalizeTaste({ designVariance, motionIntensity, visualDensity });
}

export function normalizeTaste(taste) {
  return {
    designVariance: clampDial(taste.designVariance ?? DEFAULT_TASTE.designVariance),
    motionIntensity: clampDial(taste.motionIntensity ?? DEFAULT_TASTE.motionIntensity),
    visualDensity: clampDial(taste.visualDensity ?? DEFAULT_TASTE.visualDensity)
  };
}

export function tasteRenderFlags(taste) {
  const normalized = normalizeTaste(taste);
  return {
    showEyebrow: normalized.visualDensity >= 7,
    showSectionKickers: normalized.designVariance >= 8,
    showScrollReveal: normalized.motionIntensity >= 4,
    showHeroFadeUp: normalized.motionIntensity >= 3,
    showPageBackdrop: true,
    showSpotlight: normalized.motionIntensity >= 5 && normalized.designVariance >= 5,
    showFeatureIcons: normalized.designVariance >= 7 && normalized.visualDensity >= 7,
    heroCentered: normalized.designVariance <= 5,
    motionScale: normalized.motionIntensity / DEFAULT_TASTE.motionIntensity,
    sectionPaddingScale: normalized.visualDensity <= 4 ? 1.15 : normalized.visualDensity >= 8 ? 0.85 : 1,
    hoverLift: normalized.motionIntensity >= 6 ? "-4px" : normalized.motionIntensity >= 4 ? "-2px" : "0",
    revealDurationMs: normalized.motionIntensity >= 7 ? 480 : normalized.motionIntensity >= 4 ? 360 : 0
  };
}

function clampDial(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_TASTE.designVariance;
  return Math.max(DIAL_MIN, Math.min(DIAL_MAX, Math.round(n)));
}
