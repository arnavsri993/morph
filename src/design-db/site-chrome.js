// Profile-aware page chrome for morph-generated sites.
// Brings morph product polish (aurora backdrops, fade-up motion, mobile nav)
// into transform output — with per-profile atmosphere so every site feels distinct.

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escAttr(value) {
  return esc(value).replace(/"/g, "&quot;");
}

function hashProfileId(id) {
  let hash = 0;
  for (const char of String(id ?? "")) {
    hash = ((hash << 5) - hash) + char.charCodeAt(0);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function resolveNavVariant(patterns = []) {
  const ids = new Set(patterns.map((pattern) => pattern.id));
  if (ids.has("nav-floating-pill")) return "floating";
  if (ids.has("nav-minimal-logo")) return "minimal";
  if (ids.has("nav-split-actions")) return "split-actions";
  if (ids.has("nav-mega-dropdown")) return "mega";
  if (ids.has("nav-command-palette")) return "command";
  return "glass";
}

export function resolveFooterVariant(patterns = []) {
  const ids = new Set(patterns.map((pattern) => pattern.id));
  if (ids.has("footer-minimal-legal")) return "minimal";
  if (ids.has("footer-newsletter")) return "newsletter";
  return "standard";
}

export function profileBrandMark(profile) {
  const hash = hashProfileId(profile.id);
  const shapes = ["rounded", "diamond", "circle", "hex", "square"];
  return shapes[hash % shapes.length];
}

function primaryRgb(profile) {
  const hex = profile.colors?.primary ?? "#5e6ad2";
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return "94, 106, 210";
  return `${parseInt(match[1], 16)}, ${parseInt(match[2], 16)}, ${parseInt(match[3], 16)}`;
}

function accentRgb(profile) {
  const hex = profile.colors?.accent ?? profile.colors?.primary ?? "#3dabb8";
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return "61, 171, 184";
  return `${parseInt(match[1], 16)}, ${parseInt(match[2], 16)}, ${parseInt(match[3], 16)}`;
}

export function profileBackdropStyles(profile, flags = {}) {
  if (!flags.showPageBackdrop) return "";
  const primary = primaryRgb(profile);
  const accent = accentRgb(profile);
  const hash = hashProfileId(profile.id);
  const driftA = 18 + (hash % 12);
  const driftB = 22 + (hash % 16);
  const spotX = 15 + (hash % 55);
  const spotY = 8 + (hash % 28);
  const isDark = profile.mode === "dark";
  const gridLine = isDark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.06)";
  const texture = profile.texture ?? "grid";

  let aurora = `
    .page-backdrop .aurora {
      position: absolute;
      width: 150%;
      height: 150%;
      left: -25%;
      top: -35%;
      background:
        radial-gradient(ellipse 42% 36% at ${spotX}% ${spotY}%, rgba(${primary}, ${isDark ? 0.16 : 0.12}), transparent 72%),
        radial-gradient(ellipse 38% 32% at ${100 - spotX}% ${spotY + 6}%, rgba(${accent}, ${isDark ? 0.1 : 0.08}), transparent 70%);
      animation: backdrop-drift-${hash % 4} ${driftA}s ease-in-out infinite alternate;
    }`;

  let grid = "";
  if (texture === "grid" || texture === "dots") {
    grid = `
    .page-backdrop .grid-bg {
      position: absolute;
      inset: 0;
      background-image: radial-gradient(${gridLine} 1px, transparent 1px);
      background-size: ${texture === "dots" ? "24px 24px" : "32px 32px"};
      mask-image: radial-gradient(ellipse 92% 58% at 50% 0%, black 18%, transparent 80%);
      -webkit-mask-image: radial-gradient(ellipse 92% 58% at 50% 0%, black 18%, transparent 80%);
      opacity: ${isDark ? 0.45 : 0.55};
    }`;
  } else if (texture === "beams") {
    grid = `
    .page-backdrop .grid-bg {
      position: absolute;
      inset: -30% -15% auto;
      height: 130%;
      background: conic-gradient(from ${160 + (hash % 40)}deg at 50% 0%, transparent 38%, ${gridLine} 44%, transparent 50%, ${gridLine} 56%, transparent 62%);
      opacity: ${isDark ? 0.35 : 0.25};
    }`;
  }

  const keyframes = `
    @keyframes backdrop-drift-0 { to { transform: translate3d(2%, 3%, 0) scale(1.04); } }
    @keyframes backdrop-drift-1 { to { transform: translate3d(-2%, 2%, 0) scale(1.06); } }
    @keyframes backdrop-drift-2 { to { transform: translate3d(3%, -2%, 0) scale(1.05); } }
    @keyframes backdrop-drift-3 { to { transform: translate3d(-3%, -2%, 0) scale(1.03); } }`;

  return `
    .page-backdrop {
      position: fixed;
      inset: 0;
      z-index: -1;
      pointer-events: none;
      overflow: hidden;
      background: var(--bg);
    }
    ${aurora}
    ${grid}
    ${keyframes}`;
}

export function profileBackdropHtml() {
  return `<div class="page-backdrop" aria-hidden="true">
    <div class="aurora"></div>
    <div class="grid-bg"></div>
  </div>`;
}

export function heroAnimationStyles(flags = {}) {
  if (!flags.showHeroFadeUp) return "";
  return `
    @keyframes fade-up {
      from { opacity: 0; transform: translateY(18px); }
      to { opacity: 1; transform: none; }
    }
    .fade-up {
      animation: fade-up 0.42s var(--ease-out) both;
    }
    .fade-up-1 { animation-delay: 0.05s; }
    .fade-up-2 { animation-delay: 0.1s; }
    .fade-up-3 { animation-delay: 0.16s; }
    .fade-up-4 { animation-delay: 0.22s; }
    .fade-up-5 { animation-delay: 0.28s; }`;
}

export function navVariantStyles(variant, profile) {
  const mark = profileBrandMark(profile);
  const markStyles = {
    rounded: "border-radius: 8px;",
    diamond: "border-radius: 4px; transform: rotate(45deg); width: 22px; height: 22px;",
    circle: "border-radius: 50%;",
    hex: "border-radius: 4px; clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);",
    square: "border-radius: 2px;"
  };

  let extra = `
    .brand-mark { ${markStyles[mark]} }`;

  if (variant === "floating") {
    extra += `
    .site-nav.nav-floating {
      position: sticky;
      top: 16px;
      z-index: 60;
      background: transparent;
      border: none;
      backdrop-filter: none;
    }
    .site-nav.nav-floating .container {
      margin-top: 12px;
      padding: 10px 18px;
      height: auto;
      min-height: 56px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-pill);
      background: color-mix(in srgb, var(--bg) 82%, transparent);
      backdrop-filter: blur(20px) saturate(1.3);
      box-shadow: var(--shadow-card);
    }`;
  }

  if (variant === "minimal") {
    extra += `
    .site-nav.nav-minimal .nav-links { display: none; }
    .site-nav.nav-minimal .container { justify-content: center; position: relative; }
    .site-nav.nav-minimal .brand { margin-inline: auto; }
    .site-nav.nav-minimal .nav-cta { position: absolute; right: 0; }`;
  }

  if (variant === "split-actions") {
    extra += `
    .site-nav.nav-split .nav-actions {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-left: auto;
    }
    .site-nav.nav-split .nav-secondary {
      font-size: 14px;
      font-weight: 500;
      color: var(--muted);
      padding: 8px 14px;
      border-radius: var(--radius-pill);
      transition: color var(--duration-fast) var(--ease-hover), background var(--duration-fast) var(--ease-hover);
    }
    .site-nav.nav-split .nav-secondary:hover {
      color: var(--ink);
      background: color-mix(in srgb, var(--ink) 7%, transparent);
    }`;
  }

  if (variant === "mega") {
    extra += `
    .site-nav.nav-mega .nav-links a.has-caret::after {
      content: "▾";
      margin-left: 4px;
      font-size: 10px;
      opacity: 0.6;
    }`;
  }

  if (variant === "command") {
    extra += `
    .nav-cmd {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border);
      background: var(--surface);
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--muted);
      margin-right: var(--space-3);
    }
    .nav-cmd kbd {
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid var(--border-strong);
      background: var(--bg-alt);
      font-size: 10px;
    }`;
  }

  return extra;
}

export function mobileNavStyles() {
  return `
    .nav-toggle {
      display: none;
      width: 40px;
      height: 40px;
      place-items: center;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: color-mix(in srgb, var(--surface) 80%, transparent);
      color: var(--ink);
      cursor: pointer;
      margin-left: auto;
    }
    .mobile-menu {
      display: none;
      border-top: 1px solid var(--border);
      background: color-mix(in srgb, var(--bg) 94%, transparent);
      backdrop-filter: blur(20px);
      padding: 12px 24px 20px;
    }
    .mobile-menu a {
      display: block;
      padding: 12px 0;
      border-bottom: 1px solid var(--border);
      font-weight: 500;
      color: var(--ink-secondary);
    }
    .mobile-menu a:hover { color: var(--ink); }
    .mobile-menu .btn { margin-top: 16px; width: 100%; }
    @media (max-width: 768px) {
      .nav-toggle { display: grid; }
      .site-nav .nav-links,
      .site-nav .nav-cta,
      .site-nav .nav-actions,
      .site-nav .nav-cmd { display: none !important; }
      .mobile-menu.open { display: block; }
      .site-nav.nav-minimal .nav-cta { display: none !important; }
      .site-nav.nav-minimal .brand { margin-inline: 0; }
    }`;
}

export function renderSiteNav(content, profile, options = {}) {
  const brand = esc(content.brand || "Product");
  const navLinks = (content.nav ?? []).slice(0, 5);
  const primaryCta = content.hero?.ctas?.[0] ?? { label: "Get started", href: "#" };
  const secondaryCta = content.hero?.ctas?.[1] ?? null;
  const variant = options.navVariant ?? "glass";
  const anim = options.showHeroFadeUp ? "fade-up" : "";
  const navClass = [
    "site-nav",
    variant === "floating" ? "nav-floating" : "",
    variant === "minimal" ? "nav-minimal" : "",
    variant === "split-actions" ? "nav-split" : "",
    variant === "mega" ? "nav-mega" : "",
    variant === "command" ? "nav-command" : ""
  ].filter(Boolean).join(" ");

  const linkItems = navLinks.map((link, index) => {
    const caret = variant === "mega" && index < 2 ? " has-caret" : "";
    return `          <li><a class="${caret.trim()}" href="${escAttr(link.href)}">${esc(link.label)}</a></li>`;
  }).join("\n");

  const navBlock = navLinks.length
    ? `<nav aria-label="Primary">
        <ul class="nav-links">
${linkItems}
        </ul>
      </nav>`
    : "";

  const commandBlock = variant === "command"
    ? `<span class="nav-cmd" aria-hidden="true">Search <kbd>⌘K</kbd></span>`
    : "";

  const actionsBlock = variant === "split-actions"
    ? `<div class="nav-actions">
        ${secondaryCta ? `<a class="nav-secondary" href="${escAttr(secondaryCta.href)}">${esc(secondaryCta.label)}</a>` : ""}
        <a class="btn btn-primary nav-cta" href="${escAttr(primaryCta.href)}">${esc(primaryCta.label)}</a>
      </div>`
    : `<a class="btn btn-primary nav-cta" href="${escAttr(primaryCta.href)}">${esc(primaryCta.label)}</a>`;

  return `  <header class="${navClass}">
    <div class="container ${anim}">
      <a class="brand" href="#"><span class="brand-mark" aria-hidden="true"></span>${brand}</a>
      ${commandBlock}
      ${navBlock}
      ${actionsBlock}
      <button class="nav-toggle" type="button" id="navToggle" aria-label="Open menu" aria-expanded="false" aria-controls="mobileMenu">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      </button>
    </div>
    <div class="mobile-menu" id="mobileMenu">
${navLinks.map((link) => `      <a href="${escAttr(link.href)}">${esc(link.label)}</a>`).join("\n")}
      <a class="btn btn-primary" href="${escAttr(primaryCta.href)}">${esc(primaryCta.label)}</a>
    </div>
  </header>`;
}

export function renderSiteFooter(content, profile, options = {}) {
  const brand = esc(content.brand || "Product");
  const navLinks = (content.nav ?? []).slice(0, 5);
  const variant = options.footerVariant ?? "standard";
  const year = new Date().getFullYear();
  const legal = esc(content.footerText || "All rights reserved.");

  if (variant === "minimal") {
    return `  <footer class="site-footer footer-minimal">
    <div class="container">
      <p class="legal centered">© ${year} ${brand}. ${legal}</p>
    </div>
  </footer>`;
  }

  if (variant === "newsletter") {
    return `  <footer class="site-footer footer-newsletter">
    <div class="container">
      <div class="newsletter-band reveal">
        <div>
          <h3>Stay in the loop</h3>
          <p>Product updates and design notes — no spam.</p>
        </div>
        <form class="newsletter-form" action="#" onsubmit="return false">
          <input type="email" placeholder="you@company.com" aria-label="Email address">
          <button class="btn btn-primary" type="submit">Subscribe</button>
        </form>
      </div>
      <div class="top">
        <a class="brand" href="#"><span class="brand-mark" aria-hidden="true"></span>${brand}</a>
        ${navLinks.length ? `<ul class="footer-links">
${navLinks.map((link) => `          <li><a href="${escAttr(link.href)}">${esc(link.label)}</a></li>`).join("\n")}
        </ul>` : ""}
      </div>
      <p class="legal">© ${year} ${brand}. ${legal}</p>
    </div>
  </footer>`;
  }

  return `  <footer class="site-footer">
    <div class="container">
      <div class="top">
        <a class="brand" href="#"><span class="brand-mark" aria-hidden="true"></span>${brand}</a>
        ${navLinks.length ? `<ul class="footer-links">
${navLinks.map((link) => `          <li><a href="${escAttr(link.href)}">${esc(link.label)}</a></li>`).join("\n")}
        </ul>` : ""}
      </div>
      <p class="legal">© ${year} ${brand}. ${legal}</p>
    </div>
  </footer>`;
}

export function footerVariantStyles() {
  return `
    .footer-minimal { text-align: center; padding: var(--space-7) 0; }
    .footer-minimal .legal.centered { border: none; padding-top: 0; }
    .footer-newsletter .newsletter-band {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: var(--space-5);
      align-items: center;
      padding: var(--space-6);
      margin-bottom: var(--space-7);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border);
      background: var(--surface);
    }
    .footer-newsletter h3 {
      font-family: var(--font-display);
      font-size: 20px;
      font-weight: 600;
      margin-bottom: var(--space-2);
    }
    .footer-newsletter p { color: var(--muted); font-size: 15px; }
    .newsletter-form {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
    }
    .newsletter-form input {
      flex: 1;
      min-width: 200px;
      padding: 12px 16px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-strong);
      background: var(--bg-alt);
      color: var(--ink);
      font: inherit;
      font-size: 14px;
    }`;
}

export function spotlightStyles() {
  return `
    .spotlight-target::before {
      content: "";
      position: absolute;
      inset: 0;
      background: radial-gradient(520px circle at var(--spot-x, 50%) var(--spot-y, 0%), rgba(var(--spot-rgb, 94, 106, 210), 0.1), transparent 52%);
      pointer-events: none;
      z-index: 0;
      opacity: 0;
      transition: opacity var(--duration-ui) var(--ease-out);
    }
    .spotlight-target:hover::before,
    .spotlight-target:focus-within::before { opacity: 1; }`;
}

export function pageScripts(flags = {}, profile = {}) {
  const primary = primaryRgb(profile);
  const parts = [
    `(function () {
      var toggle = document.getElementById("navToggle");
      var menu = document.getElementById("mobileMenu");
      if (toggle && menu) {
        toggle.addEventListener("click", function () {
          var open = menu.classList.toggle("open");
          toggle.setAttribute("aria-expanded", open ? "true" : "false");
        });
        menu.addEventListener("click", function (e) {
          if (e.target && e.target.tagName === "A") {
            menu.classList.remove("open");
            toggle.setAttribute("aria-expanded", "false");
          }
        });
      }`
  ];

  if (flags.showScrollReveal) {
    parts.push(`
      var revealEnabled = true;
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        var observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("in");
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.12 });
        document.querySelectorAll(".reveal").forEach(function (el) { observer.observe(el); });
      } else {
        document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
      }`);
  } else {
    parts.push(`document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });`);
  }

  if (flags.showSpotlight) {
    parts.push(`
      document.documentElement.style.setProperty("--spot-rgb", "${primary}");
      document.querySelectorAll(".spotlight-target").forEach(function (el) {
        el.addEventListener("pointermove", function (e) {
          var rect = el.getBoundingClientRect();
          var x = ((e.clientX - rect.left) / rect.width) * 100;
          var y = ((e.clientY - rect.top) / rect.height) * 100;
          el.style.setProperty("--spot-x", x + "%");
          el.style.setProperty("--spot-y", y + "%");
        });
      });`);
  }

  parts.push(`})();`);
  return parts.join("\n");
}
