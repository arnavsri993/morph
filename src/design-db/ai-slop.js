// AI-generated UI slop detection — inspired by Impeccable, Taste Skill, and
// Emil Kowalski's motion standards (https://adi-mkv.github.io/fix-ai-design/).
//
// CSS/HTML heuristics that catch the fingerprints agents leave behind: Inter
// everywhere, purple gradients, gradient text, nested cards, bounce easing,
// dark-mode glows, and the hero eyebrow chip template.

export const OVERUSED_FONTS = new Set([
  "inter", "roboto", "open sans", "lato", "montserrat", "arial", "helvetica",
  "fraunces", "instrument sans", "instrument serif",
  "geist", "geist sans", "geist mono",
  "mona sans", "plus jakarta sans", "space grotesk", "recoleta"
]);

const PURPLE_VIOLET = /\b(?:violet|purple|indigo|fuchsia|#(?:7c3aed|8b5cf6|6d28d9|a855f7|6366f1|4f46e5|9333ea|c084fc))\b/i;
const CYAN_NEON = /\b(?:cyan|#(?:06b6d4|22d3ee|67e8f9|4cc9f0))\b/i;
const BOUNCE_ANIM = /\b(?:bounce|elastic|wobble|jiggle|spring)\b/i;
const LAYOUT_TRANSITION = /\b(?:width|height|padding|margin|top|left|right|bottom)\b/i;
const BUZZWORDS = /\b(?:streamline|empower|supercharge|world-class|enterprise-grade|next-generation|cutting-edge|revolutionize|unlock(?:ing)?|leverage|seamless(?:ly)?|game-changer|best-in-class|state-of-the-art)\b/i;

function stripHtml(html) {
  return String(html ?? "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectFonts(html, css) {
  const fonts = new Set();
  const source = `${html}\n${css}`;
  for (const match of source.matchAll(/fonts\.googleapis\.com\/css2?\?family=([^&"'\s]+)/gi)) {
    for (const family of match[1].split("|")) {
      fonts.add(family.split(":")[0].replace(/\+/g, " ").toLowerCase());
    }
  }
  for (const match of source.matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
    for (const face of match[1].split(",")) {
      const name = face.trim().replace(/^['"]|['"]$/g, "").toLowerCase();
      if (name && !/^(serif|sans-serif|monospace|inherit|system-ui)$/.test(name)) {
        fonts.add(name);
      }
    }
  }
  return fonts;
}

function hasBounceEasing(css) {
  if (BOUNCE_ANIM.test(css)) return true;
  for (const match of css.matchAll(/cubic-bezier\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/gi)) {
    const y1 = Number.parseFloat(match[2]);
    const y2 = Number.parseFloat(match[4]);
    if (y1 < -0.1 || y1 > 1.1 || y2 < -0.1 || y2 > 1.1) return true;
  }
  return false;
}

function hasCodexGridBackground(css) {
  const hairlineRe = /\b\d{1,3}px\s*,\s*transparent\s+\d{1,3}px/gi;
  const gridSizeRe = /background-size\s*:[^;{}"']*\b\d{1,3}px\b/i;
  for (const block of css.match(/\{[^{}]*\}/g) ?? []) {
    if (!gridSizeRe.test(block)) continue;
    const hairlines = block.match(hairlineRe);
    if (hairlines && hairlines.length >= 2) return true;
  }
  return false;
}

export const AI_SLOP_HEURISTICS = [
  {
    id: "repeated-section-kickers",
    severity: "low",
    weight: 2,
    category: "slop",
    message: "Repeated tiny uppercase kickers above section headings — AI editorial scaffolding.",
    test: ({ html, css }) =>
      (html.match(/class=["'][^"']*\bkicker\b[^"']*["']/gi) ?? []).length >= 2
      && /\.kicker\b/i.test(css)
  },
  {
    id: "overused-font",
    severity: "medium",
    weight: 6,
    category: "slop",
    message: "Uses an overused AI-default font (Inter, Roboto, Geist, Space Grotesk, etc.) instead of a distinctive pairing.",
    test: ({ html, css }) => {
      const fonts = collectFonts(html, css);
      if (fonts.size >= 2) return false;
      return [...fonts].some((font) => OVERUSED_FONTS.has(font));
    }
  },
  {
    id: "single-font-family",
    severity: "low",
    weight: 3,
    category: "slop",
    message: "Only one font family drives the entire page — no display/body pairing.",
    test: ({ html, css }) => {
      const fonts = collectFonts(html, css);
      return fonts.size === 1;
    }
  },
  {
    id: "ai-color-palette",
    severity: "high",
    weight: 8,
    category: "slop",
    message: "Purple/violet gradients or cyan-on-dark palette — the most recognizable AI color tell.",
    test: ({ css, html }) => {
      const source = `${css}\n${html}`;
      if (/linear-gradient\([^)]*(?:#a5a0ff|#6ee7f5|#a5f0c5|violet|fuchsia)[^)]*(?:cyan|#06b6d4|#22d3ee|#4cc9f0)/i.test(source)) {
        return true;
      }
      if (/linear-gradient\([^)]*#7c3aed[^)]*#8b5cf6/i.test(source)) return true;
      const darkBg = /#(?:0a0a0f|0a0a0a|09090b|111827)\b/i.test(source)
        || /background(?:-color)?\s*:\s*#(?:0[0-9a-f]{5}|1[0-2][0-9a-f]{4})/i.test(source);
      if (darkBg && PURPLE_VIOLET.test(source) && CYAN_NEON.test(source) && /linear-gradient/i.test(source)) {
        return true;
      }
      return /(?:from-violet|to-purple|via-purple|purple-\d{3}).*(?:to-cyan|via-cyan|cyan-\d{3})/i.test(source);
    }
  },
  {
    id: "gradient-text",
    severity: "medium",
    weight: 5,
    category: "slop",
    message: "Gradient clipped to text — decorative rather than meaningful, a common AI heading tell.",
    test: ({ css, html }) =>
      /background-clip\s*:\s*text/i.test(`${css}\n${html}`)
      || /-webkit-background-clip\s*:\s*text/i.test(`${css}\n${html}`)
      || /bg-clip-text/i.test(html)
  },
  {
    id: "nested-cards",
    severity: "medium",
    weight: 5,
    category: "slop",
    message: "Cards nested inside cards — excessive container depth instead of spacing and typography.",
    test: ({ html }) => {
      const openTag = /<(?:article|div|section)\b[^>]*class=["'][^"']*\b(?:price-card|bento-cell|\bcard\b|\bpanel\b)\b[^"']*["']/gi;
      const innerTag = /<(?:article|div|section)\b[^>]*class=["'][^"']*\b(?:price-card|bento-cell|\bcard\b|\bpanel\b)\b[^"']*["']/i;
      const layoutOnly = /\b(?:card-grid|pricing-grid|bento-grid|integration-grid|logo-row)\b/;
      const matches = [...html.matchAll(openTag)];
      for (const match of matches) {
        const classAttr = match[0].match(/class=["']([^"']*)["']/i)?.[1] ?? "";
        if (layoutOnly.test(classAttr)) continue;
        const start = match.index ?? 0;
        const closeTag = match[0].startsWith("<article") ? "</article>" : "</div>";
        const end = html.indexOf(closeTag, start);
        const inner = html.slice(start, end > start ? end : start + 2000);
        if (innerTag.test(inner.slice(match[0].length))) return true;
      }
      return false;
    }
  },
  {
    id: "bounce-easing",
    severity: "medium",
    weight: 5,
    category: "slop",
    message: "Bounce or elastic easing feels dated — use ease-out curves that decelerate smoothly.",
    test: ({ css }) => hasBounceEasing(css)
  },
  {
    id: "layout-transition",
    severity: "medium",
    weight: 4,
    category: "motion",
    message: "Animates layout properties (width, height, padding, margin) — use transform and opacity instead.",
    test: ({ css }) => {
      for (const match of css.matchAll(/transition(?:-property)?\s*:\s*([^;}]+)/gi)) {
        const props = match[1].toLowerCase();
        if (props === "all") continue;
        if (LAYOUT_TRANSITION.test(props)) return true;
      }
      return false;
    }
  },
  {
    id: "slow-ui-transition",
    severity: "low",
    weight: 3,
    category: "motion",
    message: "UI transitions exceed 300ms — micro-interactions should feel instant (Emil Kowalski: stay under 300ms).",
    test: ({ css }) => {
      for (const match of css.matchAll(/transition[^;{}]*\b([\d.]+)(ms|s)\b/gi)) {
        const value = Number.parseFloat(match[1]);
        const unit = match[2].toLowerCase();
        const ms = unit === "s" ? value * 1000 : value;
        if (ms <= 300 || ms >= 5000) continue;
        if (/opacity|transform/.test(match[0]) && ms <= 480) continue;
        return true;
      }
      return false;
    }
  },
  {
    id: "transition-all",
    severity: "low",
    weight: 3,
    category: "motion",
    message: "Uses transition: all — specify exact properties (transform, opacity) for performance.",
    test: ({ css }) => /transition\s*:\s*all\b/i.test(css)
  },
  {
    id: "dark-glow",
    severity: "medium",
    weight: 4,
    category: "slop",
    message: "Colored box-shadow glow on a dark surface — the default AI dark-mode accent.",
    test: ({ css }) =>
      /box-shadow[^;{}]*(?:rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+|#[0-9a-f]{3,8})[^;{}]*(?:0\s+0\s+\d+px|0px\s+0px\s+\d+px)/i.test(css)
      && /(?:0\s+0\s+(?:[3-9]\d|[1-9]\d{2,})px|glow|shadow-glow)/i.test(css)
  },
  {
    id: "hero-eyebrow-chip",
    severity: "low",
    weight: 3,
    category: "slop",
    message: "Tiny pill/eyebrow label above the hero headline — the default AI SaaS hero template.",
    test: ({ html, css }) =>
      /class=["'][^"']*\b(?:eyebrow|pill|badge|chip)\b[^"']*["']/i.test(html)
      && /<h1\b/i.test(html)
      && /\.(?:eyebrow|pill|badge|chip)\b/i.test(css)
      && /<(?:div|span|p)[^>]*class=["'][^"']*\b(?:eyebrow|pill|badge|chip)\b[^"']*["'][^>]*>[\s\S]{0,500}<h1\b/i.test(html)
  },
  {
    id: "icon-tile-stack",
    severity: "low",
    weight: 3,
    category: "slop",
    message: "Rounded icon tile stacked above feature headings — the universal AI feature-card template.",
    test: ({ html, css }) =>
      (/class=["'][^"']*\b(?:icon-tile|card-icon|feature-icon|icon-box)\b/i.test(html)
        || /\.(?:icon-tile|card-icon|feature-icon|icon-box)\b/i.test(css))
  },
  {
    id: "side-tab-border",
    severity: "low",
    weight: 3,
    category: "slop",
    message: "Thick colored border on one side of a card — a recognizable AI accent pattern.",
    test: ({ css }) =>
      /border-(?:left|top|right|bottom)\s*:\s*(?:[3-9]|\d{2,})px\s+(?!transparent|var\(--border)/i.test(css)
  },
  {
    id: "codex-grid-background",
    severity: "low",
    weight: 3,
    category: "slop",
    message: "Two-axis grid-line gradient background — a common Codex/GPT decorative pattern.",
    test: ({ css }) => hasCodexGridBackground(css)
  },
  {
    id: "marketing-buzzword",
    severity: "low",
    weight: 2,
    category: "content",
    message: "Generic SaaS marketing buzzwords (streamline, empower, seamless, etc.) read as AI copy.",
    test: ({ html }) => BUZZWORDS.test(stripHtml(html))
  },
  {
    id: "ease-in-ui",
    severity: "low",
    weight: 2,
    category: "motion",
    message: "ease-in on UI transitions feels sluggish — use ease-out for entrances and feedback.",
    test: ({ css }) => /transition[^;{}]*\bease-in\b(?!\s*-out)/i.test(css)
      || /animation[^;{}]*\bease-in\b(?!\s*-out)/i.test(css)
  }
];
