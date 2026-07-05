// morph Design Intelligence Database — optional component renderers.
//
// Each renderer returns an HTML section string for patterns selected from
// the catalog. Styles live in componentStyles().

export function componentStyles(profile) {
  const { colors, fonts, radius } = profile;
  return `
/* ── Catalog components ─────────────────────────────────────────────────── */

.logo-cloud {
  padding: var(--space-7) 0;
  border-block: 1px solid var(--border);
  background: var(--bg-alt);
}
.logo-cloud .label {
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: var(--space-5);
}
.logo-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-6);
  align-items: center;
}
.logo-chip {
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 14px;
  font-weight: 600;
  color: var(--muted);
  letter-spacing: 0.02em;
}

.pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--space-5);
  align-items: stretch;
}
.price-card {
  position: relative;
  padding: var(--space-6);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.price-card.featured {
  border-color: ${colors.cardHoverBorder};
  box-shadow: var(--shadow-raised);
}
.price-card .tier {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--primary);
}
.price-card .amount {
  font-family: var(--font-display);
  font-weight: ${fonts.displayWeight};
  font-size: 40px;
  letter-spacing: ${fonts.displayTracking};
}
.price-card .amount span { font-size: 16px; color: var(--muted); font-weight: 500; }
.price-card ul {
  list-style: none;
  padding: 0;
  display: grid;
  gap: var(--space-3);
  flex: 1;
}
.price-card li {
  display: flex;
  gap: var(--space-3);
  font-size: 14px;
  color: var(--ink-secondary);
}
.price-card li::before { content: "✓"; color: var(--primary); font-weight: 700; flex: none; }

.faq-list { display: grid; gap: var(--space-3); max-width: 720px; margin-inline: auto; }
.faq-item {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  overflow: hidden;
}
.faq-item summary {
  padding: var(--space-4) var(--space-5);
  font-weight: 600;
  cursor: pointer;
  list-style: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.faq-item summary::-webkit-details-marker { display: none; }
.faq-item summary::after { content: "+"; color: var(--primary); font-size: 18px; }
.faq-item[open] summary::after { content: "−"; }
.faq-item p {
  padding: 0 var(--space-5) var(--space-4);
  color: var(--muted);
  font-size: 16px;
  line-height: 1.65;
}

.bento-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: var(--space-4);
}
.bento-cell {
  padding: var(--space-6);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  min-height: 160px;
}
.bento-cell.span-4 { grid-column: span 4; }
.bento-cell.span-3 { grid-column: span 3; }
.bento-cell.span-2 { grid-column: span 2; }
.bento-cell h3 {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 600;
  margin-bottom: var(--space-3);
}
.bento-cell p { font-size: 16px; color: var(--muted); line-height: 1.6; }
@media (max-width: 720px) {
  .bento-grid { grid-template-columns: 1fr; }
  .bento-cell.span-4, .bento-cell.span-3, .bento-cell.span-2 { grid-column: span 1; }
}

.trust-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-5);
}
.trust-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 14px;
  font-weight: 600;
  color: var(--ink-secondary);
}
.trust-badge::before {
  content: "◆";
  color: var(--primary);
  font-size: 12px;
}

.integration-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: var(--space-4);
}
.integration-tile {
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
  transition: border-color var(--duration-ui) var(--ease-out), transform var(--duration-ui) var(--ease-out);
}
.integration-tile:hover {
  border-color: ${colors.cardHoverBorder};
  transform: translateY(-2px);
}

.hero-split {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--space-8);
  align-items: center;
  text-align: left;
}
.hero-split h1 { margin-inline: 0; max-width: none; }
.hero-split .lede { margin-inline: 0; }
.hero-split .hero-ctas { justify-content: flex-start; }
.hero-panel {
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-strong);
  background: var(--surface);
  box-shadow: var(--shadow-raised);
  padding: var(--space-7);
  min-height: 320px;
  display: grid;
  place-items: center;
  position: relative;
  overflow: hidden;
}
.hero-panel.spotlight-target::after {
  content: "";
  position: absolute;
  top: 0;
  left: -30%;
  width: 24%;
  height: 100%;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--primary) 10%, transparent), transparent);
  animation: panel-sweep 5.5s ease-in-out infinite;
  pointer-events: none;
  z-index: 1;
}
@keyframes panel-sweep {
  0%, 15% { transform: translateX(0); opacity: 0; }
  25% { opacity: 1; }
  65% { opacity: 1; }
  80%, 100% { transform: translateX(520%); opacity: 0; }
}
.hero-panel::before {
  content: "";
  position: absolute;
  inset: 0;
  background: ${colors.glow !== "none" ? colors.glow : `linear-gradient(180deg, color-mix(in srgb, var(--primary) 8%, transparent), transparent)`};
  pointer-events: none;
}
.hero-bento {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: var(--space-4);
  margin-top: var(--space-7);
}
.hero-bento .bento-hero-cell {
  padding: var(--space-6);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  min-height: 140px;
  display: grid;
  align-content: end;
  gap: var(--space-2);
}
.hero-bento .bento-hero-cell.span-4 { grid-column: span 4; min-height: 200px; }
.hero-bento .bento-hero-cell.span-2 { grid-column: span 2; }
.hero-bento .bento-hero-cell h3 {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 600;
}
.hero-bento .bento-hero-cell p { font-size: 14px; color: var(--muted); line-height: 1.55; }
@media (max-width: 720px) {
  .hero-bento { grid-template-columns: 1fr; }
  .hero-bento .bento-hero-cell.span-4,
  .hero-bento .bento-hero-cell.span-2 { grid-column: span 1; }
}
.hero-editorial {
  text-align: left;
  max-width: 780px;
  margin-inline: auto;
}
.hero-editorial h1 {
  margin-inline: 0;
  max-width: none;
  font-size: clamp(44px, 8vw, 84px);
  line-height: 1.02;
}
.hero-editorial .lede {
  margin-inline: 0;
  max-width: 58ch;
  font-size: clamp(18px, 2.2vw, 22px);
  line-height: 1.7;
}
.hero-editorial .hero-ctas { justify-content: flex-start; }
.hero-minimal {
  padding: clamp(120px, 18vw, 200px) 0 clamp(80px, 12vw, 140px);
}
.hero-minimal h1 {
  font-size: clamp(48px, 9vw, 96px);
  letter-spacing: -0.04em;
  max-width: 14ch;
}
.hero-minimal .lede {
  font-size: clamp(16px, 2vw, 18px);
  max-width: 42ch;
  color: var(--ink-secondary);
}
.hero-minimal .hero-ctas { margin-top: var(--space-8); }
.features-icon-rows {
  display: grid;
  gap: var(--space-4);
  max-width: 720px;
  margin-inline: auto;
}
.feature-icon-row {
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: var(--space-4);
  align-items: start;
  padding: var(--space-5);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--surface);
}
.feature-icon-row .icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--primary) 14%, transparent);
  display: grid;
  place-items: center;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  color: var(--primary);
}
.feature-icon-row h3 {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 600;
  margin-bottom: 6px;
}
.feature-icon-row p { color: var(--muted); font-size: 15px; line-height: 1.6; }
.prose-block {
  max-width: 68ch;
  margin-inline: auto;
  font-size: 18px;
  line-height: 1.8;
  color: var(--ink-secondary);
}
.prose-block p + p { margin-top: var(--space-5); }
.prose-block h3 {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 600;
  color: var(--ink);
  margin-bottom: var(--space-4);
}
.hero-panel .mock-ui {
  position: relative;
  width: 100%;
  max-width: 360px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--bg-alt);
  padding: var(--space-4);
  display: grid;
  gap: var(--space-3);
}
.mock-bar {
  height: var(--space-2);
  border-radius: var(--space-1);
  background: color-mix(in srgb, var(--primary) 25%, transparent);
}
.mock-bar.w60 { width: 60%; }
.mock-bar.w80 { width: 80%; }
.mock-bar.w40 { width: 40%; }
`;
}

const INTEGRATION_NAMES = ["GitHub", "Slack", "Stripe", "Notion", "Figma", "Linear", "Vercel", "AWS"];

export function renderLogoCloud(content) {
  const brands = deriveLogoNames(content);
  return `  <section class="logo-cloud" aria-label="Trusted by">
    <div class="container">
      <p class="label reveal">Trusted by teams at</p>
      <div class="logo-row reveal">
${brands.map((name) => `        <span class="logo-chip">${esc(name)}</span>`).join("\n")}
      </div>
    </div>
  </section>`;
}

export function renderPricingSection(content, profile, options = {}) {
  const brand = content.brand || "Product";
  const showKickers = options.showSectionKickers ?? false;
  const tiers = [
    { name: "Starter", price: "Free", period: "", features: ["Core features", "Community support", "1 workspace"] },
    { name: "Pro", price: "$19", period: "/mo", features: ["Everything in Starter", "Advanced analytics", "Priority support", "Unlimited projects"], featured: true },
    { name: "Enterprise", price: "Custom", period: "", features: ["SSO & SAML", "Dedicated support", "Custom SLA", "Audit logs"] }
  ];
  return `  <section class="section alt" id="pricing">
    <div class="container">
      <div class="section-head centered reveal">
        ${showKickers ? `<div class="kicker">Pricing</div>\n        ` : ""}<h2>Plans that scale with ${esc(brand)}</h2>
      </div>
      <div class="pricing-grid">
${tiers.map((tier) => `        <article class="price-card reveal${tier.featured ? " featured" : ""}">
          <div class="tier">${esc(tier.name)}</div>
          <div class="amount">${esc(tier.price)}${tier.period ? `<span>${esc(tier.period)}</span>` : ""}</div>
          <ul>
${tier.features.map((feature) => `            <li>${esc(feature)}</li>`).join("\n")}
          </ul>
          <a class="btn ${tier.featured ? "btn-primary" : "btn-ghost"}" href="#get-started">Get started</a>
        </article>`).join("\n")}
      </div>
    </div>
  </section>`;
}

export function renderFaqSection(content, options = {}) {
  const showKickers = options.showSectionKickers ?? false;
  const faqs = deriveFaqs(content);
  return `  <section class="section" id="faq">
    <div class="container">
      <div class="section-head centered reveal">
        ${showKickers ? `<div class="kicker">FAQ</div>\n        ` : ""}<h2>Common questions</h2>
      </div>
      <div class="faq-list">
${faqs.map((faq) => `        <details class="faq-item reveal">
          <summary>${esc(faq.q)}</summary>
          <p>${esc(faq.a)}</p>
        </details>`).join("\n")}
      </div>
    </div>
  </section>`;
}

export function renderBentoFeatures(content, options = {}) {
  const showKickers = options.showSectionKickers ?? false;
  const features = (content.features ?? []).slice(0, 5);
  if (features.length < 2) return "";
  const spans = ["span-4", "span-2", "span-2", "span-3", "span-3"];
  return `  <section class="section alt" id="bento">
    <div class="container">
      <div class="section-head centered reveal">
        ${showKickers ? `<div class="kicker">Highlights</div>\n        ` : ""}<h2>Built for how you actually work</h2>
      </div>
      <div class="bento-grid">
${features.map((feature, index) => `        <article class="bento-cell ${spans[index % spans.length]} reveal">
          <h3>${esc(feature.title)}</h3>
          <p>${esc(feature.body)}</p>
        </article>`).join("\n")}
      </div>
    </div>
  </section>`;
}

export function renderTrustBadges() {
  const badges = ["SOC 2 Type II", "GDPR Ready", "99.9% Uptime", "Enterprise SSO"];
  return `  <section class="section alt" aria-label="Trust and compliance">
    <div class="container">
      <div class="trust-row reveal">
${badges.map((badge) => `        <span class="trust-badge">${esc(badge)}</span>`).join("\n")}
      </div>
    </div>
  </section>`;
}

export function renderIntegrationGrid(content, options = {}) {
  const showKickers = options.showSectionKickers ?? false;
  const names = INTEGRATION_NAMES.slice(0, 8);
  return `  <section class="section" id="integrations">
    <div class="container">
      <div class="section-head centered reveal">
        ${showKickers ? `<div class="kicker">Integrations</div>\n        ` : ""}<h2>Works with your stack</h2>
      </div>
      <div class="integration-grid">
${names.map((name) => `        <div class="integration-tile reveal">${esc(name)}</div>`).join("\n")}
      </div>
    </div>
  </section>`;
}

function heroAnim(flags, index) {
  if (!flags.showHeroFadeUp) return "";
  return ` fade-up fade-up-${index}`;
}

export function renderHeroSplit(content, profile, renderHeadline, options = {}) {
  const { revealClass = "reveal", flags = {} } = options;
  const primaryCta = content.hero?.ctas?.[0] ?? { label: "Get started", href: "#" };
  const secondaryCta = content.hero?.ctas?.[1] ?? null;
  const spotlight = flags.showSpotlight ? " spotlight-target" : "";
  return `  <section class="hero">
    <div class="container hero-split">
      <div>
        ${flags.showEyebrow && content.hero?.eyebrow ? `<div class="eyebrow ${revealClass}${heroAnim(flags, 1)}">${esc(content.hero.eyebrow)}</div>` : ""}
        <h1 class="${revealClass}${heroAnim(flags, 2)}">${renderHeadline(content.hero?.headline || content.brand || "Welcome")}</h1>
        ${content.hero?.subhead ? `<p class="lede ${revealClass}${heroAnim(flags, 3)}">${esc(content.hero.subhead)}</p>` : ""}
        <div class="hero-ctas ${revealClass}${heroAnim(flags, 4)}">
          <a class="btn btn-primary btn-lg" href="${escAttr(primaryCta.href)}">${esc(primaryCta.label)}</a>
          ${secondaryCta ? `<a class="btn btn-ghost btn-lg" href="${escAttr(secondaryCta.href)}">${esc(secondaryCta.label)}</a>` : ""}
        </div>
      </div>
      <div class="hero-panel${spotlight} ${revealClass}${heroAnim(flags, 5)}" aria-hidden="true">
        <div class="mock-ui">
          <div class="mock-bar w80"></div>
          <div class="mock-bar w60"></div>
          <div class="mock-bar w40"></div>
          <div class="mock-bar w80"></div>
          <div class="mock-bar w60"></div>
        </div>
      </div>
    </div>
  </section>`;
}

export function renderHeroBento(content, profile, renderHeadline, options = {}) {
  const { revealClass = "reveal", flags = {} } = options;
  const primaryCta = content.hero?.ctas?.[0] ?? { label: "Get started", href: "#" };
  const secondaryCta = content.hero?.ctas?.[1] ?? null;
  const features = (content.features ?? []).slice(0, 3);
  const cells = features.length >= 2
    ? features.map((feature, index) => {
      const span = index === 0 ? "span-4" : "span-2";
      return `        <article class="bento-hero-cell ${span} ${revealClass}${heroAnim(flags, 4 + index)}">
          <h3>${esc(feature.title)}</h3>
          <p>${esc(feature.body)}</p>
        </article>`;
    }).join("\n")
    : `        <article class="bento-hero-cell span-4 ${revealClass}${heroAnim(flags, 4)}">
          <h3>${esc(content.brand || "Product")}</h3>
          <p>${esc(content.hero?.subhead || "Built for teams who care about craft.")}</p>
        </article>
        <article class="bento-hero-cell span-2 ${revealClass}${heroAnim(flags, 5)}">
          <h3>Fast</h3>
          <p>Ship in minutes, not weeks.</p>
        </article>`;

  return `  <section class="hero">
    <div class="container">
      ${flags.showEyebrow && content.hero?.eyebrow ? `<div class="eyebrow ${revealClass}${heroAnim(flags, 1)}">${esc(content.hero.eyebrow)}</div>` : ""}
      <h1 class="${revealClass}${heroAnim(flags, 2)}">${renderHeadline(content.hero?.headline || content.brand || "Welcome")}</h1>
      ${content.hero?.subhead ? `<p class="lede ${revealClass}${heroAnim(flags, 3)}">${esc(content.hero.subhead)}</p>` : ""}
      <div class="hero-ctas ${revealClass}${heroAnim(flags, 4)}">
        <a class="btn btn-primary btn-lg" href="${escAttr(primaryCta.href)}">${esc(primaryCta.label)}</a>
        ${secondaryCta ? `<a class="btn btn-ghost btn-lg" href="${escAttr(secondaryCta.href)}">${esc(secondaryCta.label)}</a>` : ""}
      </div>
      <div class="hero-bento">
${cells}
      </div>
    </div>
  </section>`;
}

export function renderHeroEditorial(content, profile, renderHeadline, options = {}) {
  const { revealClass = "reveal", flags = {} } = options;
  const primaryCta = content.hero?.ctas?.[0] ?? { label: "Read more", href: "#" };
  const secondaryCta = content.hero?.ctas?.[1] ?? null;
  return `  <section class="hero">
    <div class="container hero-editorial">
      ${flags.showEyebrow && content.hero?.eyebrow ? `<div class="eyebrow ${revealClass}${heroAnim(flags, 1)}">${esc(content.hero.eyebrow)}</div>` : ""}
      <h1 class="${revealClass}${heroAnim(flags, 2)}">${renderHeadline(content.hero?.headline || content.brand || "Welcome")}</h1>
      ${content.hero?.subhead ? `<p class="lede ${revealClass}${heroAnim(flags, 3)}">${esc(content.hero.subhead)}</p>` : ""}
      <div class="hero-ctas ${revealClass}${heroAnim(flags, 4)}">
        <a class="btn btn-primary btn-lg" href="${escAttr(primaryCta.href)}">${esc(primaryCta.label)}</a>
        ${secondaryCta ? `<a class="btn btn-ghost btn-lg" href="${escAttr(secondaryCta.href)}">${esc(secondaryCta.label)}</a>` : ""}
      </div>
    </div>
  </section>`;
}

export function renderHeroMinimal(content, profile, renderHeadline, options = {}) {
  const { revealClass = "reveal", flags = {} } = options;
  const primaryCta = content.hero?.ctas?.[0] ?? { label: "Get started", href: "#" };
  return `  <section class="hero hero-minimal">
    <div class="container">
      <h1 class="${revealClass}${heroAnim(flags, 1)}">${renderHeadline(content.hero?.headline || content.brand || "Welcome")}</h1>
      ${content.hero?.subhead ? `<p class="lede ${revealClass}${heroAnim(flags, 2)}">${esc(content.hero.subhead)}</p>` : ""}
      <div class="hero-ctas ${revealClass}${heroAnim(flags, 3)}">
        <a class="btn btn-primary btn-lg" href="${escAttr(primaryCta.href)}">${esc(primaryCta.label)}</a>
      </div>
    </div>
  </section>`;
}

export function renderProseSection(content, options = {}) {
  const { revealClass = "reveal" } = options;
  const section = (content.sections ?? [])[0];
  const heading = section?.heading || `About ${content.brand || "us"}`;
  const body = section?.body
    || content.hero?.subhead
    || content.description
    || "We build tools that respect your time, your taste, and your team.";
  const paragraphs = String(body).split(/\n{2,}/).filter(Boolean);
  return `  <section class="section alt" id="story">
    <div class="container">
      <div class="prose-block ${revealClass}">
        <h3>${esc(heading)}</h3>
${paragraphs.map((paragraph) => `        <p>${esc(paragraph.trim())}</p>`).join("\n")}
      </div>
    </div>
  </section>`;
}

export function renderIconRowFeatures(content, options = {}) {
  const { revealClass = "reveal", showSectionKickers = false } = options;
  const brand = content.brand || "Product";
  const features = (content.features ?? []).slice(0, 6);
  if (!features.length) return "";
  return `  <section class="section" id="features">
    <div class="container">
      <div class="section-head centered ${revealClass}">
        ${showSectionKickers ? `<div class="kicker">Capabilities</div>\n        ` : ""}<h2>${esc(content.featuresHeading || `What ${brand} delivers`)}</h2>
      </div>
      <div class="features-icon-rows">
${features.map((feature, index) => `        <article class="feature-icon-row ${revealClass}">
          <div class="icon" aria-hidden="true">${String(index + 1).padStart(2, "0")}</div>
          <div>
            <h3>${esc(feature.title)}</h3>
            <p>${esc(feature.body)}</p>
          </div>
        </article>`).join("\n")}
      </div>
    </div>
  </section>`;
}

export const COMPONENT_RENDERERS = {
  "social-logo-cloud": renderLogoCloud,
  "pricing-three-tier": renderPricingSection,
  "pricing-two-column": renderPricingSection,
  "content-faq-accordion": renderFaqSection,
  "features-bento-grid": renderBentoFeatures,
  "features-icon-rows": renderIconRowFeatures,
  "content-prose-section": renderProseSection,
  "social-trust-badges": renderTrustBadges,
  "features-integration-grid": renderIntegrationGrid
};

export function renderCatalogSections(content, profile, patterns, helpers = {}) {
  const sections = [];
  const order = helpers.sectionOrder ?? ["logos", "pricing", "faq", "trust", "integrations", "bento", "prose"];
  const patternIds = new Set((patterns ?? []).map((pattern) => pattern.id));
  const sectionOptions = {
    showSectionKickers: helpers.renderFlags?.showSectionKickers ?? false
  };

  const renderers = {
    logos: () => patternIds.has("social-logo-cloud") ? renderLogoCloud(content) : "",
    pricing: () => (patternIds.has("pricing-three-tier") || patternIds.has("pricing-two-column"))
      ? renderPricingSection(content, profile, sectionOptions) : "",
    faq: () => patternIds.has("content-faq-accordion") ? renderFaqSection(content, sectionOptions) : "",
    trust: () => patternIds.has("social-trust-badges") ? renderTrustBadges() : "",
    integrations: () => patternIds.has("features-integration-grid") ? renderIntegrationGrid(content, sectionOptions) : "",
    bento: () => patternIds.has("features-bento-grid") ? renderBentoFeatures(content, sectionOptions) : "",
    prose: () => patternIds.has("content-prose-section") ? renderProseSection(content, sectionOptions) : ""
  };

  for (const key of order) {
    const html = renderers[key]?.();
    if (html) sections.push(html);
  }
  return sections;
}

function deriveLogoNames(content) {
  if (Array.isArray(content.logoPartners) && content.logoPartners.length >= 3) {
    return content.logoPartners.slice(0, 8);
  }
  const fromFeatures = (content.features ?? []).slice(0, 4).map((feature) => feature.title.split(/\s+/)[0]);
  const defaults = ["Acme", "Globex", "Initech", "Umbrella", "Stark"];
  const names = [...new Set(fromFeatures.filter((name) => name.length <= 12))];
  return (names.length >= 3 ? names : defaults).slice(0, 5);
}

function deriveFaqs(content) {
  const fromFeatures = (content.features ?? []).slice(0, 3).map((feature) => ({
    q: `How does ${feature.title} work?`,
    a: feature.body || `${feature.title} is included in every plan and works out of the box.`
  }));
  if (fromFeatures.length >= 2) return fromFeatures;
  return [
    { q: "How do I get started?", a: "Sign up for free, connect your workspace, and invite your team in under five minutes." },
    { q: "Can I change plans later?", a: "Yes — upgrade or downgrade anytime. Changes take effect on your next billing cycle." },
    { q: "Is there an enterprise plan?", a: "Contact sales for SSO, custom SLAs, dedicated support, and volume pricing." }
  ];
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escAttr(value) {
  return esc(value).replace(/"/g, "&quot;");
}
