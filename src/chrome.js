// Shared morph product chrome — tokens and primitives from the aurora-dark design profile.
// Keeps landing, Studio, auth, and billing on one design system (the same corpus we use for transforms).

import { getProfile } from "./design-db/profiles.js";

const profile = getProfile("aurora-dark");
const { colors, radius, fonts } = profile;

export const CHROME_THEME_COLOR = colors.bg;
export const CHROME_HEADER_BG = colors.bg;

/** Unified :root tokens. Pass extra declarations for page-specific overrides. */
export function chromeTokens(extra = "") {
  return `
    :root {
      color-scheme: dark;
      --bg: ${colors.bg};
      --bg-alt: ${colors.bgAlt};
      --bg-subtle: ${colors.bgAlt};
      --bg-elevated: ${colors.surfaceRaised};
      --surface: rgba(24, 24, 27, 0.72);
      --surface-solid: ${colors.surface};
      --surface-raised: ${colors.surfaceRaised};
      --surface-elevated: ${colors.surfaceRaised};
      --surface-hover: rgba(255, 255, 255, 0.05);
      --border: ${colors.border};
      --border-strong: ${colors.borderStrong};
      --line: ${colors.border};
      --line-strong: ${colors.borderStrong};
      --ink: ${colors.ink};
      --text: ${colors.ink};
      --ink-secondary: ${colors.inkSecondary};
      --muted: ${colors.muted};
      --faint: #71717a;
      --brand: ${colors.primary};
      --brand-a: ${colors.primary};
      --brand-b: #a78bfa;
      --brand-c: #6366f1;
      --brand-2: #a78bfa;
      --cyan: ${colors.accent};
      --primary: ${colors.primary};
      --focus: ${colors.focus};
      --ok: #4ade80;
      --ok-dim: rgba(74, 222, 128, 0.12);
      --bad: #f87171;
      --bad-dim: rgba(248, 113, 113, 0.12);
      --warn: #fbbf24;
      --warn-dim: rgba(251, 191, 36, 0.12);
      --font: ${fonts.bodyStack};
      --mono: ${fonts.monoStack};
      --radius: ${radius.lg};
      --radius-sm: ${radius.sm};
      --radius-xs: 6px;
      --radius-md: ${radius.md};
      --max: 1080px;
      --container: 1120px;
      --ease: cubic-bezier(0.16, 1, 0.3, 1);
      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.32), 0 0 0 1px rgba(255, 255, 255, 0.04);
      --shadow-md: 0 8px 32px -8px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.05);
      --shadow-lg: 0 24px 64px -16px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.06);
      --shadow-xl: 0 48px 120px -48px rgba(0, 0, 0, 0.92), 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
      --page-pad: clamp(20px, 3vw, 40px);
      --section-gap: clamp(48px, 5vw, 72px);
      ${extra}
    }`;
}

/** Base document reset shared across product pages. */
export function chromeReset(options = {}) {
  const bodyExtra = options.centered
    ? `
      min-height: 100vh;
      min-height: 100dvh;
      display: grid;
      place-items: center;
      padding: clamp(20px, 5vw, 48px);`
    : "";
  const fontSize = options.fontSize ?? "16px";
  return `
    *, *::before, *::after { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      min-width: 320px;
      background: var(--bg);
      color: var(--ink);
      font-family: var(--font);
      font-size: ${fontSize};
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      overflow-x: hidden;${bodyExtra}
    }
    ::selection { background: rgba(124, 124, 248, 0.35); color: #fff; }
    :focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: 3px;
      border-radius: var(--radius-xs);
    }
    a { color: inherit; text-decoration: none; }
    code { font-family: var(--mono); font-size: 0.9em; color: var(--cyan); }`;
}

/** Aurora + dot-grid backdrop used on marketing and app surfaces. */
export function backdropStyles() {
  return `
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: -1;
      pointer-events: none;
      overflow: hidden;
    }
    .aurora {
      position: absolute;
      width: 140%;
      height: 140%;
      left: -20%;
      top: -30%;
      background:
        radial-gradient(ellipse 40% 35% at 20% 20%, rgba(124, 124, 248, 0.2), transparent 70%),
        radial-gradient(ellipse 35% 30% at 80% 10%, rgba(167, 139, 250, 0.14), transparent 70%),
        radial-gradient(ellipse 30% 25% at 60% 80%, rgba(34, 211, 238, 0.07), transparent 70%);
      animation: aurora-drift 20s ease-in-out infinite alternate;
    }
    @keyframes aurora-drift {
      to { transform: translate3d(2%, 3%, 0) scale(1.05); }
    }
    .grid-bg {
      position: absolute;
      inset: 0;
      background-image: radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px);
      background-size: 32px 32px;
      mask-image: radial-gradient(ellipse 90% 55% at 50% 0%, black 15%, transparent 78%);
      -webkit-mask-image: radial-gradient(ellipse 90% 55% at 50% 0%, black 15%, transparent 78%);
      opacity: 0.4;
    }`;
}

export function backdropHtml() {
  return `<div class="backdrop" aria-hidden="true">
    <div class="aurora"></div>
    <div class="grid-bg"></div>
  </div>`;
}

/** Shared pill buttons — landing, Studio, auth, billing. */
export function buttonStyles() {
  return `
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 44px;
      padding: 0 22px;
      border-radius: 999px;
      border: 1px solid transparent;
      font: inherit;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: transform 0.18s var(--ease), box-shadow 0.18s, background 0.18s, border-color 0.18s;
    }
    .btn svg { flex: none; transition: transform 0.18s var(--ease); }
    .btn-primary {
      color: #fff;
      background: linear-gradient(135deg, var(--brand-a), var(--brand-b));
      box-shadow: 0 0 32px -8px rgba(124, 124, 248, 0.65);
    }
    .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 28px -4px rgba(124, 124, 248, 0.7);
    }
    .btn-primary:hover svg { transform: translateX(2px); }
    .btn-primary:active { transform: translateY(0); }
    .btn-ghost {
      color: var(--ink);
      background: rgba(255, 255, 255, 0.04);
      border-color: var(--border-strong);
    }
    .btn-ghost:hover {
      background: rgba(255, 255, 255, 0.08);
      transform: translateY(-1px);
    }
    .btn-ghost:active { transform: translateY(0); }
    .btn-lg { min-height: 48px; padding: 0 26px; font-size: 15px; }`;
}

/** Content shell + site nav chrome. */
export function shellStyles() {
  return `
    .shell {
      width: min(var(--max), calc(100vw - 48px));
      margin: 0 auto;
    }
    .nav-links { display: flex; align-items: center; gap: 2px; }
    .nav-link {
      color: var(--muted);
      font-size: 14px;
      font-weight: 500;
      padding: 8px 14px;
      border-radius: 999px;
      transition: color 0.18s, background 0.18s;
    }
    .nav-link:hover { color: var(--ink); background: rgba(255, 255, 255, 0.05); }
    .nav-link.active {
      color: var(--ink);
      background: rgba(124, 124, 248, 0.12);
      box-shadow: inset 0 0 0 1px rgba(124, 124, 248, 0.22);
    }
    .nav-actions { display: flex; align-items: center; gap: 10px; }
    .nav-toggle {
      display: none;
      width: 40px;
      height: 40px;
      place-items: center;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: rgba(255, 255, 255, 0.04);
      color: var(--ink);
      cursor: pointer;
    }
    .mobile-menu {
      display: none;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      background: var(--bg);
      backdrop-filter: blur(20px);
      padding: 12px 24px 20px;
    }
    .mobile-menu a {
      display: block;
      padding: 12px 0;
      border-bottom: 1px solid var(--border);
      font-weight: 500;
    }
    .mobile-menu .btn { margin-top: 16px; width: 100%; }
    @media (max-width: 768px) {
      .shell { width: min(var(--max), calc(100vw - 32px)); }
      .nav-links,
      .nav-actions .nav-link,
      .nav-actions .btn:not(.nav-toggle),
      .nav-right .top-link,
      .nav-right .user-chip { display: none; }
      .nav-toggle { display: grid; }
      .mobile-menu.open { display: block; }
    }`;
}

/** Inline script for mobile nav toggle — pass menu and toggle element ids. */
export function mobileNavScript({ toggleId = "navToggle", menuId = "mobileMenu" } = {}) {
  return `
      var toggle = document.getElementById("${toggleId}");
      var menu = document.getElementById("${menuId}");
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
      }`;
}

export function reducedMotionStyles(extra = "") {
  return `
    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto; }
      *, *::before, *::after { animation: none !important; transition-duration: 0.01ms !important; }
      ${extra}
    }`;
}
