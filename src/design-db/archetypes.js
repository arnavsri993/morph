// Morph Design Intelligence Database — page layout archetypes.
//
// Archetypes define how extracted content is composed into a full page:
// hero variant, section order, and default pattern set.

export const LAYOUT_ARCHETYPES = [
  {
    id: "landing-classic",
    name: "Classic landing",
    description: "Centered hero, feature grid, split sections, CTA band — the Linear/Vercel shape.",
    tags: ["landing", "saas", "developer", "default"],
    heroVariant: "centered",
    defaultPatterns: [
      "hero-centered-gradient", "nav-glass-sticky", "features-card-grid",
      "features-split-detail", "social-stats-band", "cta-gradient-band", "footer-multi-column"
    ],
    sectionOrder: ["hero", "stats", "features", "splits", "social", "extras", "cta"]
  },
  {
    id: "landing-split",
    name: "Split product landing",
    description: "Hero with product panel, tabbed features, logo cloud — the Stripe/Intercom shape.",
    tags: ["saas", "product", "b2b", "enterprise"],
    heroVariant: "split",
    defaultPatterns: [
      "hero-split-product", "nav-glass-sticky", "social-logo-cloud",
      "features-tabbed", "features-split-detail", "pricing-three-tier", "cta-floating-card"
    ],
    sectionOrder: ["hero", "logos", "features", "splits", "pricing", "social", "extras", "cta"]
  },
  {
    id: "landing-bento",
    name: "Bento grid landing",
    description: "Asymmetric bento hero and features — the Framer/Webflow creative shape.",
    tags: ["creative", "startup", "design", "portfolio"],
    heroVariant: "bento",
    defaultPatterns: [
      "hero-bento-showcase", "nav-minimal-logo", "features-bento-grid",
      "social-testimonial-cards", "cta-floating-card", "footer-minimal-legal"
    ],
    sectionOrder: ["hero", "features", "social", "extras", "cta"]
  },
  {
    id: "developer-product",
    name: "Developer product",
    description: "Dark gradient hero, code-forward features, integration grid — the Supabase/Vercel shape.",
    tags: ["developer", "api", "infra", "open-source", "cli"],
    heroVariant: "centered",
    defaultPatterns: [
      "hero-centered-gradient", "nav-glass-sticky", "features-icon-rows",
      "features-integration-grid", "features-split-detail", "social-stats-band", "cta-gradient-band"
    ],
    sectionOrder: ["hero", "stats", "features", "integrations", "splits", "extras", "cta"]
  },
  {
    id: "editorial-story",
    name: "Editorial story",
    description: "Serif lead, prose sections, quote band — the Patagonia/Kinfolk shape.",
    tags: ["editorial", "nonprofit", "sustainability", "blog", "story"],
    heroVariant: "editorial",
    defaultPatterns: [
      "hero-editorial-lead", "nav-minimal-logo", "content-prose-section",
      "features-split-detail", "social-testimonial-quote", "cta-inline-banner", "footer-minimal-legal"
    ],
    sectionOrder: ["hero", "prose", "splits", "social", "extras", "cta"]
  },
  {
    id: "saas-pricing",
    name: "SaaS pricing-first",
    description: "Conversion-focused with pricing table and FAQ — the Cal.com/Ramp shape.",
    tags: ["pricing", "subscription", "startup", "conversion"],
    heroVariant: "centered",
    defaultPatterns: [
      "hero-cta-dual", "nav-split-actions", "social-logo-cloud", "features-card-grid",
      "pricing-three-tier", "content-faq-accordion", "social-trust-badges", "cta-gradient-band"
    ],
    sectionOrder: ["hero", "logos", "features", "pricing", "faq", "trust", "cta"]
  },
  {
    id: "enterprise-trust",
    name: "Enterprise trust",
    description: "Logo cloud, case study, comparison table — the Databricks/Salesforce shape.",
    tags: ["enterprise", "b2b", "security", "compliance"],
    heroVariant: "split",
    defaultPatterns: [
      "hero-split-product", "nav-mega-dropdown", "social-logo-cloud", "social-trust-badges",
      "features-icon-rows", "content-comparison-table", "social-case-study", "cta-floating-card"
    ],
    sectionOrder: ["hero", "logos", "trust", "features", "comparison", "social", "cta"]
  },
  {
    id: "minimal-showcase",
    name: "Minimal showcase",
    description: "Monochrome statement hero, sparse sections — the Apple/OpenAI shape.",
    tags: ["minimal", "luxury", "premium", "hardware", "research"],
    heroVariant: "minimal",
    defaultPatterns: [
      "hero-minimal-statement", "nav-minimal-logo", "features-split-detail",
      "social-testimonial-quote", "footer-minimal-legal"
    ],
    sectionOrder: ["hero", "splits", "social", "cta"]
  }
];

export function getArchetype(id) {
  return LAYOUT_ARCHETYPES.find((archetype) => archetype.id === id) ?? null;
}

export function selectArchetype(text, options = {}) {
  if (options.archetypeId) {
    const explicit = getArchetype(options.archetypeId);
    if (explicit) return { archetype: explicit, reason: "explicit", matchedTags: [] };
  }

  if (options.aiHints?.archetypeId) {
    const aiArchetype = getArchetype(options.aiHints.archetypeId);
    if (aiArchetype) {
      return { archetype: aiArchetype, reason: "ai_reference", matchedTags: [] };
    }
  }

  const retrieval = options.retrieval;
  if (retrieval?.archetypeHint?.id && retrieval.confidence >= 0.35) {
    const retrieved = getArchetype(retrieval.archetypeHint.id);
    if (retrieved) {
      return {
        archetype: retrieved,
        reason: "reference_corpus",
        matchedTags: [retrieval.topReference?.id].filter(Boolean)
      };
    }
  }

  const haystack = String(text ?? "").toLowerCase();
  let best = null;
  let bestScore = 0;
  let bestTags = [];

  for (const archetype of LAYOUT_ARCHETYPES) {
    const matched = archetype.tags.filter((tag) =>
      new RegExp(`\\b${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(haystack)
    );
    if (matched.length > bestScore) {
      best = archetype;
      bestScore = matched.length;
      bestTags = matched;
    }
  }

  if (best && bestScore > 0) {
    return { archetype: best, reason: "keyword_match", matchedTags: bestTags };
  }

  return {
    archetype: getArchetype("landing-classic"),
    reason: "default",
    matchedTags: []
  };
}
