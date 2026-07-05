// morph Design Intelligence Database — active reference insights.
//
// Turns retrieval matches from the full 14k+ corpus into concrete repair
// decisions: which patterns to apply, hero/nav variants, taste dials, and
// which external resources actually drove the fix.

import { UI_PATTERN_CATALOG } from "./catalog.js";
import { getArchetype } from "./archetypes.js";
import { getMergedReferenceCorpus } from "./reference-corpus.js";
import { normalizeTaste } from "./taste.js";
import {
  INSIGHTS_MATCH_LIMIT,
  INSIGHTS_PATTERN_LIMIT,
  RECEIPT_REFERENCE_LIMIT
} from "./retrieval-config.js";

const TAG_PATTERN_BOOSTS = {
  developer: ["hero-code-snippet", "features-code-blocks", "features-integration-grid", "nav-glass-sticky", "content-api-reference"],
  enterprise: ["social-trust-badges", "social-customer-logos-marquee", "nav-mega-dropdown", "content-comparison-table", "cta-demo-booking"],
  saas: ["pricing-three-tier", "features-card-grid", "social-logo-cloud", "hero-product-screenshot"],
  minimal: ["hero-minimal-statement", "nav-minimal-logo", "footer-minimal-legal"],
  creative: ["hero-bento-showcase", "features-bento-grid", "features-hover-reveal", "nav-floating-pill"],
  landing: ["hero-centered-gradient", "cta-gradient-band", "social-stats-band"],
  startup: ["hero-announcement-pill", "cta-waitlist-glow", "utility-announcement-bar"],
  dark: ["hero-aurora-mesh", "nav-glass-sticky", "hero-video-backdrop"],
  api: ["hero-code-snippet", "content-api-reference", "features-code-blocks"],
  commerce: ["hero-split-product", "features-split-detail"],
  editorial: ["hero-editorial-lead", "content-prose-section"],
  security: ["content-security-page", "social-trust-badges"],
  pricing: ["pricing-three-tier", "pricing-feature-matrix", "pricing-toggle-annual"],
  conversion: ["cta-gradient-band", "hero-cta-dual", "social-stats-band"],
  dashboard: ["dash-metric-cards", "dash-sidebar-nav"],
  motion: ["features-hover-reveal", "hero-aurora-mesh"],
  open: ["features-integration-grid", "social-logo-cloud"],
  components: ["features-card-grid", "features-icon-rows"],
  design: ["hero-bento-showcase", "features-bento-grid"],
  animated: ["features-hover-reveal", "hero-aurora-mesh"],
  accessibility: ["social-trust-badges", "content-faq-accordion"],
  marketing: ["social-customer-logos-marquee", "cta-waitlist-glow", "hero-announcement-pill"],
  ai: ["hero-minimal-statement", "hero-aurora-mesh", "features-code-blocks"],
  fintech: ["pricing-feature-matrix", "social-trust-badges", "hero-split-product"],
  legal: ["content-security-page", "social-case-study", "cta-demo-booking"],
  health: ["hero-editorial-lead", "social-testimonial-quote"],
  gaming: ["hero-video-backdrop", "hero-bento-showcase"],
  travel: ["hero-split-product", "content-prose-section"],
  education: ["features-numbered-steps", "content-faq-accordion"],
  nonprofit: ["hero-editorial-lead", "content-prose-section", "social-testimonial-quote"]
};

const INDUSTRY_PATTERN_BOOSTS = {
  "developer-tools": ["hero-code-snippet", "features-code-blocks", "features-integration-grid"],
  fintech: ["pricing-feature-matrix", "social-trust-badges", "hero-split-product"],
  saas: ["pricing-three-tier", "social-logo-cloud", "features-card-grid"],
  "creative-tools": ["hero-bento-showcase", "features-bento-grid"],
  commerce: ["hero-split-product", "features-split-detail"],
  enterprise: ["social-customer-logos-marquee", "content-comparison-table", "nav-mega-dropdown"],
  media: ["hero-video-backdrop", "hero-editorial-lead"],
  health: ["hero-editorial-lead", "social-testimonial-quote"],
  ai: ["hero-aurora-mesh", "hero-minimal-statement", "features-code-blocks"],
  gaming: ["hero-video-backdrop", "hero-bento-showcase"],
  travel: ["hero-split-product", "content-prose-section"],
  education: ["features-numbered-steps", "content-faq-accordion"],
  legal: ["content-security-page", "social-case-study"],
  marketing: ["social-customer-logos-marquee", "cta-waitlist-glow"],
  hardware: ["hero-minimal-statement", "features-split-detail"],
  social: ["social-wall-of-love", "social-testimonial-cards"],
  nonprofit: ["hero-editorial-lead", "content-prose-section"]
};

const HERO_VARIANT_BY_ARCHETYPE = {
  "landing-classic": "centered",
  "landing-split": "split",
  "landing-bento": "bento",
  "developer-product": "centered",
  "editorial-story": "editorial",
  "saas-pricing": "centered",
  "enterprise-trust": "split",
  "minimal-showcase": "minimal"
};

const NAV_VARIANT_BY_PATTERN = {
  "nav-glass-sticky": "glass",
  "nav-minimal-logo": "minimal",
  "nav-split-actions": "split",
  "nav-mega-dropdown": "mega",
  "nav-floating-pill": "pill",
  "nav-command-palette": "command"
};

export function synthesizeReferenceInsights(retrieval, content = {}) {
  const matches = retrieval?.matches ?? [];
  if (!matches.length) return emptyInsights();

  const corpusById = new Map(getMergedReferenceCorpus().map((entry) => [entry.id, entry]));
  const patternVotes = new Map();
  const tagCounts = new Map();
  const tierCounts = new Map();
  const sourceCounts = new Map();
  const heroVotes = new Map();
  const navVotes = new Map();
  const appliedReferences = [];

  for (const match of matches.slice(0, INSIGHTS_MATCH_LIMIT)) {
    const reference = corpusById.get(match.id);
    if (!reference) continue;

    appliedReferences.push({
      id: reference.id,
      name: reference.name,
      tier: reference.tier,
      industry: reference.industry,
      score: match.score,
      source: reference.source ?? "curated",
      profileHint: reference.profileHint,
      archetypeHint: reference.archetypeHint,
      url: reference.url ?? null,
      npm: reference.npm ?? null
    });

    tierCounts.set(reference.tier, (tierCounts.get(reference.tier) ?? 0) + match.score);
    const sourceKey = String(reference.source ?? "curated").split(":")[0];
    sourceCounts.set(sourceKey, (sourceCounts.get(sourceKey) ?? 0) + 1);

    const archetype = getArchetype(reference.archetypeHint);
    if (archetype?.heroVariant) {
      heroVotes.set(archetype.heroVariant, (heroVotes.get(archetype.heroVariant) ?? 0) + match.score);
    }

    for (const patternId of reference.patterns ?? []) {
      patternVotes.set(patternId, (patternVotes.get(patternId) ?? 0) + match.score * 1.2);
    }

    for (const tag of reference.tags ?? []) {
      const normalized = String(tag).toLowerCase();
      tagCounts.set(normalized, (tagCounts.get(normalized) ?? 0) + match.score);
      boostPatterns(patternVotes, TAG_PATTERN_BOOSTS[normalized], match.score);
    }

    boostPatterns(patternVotes, INDUSTRY_PATTERN_BOOSTS[reference.industry], match.score * 1.1);

    for (const keyword of reference.keywords ?? []) {
      const lower = String(keyword).toLowerCase();
      for (const [tag, patterns] of Object.entries(TAG_PATTERN_BOOSTS)) {
        if (lower.includes(tag)) boostPatterns(patternVotes, patterns, match.score * 0.35);
      }
    }
  }

  const patternIds = rankPatternIds(patternVotes);
  const heroVariant = pickTopVote(heroVotes);
  const navVariant = pickNavVariant(patternVotes, navVotes);
  const taste = deriveTasteFromSignals(tagCounts, tierCounts, content, retrieval);
  const sectionOrder = deriveSectionOrder(patternIds, retrieval.signals ?? {});

  return {
    appliedReferences: appliedReferences.slice(0, RECEIPT_REFERENCE_LIMIT),
    matchedCount: matches.length,
    referencesUsed: appliedReferences.length,
    patternIds,
    heroVariant,
    navVariant,
    taste,
    sectionOrder,
    inspirationLine: buildInspirationLine(appliedReferences.slice(0, 5)),
    dominantIndustry: retrieval.industry?.industry ?? null,
    sourceBreakdown: rankEntries(sourceCounts, 6),
    repairNotes: buildRepairNotes(appliedReferences, patternIds, retrieval)
  };
}

export function applyReferenceInsightsToPatterns(selectedPatterns, insights) {
  if (!insights?.patternIds?.length) return selectedPatterns;

  const byId = new Map(selectedPatterns.map((pattern) => [pattern.id, pattern]));
  for (const patternId of insights.patternIds) {
    if (byId.has(patternId)) continue;
    const pattern = UI_PATTERN_CATALOG.find((entry) => entry.id === patternId);
    if (pattern) byId.set(patternId, pattern);
  }
  return [...byId.values()];
}

export function applyReferenceInsightsToArchetype(archetype, insights) {
  if (!archetype || !insights) return archetype;
  const heroVariant = insights.heroVariant ?? archetype.heroVariant;
  const sectionOrder = insights.sectionOrder?.length ? insights.sectionOrder : archetype.sectionOrder;
  if (heroVariant === archetype.heroVariant && sectionOrder === archetype.sectionOrder) return archetype;
  return { ...archetype, heroVariant, sectionOrder };
}

export function mergeReferenceTaste(baseTaste, insights) {
  if (!insights?.taste) return normalizeTaste(baseTaste);
  const base = normalizeTaste(baseTaste);
  return normalizeTaste({
    designVariance: Math.round((base.designVariance * 0.55) + (insights.taste.designVariance * 0.45)),
    motionIntensity: Math.round((base.motionIntensity * 0.55) + (insights.taste.motionIntensity * 0.45)),
    visualDensity: Math.round((base.visualDensity * 0.55) + (insights.taste.visualDensity * 0.45))
  });
}

function emptyInsights() {
  return {
    appliedReferences: [],
    matchedCount: 0,
    patternIds: [],
    heroVariant: null,
    navVariant: null,
    taste: null,
    sectionOrder: null,
    inspirationLine: null,
    dominantIndustry: null,
    sourceBreakdown: [],
    repairNotes: []
  };
}

function boostPatterns(votes, patternIds = [], weight = 1) {
  for (const patternId of patternIds ?? []) {
    votes.set(patternId, (votes.get(patternId) ?? 0) + weight);
  }
}

function rankPatternIds(votes) {
  const valid = new Set(UI_PATTERN_CATALOG.map((pattern) => pattern.id));
  return [...votes.entries()]
    .filter(([id]) => valid.has(id))
    .sort((left, right) => right[1] - left[1])
    .slice(0, INSIGHTS_PATTERN_LIMIT)
    .map(([id]) => id);
}

function pickTopVote(votes) {
  const ranked = rankEntries(votes, 1);
  return ranked[0]?.[0] ?? null;
}

function pickNavVariant(patternVotes) {
  let best = null;
  let bestScore = 0;
  for (const [patternId, variant] of Object.entries(NAV_VARIANT_BY_PATTERN)) {
    const score = patternVotes.get(patternId) ?? 0;
    if (score > bestScore) {
      best = variant;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

function deriveTasteFromSignals(tagCounts, tierCounts, content, retrieval) {
  let designVariance = 6;
  let motionIntensity = 4;
  let visualDensity = 4;

  if ((tagCounts.get("creative") ?? 0) + (tagCounts.get("design") ?? 0) > 8) {
    designVariance = 8;
    motionIntensity = 6;
  }
  if ((tagCounts.get("minimal") ?? 0) + (tagCounts.get("luxury") ?? 0) > 6) {
    designVariance = 4;
    motionIntensity = 3;
    visualDensity = 3;
  }
  if ((tagCounts.get("enterprise") ?? 0) + (tierCounts.get("enterprise") ?? 0) + (tierCounts.get("fortune500") ?? 0) > 12) {
    visualDensity = 5;
    motionIntensity = 3;
    designVariance = 5;
  }
  if ((tagCounts.get("developer") ?? 0) + (retrieval.signals?.isDeveloper ? 6 : 0) > 8) {
    visualDensity = 6;
    motionIntensity = 4;
    designVariance = 5;
  }
  if ((tagCounts.get("dashboard") ?? 0) > 4 || (content.features ?? []).length >= 6) {
    visualDensity = 7;
    motionIntensity = 2;
  }
  if ((tagCounts.get("animated") ?? 0) + (tagCounts.get("motion") ?? 0) > 5) {
    motionIntensity = 7;
  }

  return normalizeTaste({ designVariance, motionIntensity, visualDensity });
}

function deriveSectionOrder(patternIds, signals) {
  const ids = new Set(patternIds);
  if (ids.has("pricing-three-tier") || ids.has("pricing-feature-matrix") || signals.hasPricing) {
    return ["hero", "logos", "features", "splits", "pricing", "faq", "trust", "social", "extras", "cta"];
  }
  if (ids.has("content-prose-section") || ids.has("hero-editorial-lead")) {
    return ["hero", "prose", "splits", "social", "extras", "cta"];
  }
  if (ids.has("features-integration-grid") || ids.has("hero-code-snippet")) {
    return ["hero", "stats", "features", "integrations", "splits", "extras", "cta"];
  }
  if (ids.has("hero-bento-showcase") || ids.has("features-bento-grid")) {
    return ["hero", "features", "social", "extras", "cta"];
  }
  return null;
}

function buildInspirationLine(references) {
  if (!references.length) return null;
  const names = references.slice(0, 3).map((reference) => reference.name);
  if (names.length === 1) return `Repair grammar informed by ${names[0]}.`;
  return `Repair grammar informed by ${names.slice(0, -1).join(", ")} and ${names.at(-1)}.`;
}

function buildRepairNotes(appliedReferences, patternIds, retrieval) {
  const notes = [];
  if (retrieval.matchedCount) {
    notes.push(`Scored ${retrieval.corpusSize}-entry corpus; ${retrieval.matchedCount} references matched site content.`);
  }
  if (appliedReferences.length) {
    notes.push(`Synthesized repair decisions from ${appliedReferences.length} weighted corpus references.`);
  }
  if (patternIds.length) {
    notes.push(`Applied ${patternIds.length} UI patterns derived from matched npm packages and design systems.`);
  }
  if (retrieval.sourceSignals?.sourceFamilies?.length) {
    const families = retrieval.sourceSignals.sourceFamilies.slice(0, 3).map((family) => family.label);
    notes.push(`Weighted signals from ${families.join(", ")}.`);
  }
  return notes;
}

function rankEntries(map, limit) {
  return [...map.entries()].sort((left, right) => right[1] - left[1]).slice(0, limit);
}

export { HERO_VARIANT_BY_ARCHETYPE, TAG_PATTERN_BOOSTS };
