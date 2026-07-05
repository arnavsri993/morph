// morph transform engine.
//
// Takes an arbitrary (usually agent-generated) website, extracts its content,
// scores its UI quality against the design intelligence database heuristics,
// selects the best-matching design profile, and re-renders the site as a
// polished, responsive, animated page — keeping the original content.

import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { runSponsorEnrichment } from "./ai-providers.js";
import {
  aiVisionAvailable,
  analyzeUiReference,
  generateUiReference
} from "./ai-vision.js";
import { resolveNavVariant } from "./design-db/site-chrome.js";
import {
  databaseSummary,
  extractVisualPreferences,
  planTransform,
  renderPage,
  renderStylesheet
} from "./design-db/index.js";
import { TRANSFORM_PRESERVE_SCORE, transformVerdict } from "./design-db/scoring.js";
import { assessFullUiQuality } from "./scanners/design-health.js";
import { enrichContent, researchSite } from "./site-research.js";

const REMOTE_CSS_TIMEOUT_MS = 5000;
const REMOTE_CSS_MAX_BYTES = 256 * 1024;
const REMOTE_CSS_MAX_FILES = 6;

export async function transformSite(inputDir, outputDir, options = {}) {
  const entry = await findEntryHtml(inputDir);
  if (!entry) {
    throw new Error(`No HTML entry point found under ${inputDir}. morph transform needs at least one .html file.`);
  }

  const html = await readFile(entry, "utf8");
  const cssBundle = await collectCss(inputDir, entry, html);
  const assessmentOptions = {
    perspective: "input",
    cssCoverage: cssBundle.coverage
  };
  const before = assessFullUiQuality(html, cssBundle.css, assessmentOptions);
  const siteResearch = researchSite(html, cssBundle.css);
  const content = enrichContent(extractContent(html), siteResearch);

  if (before.score >= TRANSFORM_PRESERVE_SCORE && !options.forceRerender) {
    return await buildPreserveReceipt({
      inputDir,
      entry,
      outputDir,
      html,
      cssBundle,
      before,
      siteResearch,
      content,
      options
    });
  }

  const contentSummary = [
    content.brand,
    content.hero?.headline,
    content.hero?.subhead,
    siteResearch.meta?.description,
    `${(content.features ?? []).length} features`,
    siteResearch.audience?.map((item) => item.label).join(", ")
  ].filter(Boolean).join(" — ");

  let ai = null;
  let aiHints = options.aiHints ?? null;
  let sponsorAi = null;

  if (!aiHints && aiVisionAvailable()) {
    sponsorAi = await runSponsorEnrichment({
      contentSummary,
      instructions: options.instructions
    });
    if (sponsorAi.mergedHints) {
      aiHints = sponsorAi.mergedHints;
    }
  }

  if (options.generateReference && !aiHints) {
    ai = await generateUiReference({
      brand: content.brand,
      headline: content.hero?.headline,
      instructions: options.instructions,
      contentSummary,
      outputDir: path.join(outputDir, "..", ".morph", "references")
    });
    aiHints = ai.hints;
  } else if (options.referenceImage && !aiHints) {
    ai = await analyzeUiReference({
      imagePath: path.resolve(options.referenceImage),
      instructions: options.instructions,
      contentSummary
    });
    aiHints = ai.hints;
  }

  const visualPreferences = extractVisualPreferences(html, cssBundle.css);
  const plan = planTransform(content, {
    profile: options.profile ?? null,
    archetype: options.archetype ?? null,
    instructions: options.instructions ?? "",
    aiHints,
    visualPreferences,
    siteResearch,
    taste: options.taste ?? null
  });

  const renderOptions = {
    archetype: plan.archetype.archetype,
    patterns: plan.patterns,
    taste: plan.taste,
    renderFlags: plan.renderFlags
  };
  const outputHtml = renderPage(content, plan.profile.profile, renderOptions);
  const outputCss = renderStylesheet(plan.profile.profile, {
    taste: plan.taste,
    renderFlags: plan.renderFlags,
    navVariant: resolveNavVariant(plan.patterns)
  });
  const after = assessFullUiQuality(outputHtml, outputCss, { perspective: "output" });

  await mkdir(outputDir, { recursive: true });
  const htmlPath = path.join(outputDir, "index.html");
  const cssPath = path.join(outputDir, "morph-theme.css");
  await writeFile(htmlPath, outputHtml);
  await writeFile(cssPath, outputCss);

  if (ai?.imagePath && existsSync(ai.imagePath)) {
    const refName = path.basename(ai.imagePath);
    await writeFile(path.join(outputDir, refName), await readFile(ai.imagePath));
  }

  return {
    schemaVersion: "morph.transform.v1",
    generatedAt: new Date().toISOString(),
    input: {
      root: inputDir,
      entry: path.relative(inputDir, entry)
    },
    output: {
      root: outputDir,
      files: ["index.html", "morph-theme.css"]
    },
    designDatabase: databaseSummary(),
    ai: ai ? {
      available: ai.available,
      reason: ai.reason,
      message: ai.message,
      imagePath: ai.imagePath ?? null,
      hints: aiHints,
      provider: ai.provider ?? ai.analysis?.provider ?? null,
      sponsor: ai.sponsor ?? ai.analysis?.sponsor ?? null
    } : {
      available: aiVisionAvailable(),
      reason: aiHints ? (sponsorAi?.available ? "sponsor_enrichment" : "provided_hints") : "not_used",
      message: aiVisionAvailable()
        ? "Set --reference-image or --generate-reference to use AI vision."
        : "Configure OPENROUTER_API_KEY, NEBIUS_API_KEY, NVIDIA_API_KEY, AZURE_OPENAI_API_KEY, CLOUDFLARE_API_TOKEN, or OPENAI_API_KEY."
    },
    sponsorAi: sponsorAi ? {
      available: sponsorAi.available,
      providers: Object.fromEntries(
        Object.entries(sponsorAi.providers).map(([key, value]) => [key, {
          provider: value.provider,
          model: value.model,
          hints: value.hints
        }])
      )
    } : null,
    visualPreferences,
    siteResearch: {
      summary: siteResearch.summary,
      audience: siteResearch.audience,
      inventory: siteResearch.inventory,
      topics: siteResearch.topics?.slice(0, 12) ?? [],
      navLinks: siteResearch.navLinks?.slice(0, 8) ?? [],
      cardCount: siteResearch.cards?.length ?? 0,
      eventCount: siteResearch.events?.length ?? 0
    },
    profile: {
      id: plan.profile.profile.id,
      name: plan.profile.profile.name,
      inspiration: plan.profile.profile.inspiration,
      mode: plan.profile.profile.mode,
      selectionReason: plan.profile.reason,
      matchedKeywords: plan.profile.matchedKeywords,
      referenceSite: plan.profile.referenceSite ?? null,
      matchedReference: plan.profile.matchedReference ?? null,
      modeAdjustedFrom: plan.profile.modeAdjustedFrom ?? null
    },
    archetype: {
      id: plan.archetype.archetype.id,
      name: plan.archetype.archetype.name,
      selectionReason: plan.archetype.reason,
      matchedTags: plan.archetype.matchedTags
    },
    retrieval: {
      engine: plan.retrieval.sourceIndex?.version ?? "reference_corpus_v2",
      corpusSize: plan.retrieval.corpusSize,
      estimatedSourceSignals: plan.retrieval.sourceIndex?.estimatedSources ?? null,
      confidence: plan.retrieval.confidence,
      topReference: plan.retrieval.topReference,
      matchedReferences: (plan.retrieval.matches ?? []).slice(0, 5),
      industry: plan.retrieval.industry?.industry ?? null,
      highEndDimensions: plan.retrieval.sourceSignals?.topDimensions ?? [],
      matchedSourceFamilies: plan.retrieval.sourceSignals?.sourceFamilies ?? [],
      patternHints: plan.retrieval.patternHints?.length ?? 0
    },
    patterns: plan.patterns.map((pattern) => ({
      id: pattern.id,
      name: pattern.name,
      category: pattern.category
    })),
    taste: plan.taste,
    renderFlags: plan.renderFlags,
    content: {
      brand: content.brand,
      headline: content.hero?.headline ?? null,
      navLinks: (content.nav ?? []).length,
      features: (content.features ?? []).length,
      sections: (content.sections ?? []).length,
      stats: (content.stats ?? []).length
    },
    before,
    after,
    codeReview: {
      file: path.relative(inputDir, entry),
      before: html,
      after: outputHtml,
      changed: true
    },
    improvement: after.score - before.score,
    verdict: transformVerdict(after),
    preservedOriginal: false,
    cssCollection: cssBundle.meta,
    summary: buildSummary(plan, before, after, aiHints)
  };
}

function buildSummary(plan, before, after, aiHints) {
  const refNote = plan.retrieval?.topReference
    ? ` Matched ${plan.retrieval.topReference.name} (${plan.retrieval.topReference.tier}) from a ${plan.retrieval.corpusSize}-site reference corpus.`
    : "";
  const aiNote = aiHints?.layoutNotes ? ` AI reference: ${aiHints.layoutNotes}.` : "";
  return `morph re-rendered the site with ${plan.profile.profile.name} (${plan.archetype.archetype.name} layout, ${plan.patterns.length} UI patterns): UI quality ${before.score}/100 → ${after.score}/100.${refNote}${aiNote}`;
}

export async function findEntryHtml(rootDir) {
  if (!existsSync(rootDir)) return null;
  const htmlFiles = await walkForHtml(rootDir);
  if (!htmlFiles.length) return null;
  const index = htmlFiles.find((file) => path.basename(file).toLowerCase() === "index.html");
  if (index) return index;
  htmlFiles.sort((left, right) => left.split(path.sep).length - right.split(path.sep).length || left.localeCompare(right));
  return htmlFiles[0];
}

async function walkForHtml(directory) {
  const rootStat = await stat(directory);
  if (!rootStat.isDirectory()) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (["node_modules", ".git", ".morph", "dist", "build", ".next"].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkForHtml(absolute));
    else if (entry.name.toLowerCase().endsWith(".html")) files.push(absolute);
  }
  return files;
}

async function collectCss(rootDir, entryFile, html) {
  const chunks = [];
  const meta = {
    inlineStyles: 0,
    styleBlocks: 0,
    localStylesheets: 0,
    remoteStylesheets: 0,
    remoteFetched: 0,
    remoteFailed: 0
  };
  let remoteFetchBudget = REMOTE_CSS_MAX_FILES;

  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    chunks.push(match[1]);
    meta.styleBlocks += 1;
  }

  for (const match of html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi)) {
    const href = match[0].match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;

    if (/^https?:/i.test(href)) {
      meta.remoteStylesheets += 1;
      if (remoteFetchBudget <= 0) continue;
      remoteFetchBudget -= 1;
      const remoteCss = await fetchRemoteStylesheet(href);
      if (remoteCss) {
        chunks.push(remoteCss);
        meta.remoteFetched += 1;
      } else {
        meta.remoteFailed += 1;
      }
      continue;
    }

    const cssFile = path.resolve(path.dirname(entryFile), href.replace(/^\//, ""));
    if (cssFile.startsWith(path.resolve(rootDir)) && existsSync(cssFile)) {
      try {
        chunks.push(await readFile(cssFile, "utf8"));
        meta.localStylesheets += 1;
      } catch {
        // unreadable stylesheet: treated as absent
      }
    }
  }

  for (const match of html.matchAll(/style=["']([^"']*)["']/gi)) {
    chunks.push(`.inline{${match[1]}}`);
    meta.inlineStyles += 1;
  }

  const css = chunks.join("\n");
  const referencesStylesheets = meta.localStylesheets + meta.remoteStylesheets > 0
    || /<link\b[^>]*rel=["']stylesheet["']/i.test(html);
  const coverage = referencesStylesheets && css.trim().length < 120 ? "partial" : "full";

  return { css, coverage, meta };
}

async function fetchRemoteStylesheet(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REMOTE_CSS_TIMEOUT_MS);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "text/css,*/*;q=0.1" }
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > REMOTE_CSS_MAX_BYTES) return null;
    return new TextDecoder("utf-8").decode(buffer);
  } catch {
    return null;
  }
}

async function buildPreserveReceipt({
  inputDir,
  entry,
  outputDir,
  html,
  cssBundle,
  before,
  siteResearch,
  content,
  options
}) {
  const passthroughHtml = ensureViewportMeta(html);
  const linkedCss = cssBundle.css.trim()
    ? `<style>\n${cssBundle.css}\n</style>`
    : "";

  await mkdir(outputDir, { recursive: true });
  const htmlPath = path.join(outputDir, "index.html");
  await writeFile(htmlPath, passthroughHtml.includes("<head")
    ? passthroughHtml.replace(/<head([^>]*)>/i, `<head$1>\n${linkedCss}`)
    : `<!doctype html><html><head>${linkedCss}</head><body>${passthroughHtml}</body></html>`);

  const after = assessFullUiQuality(passthroughHtml, cssBundle.css, { perspective: "output" });

  return {
    schemaVersion: "morph.transform.v1",
    generatedAt: new Date().toISOString(),
    input: {
      root: inputDir,
      entry: path.relative(inputDir, entry)
    },
    output: {
      root: outputDir,
      files: ["index.html"]
    },
    designDatabase: databaseSummary(),
    ai: {
      available: aiVisionAvailable(),
      reason: "preserved_original",
      message: "Site already meets the quality bar — morph preserved the original layout instead of applying a template."
    },
    sponsorAi: null,
    visualPreferences: extractVisualPreferences(html, cssBundle.css),
    siteResearch: {
      summary: siteResearch.summary,
      audience: siteResearch.audience,
      inventory: siteResearch.inventory,
      topics: siteResearch.topics?.slice(0, 12) ?? [],
      navLinks: siteResearch.navLinks?.slice(0, 8) ?? [],
      cardCount: siteResearch.cards?.length ?? 0,
      eventCount: siteResearch.events?.length ?? 0
    },
    profile: null,
    archetype: null,
    retrieval: null,
    patterns: [],
    taste: options.taste ?? null,
    renderFlags: null,
    content: {
      brand: content.brand,
      headline: content.hero?.headline ?? null,
      navLinks: (content.nav ?? []).length,
      features: (content.features ?? []).length,
      sections: (content.sections ?? []).length,
      stats: (content.stats ?? []).length
    },
    before,
    after,
    codeReview: {
      file: path.relative(inputDir, entry),
      before: html,
      after: passthroughHtml,
      changed: passthroughHtml !== html
    },
    improvement: after.score - before.score,
    verdict: transformVerdict(after),
    preservedOriginal: true,
    cssCollection: cssBundle.meta,
    summary: `morph preserved the original site (${before.score}/100) — it already meets the quality bar. No template re-render applied.`
  };
}

function ensureViewportMeta(html) {
  if (/name=["']viewport["']/i.test(html)) return html;
  if (/<head\b/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, '<head$1>\n<meta name="viewport" content="width=device-width, initial-scale=1">');
  }
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${html}</body></html>`;
}

// ── Content extraction ─────────────────────────────────────────────────────

const CTA_PATTERN = /(get started|start (?:now|free|building|today)|sign ?up|try (?:it|now|free)|download|buy now|join|book|request|contact|learn more|see (?:how|demo)|view demo|explore)/i;

export function extractContent(rawHtml) {
  const html = String(rawHtml ?? "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  const title = textOf(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const description = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1] ?? "";

  const headings = collectTags(html, "h1")
    .concat(collectTags(html, "h2"), collectTags(html, "h3"))
    .sort((left, right) => left.index - right.index);
  const paragraphs = collectTags(html, "p");
  const listItems = collectTags(html, "li");
  const anchors = collectAnchors(html);
  const blockquote = textOf(html.match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i)?.[1] ?? "");

  const h1 = headings.find((heading) => heading.tag === "h1") ?? headings[0] ?? null;
  let headline = h1?.text || title || "Welcome";
  const brand = deriveBrand(html, title, headline);

  // Fast sites often use the brand name as the h1 and put the real tagline in
  // the next heading. Promote that heading into the hero.
  let heroHeading = h1;
  if (h1 && brand && h1.text.toLowerCase() === brand.toLowerCase()) {
    const tagline = headings.find((heading) =>
      heading !== h1 && heading.index > h1.index && heading.text.length > brand.length + 4
    );
    if (tagline) {
      headline = tagline.text;
      heroHeading = tagline;
    }
  }

  const subhead = paragraphs.find((paragraph) => heroHeading && paragraph.index > heroHeading.index && paragraph.text.length > 40)?.text
    ?? paragraphs.find((paragraph) => paragraph.text.length > 40)?.text
    ?? description
    ?? "";
  const nav = deriveNav(html, anchors, headings);
  const ctas = deriveCtas(html, anchors);

  const { features, sections } = deriveFeatureSections(headings, paragraphs, listItems, heroHeading);
  const stats = deriveStats(listItems, headings);

  const footerText = textOf(html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i)?.[1] ?? "")
    .replace(/©\s*\d{4}\s*/g, "")
    .slice(0, 120);

  return {
    title: title || brand,
    description,
    brand,
    nav,
    hero: {
      eyebrow: null,
      headline,
      subhead: subhead === headline ? "" : subhead,
      ctas
    },
    featuresHeading: headings.find((heading) =>
      heading.tag !== "h1" && /feature|why|what|benefit|offer|include/i.test(heading.text)
    )?.text ?? null,
    features,
    sections,
    stats,
    testimonial: blockquote ? parseTestimonial(blockquote) : null,
    cta: {
      headline: headings.find((heading) => CTA_PATTERN.test(heading.text))?.text ?? null,
      subhead: null
    },
    footerText: footerText || null
  };
}

function collectTags(html, tag) {
  const results = [];
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  for (const match of html.matchAll(pattern)) {
    const text = textOf(match[1]);
    if (text) results.push({ tag, text, index: match.index });
  }
  return results;
}

function collectAnchors(html) {
  const results = [];
  for (const match of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = match[0].match(/href=["']([^"']*)["']/i)?.[1] ?? "#";
    const text = textOf(match[1]);
    if (text) results.push({ label: text, href, index: match.index });
  }
  return results;
}

function deriveBrand(html, title, headline) {
  const headerBlock = html.match(/<(?:header|nav)[^>]*>([\s\S]*?)<\/(?:header|nav)>/i)?.[1] ?? "";
  const headerBrand = textOf(headerBlock.match(/<(?:a|strong|b|span|h\d)[^>]*>([\s\S]*?)<\/(?:a|strong|b|span|h\d)>/i)?.[1] ?? "");
  if (headerBrand && headerBrand.length <= 32) return headerBrand;
  const cleanTitle = title.split(/[|–—-]/)[0].trim();
  if (cleanTitle && cleanTitle.length <= 32) return cleanTitle;
  const shortHeadline = headline.split(/\s+/).slice(0, 2).join(" ");
  return shortHeadline || "Product";
}

function deriveNav(html, anchors, headings) {
  const navBlock = html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/i)?.[1]
    ?? html.match(/<header[^>]*>([\s\S]*?)<\/header>/i)?.[1]
    ?? "";
  let candidates = collectAnchors(navBlock);
  if (!candidates.length) {
    candidates = anchors.filter((anchor) => anchor.href.startsWith("#") && anchor.label.length <= 24);
  }
  if (!candidates.length) {
    // Fabricate anchor navigation from section headings so the page still
    // gets a real nav.
    candidates = headings
      .filter((heading) => heading.tag !== "h1" && heading.text.length <= 24)
      .slice(0, 4)
      .map((heading) => ({ label: heading.text, href: `#${slugify(heading.text)}` }));
  }
  const seen = new Set();
  return candidates
    .filter((candidate) => {
      const key = candidate.label.toLowerCase();
      if (seen.has(key) || CTA_PATTERN.test(candidate.label)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5)
    .map((candidate) => ({ label: candidate.label, href: candidate.href || "#" }));
}

function deriveCtas(html, anchors) {
  const buttons = [];
  for (const match of html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)) {
    const text = textOf(match[1]);
    if (text) buttons.push({ label: text, href: "#get-started", index: match.index });
  }
  const candidates = anchors
    .filter((anchor) => CTA_PATTERN.test(anchor.label))
    .concat(buttons.filter((button) => CTA_PATTERN.test(button.label)))
    .concat(buttons)
    .sort((left, right) => left.index - right.index);

  const seen = new Set();
  const ctas = [];
  for (const candidate of candidates) {
    const key = candidate.label.toLowerCase();
    if (seen.has(key) || candidate.label.length > 28) continue;
    seen.add(key);
    ctas.push({ label: candidate.label, href: candidate.href || "#get-started" });
    if (ctas.length === 2) break;
  }
  if (!ctas.length) ctas.push({ label: "Get started", href: "#get-started" });
  return ctas;
}

function deriveFeatureSections(headings, paragraphs, listItems, heroHeading) {
  const bodyFor = (heading, nextHeadingIndex) =>
    paragraphs.find((paragraph) =>
      paragraph.index > heading.index
      && (nextHeadingIndex === null || paragraph.index < nextHeadingIndex)
    )?.text ?? "";

  const subHeadings = headings.filter((heading) => heading !== heroHeading && heading.tag !== "h1");
  const entries = subHeadings.map((heading, index) => {
    const next = subHeadings[index + 1]?.index ?? null;
    const items = listItems
      .filter((item) => item.index > heading.index && (next === null || item.index < next))
      .map((item) => item.text)
      .filter((text) => text.length <= 90);
    return {
      heading: heading.text,
      body: bodyFor(heading, next),
      items
    };
  }).filter((entry) =>
    entry.heading
    && !CTA_PATTERN.test(entry.heading)
    && (entry.body || entry.items.length)
  );

  const features = [];
  const sections = [];
  for (const entry of entries) {
    if (entry.heading.length <= 42 && entry.body && entry.body.length <= 200 && entry.items.length <= 1) {
      features.push({ title: entry.heading, body: entry.body });
    } else {
      sections.push(entry);
    }
  }

  // If the page is nothing but list items (a common fast-site shape), promote
  // them into feature cards.
  if (!features.length && !sections.length && listItems.length >= 3) {
    for (const item of listItems.slice(0, 6)) {
      const [head, ...rest] = item.text.split(/[:—–-]\s+/);
      features.push({
        title: head.slice(0, 42),
        body: rest.join(" ") || item.text
      });
    }
  }

  return { features: features.slice(0, 9), sections: sections.slice(0, 4) };
}

function parseTestimonial(blockquote) {
  const match = blockquote.match(/^(.*?)\s*[—–-]\s*([A-Z][\w\s,.]{2,50})$/s);
  if (match && match[1].length > 20) {
    return { quote: match[1].replace(/^["“”]+|["“”]+$/g, "").slice(0, 220), author: match[2].trim() };
  }
  return { quote: blockquote.replace(/^["“”]+|["“”]+$/g, "").slice(0, 220), author: null };
}

function deriveStats(listItems, headings) {
  const stats = [];
  const candidates = listItems.concat(headings);
  for (const candidate of candidates) {
    const match = candidate.text.match(/^([~$]?\d[\d,.]*\s?(?:\+|%|[kKmMbBx])?)\s*[—:·-]?\s+(.{3,40})$/);
    if (!match) continue;
    stats.push({ value: match[1].trim(), label: match[2].trim() });
    if (stats.length === 4) break;
  }
  return stats;
}

function textOf(fragment) {
  return String(fragment ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
