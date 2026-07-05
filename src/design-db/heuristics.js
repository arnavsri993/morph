// Morph Design Intelligence Database — UI quality heuristics.
//
// Rules that detect the fingerprints of quickly-generated, unpolished web UI.
// Each rule inspects the combined HTML and CSS of a page and returns findings.
// The transform engine uses the resulting score to decide how much of the
// page needs to be re-rendered, and the findings become the "before" receipt.

const GENERIC_FONT_ONLY = /font-family\s*:\s*(?:arial|helvetica|verdana|tahoma|georgia|"?times new roman"?|times|serif|sans-serif|monospace|cursive)\s*(?:,\s*(?:arial|helvetica|verdana|tahoma|georgia|"?times new roman"?|times|serif|sans-serif|monospace|cursive)\s*)*[;}"]/i;

export const UI_HEURISTICS = [
  {
    id: "no-viewport-meta",
    severity: "high",
    weight: 8,
    category: "responsive",
    message: "Page has no viewport meta tag, so it renders zoomed-out on mobile.",
    test: ({ html }) => !/name=["']viewport["']/i.test(html)
  },
  {
    id: "default-typography",
    severity: "high",
    weight: 9,
    category: "typography",
    message: "Typography relies on browser-default or generic system fonts with no curated pairing.",
    test: ({ css }) => !css.trim() || GENERIC_FONT_ONLY.test(css) || !/font-family/i.test(css)
  },
  {
    id: "no-type-scale",
    severity: "medium",
    weight: 6,
    category: "typography",
    message: "Headings use browser-default sizes; there is no deliberate type scale or tracking.",
    test: ({ css }) => !/letter-spacing/i.test(css) && !/clamp\(/i.test(css)
  },
  {
    id: "primary-color-collision",
    severity: "high",
    weight: 8,
    category: "color",
    message: "Uses raw saturated web colors (pure red/blue/green/yellow) instead of a tuned palette.",
    test: ({ css, html }) => {
      const cssValues = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/:\s*([^;{}]+)/g)]
        .map((match) => match[1]);
      const inlineValues = [...html.matchAll(/(?:style|bgcolor|color)=["']([^"']*)["']/gi)]
        .map((match) => match[1]);
      const source = cssValues.concat(inlineValues).join("\n");
      return /\b(?:red|blue|green|yellow|orange|purple|pink|lime|cyan|magenta)\b/i.test(source)
        || /#(?:f00|ff0000|00f|0000ff|0f0|00ff00|ff0|ffff00)\b/i.test(source);
    }
  },
  {
    id: "no-color-system",
    severity: "medium",
    weight: 6,
    category: "color",
    message: "No CSS custom properties: colors are hardcoded ad hoc with no semantic token system.",
    test: ({ css }) => !/--[a-z-]+\s*:/i.test(css)
  },
  {
    id: "no-spacing-rhythm",
    severity: "medium",
    weight: 6,
    category: "layout",
    message: "No consistent spacing rhythm: margins and paddings are ad hoc values.",
    test: ({ css }) => {
      const values = [...css.matchAll(/(?:margin|padding)[^:;{}]*:\s*([^;}]+)/gi)]
        .flatMap((match) => match[1].match(/\d+px/g) ?? []);
      if (values.length < 3) return true;
      const unique = new Set(values);
      const offGrid = [...unique].filter((value) => Number.parseInt(value, 10) % 4 !== 0);
      return offGrid.length / unique.size > 0.4;
    }
  },
  {
    id: "centered-text-walls",
    severity: "low",
    weight: 3,
    category: "layout",
    message: "Long paragraphs are center-aligned, which hurts readability.",
    test: ({ css }) => /text-align\s*:\s*center/i.test(css) && !/max-width/i.test(css)
  },
  {
    id: "no-max-width-container",
    severity: "medium",
    weight: 6,
    category: "layout",
    message: "Content has no max-width container, so lines run edge-to-edge on wide screens.",
    test: ({ css }) => !/max-width\s*:\s*(?:9\d0px|1\d{3}px|\d+ch|\d+rem)/i.test(css)
  },
  {
    id: "no-hover-states",
    severity: "medium",
    weight: 5,
    category: "interaction",
    message: "Interactive elements have no hover states, so the page feels static and unresponsive.",
    test: ({ css }) => !/:hover/i.test(css)
  },
  {
    id: "no-focus-states",
    severity: "high",
    weight: 7,
    category: "accessibility",
    message: "No focus-visible styling: keyboard users cannot see where they are.",
    test: ({ css }) => !/focus/i.test(css)
  },
  {
    id: "no-transitions",
    severity: "low",
    weight: 4,
    category: "motion",
    message: "No transitions or animation: state changes snap harshly instead of easing.",
    test: ({ css }) => !/transition|animation/i.test(css)
  },
  {
    id: "default-buttons",
    severity: "high",
    weight: 7,
    category: "components",
    message: "Buttons and links use browser-default styling instead of designed components.",
    test: ({ html, css }) => /<(?:button|input[^>]*type=["'](?:submit|button))/i.test(html)
      && !/(?:button|\.btn|\[type=["']submit)/i.test(css)
  },
  {
    id: "underlined-raw-links",
    severity: "low",
    weight: 3,
    category: "components",
    message: "Navigation links keep the default underline and browser blue/purple colors.",
    test: ({ html, css }) => /<a\s/i.test(html) && !/(?:^|[,{}\s])a\s*[:{,]|text-decoration/i.test(css)
  },
  {
    id: "no-border-radius",
    severity: "low",
    weight: 3,
    category: "shape",
    message: "No border radius anywhere: every surface is a hard rectangle.",
    test: ({ css }) => !/border-radius/i.test(css)
  },
  {
    id: "no-elevation",
    severity: "low",
    weight: 3,
    category: "depth",
    message: "No shadows or layering: the page has no depth hierarchy.",
    test: ({ css }) => !/box-shadow/i.test(css)
  },
  {
    id: "inline-style-soup",
    severity: "medium",
    weight: 5,
    category: "architecture",
    message: "Heavy inline style attributes instead of a stylesheet: unmaintainable and inconsistent.",
    test: ({ html }) => (html.match(/style=["']/gi) ?? []).length >= 5
  },
  {
    id: "table-or-center-layout",
    severity: "medium",
    weight: 5,
    category: "layout",
    message: "Uses <center>, <font>, or layout tables — pre-CSS-era construction.",
    test: ({ html }) => /<(?:center|font|marquee)\b/i.test(html)
  },
  {
    id: "no-semantic-structure",
    severity: "medium",
    weight: 5,
    category: "architecture",
    message: "Page is div soup: no header, nav, main, section, or footer landmarks.",
    test: ({ html }) => !/<(?:header|nav|main|section|footer)\b/i.test(html)
  },
  {
    id: "missing-image-alts",
    severity: "medium",
    weight: 4,
    category: "accessibility",
    message: "Images are missing alt text.",
    test: ({ html }) => [...html.matchAll(/<img\b[^>]*>/gi)]
      .some((match) => !/\balt=/i.test(match[0]))
  },
  {
    id: "no-dark-considered-contrast",
    severity: "low",
    weight: 2,
    category: "color",
    message: "Pure black text on pure white (or the reverse) with no tuned contrast pairing.",
    test: ({ css }) => /color\s*:\s*(?:#000000|#000|black)\b/i.test(css)
      && /background(?:-color)?\s*:\s*(?:#ffffff|#fff|white)\b/i.test(css)
  },
  {
    id: "no-responsive-rules",
    severity: "high",
    weight: 7,
    category: "responsive",
    message: "No media queries or fluid units: the layout cannot adapt to smaller screens.",
    test: ({ css }) => !/@media/i.test(css) && !/(?:clamp|min\(|max\(|\dvw)/i.test(css)
  },
  {
    id: "no-font-loading",
    severity: "medium",
    weight: 5,
    category: "typography",
    message: "No webfont is loaded: the page depends entirely on installed system fonts.",
    test: ({ html, css }) => !/fonts\.googleapis|@font-face|fonts\.bunny|typekit/i.test(`${html}\n${css}`)
  },
  {
    id: "unstyled-forms",
    severity: "medium",
    weight: 4,
    category: "components",
    message: "Form inputs keep browser-default chrome instead of designed fields.",
    test: ({ html, css }) => /<(?:input|textarea|select)\b/i.test(html)
      && !/(?:input|textarea|select)\s*[,{:[]/i.test(css)
  },
  {
    id: "emoji-as-icons",
    severity: "low",
    weight: 2,
    category: "components",
    message: "Raw emoji used as feature icons instead of a consistent icon system.",
    test: ({ html }) => (html.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) ?? []).length >= 3
  },
  {
    id: "lorem-or-placeholder",
    severity: "low",
    weight: 2,
    category: "content",
    message: "Placeholder copy (lorem ipsum / TODO) left in the page.",
    test: ({ html }) => /lorem ipsum|placeholder text|todo:/i.test(html)
  }
];

export function assessUiQuality(html, css) {
  const context = { html: String(html ?? ""), css: String(css ?? "") };
  const findings = [];
  let deduction = 0;

  for (const rule of UI_HEURISTICS) {
    let hit = false;
    try {
      hit = Boolean(rule.test(context));
    } catch {
      hit = false;
    }
    if (!hit) continue;
    deduction += rule.weight;
    findings.push({
      id: rule.id,
      severity: rule.severity,
      category: rule.category,
      weight: rule.weight,
      message: rule.message
    });
  }

  return {
    model: "morph.ui-quality.v1",
    score: Math.max(0, 100 - deduction),
    findings,
    summary: {
      total: findings.length,
      high: findings.filter((finding) => finding.severity === "high").length,
      medium: findings.filter((finding) => finding.severity === "medium").length,
      low: findings.filter((finding) => finding.severity === "low").length
    }
  };
}
