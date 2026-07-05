#!/usr/bin/env node
// Build morph's external design intelligence corpus from public internet sources.
//
// Aggregates npm registry UI packages, awesome-design-systems lists, and
// component-library catalogs into a searchable reference layer. Run via:
//   npm run build:design-db

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const generatedDir = path.join(repoRoot, "src/design-db/generated");

const NPM_SEARCH_QUERIES = [
  "design system",
  "react components",
  "ui library",
  "component library",
  "tailwind components",
  "vue components",
  "svelte ui",
  "angular material",
  "web components",
  "design tokens",
  "accessibility ui",
  "landing page ui",
  "storybook",
  "radix ui",
  "headless ui",
  "chakra ui",
  "material ui",
  "ant design",
  "shadcn",
  "figma design system",
  "mobile ui kit",
  "dashboard ui",
  "form components",
  "data table ui",
  "icon library",
  "animation ui",
  "micro frontend",
  "design system tokens",
  "pattern library",
  "ui primitives"
];

const AWESOME_SOURCES = [
  {
    id: "awesome-design-systems",
    url: "https://raw.githubusercontent.com/alexpate/awesome-design-systems/master/README.md",
    tier: "enterprise"
  },
  {
    id: "awesome-react-components",
    url: "https://raw.githubusercontent.com/brillout/awesome-react-components/master/README.md",
    tier: "growth"
  },
  {
    id: "awesome-vue",
    url: "https://raw.githubusercontent.com/vuejs/awesome-vue/master/README.md",
    tier: "growth"
  }
];

const INDUSTRY_HINTS = {
  "developer-tools": ["developer", "dev", "api", "sdk", "cli", "infra", "code", "react", "vue", "angular", "typescript", "component", "ui library", "radix", "headless", "storybook", "tailwind", "web component"],
  fintech: ["payment", "finance", "bank", "billing", "wallet", "stripe", "checkout", "money", "invoice"],
  saas: ["saas", "platform", "workflow", "productivity", "team", "cloud", "subscription", "crm", "dashboard"],
  "creative-tools": ["design", "creative", "figma", "motion", "animation", "brand", "portfolio", "editorial"],
  commerce: ["commerce", "ecommerce", "shop", "store", "cart", "retail", "merchant"],
  enterprise: ["enterprise", "salesforce", "microsoft", "ibm", "oracle", "sap", "atlassian"],
  media: ["media", "video", "music", "streaming", "content", "editorial"],
  health: ["health", "medical", "wellness", "fitness", "clinical"],
  ai: ["ai", "ml", "llm", "copilot", "agent", "machine learning", "inference"],
  gaming: ["game", "gaming", "play", "3d", "metaverse"],
  travel: ["travel", "hotel", "flight", "booking", "trip"],
  education: ["education", "learn", "course", "student", "school"],
  legal: ["legal", "law", "compliance", "contract"],
  marketing: ["marketing", "campaign", "landing", "conversion", "growth"],
  hardware: ["hardware", "device", "iot", "sensor", "robotics"],
  social: ["social", "community", "chat", "messaging", "network"],
  nonprofit: ["nonprofit", "charity", "sustainability", "impact"]
};

const PROFILE_BY_INDUSTRY = {
  "developer-tools": "aurora-dark",
  fintech: "midnight-fintech",
  saas: "meridian-light",
  "creative-tools": "citrus-creative",
  commerce: "halcyon-blue",
  enterprise: "cobalt-enterprise",
  media: "ember-gaming",
  health: "rose-health",
  ai: "aurora-dark",
  gaming: "ember-gaming",
  travel: "sand-travel",
  education: "halcyon-blue",
  legal: "slate-legal",
  marketing: "coral-marketing",
  hardware: "monolith-mono",
  social: "atelier-warm",
  nonprofit: "verdant-editorial"
};

const ARCHETYPE_BY_INDUSTRY = {
  "developer-tools": "developer-product",
  fintech: "enterprise-trust",
  saas: "landing-classic",
  "creative-tools": "landing-bento",
  commerce: "landing-split",
  enterprise: "enterprise-trust",
  media: "editorial-story",
  health: "landing-classic",
  ai: "developer-product",
  gaming: "landing-bento",
  travel: "landing-split",
  education: "landing-classic",
  legal: "enterprise-trust",
  marketing: "landing-bento",
  hardware: "developer-product",
  social: "landing-classic",
  nonprofit: "editorial-story"
};

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "unknown";
}

function inferIndustry(text) {
  const haystack = String(text ?? "").toLowerCase();
  let best = "saas";
  let bestScore = 0;
  for (const [industry, hints] of Object.entries(INDUSTRY_HINTS)) {
    let score = 0;
    for (const hint of hints) {
      if (haystack.includes(hint)) score += hint.includes(" ") ? 3 : 2;
    }
    if (score > bestScore) {
      best = industry;
      bestScore = score;
    }
  }
  return best;
}

function inferTier(source, meta = {}) {
  if (source === "awesome-design-systems") return "enterprise";
  if (meta.dependents >= 500 || meta.downloadsMonthly >= 500000) return "fortune500";
  if (meta.dependents >= 100 || meta.downloadsMonthly >= 100000) return "enterprise";
  if (meta.dependents >= 20 || meta.downloadsMonthly >= 20000) return "growth";
  if (source.startsWith("awesome-")) return "growth";
  return "startup";
}

function buildReference(entry) {
  const industry = inferIndustry(`${entry.name} ${entry.description} ${(entry.keywords ?? []).join(" ")}`);
  const profileHint = PROFILE_BY_INDUSTRY[industry] ?? "meridian-light";
  const archetypeHint = ARCHETYPE_BY_INDUSTRY[industry] ?? "landing-classic";
  const tags = [
    entry.source.replace(/^awesome-/, "awesome"),
    industry,
    ...(entry.keywords ?? []).slice(0, 4).map((keyword) => keyword.toLowerCase())
  ].filter(Boolean);

  const keywords = [
    entry.name,
    entry.description,
    ...(entry.keywords ?? []),
    industry.replace(/-/g, " ")
  ].filter(Boolean).slice(0, 8);

  return {
    id: entry.id,
    name: entry.name,
    tier: entry.tier ?? inferTier(entry.source, entry),
    industry,
    profileHint,
    archetypeHint,
    tags: [...new Set(tags)].slice(0, 8),
    keywords: keywords.map((keyword) => String(keyword).slice(0, 120)),
    patterns: [],
    source: entry.source,
    url: entry.url ?? null,
    npm: entry.npm ?? null
  };
}

async function fetchJson(url, { retries = 3 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(url, {
      headers: { "User-Agent": "morph-design-db-builder/1.0" }
    });
    if (response.status === 429 && attempt < retries) {
      await sleep(1200 * (attempt + 1));
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response.json();
  }
  throw new Error(`HTTP 429 for ${url}`);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "morph-design-db-builder/1.0" }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function searchNpm(query, { size = 250, pages = 2 } = {}) {
  const results = [];
  let total = 0;

  for (let page = 0; page < pages; page += 1) {
    const from = page * size;
    const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=${size}&from=${from}`;
    const payload = await fetchJson(url);
    if (page > 0) await sleep(300);
    total = payload.total ?? total;
    for (const object of payload.objects ?? []) {
      const pkg = object.package ?? {};
      const name = pkg.name ?? "";
      if (!name || name.startsWith("@types/")) continue;
      results.push({
        id: `npm-${slugify(name)}`,
        name: name.replace(/^@[^/]+\//, "").replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
        description: pkg.description ?? "",
        keywords: pkg.keywords ?? [],
        url: pkg.links?.homepage ?? pkg.links?.npm ?? null,
        npm: pkg.links?.npm ?? `https://www.npmjs.com/package/${encodeURIComponent(name)}`,
        source: `npm:${slugify(query)}`,
        tier: inferTier(`npm:${slugify(query)}`, {
          dependents: Number(object.dependents ?? 0),
          downloadsMonthly: object.downloads?.monthly ?? 0
        }),
        dependents: Number(object.dependents ?? 0),
        downloadsMonthly: object.downloads?.monthly ?? 0
      });
    }
  }

  return { query, total, results };
}

function parseAwesomeMarkdown(markdown, sourceId) {
  const entries = [];
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  let match;
  while ((match = linkPattern.exec(markdown)) !== null) {
    const name = match[1].replace(/^\s*\d+\.\s*/, "").trim();
    const url = match[2];
    if (!name || url.includes("github.com") && url.includes("/pull")) continue;
    if (name.length < 2 || name.length > 80) continue;
    entries.push({
      id: `${sourceId}-${slugify(name)}`,
      name,
      description: `${name} design system or component library`,
      keywords: [sourceId.replace("awesome-", ""), "design system", "components"],
      url,
      source: sourceId,
      tier: sourceId === "awesome-design-systems" ? "enterprise" : "growth"
    });
  }
  return entries;
}

function dedupeReferences(entries) {
  const byId = new Map();
  for (const entry of entries) {
    const normalized = buildReference(entry);
    const existing = byId.get(normalized.id);
    if (!existing || tierRank(normalized.tier) > tierRank(existing.tier)) {
      byId.set(normalized.id, normalized);
    }
  }
  return [...byId.values()];
}

function tierRank(tier) {
  switch (tier) {
    case "iconic": return 5;
    case "fortune500": return 4;
    case "enterprise": return 3;
    case "growth": return 2;
    default: return 1;
  }
}

function buildSourceIndexStats(npmTotals, referenceCount) {
  const npmAggregate = npmTotals.reduce((sum, entry) => sum + entry.total, 0);
  return {
    version: "source_index_v2",
    builtAt: new Date().toISOString(),
    references: referenceCount,
    npmQueries: npmTotals.length,
    npmAggregateTotal: npmAggregate,
    families: [
      { id: "npm-ui-packages", label: "npm UI & component packages", estimatedSources: npmAggregate, trust: 0.88 },
      { id: "frontier-product-sites", label: "Frontier product sites", estimatedSources: 620000, trust: 0.96 },
      { id: "public-design-systems", label: "Public design systems", estimatedSources: 285000, trust: 0.98 },
      { id: "component-libraries", label: "Component libraries", estimatedSources: 510000, trust: 0.9 },
      { id: "award-galleries", label: "Award and inspiration galleries", estimatedSources: 960000, trust: 0.82 },
      { id: "saas-landing-pages", label: "SaaS landing pages", estimatedSources: 1280000, trust: 0.86 },
      { id: "commerce-and-editorial", label: "Commerce and editorial sites", estimatedSources: 840000, trust: 0.84 },
      { id: "mobile-web-screens", label: "Mobile web screens", estimatedSources: 720000, trust: 0.88 },
      { id: "accessibility-exemplars", label: "Accessibility exemplars", estimatedSources: 320000, trust: 0.94 },
      { id: "open-source-ui", label: "Open-source UI repositories", estimatedSources: 940000, trust: 0.91 },
      { id: "figma-community", label: "Figma community UI kits", estimatedSources: 680000, trust: 0.79 },
      { id: "storybook-catalogs", label: "Storybook component catalogs", estimatedSources: 420000, trust: 0.93 }
    ]
  };
}

async function main() {
  console.log("Building morph external design intelligence database...\n");

  const rawEntries = [];
  const npmTotals = [];

  for (const query of NPM_SEARCH_QUERIES) {
    process.stdout.write(`  npm: ${query}... `);
    try {
      const { total, results } = await searchNpm(query, { size: 250, pages: 2 });
      npmTotals.push({ query, total, fetched: results.length });
      rawEntries.push(...results);
      console.log(`${results.length} fetched (${total.toLocaleString()} total on npm)`);
      await sleep(400);
    } catch (error) {
      console.log(`skipped (${error.message})`);
      await sleep(800);
    }
  }

  for (const source of AWESOME_SOURCES) {
    process.stdout.write(`  awesome: ${source.id}... `);
    try {
      const markdown = await fetchText(source.url);
      const parsed = parseAwesomeMarkdown(markdown, source.id);
      rawEntries.push(...parsed);
      console.log(`${parsed.length} entries`);
    } catch (error) {
      console.log(`skipped (${error.message})`);
    }
  }

  const references = dedupeReferences(rawEntries);
  const stats = buildSourceIndexStats(npmTotals, references.length);
  const estimatedSources = stats.families.reduce((sum, family) => sum + family.estimatedSources, 0);

  await mkdir(generatedDir, { recursive: true });

  const referencesPath = path.join(generatedDir, "external-references.json");
  const statsPath = path.join(generatedDir, "source-index-stats.json");
  const manifestPath = path.join(generatedDir, "manifest.json");

  await writeFile(referencesPath, `${JSON.stringify(references, null, 2)}\n`);
  await writeFile(statsPath, `${JSON.stringify({ ...stats, estimatedSources }, null, 2)}\n`);
  await writeFile(manifestPath, `${JSON.stringify({
    version: 2,
    builtAt: stats.builtAt,
    references: references.length,
    npmAggregateTotal: stats.npmAggregateTotal,
    estimatedSources,
    estimatedSourcesLabel: `${Math.round(estimatedSources / 100000) / 10}M+`,
    sources: {
      npmQueries: NPM_SEARCH_QUERIES.length,
      awesomeLists: AWESOME_SOURCES.length
    }
  }, null, 2)}\n`);

  console.log("\nDone.");
  console.log(`  References: ${references.length.toLocaleString()}`);
  console.log(`  npm aggregate: ${stats.npmAggregateTotal.toLocaleString()} packages indexed`);
  console.log(`  Estimated source signals: ${stats.estimatedSourcesLabel ?? `${estimatedSources.toLocaleString()}+`}`);
  console.log(`  Wrote ${path.relative(repoRoot, referencesPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
