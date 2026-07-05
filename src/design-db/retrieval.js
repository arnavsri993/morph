// morph Design Intelligence Database — reference retrieval engine.
//
// Scores incoming site content against the massive UI reference corpus to
// select profile, archetype, and pattern combinations that match the visual
// grammar of frontier and Fortune-class product sites.

import { INDUSTRY_VOCABULARY, getMergedReferenceCorpus } from "./reference-corpus.js";
import { UI_PATTERN_CATALOG } from "./catalog.js";
import { getProfile } from "./profiles.js";
import { getArchetype } from "./archetypes.js";
import { analyzeHighEndSignals, sourceIndexSummary } from "./source-index.js";

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
  "by", "from", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "do", "does", "did", "will", "would", "could", "should", "may", "might", "must",
  "this", "that", "these", "those", "it", "its", "your", "you", "we", "our", "they",
  "their", "all", "can", "just", "also", "more", "most", "other", "some", "such",
  "no", "not", "only", "own", "same", "so", "than", "too", "very", "up", "out", "about"
]);

export function tokenize(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

export function analyzeContentSignals(content) {
  const text = [
    content.title,
    content.brand,
    content.hero?.headline,
    content.hero?.subhead,
    ...(content.features ?? []).map((feature) => `${feature.title} ${feature.body}`),
    ...(content.sections ?? []).map((section) => `${section.heading} ${section.body}`),
    ...(content.nav ?? []).map((link) => link.label)
  ].join(" ").toLowerCase();

  return {
    text,
    featureCount: (content.features ?? []).length,
    sectionCount: (content.sections ?? []).length,
    navCount: (content.nav ?? []).length,
    hasStats: (content.stats ?? []).length > 0,
    hasTestimonial: Boolean(content.testimonial?.quote),
    hasPricing: /\b(pric|plan|tier|subscription|free|pro|enterprise|\$\d)\b/i.test(text),
    hasFaq: /\b(faq|question|help|support)\b/i.test(text),
    hasIntegrations: /\b(integrat|connect|plugin|api|slack|github|webhook)\b/i.test(text),
    hasTeam: /\b(team|about|founder|people|careers|culture)\b/i.test(text),
    hasAuth: /\b(login|sign in|sign up|auth|password|sso)\b/i.test(text),
    hasDocs: /\b(docs|documentation|guide|tutorial|api reference)\b/i.test(text),
    hasBlog: /\b(blog|article|news|post|publish)\b/i.test(text),
    isDeveloper: /\b(api|sdk|developer|dev|code|deploy|git|cli|infra|database)\b/i.test(text),
    isEnterprise: /\b(enterprise|b2b|compliance|security|audit|sso|scale|global)\b/i.test(text),
    isCreative: /\b(design|creative|portfolio|agency|studio|motion|brand)\b/i.test(text),
    isCommerce: /\b(shop|store|cart|checkout|commerce|retail|sell|buy)\b/i.test(text),
    isAi: /\b(ai|artificial intelligence|machine learning|llm|model|agent|copilot)\b/i.test(text),
    isHealth: /\b(health|wellness|medical|fitness|therapy|meditation)\b/i.test(text),
    isFintech: /\b(payment|finance|bank|billing|invoice|wallet|money)\b/i.test(text)
  };
}

function detectIndustry(tokens, signals) {
  let bestIndustry = null;
  let bestScore = 0;

  for (const [industry, vocabulary] of Object.entries(INDUSTRY_VOCABULARY)) {
    let score = 0;
    for (const phrase of vocabulary) {
      const phraseTokens = phrase.split(/\s+/);
      if (phraseTokens.length === 1) {
        if (tokens.includes(phraseTokens[0])) score += 2;
      } else if (signals.text.includes(phrase)) {
        score += 3;
      }
    }
    if (score > bestScore) {
      bestIndustry = industry;
      bestScore = score;
    }
  }

  return { industry: bestIndustry, score: bestScore };
}

function tierWeight(tier) {
  switch (tier) {
    case "iconic": return 1.35;
    case "fortune500": return 1.25;
    case "enterprise": return 1.15;
    case "growth": return 1.05;
    default: return 1;
  }
}

export function scoreReference(reference, tokens, signals, industryMatch) {
  let score = 0;
  const matchedTokens = [];

  for (const tag of reference.tags) {
    const tagTokens = tag.split(/[\s-]+/);
    for (const token of tagTokens) {
      if (tokens.includes(token)) {
        score += 3;
        matchedTokens.push(tag);
        break;
      }
    }
  }

  for (const keyword of reference.keywords) {
    const keywordLower = keyword.toLowerCase();
    if (signals.text.includes(keywordLower)) {
      score += 4;
      matchedTokens.push(keyword);
    } else {
      const keywordTokens = tokenize(keyword);
      const overlap = keywordTokens.filter((token) => tokens.includes(token)).length;
      if (overlap >= Math.min(2, keywordTokens.length)) {
        score += overlap * 2;
        matchedTokens.push(keyword);
      }
    }
  }

  const nameTokens = tokenize(reference.name);
  for (const token of nameTokens) {
    if (tokens.includes(token)) {
      score += 5;
      matchedTokens.push(reference.name);
      break;
    }
  }

  if (industryMatch.industry === reference.industry) {
    score += 6 + Math.min(industryMatch.score, 6);
    matchedTokens.push(`industry:${reference.industry}`);
  }

  if (signals.isDeveloper && reference.industry === "developer-tools") score += 4;
  if (signals.isFintech && reference.industry === "fintech") score += 4;
  if (signals.isAi && reference.industry === "ai") score += 4;
  if (signals.isEnterprise && reference.tier === "enterprise") score += 3;
  if (signals.isCreative && reference.industry === "creative-tools") score += 4;
  if (signals.isCommerce && reference.industry === "commerce") score += 4;
  if (signals.isHealth && reference.industry === "health") score += 4;

  if (signals.hasPricing && reference.archetypeHint === "saas-pricing") score += 3;
  if (signals.isEnterprise && reference.archetypeHint === "enterprise-trust") score += 3;
  if (signals.isDeveloper && reference.archetypeHint === "developer-product") score += 3;

  score *= tierWeight(reference.tier);

  return { reference, score, matchedTokens: [...new Set(matchedTokens)] };
}

export function retrieveReferences(text, content, { limit = 8 } = {}) {
  const tokens = tokenize(text);
  const signals = analyzeContentSignals(content);
  const sourceSignals = analyzeHighEndSignals(text, signals);
  const industryMatch = detectIndustry(tokens, signals);

  const corpus = getMergedReferenceCorpus();
  const scored = corpus
    .map((reference) => scoreReference(reference, tokens, signals, industryMatch))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  return {
    matches: scored.slice(0, limit),
    industry: industryMatch,
    signals,
    sourceSignals,
    corpusSize: corpus.length,
    searched: corpus.length
  };
}

function aggregateHints(matches) {
  const profileVotes = new Map();
  const archetypeVotes = new Map();
  const patternVotes = new Map();

  for (const { reference, score } of matches) {
    profileVotes.set(reference.profileHint, (profileVotes.get(reference.profileHint) ?? 0) + score);
    archetypeVotes.set(reference.archetypeHint, (archetypeVotes.get(reference.archetypeHint) ?? 0) + score);
    for (const patternId of reference.patterns ?? []) {
      patternVotes.set(patternId, (patternVotes.get(patternId) ?? 0) + score * 0.5);
    }
  }

  const topProfile = [...profileVotes.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  const topArchetype = [...archetypeVotes.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  const topPatterns = [...patternVotes.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([id]) => id);

  return {
    profileId: topProfile?.[0] ?? null,
    profileConfidence: topProfile ? topProfile[1] / matches[0].score : 0,
    archetypeId: topArchetype?.[0] ?? null,
    archetypeConfidence: topArchetype ? topArchetype[1] / matches[0].score : 0,
    patternIds: topPatterns
  };
}

function contentPatternHints(signals) {
  const hints = new Set();
  if (signals.hasPricing) hints.add("pricing-three-tier");
  if (signals.hasFaq) hints.add("content-faq-accordion");
  if (signals.hasIntegrations) hints.add("features-integration-grid");
  if (signals.hasTeam) hints.add("content-team-grid");
  if (signals.hasStats) hints.add("social-stats-band");
  if (signals.hasTestimonial) hints.add("social-testimonial-quote");
  if (signals.featureCount >= 4) hints.add("features-bento-grid");
  if (signals.featureCount >= 2) hints.add("social-logo-cloud");
  if (signals.isEnterprise) hints.add("social-trust-badges");
  if (signals.isDeveloper) hints.add("features-icon-rows");
  if (signals.isCreative) hints.add("hero-bento-showcase");
  if (signals.isCommerce) hints.add("hero-split-product");
  if (signals.isAi) hints.add("hero-minimal-statement");
  if (signals.hasAuth) hints.add("auth-minimal-card");
  if (signals.hasDocs) hints.add("content-prose-section");
  return [...hints];
}

export function buildRetrievalPlan(text, content) {
  const retrieval = retrieveReferences(text, content);
  const { matches, industry, signals, sourceSignals, corpusSize, searched } = retrieval;
  const sourceIndex = sourceIndexSummary();

  if (!matches.length) {
    return {
      matches: [],
      industry,
      signals,
      sourceSignals,
      corpusSize,
      sourceIndex,
      searched,
      profileHint: null,
      archetypeHint: null,
      patternHints: contentPatternHints(signals),
      topReference: null,
      confidence: 0
    };
  }

  const hints = aggregateHints(matches);
  const patternHints = [...new Set([
    ...hints.patternIds,
    ...contentPatternHints(signals)
  ])].filter((id) => UI_PATTERN_CATALOG.some((pattern) => pattern.id === id));

  const topMatch = matches[0];
  const profile = getProfile(hints.profileId);
  const archetype = getArchetype(hints.archetypeId);

  return {
    matches: matches.map(({ reference, score, matchedTokens }) => ({
      id: reference.id,
      name: reference.name,
      tier: reference.tier,
      industry: reference.industry,
      score: Math.round(score * 10) / 10,
      matchedTokens
    })),
    industry,
    signals,
    sourceSignals,
    corpusSize,
    sourceIndex,
    searched,
    profileHint: profile ? {
      id: profile.id,
      name: profile.name,
      confidence: Math.round(hints.profileConfidence * 100) / 100,
      inspiration: profile.inspiration
    } : null,
    archetypeHint: archetype ? {
      id: archetype.id,
      name: archetype.name,
      confidence: Math.round(hints.archetypeConfidence * 100) / 100
    } : null,
    patternHints,
    topReference: {
      id: topMatch.reference.id,
      name: topMatch.reference.name,
      tier: topMatch.reference.tier,
      score: Math.round(topMatch.score * 10) / 10
    },
    confidence: Math.min(1, topMatch.score / 30)
  };
}

export function retrievalSummary() {
  const sourceIndex = sourceIndexSummary();
  const corpus = getMergedReferenceCorpus();
  return {
    engine: "reference_corpus_v3",
    corpusSize: corpus.length,
    estimatedSourceSignals: sourceIndex.estimatedSources,
    sourceFamilies: sourceIndex.families,
    highEndDimensions: sourceIndex.dimensions,
    industries: Object.keys(INDUSTRY_VOCABULARY).length,
    scoring: "weighted_token_industry_tier_source_index"
  };
}
