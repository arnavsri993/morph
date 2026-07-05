// morph Design Intelligence Database — public API.

import { DESIGN_PROFILES, getProfile } from "./profiles.js";
import { UI_HEURISTICS, assessUiQuality } from "./heuristics.js";
import { renderPage, renderStylesheet } from "./patterns.js";
import { UI_PATTERN_CATALOG, REFERENCE_SITES, catalogSummary, matchReferenceSites, selectPatternsForContent } from "./catalog.js";
import { LAYOUT_ARCHETYPES, selectArchetype, getArchetype } from "./archetypes.js";
import { applyDesignHints } from "../ai-vision.js";
import { corpusSummary } from "./reference-corpus.js";
import { buildRetrievalPlan, retrievalSummary } from "./retrieval.js";
import { analyzeHighEndSignals, sourceIndexSummary } from "./source-index.js";

export {
  DESIGN_PROFILES,
  getProfile,
  UI_HEURISTICS,
  assessUiQuality,
  renderPage,
  renderStylesheet,
  UI_PATTERN_CATALOG,
  REFERENCE_SITES,
  catalogSummary,
  matchReferenceSites,
  selectPatternsForContent,
  LAYOUT_ARCHETYPES,
  selectArchetype,
  getArchetype,
  applyDesignHints,
  buildRetrievalPlan,
  retrievalSummary,
  corpusSummary,
  analyzeHighEndSignals,
  sourceIndexSummary
};

const RETRIEVAL_CONFIDENCE_THRESHOLD = 0.35;

// Choose the profile whose keyword fingerprint best matches the site's
// content. Falls back to the flagship dark profile, which reads as
// "frontier developer product" for generic sites.
export function selectProfile(text, preferredId = null, options = {}) {
  if (preferredId) {
    const preferred = getProfile(preferredId);
    if (preferred) return { profile: preferred, matchedKeywords: [], reason: "explicit" };
  }

  if (options.aiHints?.profileId) {
    const aiProfile = getProfile(options.aiHints.profileId);
    if (aiProfile) {
      return {
        profile: applyDesignHints(aiProfile, options.aiHints),
        matchedKeywords: [],
        reason: "ai_reference",
        referenceConfidence: options.aiHints.confidence ?? null
      };
    }
  }

  const retrieval = options.retrieval;
  if (retrieval?.profileHint?.id && retrieval.confidence >= RETRIEVAL_CONFIDENCE_THRESHOLD) {
    const retrieved = getProfile(retrieval.profileHint.id);
    if (retrieved) {
      return {
        profile: options.aiHints ? applyDesignHints(retrieved, options.aiHints) : retrieved,
        matchedKeywords: [],
        reason: "reference_corpus",
        referenceSite: retrieval.topReference?.id ?? null,
        referenceConfidence: retrieval.confidence,
        matchedReference: retrieval.topReference?.name ?? null
      };
    }
  }

  const referenceMatches = matchReferenceSites(text);
  if (referenceMatches.length && referenceMatches[0].score >= 2) {
    const hinted = getProfile(referenceMatches[0].site.profileHint);
    if (hinted) {
      return {
        profile: hinted,
        matchedKeywords: referenceMatches[0].matchedTags,
        reason: "reference_site",
        referenceSite: referenceMatches[0].site.id
      };
    }
  }

  const haystack = String(text ?? "").toLowerCase();
  let best = null;
  let bestScore = 0;
  let bestKeywords = [];

  for (const profile of DESIGN_PROFILES) {
    const matched = profile.keywords.filter((keyword) =>
      new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(haystack)
    );
    if (matched.length > bestScore) {
      best = profile;
      bestScore = matched.length;
      bestKeywords = matched;
    }
  }

  if (best && bestScore > 0) {
    const profile = options.aiHints ? applyDesignHints(best, options.aiHints) : best;
    return { profile, matchedKeywords: bestKeywords, reason: "keyword_match" };
  }

  const fallback = getProfile("aurora-dark");
  return {
    profile: options.aiHints ? applyDesignHints(fallback, options.aiHints) : fallback,
    matchedKeywords: [],
    reason: "default_flagship"
  };
}

export function databaseSummary() {
  const catalog = catalogSummary();
  const corpus = corpusSummary();
  const retrieval = retrievalSummary();
  const sourceIndex = sourceIndexSummary();
  return {
    profiles: DESIGN_PROFILES.length,
    heuristics: UI_HEURISTICS.length,
    patterns: catalog.patterns,
    archetypes: LAYOUT_ARCHETYPES.length,
    referenceSites: catalog.referenceSites,
    referenceCorpus: corpus.references,
    sourceIndex,
    estimatedSourceSignals: sourceIndex.estimatedSources,
    corpusTiers: corpus.tiers,
    corpusIndustries: corpus.industries,
    retrievalEngine: retrieval.engine,
    profileIds: DESIGN_PROFILES.map((profile) => profile.id),
    archetypeIds: LAYOUT_ARCHETYPES.map((archetype) => archetype.id),
    patternCategories: catalog.byCategory
  };
}

export function planTransform(content, options = {}) {
  const selectionText = buildSelectionText(content, options.instructions);
  const retrieval = buildRetrievalPlan(selectionText, content);

  const profileSelection = selectProfile(selectionText, options.profile ?? null, {
    aiHints: options.aiHints ?? null,
    retrieval
  });
  const archetypeSelection = selectArchetype(selectionText, {
    archetypeId: options.archetype ?? null,
    aiHints: options.aiHints ?? null,
    retrieval
  });
  const patterns = selectPatternsForContent(content, archetypeSelection.archetype, {
    retrievalHints: retrieval
  });

  return {
    profile: profileSelection,
    archetype: archetypeSelection,
    patterns,
    selectionText,
    retrieval
  };
}

function buildSelectionText(content, instructions = "") {
  return [
    content.title,
    content.brand,
    content.hero?.headline,
    content.hero?.subhead,
    ...(content.features ?? []).map((feature) => `${feature.title} ${feature.body}`),
    ...(content.sections ?? []).map((section) => `${section.heading} ${section.body}`),
    instructions ?? ""
  ].join(" ");
}
