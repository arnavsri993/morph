// Captures 100% of readable site content before morph redesigns it.
// Nothing from the original page is discarded — overflow is preserved for render.

import { isAccessibilityNoise } from "./content-noise.js";

export function captureSiteSnapshot(rawHtml, css = "") {
  const html = String(rawHtml ?? "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  const headings = collectHeadings(html);
  const paragraphs = collectElements(html, "p");
  const listItems = collectElements(html, "li");
  const links = collectLinks(html);
  const buttons = collectButtons(html);
  const images = collectImages(html);
  const blockquotes = collectElements(html, "blockquote");
  const tables = collectTables(html);
  const forms = collectForms(html);
  const navLinks = collectNavLinks(html, links);
  const ctas = collectCtas(links, buttons);
  const blocks = buildDocumentBlocks(html, headings, paragraphs, listItems);
  const fullText = [
    extractMeta(html).title,
    extractMeta(html).description,
    ...headings.map((heading) => heading.text),
    ...paragraphs.map((paragraph) => paragraph.text),
    ...listItems.map((item) => item.text),
    ...links.map((link) => link.label),
    ...buttons.map((button) => button.label),
    ...blockquotes.map((quote) => quote.text),
    String(css ?? "")
  ].filter(Boolean).join("\n");

  return {
    meta: extractMeta(html),
    inventory: {
      headings: headings.length,
      paragraphs: paragraphs.length,
      listItems: listItems.length,
      links: links.length,
      buttons: buttons.length,
      images: images.length,
      blockquotes: blockquotes.length,
      tables: tables.length,
      forms: forms.length,
      blocks: blocks.length,
      textLength: fullText.length
    },
    headings,
    paragraphs,
    listItems,
    links,
    buttons,
    images,
    blockquotes,
    tables,
    forms,
    navLinks,
    ctas,
    blocks,
    fullText
  };
}

export function mergeCapturedIntoContent(content, capture) {
  if (!capture) return content;
  const merged = structuredClone(content);

  merged.capture = {
    inventory: capture.inventory,
    blockCount: capture.blocks?.length ?? 0,
    fullTextLength: capture.fullText?.length ?? 0
  };

  if (capture.meta?.description && !merged.description) {
    merged.description = capture.meta.description;
  }
  if (capture.meta?.title && !merged.title) {
    merged.title = capture.meta.title;
  }

  if (capture.navLinks?.length) {
    merged.nav = dedupeNav(capture.navLinks);
  }

  if (capture.ctas?.length) {
    merged.hero ??= {};
    merged.hero.ctas = capture.ctas.slice(0, 6);
  }

  const heroKeys = new Set([
    normalizeKey(merged.brand),
    normalizeKey(merged.hero?.headline),
    normalizeKey(merged.hero?.subhead)
  ].filter(Boolean));

  const features = [...(merged.features ?? [])];
  const sections = [...(merged.sections ?? [])];
  const featureTitles = new Set(features.map((feature) => normalizeKey(feature.title)));
  const sectionHeadings = new Set(sections.map((section) => normalizeKey(section.heading)));

  for (const block of capture.blocks ?? []) {
    if (!block.heading && !block.body && !(block.items?.length)) continue;
    const titleKey = normalizeKey(block.heading);
    if (titleKey && heroKeys.has(titleKey)) continue;

    if (block.kind === "feature" && block.heading) {
      if (featureTitles.has(titleKey)) continue;
      features.push({ title: block.heading, body: block.body || block.items?.[0] || "" });
      featureTitles.add(titleKey);
      continue;
    }

    if (block.heading) {
      if (sectionHeadings.has(titleKey)) continue;
      const body = block.body || "";
      const items = block.items ?? [];
      if (!body.trim() && !items.length) continue;
      sections.push({
        heading: block.heading,
        body,
        items
      });
      sectionHeadings.add(titleKey);
    }
  }

  merged.features = features;
  merged.sections = sections;

  const quotes = (capture.blockquotes ?? [])
    .map((entry) => parseQuote(entry.text))
    .filter(Boolean);
  if (!merged.testimonial?.quote && quotes[0]) {
    merged.testimonial = quotes[0];
  }
  if (quotes.length > 1) {
    merged.testimonials = quotes;
  }

  if (!merged.stats?.length) {
    const stats = extractStats(capture);
    if (stats.length) merged.stats = stats;
  }

  const preserved = collectPreservedBlocks(capture, merged, heroKeys);
  if (preserved.length) merged.preservedBlocks = preserved;

  merged.allParagraphs = (capture.paragraphs ?? [])
    .map((paragraph) => paragraph.text)
    .filter(Boolean);

  merged.allLinks = capture.links ?? [];
  merged.allImages = capture.images ?? [];
  merged.sourceText = capture.fullText ?? "";

  return merged;
}

function collectHeadings(html) {
  const headings = [];
  for (const level of [1, 2, 3, 4, 5, 6]) {
    const pattern = new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, "gi");
    for (const match of html.matchAll(pattern)) {
      const text = cleanText(match[1]);
      if (text && !isAccessibilityNoise(text)) {
        headings.push({ level, text, index: match.index ?? 0, tag: `h${level}` });
      }
    }
  }
  return headings.sort((left, right) => left.index - right.index);
}

function collectElements(html, tag) {
  const results = [];
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  for (const match of html.matchAll(pattern)) {
    const text = cleanText(match[1]);
    if (text) results.push({ text, index: match.index ?? 0, tag });
  }
  return results;
}

function collectLinks(html) {
  const links = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = cleanText(match[2]);
    if (!label) continue;
    links.push({ label, href: match[1] || "#", index: match.index ?? 0 });
  }
  return links;
}

function collectButtons(html) {
  const buttons = [];
  for (const match of html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)) {
    const label = cleanText(match[1]);
    if (label) buttons.push({ label, href: "#", index: match.index ?? 0 });
  }
  return buttons;
}

function collectImages(html) {
  const images = [];
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1] ?? null;
    const alt = tag.match(/\balt=["']([^"']*)["']/i)?.[1] ?? "";
    if (src || alt) images.push({ src, alt: cleanText(alt) });
  }
  return images;
}

function collectTables(html) {
  const tables = [];
  for (const match of html.matchAll(/<table\b[\s\S]*?<\/table>/gi)) {
    const rows = [...match[0].matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((row) =>
      [...row[0].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map((cell) => cleanText(cell[1]))
        .filter(Boolean)
    ).filter((row) => row.length);
    if (rows.length) tables.push({ rows });
  }
  return tables;
}

function collectForms(html) {
  const forms = [];
  for (const match of html.matchAll(/<form\b[\s\S]*?<\/form>/gi)) {
    const fields = [...match[0].matchAll(/<(?:input|textarea|select)\b[^>]*>/gi)].map((field) => {
      const tag = field[0];
      return {
        type: tag.match(/\btype=["']([^"']+)["']/i)?.[1] ?? tag.match(/^<(\w+)/)?.[1] ?? "input",
        name: tag.match(/\bname=["']([^"']+)["']/i)?.[1] ?? null,
        placeholder: tag.match(/\bplaceholder=["']([^"']+)["']/i)?.[1] ?? null
      };
    });
    forms.push({ fields });
  }
  return forms;
}

function collectNavLinks(html, links) {
  const blocks = [
    ...(html.match(/<nav[^>]*>[\s\S]*?<\/nav>/gi) ?? []),
    ...(html.match(/<header[^>]*>[\s\S]*?<\/header>/gi) ?? [])
  ];
  const nav = [];
  for (const block of blocks) {
    for (const match of block.matchAll(/<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const label = cleanText(match[2]);
      if (!label || label.length > 48 || isAccessibilityNoise(label)) continue;
      nav.push({ label, href: match[1] || "#" });
    }
  }
  if (nav.length) return dedupeNav(nav);
  return dedupeNav(links.filter((link) => link.href.startsWith("#") || link.label.length <= 32));
}

function collectCtas(links, buttons) {
  const pattern = /(get started|start|sign ?up|try|download|buy|join|book|register|contact|demo|learn more)/i;
  const seen = new Set();
  const ctas = [];
  for (const candidate of [...links, ...buttons].sort((left, right) => left.index - right.index)) {
    if (!pattern.test(candidate.label)) continue;
    const key = candidate.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ctas.push({ label: candidate.label, href: candidate.href || "#get-started" });
  }
  return ctas;
}

function buildDocumentBlocks(html, headings, paragraphs, listItems) {
  const blocks = [];
  const subHeadings = headings.filter((heading) => heading.level >= 2);

  for (const [index, heading] of subHeadings.entries()) {
    const next = subHeadings[index + 1]?.index ?? html.length;
    const slice = html.slice(heading.index, next);
    const body = cleanText(slice.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "");
    const items = listItems
      .filter((item) => item.index > heading.index && item.index < next)
      .map((item) => item.text)
      .filter(Boolean);
    const kind = body && body.length <= 320 && items.length <= 2 ? "feature" : "section";
    blocks.push({
      kind,
      heading: heading.text,
      body: body || items.join(" · "),
      items,
      level: heading.level,
      index: heading.index
    });
  }

  if (!blocks.length && listItems.length) {
    for (const item of listItems) {
      const [head, ...rest] = item.text.split(/[:—–-]\s+/);
      blocks.push({
        kind: "feature",
        heading: head.slice(0, 80),
        body: rest.join(" ") || item.text,
        items: [],
        level: 3,
        index: item.index
      });
    }
  }

  return blocks;
}

function collectPreservedBlocks(capture, content, heroKeys) {
  const used = new Set([
    ...heroKeys,
    ...(content.features ?? []).map((feature) => normalizeKey(feature.title)),
    ...(content.features ?? []).map((feature) => normalizeKey(feature.body)).filter(Boolean),
    ...(content.sections ?? []).map((section) => normalizeKey(section.heading)),
    ...(content.sections ?? []).flatMap((section) => [
      normalizeKey(section.body),
      ...(section.items ?? []).map((item) => normalizeKey(item))
    ]).filter(Boolean)
  ]);

  const preserved = [];
  for (const paragraph of capture.paragraphs ?? []) {
    const key = normalizeKey(paragraph.text);
    if (!key || key.length < 24 || used.has(key)) continue;
    if (content.hero?.subhead && paragraph.text === content.hero.subhead) continue;
    preserved.push({ type: "paragraph", text: paragraph.text });
    used.add(key);
  }

  for (const table of capture.tables ?? []) {
    preserved.push({ type: "table", rows: table.rows });
  }

  for (const form of capture.forms ?? []) {
    if (form.fields?.length) preserved.push({ type: "form", fields: form.fields });
  }

  return preserved;
}

function extractStats(capture) {
  const stats = [];
  const pattern = /^([~$]?\d[\d,.]*\s?(?:\+|%|[kKmMbBx])?)\s*[—:·-]?\s+(.{3,60})$/;
  for (const item of [...(capture.listItems ?? []), ...(capture.headings ?? [])]) {
    const text = item.text ?? item.label;
    const match = String(text).match(pattern);
    if (!match) continue;
    stats.push({ value: match[1].trim(), label: match[2].trim() });
  }
  return stats;
}

function dedupeNav(links) {
  const seen = new Set();
  return links.filter((link) => {
    const key = link.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractMeta(html) {
  const pick = (pattern) => html.match(pattern)?.[1]?.trim() ?? "";
  return {
    title: cleanText(pick(/<title[^>]*>([\s\S]*?)<\/title>/i)),
    description: pick(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
      || pick(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i),
    keywords: pick(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']*)["']/i)
  };
}

function parseQuote(text) {
  if (!text || text.length < 16) return null;
  const match = text.match(/^(.*?)\s*[—–-]\s*([A-Z][\w\s,.]{2,50})$/s);
  if (match) {
    return { quote: match[1].replace(/^["“”]+|["“”]+$/g, "").trim(), author: match[2].trim() };
  }
  return { quote: text.replace(/^["“”]+|["“”]+$/g, "").trim(), author: null };
}

function normalizeKey(value) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
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
