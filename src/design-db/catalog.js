// morph Design Intelligence Database — UI pattern catalog.
//
// A searchable library of production-grade web UI patterns distilled from
// frontier product sites. Patterns are tagged by category, industry, and
// layout role so the transform engine can assemble pages intelligently.

import { REFERENCE_SITES as CORPUS_REFERENCE_SITES } from "./reference-corpus.js";

export { REFERENCE_SITES } from "./reference-corpus.js";

const REFERENCE_SITES = CORPUS_REFERENCE_SITES;

export const PATTERN_CATEGORIES = [
  "hero", "navigation", "features", "social-proof", "pricing", "cta",
  "content", "footer", "forms", "dashboard", "auth", "utility"
];

export const UI_PATTERN_CATALOG = [
  // ── Hero patterns ────────────────────────────────────────────────────────
  { id: "hero-centered-gradient", category: "hero", name: "Centered gradient hero", tags: ["landing", "saas", "developer"], layout: "centered", priority: 10 },
  { id: "hero-split-product", category: "hero", name: "Split hero with product panel", tags: ["saas", "product", "b2b"], layout: "split", priority: 9 },
  { id: "hero-bento-showcase", category: "hero", name: "Bento grid hero showcase", tags: ["creative", "portfolio", "startup"], layout: "bento", priority: 8 },
  { id: "hero-minimal-statement", category: "hero", name: "Minimal monochrome statement", tags: ["luxury", "agency", "minimal"], layout: "minimal", priority: 8 },
  { id: "hero-video-backdrop", category: "hero", name: "Dark hero with glow backdrop", tags: ["entertainment", "gaming", "media"], layout: "centered", priority: 7 },
  { id: "hero-editorial-lead", category: "hero", name: "Editorial serif lead", tags: ["editorial", "nonprofit", "blog"], layout: "editorial", priority: 7 },
  { id: "hero-cta-dual", category: "hero", name: "Dual CTA hero band", tags: ["conversion", "startup"], layout: "centered", priority: 6 },
  { id: "hero-stats-inline", category: "hero", name: "Hero with inline stats", tags: ["growth", "metrics"], layout: "centered", priority: 6 },

  // ── Navigation ───────────────────────────────────────────────────────────
  { id: "nav-glass-sticky", category: "navigation", name: "Glass sticky nav", tags: ["saas", "developer"], priority: 10 },
  { id: "nav-minimal-logo", category: "navigation", name: "Minimal logo + CTA nav", tags: ["luxury", "minimal"], priority: 9 },
  { id: "nav-split-actions", category: "navigation", name: "Split nav with secondary action", tags: ["enterprise", "b2b"], priority: 8 },
  { id: "nav-mega-dropdown", category: "navigation", name: "Mega menu dropdown nav", tags: ["enterprise", "platform"], priority: 7 },
  { id: "nav-tab-bar", category: "navigation", name: "Tab bar navigation", tags: ["dashboard", "app"], priority: 6 },

  // ── Features ─────────────────────────────────────────────────────────────
  { id: "features-card-grid", category: "features", name: "Three-column feature cards", tags: ["saas", "landing"], priority: 10 },
  { id: "features-bento-grid", category: "features", name: "Asymmetric bento feature grid", tags: ["creative", "startup"], priority: 9 },
  { id: "features-icon-rows", category: "features", name: "Icon row feature list", tags: ["enterprise", "b2b"], priority: 8 },
  { id: "features-tabbed", category: "features", name: "Tabbed feature showcase", tags: ["product", "platform"], priority: 8 },
  { id: "features-comparison", category: "features", name: "Before/after comparison", tags: ["conversion"], priority: 7 },
  { id: "features-timeline", category: "features", name: "Vertical timeline steps", tags: ["process", "onboarding"], priority: 7 },
  { id: "features-integration-grid", category: "features", name: "Integration logo grid", tags: ["platform", "api"], priority: 8 },
  { id: "features-split-detail", category: "features", name: "Alternating split sections", tags: ["story", "product"], priority: 9 },

  // ── Social proof ─────────────────────────────────────────────────────────
  { id: "social-logo-cloud", category: "social-proof", name: "Logo cloud strip", tags: ["saas", "enterprise"], priority: 9 },
  { id: "social-testimonial-quote", category: "social-proof", name: "Large quote testimonial", tags: ["landing", "trust"], priority: 9 },
  { id: "social-testimonial-cards", category: "social-proof", name: "Testimonial card grid", tags: ["saas", "b2b"], priority: 8 },
  { id: "social-stats-band", category: "social-proof", name: "Metrics stats band", tags: ["growth", "metrics"], priority: 8 },
  { id: "social-trust-badges", category: "social-proof", name: "Trust badge row", tags: ["security", "enterprise"], priority: 7 },
  { id: "social-rating-stars", category: "social-proof", name: "Star rating summary", tags: ["consumer", "app"], priority: 6 },
  { id: "social-case-study", category: "social-proof", name: "Case study highlight", tags: ["enterprise", "b2b"], priority: 7 },

  // ── Pricing ────────────────────────────────────────────────────────────────
  { id: "pricing-three-tier", category: "pricing", name: "Three-tier pricing table", tags: ["saas", "subscription"], priority: 10 },
  { id: "pricing-two-column", category: "pricing", name: "Two-plan comparison", tags: ["startup", "simple"], priority: 8 },
  { id: "pricing-toggle-annual", category: "pricing", name: "Monthly/annual toggle pricing", tags: ["saas"], priority: 7 },
  { id: "pricing-enterprise-cta", category: "pricing", name: "Enterprise contact band", tags: ["enterprise", "b2b"], priority: 6 },

  // ── CTA ────────────────────────────────────────────────────────────────────
  { id: "cta-gradient-band", category: "cta", name: "Gradient CTA band", tags: ["conversion", "landing"], priority: 10 },
  { id: "cta-split-newsletter", category: "cta", name: "Newsletter signup split", tags: ["community", "blog"], priority: 7 },
  { id: "cta-floating-card", category: "cta", name: "Floating card CTA", tags: ["saas", "product"], priority: 8 },
  { id: "cta-inline-banner", category: "cta", name: "Inline banner CTA", tags: ["docs", "product"], priority: 6 },

  // ── Content ────────────────────────────────────────────────────────────────
  { id: "content-faq-accordion", category: "content", name: "FAQ accordion", tags: ["saas", "support"], priority: 9 },
  { id: "content-prose-section", category: "content", name: "Long-form prose block", tags: ["editorial", "blog"], priority: 7 },
  { id: "content-team-grid", category: "content", name: "Team member grid", tags: ["startup", "about"], priority: 6 },
  { id: "content-blog-preview", category: "content", name: "Blog post preview cards", tags: ["content", "marketing"], priority: 6 },
  { id: "content-comparison-table", category: "content", name: "Feature comparison table", tags: ["enterprise", "pricing"], priority: 7 },

  // ── Footer ─────────────────────────────────────────────────────────────────
  { id: "footer-multi-column", category: "footer", name: "Multi-column footer", tags: ["saas", "enterprise"], priority: 9 },
  { id: "footer-minimal-legal", category: "footer", name: "Minimal legal footer", tags: ["minimal", "startup"], priority: 8 },
  { id: "footer-newsletter", category: "footer", name: "Footer with newsletter", tags: ["community", "content"], priority: 7 },

  // ── Forms ──────────────────────────────────────────────────────────────────
  { id: "form-waitlist", category: "forms", name: "Email waitlist capture", tags: ["launch", "startup"], priority: 7 },
  { id: "form-contact-split", category: "forms", name: "Split contact form", tags: ["enterprise", "sales"], priority: 6 },

  // ── Dashboard / app chrome ─────────────────────────────────────────────────
  { id: "dash-sidebar-nav", category: "dashboard", name: "Sidebar app navigation", tags: ["app", "dashboard"], priority: 8 },
  { id: "dash-metric-cards", category: "dashboard", name: "Metric KPI cards", tags: ["analytics", "saas"], priority: 7 },
  { id: "dash-data-table", category: "dashboard", name: "Data table with filters", tags: ["admin", "enterprise"], priority: 6 },

  // ── Auth ───────────────────────────────────────────────────────────────────
  { id: "auth-split-panel", category: "auth", name: "Split login panel", tags: ["app", "saas"], priority: 7 },
  { id: "auth-minimal-card", category: "auth", name: "Centered auth card", tags: ["app"], priority: 6 },

  // ── Utility ────────────────────────────────────────────────────────────────
  { id: "utility-breadcrumb", category: "utility", name: "Breadcrumb trail", tags: ["docs", "enterprise"], priority: 5 },
  { id: "utility-announcement-bar", category: "utility", name: "Top announcement bar", tags: ["launch", "promo"], priority: 6 },
  { id: "utility-cookie-banner", category: "utility", name: "Cookie consent strip", tags: ["compliance"], priority: 4 },

  // ── Extended patterns (frontier reference corpus) ────────────────────────
  { id: "hero-aurora-mesh", category: "hero", name: "Aurora mesh gradient hero", tags: ["developer", "ai", "frontier"], layout: "centered", priority: 9 },
  { id: "hero-product-screenshot", category: "hero", name: "Hero with product screenshot frame", tags: ["saas", "product", "demo"], layout: "split", priority: 9 },
  { id: "hero-announcement-pill", category: "hero", name: "Hero with announcement pill", tags: ["launch", "startup"], layout: "centered", priority: 7 },
  { id: "hero-code-snippet", category: "hero", name: "Hero with code snippet panel", tags: ["developer", "api"], layout: "split", priority: 8 },
  { id: "nav-floating-pill", category: "navigation", name: "Floating pill navigation", tags: ["minimal", "startup"], priority: 8 },
  { id: "nav-command-palette", category: "navigation", name: "Command palette trigger nav", tags: ["developer", "productivity"], priority: 6 },
  { id: "features-spotlight-carousel", category: "features", name: "Spotlight feature carousel", tags: ["product", "saas"], priority: 7 },
  { id: "features-numbered-steps", category: "features", name: "Numbered step features", tags: ["onboarding", "process"], priority: 8 },
  { id: "features-code-blocks", category: "features", name: "Code-forward feature blocks", tags: ["developer", "api"], priority: 8 },
  { id: "features-hover-reveal", category: "features", name: "Hover reveal feature cards", tags: ["creative", "interactive"], priority: 7 },
  { id: "social-wall-of-love", category: "social-proof", name: "Wall of love tweet grid", tags: ["startup", "social"], priority: 8 },
  { id: "social-press-mentions", category: "social-proof", name: "Press mention strip", tags: ["growth", "launch"], priority: 7 },
  { id: "social-g2-badges", category: "social-proof", name: "Review platform badges", tags: ["saas", "b2b"], priority: 7 },
  { id: "social-customer-logos-marquee", category: "social-proof", name: "Infinite logo marquee", tags: ["enterprise", "saas"], priority: 8 },
  { id: "pricing-feature-matrix", category: "pricing", name: "Pricing with feature matrix", tags: ["enterprise", "saas"], priority: 8 },
  { id: "pricing-usage-based", category: "pricing", name: "Usage-based pricing cards", tags: ["developer", "api"], priority: 7 },
  { id: "cta-waitlist-glow", category: "cta", name: "Waitlist CTA with glow", tags: ["launch", "startup"], priority: 8 },
  { id: "cta-demo-booking", category: "cta", name: "Book a demo CTA split", tags: ["enterprise", "sales"], priority: 8 },
  { id: "content-changelog", category: "content", name: "Changelog timeline", tags: ["developer", "product"], priority: 6 },
  { id: "content-security-page", category: "content", name: "Security trust center", tags: ["enterprise", "compliance"], priority: 7 },
  { id: "content-api-reference", category: "content", name: "API reference preview", tags: ["developer", "docs"], priority: 7 },
  { id: "footer-status-link", category: "footer", name: "Footer with status page link", tags: ["developer", "saas"], priority: 6 },
  { id: "footer-social-icons", category: "footer", name: "Footer with social icons", tags: ["startup", "community"], priority: 6 },
  { id: "utility-dark-mode-toggle", category: "utility", name: "Theme mode toggle", tags: ["developer", "product"], priority: 5 },
  { id: "utility-loading-skeleton", category: "utility", name: "Skeleton loading states", tags: ["app", "product"], priority: 4 },
  { id: "dash-command-center", category: "dashboard", name: "Command center dashboard", tags: ["analytics", "enterprise"], priority: 7 },
  { id: "dash-activity-feed", category: "dashboard", name: "Activity feed panel", tags: ["saas", "collaboration"], priority: 6 }
];

// Massive reference corpus — 100+ frontier & Fortune-class product sites.

export function catalogSummary() {
  const byCategory = {};
  for (const pattern of UI_PATTERN_CATALOG) {
    byCategory[pattern.category] = (byCategory[pattern.category] ?? 0) + 1;
  }
  return {
    patterns: UI_PATTERN_CATALOG.length,
    categories: PATTERN_CATEGORIES.length,
    referenceSites: REFERENCE_SITES.length,
    byCategory
  };
}

export function findPatterns({ category = null, tags = [], limit = 12 } = {}) {
  let results = UI_PATTERN_CATALOG;
  if (category) results = results.filter((pattern) => pattern.category === category);
  if (tags.length) {
    const tagSet = new Set(tags.map((tag) => tag.toLowerCase()));
    results = results.filter((pattern) =>
      pattern.tags.some((tag) => tagSet.has(tag.toLowerCase()))
    );
  }
  return results
    .sort((left, right) => right.priority - left.priority)
    .slice(0, limit);
}

export function matchReferenceSites(text) {
  const haystack = String(text ?? "").toLowerCase();
  const matches = [];
  for (const site of REFERENCE_SITES) {
    const hitTags = site.tags.filter((tag) => haystack.includes(tag));
    const hitName = haystack.includes(site.name.toLowerCase()) || haystack.includes(site.id);
    if (hitTags.length || hitName) {
      matches.push({ site, score: hitTags.length + (hitName ? 2 : 0), matchedTags: hitTags });
    }
  }
  return matches.sort((left, right) => right.score - left.score);
}

export function selectPatternsForContent(content, archetype, options = {}) {
  const text = [
    content.title, content.brand, content.hero?.headline,
    ...(content.features ?? []).map((feature) => feature.title),
    ...(content.sections ?? []).map((section) => section.heading)
  ].join(" ").toLowerCase();

  const selected = new Set(archetype?.defaultPatterns ?? []);
  const wantsPricing = /\b(pric|plan|tier|subscription|free|pro|enterprise)\b/i.test(text);
  const wantsFaq = /\b(faq|question|help|support)\b/i.test(text);
  const wantsIntegrations = /\b(integrat|connect|plugin|api|slack|github)\b/i.test(text);
  const wantsTeam = /\b(team|about|founder|people|careers)\b/i.test(text);
  const wantsDeveloper = /\b(api|sdk|developer|dev|code|deploy|git|cli)\b/i.test(text);
  const wantsEnterprise = /\b(enterprise|b2b|compliance|security|audit|sso)\b/i.test(text);

  if (wantsPricing) selected.add("pricing-three-tier");
  if (wantsFaq) selected.add("content-faq-accordion");
  if (wantsIntegrations) selected.add("features-integration-grid");
  if (wantsTeam) selected.add("content-team-grid");
  if (content.stats?.length) selected.add("social-stats-band");
  if (content.testimonial) selected.add("social-testimonial-quote");
  if ((content.features ?? []).length >= 4) selected.add("features-bento-grid");
  if ((content.features ?? []).length >= 2) selected.add("social-logo-cloud");
  if (wantsDeveloper) {
    selected.add("features-code-blocks");
    selected.add("hero-code-snippet");
  }
  if (wantsEnterprise) {
    selected.add("social-trust-badges");
    selected.add("social-customer-logos-marquee");
  }

  for (const patternId of options.retrievalHints?.patternHints ?? []) {
    selected.add(patternId);
  }

  return [...selected].map((id) => UI_PATTERN_CATALOG.find((pattern) => pattern.id === id)).filter(Boolean);
}
