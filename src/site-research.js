// Deep read of an incoming site before morph redesigns it.
// Captures structure, audience signals, and content the shallow extractor misses.

const AUDIENCE_SIGNALS = [
  { id: "ai-community", words: ["ai", "artificial intelligence", "machine learning", "llm", "gpt", "agents", "builders", "hackathon"] },
  { id: "events", words: ["event", "events", "meetup", "conference", "summit", "festival", "ticket", "rsvp", "calendar"] },
  { id: "developer", words: ["developer", "api", "sdk", "github", "deploy", "infrastructure", "open source"] },
  { id: "saas", words: ["saas", "platform", "workspace", "team", "subscription", "pricing", "customers"] },
  { id: "community", words: ["community", "members", "network", "forum", "discord", "slack", "join us"] },
  { id: "media", words: ["news", "blog", "podcast", "newsletter", "stories", "magazine", "editorial"] }
];

const SOCIAL_HOSTS = ["twitter.com", "x.com", "linkedin.com", "github.com", "discord.gg", "discord.com", "youtube.com", "instagram.com"];

const GENERIC_SECTION_HEADINGS = /^(?:features?|pricing|about(?:\s+us)?|faq|contact(?:\s+us)?|testimonials?|how\s+it\s+works|overview|benefits?|solutions?|products?|services?|resources?|blog|news|team|careers?|support|documentation?|docs)$/i;
const CTA_HEADING = /(?:get\s+started|sign\s*up|start\s+(?:now|free|today)|join(?:\s+us)?|book\s+now|register|apply\s+now)/i;

export function researchSite(rawHtml, css = "") {
  const html = String(rawHtml ?? "");
  const stylesheet = String(css ?? "");
  const text = stripTags(html);
  const meta = extractMeta(html);
  const headings = collectHeadings(html);
  const navLinks = collectNavLinks(html);
  const cards = extractCards(html, headings);
  const events = extractEvents(html, headings);
  const partners = extractPartners(html);
  const quotes = extractQuotes(html);
  const pricing = extractPricing(html);
  const socialLinks = collectSocialLinks(html);
  const topics = headings
    .filter((heading) => heading.level <= 3)
    .map((heading) => heading.text)
    .slice(0, 24);
  const audience = inferAudience(`${text}\n${stylesheet}`, meta);
  const inventory = {
    headings: headings.length,
    paragraphs: (html.match(/<p\b/gi) ?? []).length,
    links: (html.match(/<a\b/gi) ?? []).length,
    images: (html.match(/<img\b/gi) ?? []).length,
    buttons: (html.match(/<button\b/gi) ?? []).length,
    sections: (html.match(/<section\b/gi) ?? []).length,
    articles: (html.match(/<article\b/gi) ?? []).length
  };

  const selectionText = [
    meta.title,
    meta.description,
    meta.ogTitle,
    meta.ogDescription,
    audience.map((item) => item.label).join(" "),
    ...topics,
    ...cards.map((card) => `${card.title} ${card.body}`),
    ...events.map((event) => `${event.title} ${event.body}`),
    ...navLinks.map((link) => link.label),
    ...partners
  ].filter(Boolean).join(" ");

  const summary = buildResearchSummary({
    meta,
    audience,
    inventory,
    topics,
    cards,
    events,
    partners,
    navLinks
  });

  return {
    meta,
    audience,
    inventory,
    topics,
    headings,
    navLinks,
    socialLinks,
    cards,
    events,
    partners,
    quotes,
    pricing,
    selectionText,
    summary
  };
}

export function enrichContent(content, research) {
  if (!research) return content;
  const enriched = structuredClone(content);

  if (!enriched.description && research.meta?.description) {
    enriched.description = research.meta.description;
  }
  if (!enriched.hero?.eyebrow && research.meta?.description) {
    const description = research.meta.description.trim();
    if (description.length > 0 && description.length <= 80) {
      enriched.hero ??= {};
      enriched.hero.eyebrow = description;
    }
  }
  if (research.navLinks?.length > (enriched.nav?.length ?? 0)) {
    enriched.nav = research.navLinks.slice(0, 6).map((link) => ({
      label: link.label,
      href: link.href
    }));
  }

  const skipTitles = buildEnrichmentSkipTitles(enriched);
  const existingBodies = new Set(
    (enriched.features ?? [])
      .map((feature) => normalizeEnrichmentText(feature.body))
      .filter(Boolean)
  );
  const existingFeatureTitles = new Set((enriched.features ?? []).map((feature) => feature.title.toLowerCase()));
  for (const card of research.cards ?? []) {
    if ((enriched.features?.length ?? 0) >= 9) break;
    if (!card.title) continue;
    const titleKey = card.title.toLowerCase();
    if (existingFeatureTitles.has(titleKey) || skipTitles.has(titleKey)) continue;
    const bodyKey = normalizeEnrichmentText(card.body);
    if (bodyKey && existingBodies.has(bodyKey)) continue;
    enriched.features ??= [];
    enriched.features.push({ title: card.title, body: card.body || card.title });
    existingFeatureTitles.add(titleKey);
    if (bodyKey) existingBodies.add(bodyKey);
  }

  const existingSectionHeadings = new Set((enriched.sections ?? []).map((section) => section.heading.toLowerCase()));
  for (const event of research.events ?? []) {
    if ((enriched.sections?.length ?? 0) >= 6) break;
    if (!event.title || existingSectionHeadings.has(event.title.toLowerCase())) continue;
    enriched.sections ??= [];
    enriched.sections.push({
      heading: event.title,
      body: event.body || "",
      items: event.items ?? []
    });
    existingSectionHeadings.add(event.title.toLowerCase());
  }

  if (research.partners?.length >= 3) {
    enriched.logoPartners = research.partners.slice(0, 8);
  }
  if (!enriched.testimonial?.quote && research.quotes?.[0]) {
    enriched.testimonial = research.quotes[0];
  }
  if (!enriched.stats?.length) {
    const stats = extractStatsFromResearch(research);
    if (stats.length) enriched.stats = stats;
  }
  if (research.pricing?.length) {
    enriched.pricingTiers = research.pricing;
  }
  if (!enriched.cta?.headline) {
    const ctaHeading = research.headings?.find((heading) =>
      /(join|start|get started|sign up|apply|register|book)/i.test(heading.text)
    );
    if (ctaHeading) {
      enriched.cta ??= {};
      enriched.cta.headline = ctaHeading.text;
    }
  }

  enriched.research = {
    summary: research.summary,
    audience: research.audience,
    topicCount: research.topics?.length ?? 0,
    cardCount: research.cards?.length ?? 0,
    eventCount: research.events?.length ?? 0
  };

  return enriched;
}

function extractMeta(html) {
  const pick = (pattern) => html.match(pattern)?.[1]?.trim() ?? "";
  return {
    title: pick(/<title[^>]*>([\s\S]*?)<\/title>/i),
    description: pick(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
      || pick(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i),
    ogTitle: pick(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i),
    ogDescription: pick(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i),
    ogSiteName: pick(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']*)["']/i),
    keywords: pick(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']*)["']/i),
    themeColor: pick(/<meta[^>]*name=["']theme-color["'][^>]*content=["']([^"']*)["']/i)
  };
}

function collectHeadings(html) {
  const headings = [];
  for (const level of [1, 2, 3, 4]) {
    const pattern = new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, "gi");
    for (const match of html.matchAll(pattern)) {
      const text = cleanText(match[1]);
      if (text) headings.push({ level, text, index: match.index ?? 0 });
    }
  }
  return headings.sort((left, right) => left.index - right.index);
}

function collectNavLinks(html) {
  const blocks = [
    html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/gi) ?? [],
    html.match(/<header[^>]*>([\s\S]*?)<\/header>/gi) ?? []
  ].flat();
  const links = [];
  for (const block of blocks) {
    for (const match of block.matchAll(/<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const label = cleanText(match[2]);
      const href = match[1];
      if (!label || label.length > 40) continue;
      if (/^(login|log in|sign in|sign up|get started)$/i.test(label)) continue;
      links.push({ label, href });
    }
  }
  const seen = new Set();
  return links.filter((link) => {
    const key = link.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectSocialLinks(html) {
  const links = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    try {
      const host = new URL(match[1], "https://example.com").hostname.replace(/^www\./, "");
      if (SOCIAL_HOSTS.some((social) => host.includes(social.replace(/^www\./, "")))) {
        links.push({ href: match[1], host });
      }
    } catch {
      // ignore invalid urls
    }
  }
  return links.slice(0, 8);
}

function extractCards(html, headings) {
  const cards = [];
  for (const heading of headings.filter((item) => item.level >= 2 && item.level <= 4)) {
    if (heading.text.length > 80) continue;
    if (isGenericSectionHeading(heading.text) || CTA_HEADING.test(heading.text)) continue;

    const slice = sliceHeadingContent(html, heading, headings);
    if (!slice) continue;

    // h2/h3 that only wrap deeper headings are section labels, not cards.
    if (heading.level <= 3 && hasNestedHeading(slice, heading.level)) {
      const beforeNested = slice.split(new RegExp(`<h${heading.level + 1}\\b`, "i"))[0] ?? "";
      const hasContent = /<p\b/i.test(beforeNested) || /<li\b/i.test(beforeNested);
      if (!hasContent) continue;
    }

    const body = cleanText(slice.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "");
    const items = [...slice.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((match) => cleanText(match[1]))
      .filter((text) => text && text.length <= 120)
      .slice(0, 4);
    if (!body && !items.length) continue;

    cards.push({
      title: heading.text,
      body: body || items[0] || "",
      items
    });
  }
  const seen = new Set();
  return cards.filter((card) => {
    const key = card.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12);
}

function sliceHeadingContent(html, heading, headings) {
  const closeTag = `</h${heading.level}>`;
  const closeEnd = html.indexOf(closeTag, heading.index);
  if (closeEnd === -1) return "";
  const start = closeEnd + closeTag.length;
  const next = headings.find((item) => item.index > heading.index && item.level <= heading.level);
  const end = next ? next.index : html.length;
  return html.slice(start, end);
}

function hasNestedHeading(slice, level) {
  const maxLevel = Math.min(level + 2, 6);
  for (let nested = level + 1; nested <= maxLevel; nested += 1) {
    if (new RegExp(`<h${nested}\\b`, "i").test(slice)) return true;
  }
  return false;
}

function isGenericSectionHeading(text) {
  return GENERIC_SECTION_HEADINGS.test(String(text ?? "").trim());
}

function buildEnrichmentSkipTitles(content) {
  const skip = new Set();
  for (const value of [
    content.brand,
    content.hero?.headline,
    content.hero?.subhead,
    content.hero?.eyebrow,
    content.featuresHeading,
    content.cta?.headline
  ]) {
    const normalized = normalizeEnrichmentText(value);
    if (normalized) skip.add(normalized);
  }
  return skip;
}

function normalizeEnrichmentText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function extractEvents(html, headings) {
  const events = [];
  const eventHeadings = headings.filter((heading) =>
    /event|meetup|summit|conference|hackathon|workshop|demo day|calendar/i.test(heading.text)
  );
  for (const heading of eventHeadings) {
    const slice = html.slice(heading.index, heading.index + 1600);
    const body = cleanText(slice.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "");
    const items = [...slice.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((match) => cleanText(match[1]))
      .filter(Boolean)
      .slice(0, 5);
    events.push({ title: heading.text, body, items });
  }
  return events.slice(0, 6);
}

function extractPartners(html) {
  const names = new Set();
  for (const match of html.matchAll(/<img\b[^>]*alt=["']([^"']{2,28})["']/gi)) {
    const alt = cleanText(match[1]);
    if (alt && !/logo|icon|image|avatar|photo/i.test(alt)) names.add(alt);
    if (/logo/i.test(alt)) names.add(alt.replace(/\s*logo\s*/i, "").trim());
  }
  for (const match of html.matchAll(/class=["'][^"']*(?:logo|partner|sponsor)[^"']*["'][^>]*>([\s\S]*?)<\//gi)) {
    const text = cleanText(match[1]);
    if (text && text.length <= 24) names.add(text);
  }
  return [...names].filter(Boolean).slice(0, 10);
}

function extractQuotes(html) {
  const quotes = [];
  for (const match of html.matchAll(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi)) {
    const parsed = parseQuote(cleanText(match[1]));
    if (parsed) quotes.push(parsed);
  }
  return quotes.slice(0, 4);
}

function extractPricing(html) {
  const tiers = [];
  const blocks = html.match(/<(?:section|div)[^>]*(?:pricing|plans)[^>]*>[\s\S]*?<\/(?:section|div)>/gi) ?? [];
  for (const block of blocks.slice(0, 1)) {
    for (const heading of block.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi)) {
      const name = cleanText(heading[1]);
      const slice = block.slice(heading.index ?? 0, (heading.index ?? 0) + 500);
      const price = cleanText(slice.match(/\$[\d,.]+(?:\s*\/\s*(?:mo|month|yr|year))?/i)?.[0] ?? "");
      if (name) tiers.push({ name, price: price || "Contact" });
    }
  }
  return tiers.slice(0, 4);
}

function inferAudience(text, meta) {
  const haystack = `${text} ${meta.description ?? ""} ${meta.keywords ?? ""}`.toLowerCase();
  const matches = [];
  for (const signal of AUDIENCE_SIGNALS) {
    const hits = signal.words.filter((word) => haystack.includes(word));
    if (hits.length) {
      matches.push({
        id: signal.id,
        label: signal.id.replace(/-/g, " "),
        hits
      });
    }
  }
  return matches.sort((left, right) => right.hits.length - left.hits.length).slice(0, 4);
}

function extractStatsFromResearch(research) {
  const stats = [];
  const pattern = /([~$]?\d[\d,.]*\s?(?:\+|%|[kKmMbB])?)\s+([A-Za-z][\w\s]{2,40})/g;
  const haystack = [
    research.meta?.description,
    ...(research.cards ?? []).map((card) => card.body),
    ...(research.events ?? []).map((event) => event.body)
  ].filter(Boolean).join(" ");
  for (const match of haystack.matchAll(pattern)) {
    stats.push({ value: match[1].trim(), label: match[2].trim() });
    if (stats.length === 4) break;
  }
  return stats;
}

function buildResearchSummary({ meta, audience, inventory, topics, cards, events, partners, navLinks }) {
  const lines = [];
  if (meta.title) lines.push(`Site: ${meta.title}`);
  if (meta.description) lines.push(`Positioning: ${meta.description}`);
  if (audience.length) lines.push(`Audience: ${audience.map((item) => item.label).join(", ")}`);
  lines.push(`Structure: ${inventory.headings} headings, ${inventory.sections} sections, ${inventory.links} links, ${inventory.images} images`);
  if (topics.length) lines.push(`Key topics: ${topics.slice(0, 6).join(" · ")}`);
  if (cards.length) lines.push(`Content blocks found: ${cards.length}`);
  if (events.length) lines.push(`Event/community sections: ${events.length}`);
  if (partners.length) lines.push(`Partners/logos: ${partners.slice(0, 5).join(", ")}`);
  if (navLinks.length) lines.push(`Navigation: ${navLinks.map((link) => link.label).join(" / ")}`);
  return lines.join("\n");
}

function parseQuote(text) {
  if (!text || text.length < 20) return null;
  const match = text.match(/^(.*?)\s*[—–-]\s*([A-Z][\w\s,.]{2,50})$/s);
  if (match) {
    return { quote: match[1].replace(/^["“”]+|["“”]+$/g, "").slice(0, 240), author: match[2].trim() };
  }
  return { quote: text.replace(/^["“”]+|["“”]+$/g, "").slice(0, 240), author: null };
}

function stripTags(fragment) {
  return cleanText(String(fragment ?? "").replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<style\b[\s\S]*?<\/style>/gi, ""));
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}
