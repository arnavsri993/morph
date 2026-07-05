// Morph Design Source Index.
//
// This is the scalable layer above the named reference corpus. It does not
// vendor millions of web pages into the repo. Instead it models the aggregate
// signal families Morph should learn from when a large crawler/export is
// attached later: curated sites, design systems, component libraries, product
// screenshots, awards galleries, templates, and accessibility examples.

export const SOURCE_INDEX_VERSION = "source_index_v1";

export const SOURCE_FAMILIES = [
  {
    id: "frontier-product-sites",
    label: "Frontier product sites",
    estimatedSources: 420000,
    trust: 0.96,
    signals: ["visual-polish", "hero-composition", "motion", "copy-density", "conversion-flow"]
  },
  {
    id: "public-design-systems",
    label: "Public design systems",
    estimatedSources: 185000,
    trust: 0.98,
    signals: ["tokens", "components", "states", "accessibility", "documentation"]
  },
  {
    id: "component-libraries",
    label: "Component libraries",
    estimatedSources: 310000,
    trust: 0.9,
    signals: ["component-grammar", "variants", "composition", "density", "responsive-rules"]
  },
  {
    id: "award-galleries",
    label: "Award and inspiration galleries",
    estimatedSources: 760000,
    trust: 0.82,
    signals: ["art-direction", "layout-novelty", "microinteraction", "typography", "brand-expression"]
  },
  {
    id: "saas-landing-pages",
    label: "SaaS landing pages",
    estimatedSources: 980000,
    trust: 0.86,
    signals: ["pricing", "feature-hierarchy", "social-proof", "enterprise-trust", "cta-clarity"]
  },
  {
    id: "commerce-and-editorial",
    label: "Commerce and editorial sites",
    estimatedSources: 640000,
    trust: 0.84,
    signals: ["product-story", "imagery", "editorial-rhythm", "merchandising", "content-scanning"]
  },
  {
    id: "mobile-web-screens",
    label: "Mobile web screens",
    estimatedSources: 540000,
    trust: 0.88,
    signals: ["mobile-density", "thumb-reach", "navigation", "viewport-safety", "touch-targets"]
  },
  {
    id: "accessibility-exemplars",
    label: "Accessibility exemplars",
    estimatedSources: 220000,
    trust: 0.94,
    signals: ["focus", "contrast", "semantics", "reduced-motion", "keyboard-flow"]
  }
];

export const HIGH_END_FRONTEND_DIMENSIONS = [
  {
    id: "composition",
    label: "Composition",
    keywords: ["hero", "layout", "grid", "section", "bento", "split", "editorial", "dashboard"],
    rules: ["clear hierarchy", "intentional whitespace", "balanced density", "strong first viewport"]
  },
  {
    id: "visual-system",
    label: "Visual system",
    keywords: ["token", "color", "palette", "radius", "shadow", "gradient", "theme", "brand"],
    rules: ["small palette with accents", "semantic tokens", "consistent shape language", "controlled depth"]
  },
  {
    id: "typography",
    label: "Typography",
    keywords: ["type", "headline", "copy", "font", "serif", "mono", "display", "readability"],
    rules: ["tight scale", "readable measure", "strong contrast", "no viewport-sized type hacks"]
  },
  {
    id: "interaction",
    label: "Interaction",
    keywords: ["hover", "focus", "motion", "transition", "state", "keyboard", "button", "form"],
    rules: ["visible states", "fast feedback", "reduced motion support", "accessible form affordances"]
  },
  {
    id: "conversion",
    label: "Conversion",
    keywords: ["pricing", "cta", "signup", "checkout", "demo", "trial", "sales", "plan"],
    rules: ["obvious CTA hierarchy", "trust before ask", "pricing clarity", "frictionless next step"]
  },
  {
    id: "responsiveness",
    label: "Responsiveness",
    keywords: ["mobile", "responsive", "viewport", "overflow", "touch", "tablet", "breakpoint"],
    rules: ["no horizontal overflow", "stable controls", "touch-sized targets", "content-first mobile"]
  },
  {
    id: "trust",
    label: "Trust",
    keywords: ["security", "enterprise", "compliance", "sso", "audit", "customer", "logo", "case study"],
    rules: ["proof near claims", "calm enterprise surfaces", "clear compliance language", "credible metrics"]
  },
  {
    id: "content-intelligence",
    label: "Content intelligence",
    keywords: ["docs", "features", "workflow", "integrations", "customer", "team", "use case", "guide"],
    rules: ["scan-friendly sections", "specific benefits", "logical product story", "no placeholder copy"]
  }
];

const FAMILY_SIGNAL_BONUS = {
  "visual-polish": ["composition", "visual-system"],
  "hero-composition": ["composition"],
  motion: ["interaction"],
  "copy-density": ["content-intelligence", "typography"],
  "conversion-flow": ["conversion"],
  tokens: ["visual-system"],
  components: ["interaction", "visual-system"],
  states: ["interaction"],
  accessibility: ["interaction", "responsiveness"],
  documentation: ["content-intelligence"],
  "component-grammar": ["visual-system", "interaction"],
  variants: ["interaction"],
  composition: ["composition"],
  density: ["composition", "typography"],
  "responsive-rules": ["responsiveness"],
  "art-direction": ["composition", "visual-system"],
  "layout-novelty": ["composition"],
  microinteraction: ["interaction"],
  typography: ["typography"],
  "brand-expression": ["visual-system"],
  pricing: ["conversion"],
  "feature-hierarchy": ["content-intelligence", "composition"],
  "social-proof": ["trust", "conversion"],
  "enterprise-trust": ["trust"],
  "cta-clarity": ["conversion"],
  "product-story": ["content-intelligence"],
  imagery: ["composition"],
  "editorial-rhythm": ["typography", "content-intelligence"],
  merchandising: ["conversion"],
  "content-scanning": ["content-intelligence"],
  "mobile-density": ["responsiveness", "composition"],
  "thumb-reach": ["responsiveness"],
  navigation: ["composition", "responsiveness"],
  "viewport-safety": ["responsiveness"],
  "touch-targets": ["responsiveness", "interaction"],
  focus: ["interaction"],
  contrast: ["visual-system", "typography"],
  semantics: ["content-intelligence"],
  "reduced-motion": ["interaction"],
  "keyboard-flow": ["interaction"]
};

export function sourceIndexSummary() {
  const estimatedSources = SOURCE_FAMILIES.reduce((total, family) => total + family.estimatedSources, 0);
  return {
    version: SOURCE_INDEX_VERSION,
    families: SOURCE_FAMILIES.length,
    dimensions: HIGH_END_FRONTEND_DIMENSIONS.length,
    estimatedSources,
    estimatedSourcesLabel: `${Math.round(estimatedSources / 100000) / 10}M+`,
    signals: [...new Set(SOURCE_FAMILIES.flatMap((family) => family.signals))].length
  };
}

export function analyzeHighEndSignals(text, signals = {}) {
  const haystack = String(text ?? "").toLowerCase();
  const dimensionScores = HIGH_END_FRONTEND_DIMENSIONS.map((dimension) => {
    let score = 0;
    const matchedKeywords = [];
    for (const keyword of dimension.keywords) {
      if (new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i").test(haystack)) {
        score += 2;
        matchedKeywords.push(keyword);
      }
    }
    if (dimension.id === "conversion" && signals.hasPricing) score += 4;
    if (dimension.id === "trust" && signals.isEnterprise) score += 4;
    if (dimension.id === "responsiveness" && signals.navCount >= 3) score += 1;
    if (dimension.id === "interaction" && signals.hasAuth) score += 2;
    if (dimension.id === "content-intelligence" && signals.featureCount >= 3) score += 2;
    if (dimension.id === "composition" && signals.sectionCount >= 2) score += 2;
    return {
      id: dimension.id,
      label: dimension.label,
      score,
      matchedKeywords,
      rules: dimension.rules
    };
  }).sort((left, right) => right.score - left.score);

  const activeDimensions = dimensionScores.filter((dimension) => dimension.score > 0);
  const familyScores = SOURCE_FAMILIES.map((family) => {
    let score = 0;
    for (const signal of family.signals) {
      const dimensions = FAMILY_SIGNAL_BONUS[signal] ?? [];
      for (const dimension of activeDimensions) {
        if (dimensions.includes(dimension.id)) score += dimension.score * family.trust;
      }
    }
    return {
      id: family.id,
      label: family.label,
      score: Math.round(score * 10) / 10,
      estimatedSources: family.estimatedSources,
      trust: family.trust
    };
  }).filter((family) => family.score > 0)
    .sort((left, right) => right.score - left.score);

  return {
    dimensions: activeDimensions,
    topDimensions: activeDimensions.slice(0, 4).map((dimension) => dimension.id),
    sourceFamilies: familyScores.slice(0, 5),
    estimatedMatchedSources: familyScores
      .slice(0, 5)
      .reduce((total, family) => total + Math.round(family.estimatedSources * Math.min(1, family.score / 25)), 0)
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
