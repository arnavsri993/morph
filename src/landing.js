const REPO_URL = "https://github.com/arnavsri993/morph";

export function landingHtml(config, session) {
  const projectName = escapeHtml(config.projectName ?? "Acme Control Plane");
  const sessionLabel = session ? escapeHtml(session.name || session.email) : null;
  const sessionBlock = sessionLabel
    ? `<a class="login-link" href="/studio" title="Open Studio">${sessionLabel}</a>`
    : `<a class="login-link" href="/login?returnTo=%2Fstudio">Log in</a>`;
  const mobileSessionBlock = sessionLabel
    ? `<a href="/studio">${sessionLabel}</a>`
    : `<a href="/login?returnTo=%2Fstudio">Log in</a>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Morph - CI for agent-written frontend</title>
  <meta name="description" content="Morph catches design-system drift in AI-generated frontend, explains every violation, and emits deterministic repair patches before a PR reaches human review.">
  <meta property="og:title" content="Morph - CI for agent-written frontend">
  <meta property="og:description" content="AI writes the UI. Morph makes it belong. A CI gate for AI-generated frontend drift, deterministic repairs, and merge-ready receipts.">
  <meta property="og:type" content="website">
  <meta name="theme-color" content="#050611">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      color-scheme: dark;
      --bg: #050611;
      --surface: rgba(12, 15, 28, 0.86);
      --surface-strong: #0f1424;
      --surface-muted: rgba(15, 20, 36, 0.72);
      --text: #f1f5f9;
      --muted: #9ba8bc;
      --dim: #6b7a90;
      --purple: #7c3aed;
      --violet: #a78bfa;
      --cyan: #22d3ee;
      --red: #f87171;
      --orange: #fb923c;
      --green: #4ade80;
      --grid: rgba(167, 139, 250, 0.11);
      --border: rgba(255, 255, 255, 0.1);
      --border-strong: rgba(255, 255, 255, 0.18);
      --shadow: rgba(0, 0, 0, 0.62);
      --radius-sm: 6px;
      --radius: 10px;
      --radius-lg: 14px;
      --radius-xl: 18px;
      --space-1: 4px;
      --space-2: 8px;
      --space-3: 12px;
      --space-4: 16px;
      --space-5: 20px;
      --space-6: 24px;
      --space-8: 32px;
      --space-10: 40px;
      --space-12: 48px;
      --space-16: 64px;
      --space-20: 80px;
      --space-24: 96px;
      --section-y: clamp(72px, 9vw, 120px);
      --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
      --font: "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    }

    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      min-width: 320px;
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      font-size: 16px;
      line-height: 1.62;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      overflow-x: hidden;
    }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      z-index: -3;
      background:
        radial-gradient(ellipse 80% 50% at 10% -4%, rgba(124, 58, 237, 0.32), transparent 58%),
        radial-gradient(ellipse 56% 42% at 92% 8%, rgba(34, 211, 238, 0.14), transparent 56%),
        radial-gradient(ellipse 48% 38% at 78% 92%, rgba(74, 222, 128, 0.09), transparent 64%),
        radial-gradient(ellipse 40% 34% at 4% 78%, rgba(251, 146, 60, 0.08), transparent 58%),
        var(--bg);
    }
    body::after {
      content: "";
      position: fixed;
      inset: 0;
      z-index: -2;
      pointer-events: none;
      background: radial-gradient(ellipse 60% 40% at 50% 0%, rgba(124, 58, 237, 0.06), transparent 70%);
    }
    ::selection { background: rgba(34, 211, 238, 0.28); }
    :focus-visible {
      outline: 2px solid var(--cyan);
      outline-offset: 3px;
      border-radius: var(--radius-sm);
    }
    a { color: inherit; }
    code, pre, .mono { font-family: var(--mono); }
    .skip {
      position: absolute;
      left: -9999px;
      top: 0;
      z-index: 200;
      padding: 10px 16px;
      background: var(--cyan);
      color: #031018;
      font-weight: 800;
      text-decoration: none;
    }
    .skip:focus { left: 0; }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    .shell {
      width: min(1180px, calc(100vw - var(--space-12)));
      margin: 0 auto;
    }

    .ambient {
      position: fixed;
      inset: 0;
      z-index: -2;
      overflow: hidden;
      pointer-events: none;
    }
    .ambient::before {
      content: "";
      position: absolute;
      inset: -2px;
      background-image:
        linear-gradient(var(--grid) 1px, transparent 1px),
        linear-gradient(90deg, var(--grid) 1px, transparent 1px);
      background-size: 44px 44px;
      mask-image: linear-gradient(to bottom, black, rgba(0, 0, 0, 0.86) 56%, transparent 100%);
      -webkit-mask-image: linear-gradient(to bottom, black, rgba(0, 0, 0, 0.86) 56%, transparent 100%);
      opacity: 0.7;
    }
    .ambient::after {
      content: "";
      position: absolute;
      inset: 0;
      opacity: 0.42;
      mix-blend-mode: screen;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.045 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");
    }
    .ambient-fragment {
      position: absolute;
      font-family: var(--mono);
      font-size: 11px;
      opacity: 0.42;
      color: rgba(248, 250, 252, 0.36);
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(15, 18, 32, 0.42);
      border-radius: var(--radius-sm);
      padding: 5px 8px;
      filter: blur(0.1px);
      animation: ambient-float 16s ease-in-out infinite alternate;
    }
    .ambient-fragment.drift {
      color: rgba(249, 115, 22, 0.72);
      border-color: rgba(249, 115, 22, 0.18);
      box-shadow: 0 0 24px rgba(239, 68, 68, 0.08);
    }
    .ambient-fragment.clean {
      color: rgba(34, 211, 238, 0.72);
      border-color: rgba(34, 211, 238, 0.16);
      box-shadow: 0 0 24px rgba(34, 197, 94, 0.08);
    }
    .ambient-fragment:nth-child(1) { left: -4%; top: 66%; animation-delay: -4s; }
    .ambient-fragment:nth-child(2) { left: 2%; top: 82%; animation-delay: -8s; }
    .ambient-fragment:nth-child(3) { left: -3%; top: 92%; animation-delay: -2s; }
    .ambient-fragment:nth-child(4) { right: 7%; top: 19%; animation-delay: -5s; }
    .ambient-fragment:nth-child(5) { right: 2%; top: 58%; animation-delay: -11s; }
    .ambient-fragment:nth-child(6) { right: 11%; top: 82%; animation-delay: -7s; }
    @keyframes ambient-float {
      from { transform: translate3d(0, 0, 0); opacity: 0.42; }
      to { transform: translate3d(0, -14px, 0); opacity: 0.72; }
    }
    @keyframes hero-atmosphere {
      0%, 100% { opacity: 0.85; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.02); }
    }
    @media (prefers-reduced-motion: no-preference) {
      body::after {
        animation: hero-atmosphere 18s ease-in-out infinite;
      }
    }

    .site-header {
      position: fixed;
      inset: 0 0 auto;
      z-index: 60;
      border-bottom: 1px solid transparent;
      transition: background 0.25s var(--ease-out), border-color 0.25s var(--ease-out), box-shadow 0.25s var(--ease-out);
    }
    .site-header.scrolled {
      background: rgba(5, 6, 17, 0.82);
      border-bottom-color: var(--border);
      box-shadow: 0 1px 0 rgba(255, 255, 255, 0.04), 0 20px 60px -32px rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(20px) saturate(1.35);
      -webkit-backdrop-filter: blur(20px) saturate(1.35);
    }
    .nav-bar {
      min-height: 68px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-5);
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--text);
      text-decoration: none;
      font-weight: 800;
      letter-spacing: 0;
    }
    .mark {
      width: 32px;
      height: 32px;
      display: grid;
      place-items: center;
      border-radius: var(--radius);
      color: var(--text);
      background:
        linear-gradient(135deg, rgba(124, 58, 237, 0.95), rgba(34, 211, 238, 0.78)),
        var(--surface-strong);
      border: 1px solid rgba(255, 255, 255, 0.16);
      box-shadow: 0 0 32px rgba(124, 58, 237, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.12);
      font-family: var(--mono);
      font-size: 15px;
      transition: box-shadow 0.2s var(--ease-out), transform 0.2s var(--ease-out);
    }
    .brand:hover .mark {
      box-shadow: 0 0 40px rgba(124, 58, 237, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.16);
      transform: translateY(-1px);
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .nav-links a,
    .login-link {
      color: var(--muted);
      text-decoration: none;
      font-size: 13.5px;
      font-weight: 650;
      padding: var(--space-2) 11px;
      border-radius: var(--radius-sm);
      transition: color 0.18s var(--ease-out), background 0.18s var(--ease-out);
      white-space: nowrap;
    }
    .nav-links a:hover,
    .login-link:hover {
      color: var(--text);
      background: rgba(255, 255, 255, 0.06);
    }
    .nav-links a:focus-visible,
    .login-link:focus-visible {
      color: var(--text);
      background: rgba(255, 255, 255, 0.08);
    }
    .nav-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .nav-toggle {
      display: none;
      width: 40px;
      height: 40px;
      place-items: center;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: rgba(255, 255, 255, 0.04);
      color: var(--text);
      cursor: pointer;
      transition: background 0.18s var(--ease-out), border-color 0.18s var(--ease-out);
    }
    .nav-toggle:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: var(--border-strong);
    }
    .nav-toggle:focus-visible {
      outline: 2px solid var(--cyan);
      outline-offset: 3px;
    }
    .mobile-menu {
      display: none;
      border-top: 1px solid var(--border);
      background: rgba(5, 6, 17, 0.96);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      padding: var(--space-3) var(--space-5) var(--space-5);
    }
    .mobile-menu a {
      display: block;
      color: var(--text);
      text-decoration: none;
      padding: 12px 2px;
      border-bottom: 1px solid var(--border);
      font-weight: 650;
    }
    .mobile-menu .btn { margin-top: 14px; width: 100%; }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 9px;
      min-height: 42px;
      padding: 0 18px;
      border-radius: var(--radius);
      border: 1px solid transparent;
      font: inherit;
      font-size: 14px;
      font-weight: 750;
      letter-spacing: -0.01em;
      text-decoration: none;
      cursor: pointer;
      white-space: nowrap;
      position: relative;
      isolation: isolate;
      transition:
        transform 0.18s var(--ease-out),
        box-shadow 0.18s var(--ease-out),
        border-color 0.18s var(--ease-out),
        background 0.18s var(--ease-out),
        color 0.18s var(--ease-out);
    }
    .btn svg { flex: none; transition: transform 0.18s var(--ease-out); }
    .btn-primary {
      color: #ffffff;
      background:
        linear-gradient(135deg, rgba(124, 58, 237, 0.98) 0%, rgba(99, 102, 241, 0.92) 48%, rgba(34, 211, 238, 0.76) 100%),
        var(--purple);
      border-color: rgba(255, 255, 255, 0.2);
      box-shadow:
        0 0 0 1px rgba(124, 58, 237, 0.24),
        0 0 36px rgba(124, 58, 237, 0.26),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
    }
    .btn-secondary {
      color: var(--text);
      background: rgba(255, 255, 255, 0.045);
      border-color: var(--border);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07);
    }
    .btn-green {
      color: #eafff1;
      background: rgba(74, 222, 128, 0.12);
      border-color: rgba(74, 222, 128, 0.34);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
    }
    @media (hover: hover) {
      .btn:hover { transform: translateY(-1px); }
      .btn-primary:hover {
        border-color: rgba(255, 255, 255, 0.28);
        box-shadow:
          0 0 0 1px rgba(124, 58, 237, 0.32),
          0 0 52px rgba(124, 58, 237, 0.34),
          0 12px 32px -12px rgba(34, 211, 238, 0.22),
          inset 0 1px 0 rgba(255, 255, 255, 0.24);
      }
      .btn-primary:hover svg { transform: translateX(2px); }
      .btn-secondary:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: var(--border-strong);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 8px 24px -12px rgba(0, 0, 0, 0.5);
      }
      .btn-green:hover {
        background: rgba(74, 222, 128, 0.18);
        border-color: rgba(74, 222, 128, 0.48);
        box-shadow: 0 0 32px rgba(74, 222, 128, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      }
    }
    .btn:active { transform: translateY(0); transition-duration: 0.08s; }
    .btn:focus-visible {
      outline: 2px solid var(--cyan);
      outline-offset: 3px;
    }
    .btn-lg {
      min-height: 50px;
      padding: 0 24px;
      font-size: 15px;
      border-radius: var(--radius-lg);
    }

    main { position: relative; }
    section { position: relative; }
    .section { padding: var(--section-y) 0; }
    .section-compact { padding: calc(var(--section-y) * 0.78) 0; }
    .section-head {
      max-width: 720px;
      margin-bottom: var(--space-12);
    }
    .kicker {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      margin-bottom: 12px;
      color: var(--cyan);
      font-family: var(--mono);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .kicker::before {
      content: "";
      width: 28px;
      height: 1px;
      background: linear-gradient(90deg, var(--purple), var(--cyan));
    }
    h1, h2, h3, p { margin-top: 0; }
    h1 {
      margin-bottom: var(--space-6);
      max-width: 14ch;
      font-size: clamp(2.35rem, 5.4vw, 4.125rem);
      line-height: 1.04;
      letter-spacing: -0.028em;
      font-weight: 800;
    }
    h2 {
      margin-bottom: var(--space-3);
      font-size: clamp(1.85rem, 4vw, 3.125rem);
      line-height: 1.06;
      letter-spacing: -0.022em;
      font-weight: 800;
    }
    h3 {
      margin-bottom: var(--space-2);
      font-size: 17px;
      line-height: 1.3;
      font-weight: 760;
      letter-spacing: -0.012em;
    }
    .muted { color: var(--muted); }
    .section-head p,
    .lede {
      color: var(--muted);
      font-size: 17px;
      line-height: 1.72;
      max-width: 62ch;
    }
    .section-head p { margin-bottom: 0; }
    .lede {
      margin-bottom: var(--space-8);
    }
    .lede strong,
    .text-strong { color: var(--text); font-weight: 700; }
    .text-gradient {
      color: transparent;
      background: linear-gradient(100deg, #ffffff 0%, var(--cyan) 38%, var(--violet) 82%);
      -webkit-background-clip: text;
      background-clip: text;
    }

    .hero {
      padding: calc(68px + var(--space-16)) 0 var(--space-20);
      min-height: 100svh;
      display: grid;
      align-items: center;
      gap: var(--space-12);
    }
    .hero-layout {
      display: grid;
      grid-template-columns: minmax(0, 0.88fr) minmax(380px, 1.12fr);
      gap: clamp(var(--space-8), 5vw, var(--space-16));
      align-items: center;
    }
    .hero-copy {
      position: relative;
      z-index: 2;
    }
    .hero-copy::before {
      content: "";
      position: absolute;
      top: -10%;
      left: -8%;
      width: min(520px, 90%);
      height: min(420px, 70%);
      background: radial-gradient(ellipse at center, rgba(124, 58, 237, 0.18), transparent 68%);
      filter: blur(40px);
      pointer-events: none;
      z-index: -1;
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin-bottom: var(--space-5);
      padding: 7px 12px 7px 7px;
      border: 1px solid rgba(167, 139, 250, 0.22);
      border-radius: 999px;
      background: rgba(12, 15, 28, 0.72);
      color: var(--muted);
      font-family: var(--mono);
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 0 48px rgba(124, 58, 237, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.04);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    .eyebrow span:first-child {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 999px;
      color: var(--green);
      background: rgba(34, 197, 94, 0.12);
      border: 1px solid rgba(34, 197, 94, 0.3);
    }
    .cta-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-3);
      margin-bottom: var(--space-8);
    }
    .signal-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-3);
      max-width: 680px;
    }
    .signal {
      min-height: 84px;
      padding: var(--space-4) var(--space-4);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      background: rgba(12, 15, 28, 0.62);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
      transition: border-color 0.2s var(--ease-out), transform 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
    }
    @media (hover: hover) {
      .signal:hover {
        border-color: var(--border-strong);
        transform: translateY(-2px);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 16px 40px -24px rgba(0, 0, 0, 0.6);
      }
    }
    .signal b {
      display: block;
      color: var(--text);
      font-family: var(--mono);
      font-size: 18px;
      line-height: 1.2;
      margin-bottom: 5px;
    }
    .signal span {
      display: block;
      color: var(--muted);
      font-size: 12.5px;
      line-height: 1.35;
    }

    .scanner-stage {
      position: relative;
      min-height: 620px;
    }
    .scanner-panel {
      position: relative;
      overflow: hidden;
      min-height: 560px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: var(--radius-lg);
      background:
        linear-gradient(90deg, rgba(248, 113, 113, 0.07), transparent 36%, rgba(74, 222, 128, 0.07)),
        linear-gradient(180deg, rgba(15, 20, 36, 0.94), rgba(5, 6, 17, 0.9));
      box-shadow:
        0 48px 120px -42px var(--shadow),
        0 0 100px -48px rgba(124, 58, 237, 0.85),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
      isolation: isolate;
    }
    .scanner-panel::before {
      content: "";
      position: absolute;
      inset: 0;
      z-index: -1;
      background-image:
        linear-gradient(rgba(167, 139, 250, 0.12) 1px, transparent 1px),
        linear-gradient(90deg, rgba(167, 139, 250, 0.12) 1px, transparent 1px);
      background-size: 32px 32px;
      mask-image: linear-gradient(90deg, rgba(0, 0, 0, 0.38), black 42%, black 58%, rgba(0, 0, 0, 0.38));
      -webkit-mask-image: linear-gradient(90deg, rgba(0, 0, 0, 0.38), black 42%, black 58%, rgba(0, 0, 0, 0.38));
    }
    .scanner-panel::after {
      content: "";
      position: absolute;
      top: 0;
      bottom: 0;
      left: -24%;
      width: 22%;
      background:
        linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.13), rgba(167, 139, 250, 0.28), rgba(34, 211, 238, 0.13), transparent);
      filter: blur(1px);
      animation: scanner-sweep 5.6s ease-in-out infinite;
    }
    @keyframes scanner-sweep {
      0%, 12% { transform: translateX(0); opacity: 0; }
      24% { opacity: 1; }
      66% { opacity: 1; }
      82%, 100% { transform: translateX(690%); opacity: 0; }
    }
    .panel-chrome {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.035);
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
    }
    .chrome-dots {
      display: flex;
      gap: 7px;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: var(--dim);
    }
    .dot.red { background: var(--red); }
    .dot.orange { background: var(--orange); }
    .dot.green { background: var(--green); }
    .panel-body { padding: 16px; }
    .status-strip {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      gap: 10px;
      align-items: stretch;
      margin-bottom: 14px;
    }
    .score-card {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: rgba(5, 6, 17, 0.72);
      padding: 13px;
      min-height: 106px;
      position: relative;
      overflow: hidden;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    }
    .score-card.fail { border-color: rgba(239, 68, 68, 0.3); }
    .score-card.pass {
      border-color: rgba(34, 197, 94, 0.36);
      animation: repaired-pulse 3.8s ease-in-out infinite;
    }
    @keyframes repaired-pulse {
      0%, 100% { box-shadow: 0 0 0 rgba(34, 197, 94, 0); }
      50% { box-shadow: 0 0 36px rgba(34, 197, 94, 0.18); }
    }
    .score-label {
      color: var(--muted);
      font-family: var(--mono);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }
    .score-value {
      margin-top: 12px;
      font-family: var(--mono);
      font-size: clamp(26px, 4vw, 35px);
      line-height: 0.95;
      font-weight: 800;
      letter-spacing: -0.04em;
    }
    .score-card.fail .score-value { color: var(--red); }
    .score-card.pass .score-value { color: var(--green); }
    .score-note {
      margin-top: 8px;
      color: var(--dim);
      font-size: 11px;
    }
    .repair-bridge {
      width: 92px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(34, 211, 238, 0.22);
      border-radius: var(--radius);
      background: rgba(34, 211, 238, 0.06);
      color: var(--cyan);
      font-family: var(--mono);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      text-align: center;
    }
    .repair-bridge svg { margin-bottom: 6px; filter: drop-shadow(0 0 10px rgba(34, 211, 238, 0.55)); }
    .big-score {
      margin: 12px 0;
      padding: 16px 14px;
      border: 1px solid rgba(167, 139, 250, 0.22);
      border-radius: var(--radius);
      background:
        linear-gradient(90deg, rgba(239, 68, 68, 0.09), transparent 42%, rgba(34, 197, 94, 0.1)),
        rgba(15, 18, 32, 0.66);
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .big-score > span {
      display: block;
      color: var(--muted);
      font-family: var(--mono);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .big-score strong {
      display: block;
      margin-top: 6px;
      font-family: var(--mono);
      font-size: clamp(48px, 8vw, 76px);
      line-height: 0.94;
      letter-spacing: -0.07em;
      text-shadow: 0 0 34px rgba(34, 211, 238, 0.2);
      white-space: nowrap;
    }
    .big-score strong span { display: inline; }
    .big-score .fail-num { color: var(--red); }
    .big-score .pass-num { color: var(--green); }
    .repair-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 12px;
    }
    .token-stack {
      display: grid;
      gap: 7px;
      min-width: 0;
    }
    .token-chip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-height: 30px;
      padding: 5px 8px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: rgba(6, 7, 18, 0.62);
      color: var(--muted);
      font-family: var(--mono);
      font-size: 10.5px;
      line-height: 1.35;
      animation: chip-snap 5.8s ease-in-out infinite;
    }
    .token-chip:nth-child(2) { animation-delay: -0.8s; }
    .token-chip:nth-child(3) { animation-delay: -1.5s; }
    .token-chip:nth-child(4) { animation-delay: -2.4s; }
    @keyframes chip-snap {
      0%, 64%, 100% { transform: translateY(0); }
      70% { transform: translateY(-4px); }
      76% { transform: translateY(0); }
    }
    .token-chip .bad { color: var(--orange); }
    .token-chip .good { color: var(--green); }
    .token-chip.clean {
      border-color: rgba(34, 197, 94, 0.24);
      background: rgba(34, 197, 94, 0.06);
    }
    .gate-state {
      grid-column: 1 / -1;
      border: 1px solid rgba(34, 197, 94, 0.35);
      border-radius: var(--radius);
      background:
        linear-gradient(90deg, rgba(34, 197, 94, 0.08), rgba(34, 211, 238, 0.06)),
        rgba(6, 7, 18, 0.7);
      padding: 10px;
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 12px;
      align-items: center;
      color: var(--green);
      font-family: var(--mono);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .gate-bars {
      width: 56px;
      height: 30px;
      border: 1px solid rgba(34, 197, 94, 0.32);
      border-radius: var(--radius-sm);
      position: relative;
      overflow: hidden;
    }
    .gate-bars::before,
    .gate-bars::after {
      content: "";
      position: absolute;
      top: 0;
      width: 50%;
      height: 100%;
      background: rgba(34, 197, 94, 0.16);
      animation: gate-open 4.8s ease-in-out infinite;
    }
    .gate-bars::before { left: 0; border-right: 1px solid rgba(34, 197, 94, 0.26); }
    .gate-bars::after { right: 0; border-left: 1px solid rgba(34, 197, 94, 0.26); }
    @keyframes gate-open {
      0%, 28% { transform: translateX(0); }
      48%, 100% { transform: translateX(var(--gate-x, 0)); }
    }
    .gate-bars::before { --gate-x: -72%; }
    .gate-bars::after { --gate-x: 72%; }
    .gate-state small {
      color: rgba(248, 250, 252, 0.62);
      font-size: 11px;
      text-transform: none;
      letter-spacing: 0;
      font-weight: 600;
    }
    .hero-float {
      position: absolute;
      z-index: 3;
      max-width: 290px;
      padding: 9px 10px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: var(--radius-sm);
      background: rgba(6, 7, 18, 0.82);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      box-shadow: 0 18px 48px -28px black;
      color: var(--muted);
      font-family: var(--mono);
      font-size: 11px;
      line-height: 1.35;
      white-space: nowrap;
      animation: float-chip 8s ease-in-out infinite alternate;
    }
    .hero-float .bad { color: var(--orange); }
    .hero-float .good { color: var(--cyan); }
    .float-a { top: 48px; left: -18px; animation-delay: -1s; }
    .float-b { top: 34px; right: 18px; animation-delay: -3s; }
    .float-c { bottom: 112px; left: -30px; animation-delay: -5s; }
    .float-d { bottom: 34px; right: 18px; animation-delay: -6.8s; }
    @keyframes float-chip {
      to { transform: translate3d(0, -12px, 0); }
    }

    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(167, 139, 250, 0.22) 20%, rgba(34, 211, 238, 0.16) 50%, rgba(167, 139, 250, 0.22) 80%, transparent);
      opacity: 0.9;
    }

    .matrix {
      display: grid;
      gap: 16px;
    }
    .drift-row {
      display: grid;
      grid-template-columns: minmax(0, 0.9fr) minmax(140px, 0.22fr) minmax(0, 1fr);
      gap: 16px;
      align-items: stretch;
    }
    .drift-cell {
      min-width: 0;
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      background: var(--surface);
      padding: var(--space-4);
      position: relative;
      overflow: hidden;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
      transition: border-color 0.2s var(--ease-out), transform 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
    }
    .drift-cell.problem {
      border-color: rgba(239, 68, 68, 0.24);
      background:
        linear-gradient(90deg, rgba(239, 68, 68, 0.08), transparent),
        var(--surface);
    }
    .drift-cell.repair {
      border-color: rgba(34, 197, 94, 0.24);
      background:
        linear-gradient(90deg, rgba(34, 197, 94, 0.07), transparent),
        var(--surface);
    }
    .cell-label {
      display: block;
      margin-bottom: 8px;
      color: var(--dim);
      font-family: var(--mono);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .drift-cell strong {
      display: block;
      color: var(--text);
      font-size: 16px;
      margin-bottom: 8px;
    }
    .drift-cell code {
      color: var(--cyan);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .drift-action {
      display: grid;
      place-items: center;
      border: 1px solid rgba(34, 211, 238, 0.18);
      border-radius: var(--radius);
      background: rgba(34, 211, 238, 0.045);
      color: var(--cyan);
      font-family: var(--mono);
      font-size: 11px;
      font-weight: 800;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 12px;
    }

    .compare-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      align-items: stretch;
    }
    .compare-panel {
      min-width: 0;
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      background: rgba(12, 15, 28, 0.88);
      overflow: hidden;
      box-shadow: 0 28px 80px -46px rgba(0, 0, 0, 0.75);
      transition: transform 0.22s var(--ease-out), border-color 0.22s var(--ease-out), box-shadow 0.22s var(--ease-out);
    }
    @media (hover: hover) {
      .compare-panel:hover {
        transform: translateY(-3px);
        box-shadow: 0 36px 96px -40px rgba(0, 0, 0, 0.8);
      }
      .compare-panel.before:hover { border-color: rgba(248, 113, 113, 0.38); }
      .compare-panel.after:hover { border-color: rgba(74, 222, 128, 0.4); }
    }
    .compare-panel.before { border-color: rgba(239, 68, 68, 0.3); }
    .compare-panel.after { border-color: rgba(34, 197, 94, 0.32); }
    .compare-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.035);
      font-family: var(--mono);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .before .compare-head { color: var(--orange); }
    .after .compare-head { color: var(--green); }
    .mini-score {
      color: var(--text);
      border: 1px solid currentColor;
      border-radius: 999px;
      padding: 3px 8px;
      font-size: 11px;
    }
    .compare-canvas {
      min-height: 420px;
      padding: 22px;
      position: relative;
      overflow: hidden;
    }
    .compare-canvas::before {
      content: "";
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px);
      background-size: 28px 28px;
      opacity: 0.65;
    }
    .before .compare-canvas::after {
      content: "";
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse 70% 60% at 12% 20%, rgba(239, 68, 68, 0.18), transparent 62%);
    }
    .after .compare-canvas::after {
      content: "";
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse 70% 60% at 78% 24%, rgba(34, 197, 94, 0.12), transparent 62%);
    }
    .ui-card {
      position: relative;
      z-index: 1;
      width: min(100%, 390px);
      margin: 26px auto 0;
      padding: 18px;
      background: #f8fafc;
      color: #0f172a;
      border: 1px solid rgba(15, 23, 42, 0.12);
      box-shadow: 0 26px 70px rgba(0, 0, 0, 0.38);
    }
    .before .ui-card {
      border-radius: 28px;
      transform: rotate(-1.2deg) translateX(-8px);
    }
    .after .ui-card {
      border-radius: var(--radius);
      transform: none;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
    }
    .ui-card h3 {
      color: #0f172a;
      font-size: 18px;
      margin-bottom: 4px;
    }
    .ui-card p {
      color: #475569;
      font-size: 13px;
      line-height: 1.5;
      margin-bottom: 16px;
    }
    .fake-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      padding: 0 16px;
      color: white;
      font-weight: 800;
      font-size: 13px;
      border: 0;
      cursor: default;
    }
    .before .fake-button {
      background: #7c3aed;
      border-radius: 21px;
      box-shadow: 0 14px 30px rgba(124, 58, 237, 0.32);
    }
    .after .fake-button {
      background: #2563eb;
      border-radius: 6px;
      box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.28);
    }
    .canvas-tags {
      position: relative;
      z-index: 1;
      display: grid;
      gap: 8px;
      margin-top: 24px;
    }
    .canvas-tag {
      display: inline-flex;
      width: fit-content;
      max-width: 100%;
      padding: 7px 9px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      background: rgba(6, 7, 18, 0.72);
      color: var(--muted);
      font-family: var(--mono);
      font-size: 11px;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }
    .before .canvas-tag { color: rgba(249, 115, 22, 0.92); border-color: rgba(249, 115, 22, 0.22); }
    .after .canvas-tag { color: rgba(34, 197, 94, 0.92); border-color: rgba(34, 197, 94, 0.22); }

    .demo-shell {
      display: grid;
      grid-template-columns: minmax(0, 1.08fr) minmax(320px, 0.72fr);
      gap: 24px;
      align-items: stretch;
    }
    .terminal-panel,
    .receipt-panel,
    .studio-card,
    .pricing-card,
    .doc-card {
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      background: var(--surface);
      box-shadow: 0 28px 80px -48px rgba(0, 0, 0, 0.72), inset 0 1px 0 rgba(255, 255, 255, 0.04);
      overflow: hidden;
      transition: transform 0.22s var(--ease-out), border-color 0.22s var(--ease-out), box-shadow 0.22s var(--ease-out);
    }
    @media (hover: hover) {
      .terminal-panel:hover,
      .receipt-panel:hover,
      .studio-card:hover {
        transform: translateY(-2px);
        border-color: var(--border-strong);
        box-shadow: 0 36px 96px -44px rgba(0, 0, 0, 0.78), inset 0 1px 0 rgba(255, 255, 255, 0.06);
      }
    }
    .panel-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      min-height: 46px;
      padding: 12px 15px;
      border-bottom: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.035);
      color: var(--muted);
      font-family: var(--mono);
      font-size: 12px;
    }
    .copy-btn {
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: rgba(255, 255, 255, 0.04);
      color: var(--muted);
      font: inherit;
      font-size: 11px;
      font-weight: 800;
      padding: 4px 9px;
      cursor: pointer;
      transition: color 0.18s var(--ease-out), border-color 0.18s var(--ease-out), background 0.18s var(--ease-out);
    }
    .copy-btn:hover {
      color: var(--text);
      border-color: var(--border-strong);
      background: rgba(255, 255, 255, 0.07);
    }
    .copy-btn:focus-visible {
      outline: 2px solid var(--cyan);
      outline-offset: 2px;
    }
    .terminal-body,
    .json-body,
    .patch-body {
      margin: 0;
      padding: 18px;
      overflow-x: auto;
      color: var(--muted);
      font-family: var(--mono);
      font-size: 13px;
      line-height: 1.78;
      white-space: pre;
    }
    .terminal-body { min-height: 354px; }
    .prompt { color: var(--cyan); }
    .cmd { color: var(--text); font-weight: 800; }
    .fail { color: var(--red); }
    .pass { color: var(--green); }
    .warn { color: var(--orange); }
    .json-key { color: var(--violet); }
    .json-str { color: var(--cyan); }
    .json-num { color: var(--orange); }
    .json-bool { color: var(--green); }

    .studio-preview {
      display: grid;
      grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
      gap: 18px;
      align-items: stretch;
    }
    .studio-card { min-width: 0; }
    .studio-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px;
      border-bottom: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.035);
    }
    .repo-name {
      display: grid;
      gap: 2px;
    }
    .repo-name strong { font-size: 15px; }
    .repo-name span {
      color: var(--muted);
      font-family: var(--mono);
      font-size: 11px;
    }
    .gate-pill,
    .severity,
    .status-pill {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      gap: 6px;
      border-radius: 999px;
      border: 1px solid var(--border);
      padding: 4px 9px;
      font-family: var(--mono);
      font-size: 11px;
      font-weight: 800;
      white-space: nowrap;
    }
    .gate-pill.open,
    .severity.low,
    .status-pill.pass {
      color: var(--green);
      border-color: rgba(34, 197, 94, 0.3);
      background: rgba(34, 197, 94, 0.08);
    }
    .gate-pill.blocked,
    .severity.high,
    .status-pill.fail {
      color: var(--red);
      border-color: rgba(239, 68, 68, 0.32);
      background: rgba(239, 68, 68, 0.08);
    }
    .severity.medium {
      color: var(--orange);
      border-color: rgba(249, 115, 22, 0.32);
      background: rgba(249, 115, 22, 0.08);
    }
    .score-ring {
      width: 150px;
      height: 150px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      margin: 26px auto 20px;
      background:
        radial-gradient(circle at 50% 50%, #0b1020 0 55%, transparent 56%),
        conic-gradient(var(--green) 0 100%, rgba(255, 255, 255, 0.1) 0);
      box-shadow: 0 0 48px rgba(34, 197, 94, 0.16);
    }
    .score-ring strong {
      font-family: var(--mono);
      font-size: 40px;
      line-height: 1;
      color: var(--green);
    }
    .score-ring span {
      display: block;
      color: var(--muted);
      font-size: 11px;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .studio-metrics {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      padding: 0 16px 16px;
    }
    .metric {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: var(--space-3);
      background: rgba(5, 6, 17, 0.52);
      transition: border-color 0.18s var(--ease-out);
    }
    @media (hover: hover) {
      .metric:hover { border-color: var(--border-strong); }
    }
    .metric strong {
      display: block;
      font-family: var(--mono);
      font-size: 16px;
    }
    .metric span {
      color: var(--muted);
      font-size: 11px;
    }
    .finding-list {
      display: grid;
      gap: 10px;
      padding: 16px;
    }
    .finding {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: rgba(5, 6, 17, 0.52);
      padding: var(--space-3);
      transition: border-color 0.18s var(--ease-out);
    }
    @media (hover: hover) {
      .finding:hover { border-color: var(--border-strong); }
    }
    .finding-top {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      margin-bottom: 8px;
    }
    .finding strong { font-size: 14px; }
    .path {
      display: block;
      color: var(--muted);
      font-family: var(--mono);
      font-size: 11px;
      overflow-wrap: anywhere;
    }
    .studio-actions {
      display: flex;
      gap: 10px;
      padding: 0 16px 16px;
      flex-wrap: wrap;
    }
    .patch-card {
      display: grid;
      grid-template-rows: auto 1fr auto;
    }
    .patch-diff {
      color: var(--muted);
    }
    .patch-diff .minus { color: var(--red); }
    .patch-diff .plus { color: var(--green); }
    .patch-summary {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      padding: 0 16px 16px;
    }

    .docs-cta {
      display: grid;
      grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
      gap: 18px;
      align-items: stretch;
    }
    .doc-card {
      display: block;
      min-height: 154px;
      padding: var(--space-5);
      color: inherit;
      text-decoration: none;
    }
    @media (hover: hover) {
      .doc-card:hover {
        transform: translateY(-3px);
        border-color: rgba(34, 211, 238, 0.32);
        box-shadow:
          0 24px 64px -32px rgba(0, 0, 0, 0.72),
          0 0 40px -20px rgba(34, 211, 238, 0.18),
          inset 0 1px 0 rgba(255, 255, 255, 0.06);
      }
    }
    .doc-card:focus-visible {
      outline: 2px solid var(--cyan);
      outline-offset: 3px;
    }
    .doc-card strong {
      display: flex;
      align-items: center;
      gap: 9px;
      margin-bottom: 8px;
      font-size: 16px;
    }
    .doc-card svg { color: var(--cyan); flex: none; }
    .doc-card span {
      color: var(--muted);
      font-size: 14px;
      line-height: 1.6;
    }
    .doc-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }
    .api-strip {
      margin-top: var(--space-5);
      padding: var(--space-4);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      background: rgba(5, 6, 17, 0.62);
      color: var(--muted);
      font-family: var(--mono);
      font-size: 12px;
      line-height: 1.75;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
    }
    .api-strip b { color: var(--cyan); }

    .pricing-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-4);
      align-items: stretch;
    }
    .pricing-card {
      padding: var(--space-6);
      background: rgba(12, 15, 28, 0.68);
      display: flex;
      flex-direction: column;
    }
    .pricing-card.featured {
      border-color: rgba(167, 139, 250, 0.32);
      background:
        linear-gradient(180deg, rgba(124, 58, 237, 0.08) 0%, rgba(12, 15, 28, 0.82) 42%),
        rgba(12, 15, 28, 0.82);
      box-shadow:
        0 0 0 1px rgba(124, 58, 237, 0.12),
        0 32px 80px -40px rgba(124, 58, 237, 0.28),
        inset 0 1px 0 rgba(255, 255, 255, 0.06);
    }
    @media (hover: hover) {
      .pricing-card:hover {
        transform: translateY(-3px);
        border-color: var(--border-strong);
        box-shadow: 0 32px 80px -36px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.06);
      }
      .pricing-card.featured:hover {
        border-color: rgba(167, 139, 250, 0.44);
        box-shadow:
          0 0 0 1px rgba(124, 58, 237, 0.18),
          0 40px 96px -36px rgba(124, 58, 237, 0.36),
          inset 0 1px 0 rgba(255, 255, 255, 0.08);
      }
    }
    .pricing-card .btn { margin-top: auto; width: 100%; }
    .pricing-card h3 { margin-bottom: 6px; }
    .price {
      margin: var(--space-3) 0 var(--space-1);
      font-size: clamp(1.75rem, 3vw, 2.125rem);
      line-height: 1;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .price small {
      color: var(--muted);
      font-size: 13px;
      font-weight: 600;
    }
    .pricing-card p {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.6;
    }
    .pricing-card ul {
      margin: 18px 0 20px;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 8px;
      color: var(--muted);
      font-size: 13px;
    }
    .pricing-card li::before {
      content: "+";
      color: var(--green);
      font-family: var(--mono);
      font-weight: 800;
      margin-right: 8px;
    }

    footer {
      border-top: 1px solid var(--border);
      padding: var(--space-12) 0 var(--space-8);
      background: rgba(5, 6, 17, 0.78);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    .foot-grid {
      display: grid;
      grid-template-columns: 1.35fr 1fr 1fr 1fr;
      gap: 26px;
      margin-bottom: 32px;
    }
    .foot-brand p {
      color: var(--muted);
      max-width: 330px;
      margin: 12px 0 0;
      font-size: 13px;
    }
    .foot-col h4 {
      margin: 0 0 11px;
      color: var(--dim);
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .foot-col a {
      display: block;
      color: var(--muted);
      text-decoration: none;
      font-size: 13px;
      padding: 5px 0;
      transition: color 0.18s var(--ease-out);
    }
    .foot-col a:hover { color: var(--text); }
    .foot-col a:focus-visible {
      color: var(--text);
      outline: 2px solid var(--cyan);
      outline-offset: 2px;
      border-radius: var(--radius-sm);
    }
    .foot-bottom {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      padding-top: 20px;
      border-top: 1px solid var(--border);
      color: var(--dim);
      font-size: 12px;
    }

    .reveal {
      opacity: 0;
      transform: translateY(16px);
      transition: opacity 0.7s var(--ease-out), transform 0.7s var(--ease-out);
      will-change: opacity, transform;
    }
    .reveal.in {
      opacity: 1;
      transform: none;
      will-change: auto;
    }

    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto; }
      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        scroll-behavior: auto !important;
        transition-duration: 0.01ms !important;
      }
      .reveal {
        opacity: 1;
        transform: none;
      }
    }

    @media (min-width: 1920px) {
      .shell {
        width: min(1280px, calc(100vw - 80px));
      }
      .hero-layout {
        gap: var(--space-20);
      }
      h1 { max-width: 13ch; }
    }

    @media (max-width: 1100px) {
      .hero-layout,
      .studio-preview,
      .docs-cta {
        grid-template-columns: 1fr;
      }
      .scanner-stage {
        min-height: auto;
      }
      .scanner-panel {
        min-height: 0;
      }
      .hero-float { display: none; }
      .demo-shell { grid-template-columns: 1fr; }
      .pricing-grid { grid-template-columns: 1fr; }
      .foot-grid { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 860px) {
      .nav-links,
      .nav-actions .login-link,
      .nav-actions .btn {
        display: none;
      }
      .nav-toggle { display: grid; }
      .mobile-menu.open { display: block; }
      .hero {
        min-height: 0;
        padding-top: calc(68px + var(--space-10));
      }
      .hero-copy::before {
        width: 100%;
        left: 0;
        opacity: 0.7;
      }
      .status-strip,
      .repair-grid,
      .compare-grid,
      .drift-row,
      .doc-grid {
        grid-template-columns: 1fr;
      }
      .repair-bridge {
        width: 100%;
        min-height: 74px;
      }
      .drift-action {
        min-height: 58px;
      }
      .signal-row {
        grid-template-columns: 1fr;
      }
      .gate-state {
        grid-template-columns: 1fr;
        justify-items: start;
      }
    }
    @media (max-width: 768px) {
      .shell {
        width: min(100% - var(--space-8), 1200px);
      }
      .section-head {
        margin-bottom: var(--space-10);
      }
      .compare-canvas {
        min-height: 360px;
      }
      .cta-row .btn-lg {
        flex: 1 1 calc(50% - var(--space-2));
        min-width: 140px;
      }
    }
    @media (max-width: 620px) {
      .shell {
        width: min(100% - 28px, 1200px);
      }
      .ambient-fragment,
      .signal-row {
        display: none;
      }
      .section { padding: calc(var(--section-y) * 0.72) 0; }
      .hero { padding-bottom: var(--space-10); }
      .cta-row .btn-lg {
        flex: 1 1 100%;
        width: 100%;
      }
      .panel-body,
      .compare-canvas,
      .terminal-body,
      .json-body,
      .patch-body {
        padding: 14px;
      }
      .big-score strong {
        font-size: clamp(46px, 15vw, 72px);
      }
      .studio-metrics,
      .patch-summary {
        grid-template-columns: 1fr;
      }
      .foot-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <div class="ambient" aria-hidden="true">
    <span class="ambient-fragment drift">rounded-[28px]</span>
    <span class="ambient-fragment drift">focus:outline-none</span>
    <span class="ambient-fragment drift">#7c3aed</span>
    <span class="ambient-fragment clean">var(--radius-card)</span>
    <span class="ambient-fragment clean">focus-visible:ring</span>
    <span class="ambient-fragment clean">&lt;Button/&gt;</span>
  </div>

  <header class="site-header" id="siteHeader">
    <div class="shell nav-bar">
      <a class="brand" href="#top" aria-label="Morph home">
        <span class="mark">m</span>
        <span>Morph</span>
      </a>
      <nav class="nav-links" aria-label="Primary">
        <a href="#problem">Product</a>
        <a href="#repair">Repair</a>
        <a href="#demo">Demo</a>
        <a href="#studio">Studio</a>
        <a href="#docs">Docs</a>
        <a href="#pricing">Pricing</a>
      </nav>
      <div class="nav-actions">
        ${sessionBlock}
        <a class="btn btn-primary" href="/studio">
          Launch Studio
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
        <button class="nav-toggle" id="navToggle" aria-expanded="false" aria-controls="mobileMenu" aria-label="Open menu">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
      </div>
    </div>
    <div class="mobile-menu" id="mobileMenu">
      <a href="#problem">Product</a>
      <a href="#repair">Repair</a>
      <a href="#demo">Demo</a>
      <a href="#studio">Studio</a>
      <a href="#docs">Docs</a>
      <a href="#pricing">Pricing</a>
      ${mobileSessionBlock}
      <a class="btn btn-primary" href="/studio">Launch Studio</a>
    </div>
  </header>

  <main id="main">
    <span id="top"></span>

    <section class="hero">
      <div class="shell hero-layout">
        <div class="hero-copy">
          <div class="eyebrow reveal"><span>CI</span><strong>Agent UI firewall</strong><em style="font-style:normal;color:var(--dim)">design drift blocked before review</em></div>
          <h1 class="reveal" style="transition-delay:.05s">AI writes the UI. <span class="text-gradient">Morph makes it belong.</span></h1>
          <p class="lede reveal" style="transition-delay:.1s">Morph is a multi-engine CI gate for AI-generated frontend — Morph native rules, Buoy health scoring, ESLint token linting, and axe accessibility — catching drift, explaining every violation, and emitting deterministic patches your agent applies before human review.</p>
          <div class="cta-row reveal" style="transition-delay:.15s">
            <a class="btn btn-primary btn-lg" href="/studio">
              Launch Studio
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </a>
            <a class="btn btn-secondary btn-lg" href="#demo">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>
              Run the demo
            </a>
          </div>
          <div class="signal-row reveal" style="transition-delay:.2s">
            <div class="signal"><b><span class="fail">68</span> -&gt; <span class="pass">100</span></b><span>Failing agent output repaired into a passing gate.</span></div>
            <div class="signal"><b>9 patches</b><span>Exact replacements across one frontend file.</span></div>
            <div class="signal"><b>4 engines</b><span>Morph, Buoy, ESLint, and axe-core in one verify pass.</span></div>
          </div>
        </div>

        <div class="scanner-stage reveal" style="transition-delay:.12s">
          <div class="hero-float float-a"><span class="bad">#7c3aed</span> -&gt; <span class="good">var(--color-primary)</span></div>
          <div class="hero-float float-b"><span class="bad">rounded-[28px]</span> -&gt; <span class="good">var(--radius-card)</span></div>
          <div class="hero-float float-c"><span class="bad">&lt;button&gt;</span> -&gt; <span class="good">&lt;Button variant="primary"&gt;</span></div>
          <div class="hero-float float-d"><span class="bad">focus:outline-none</span> -&gt; <span class="good">focus-visible:ring</span></div>
          <div class="scanner-panel" aria-label="Morph scanner dashboard showing fail 68 of 100 repaired to pass 100 of 100">
            <div class="panel-chrome">
              <div class="chrome-dots"><span class="dot red"></span><span class="dot orange"></span><span class="dot green"></span></div>
              <span>morph.scan / agent-ui-rewrite</span>
              <span class="status-pill pass">live gate</span>
            </div>
            <span class="sr-only">FAIL 68/100 -> PASS 100/100. MERGE GATE OPEN.</span>
            <div class="panel-body">
              <div class="status-strip">
                <div class="score-card fail">
                  <span class="score-label">before repair</span>
                  <div class="score-value">FAIL<br>68/100</div>
                  <div class="score-note">drift detected in tokens, components, focus states</div>
                </div>
                <div class="repair-bridge">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                  morph<br>repair
                </div>
                <div class="score-card pass">
                  <span class="score-label">after repair</span>
                  <div class="score-value">PASS<br>100/100</div>
                  <div class="score-note">deterministic patches applied, zero findings remain</div>
                </div>
              </div>

              <div class="big-score">
                <span>score transformation</span>
                <strong><span class="fail-num">68</span> -&gt; <span class="pass-num">100</span></strong>
              </div>

              <div class="repair-grid">
                <div class="token-stack" aria-label="Drift examples">
                  <div class="token-chip"><span class="bad">#7c3aed</span><span>-&gt;</span><span class="good">var(--color-primary)</span></div>
                  <div class="token-chip"><span class="bad">rounded-[28px]</span><span>-&gt;</span><span class="good">var(--radius-card)</span></div>
                  <div class="token-chip"><span class="bad">&lt;button&gt;</span><span>-&gt;</span><span class="good">&lt;Button/&gt;</span></div>
                  <div class="token-chip"><span class="bad">focus:outline-none</span><span>-&gt;</span><span class="good">focus-visible:ring</span></div>
                </div>
                <div class="token-stack" aria-label="Repair trace">
                  <div class="token-chip clean"><span>visual grammar</span><span class="good">locked</span></div>
                  <div class="token-chip clean"><span>component grammar</span><span class="good">locked</span></div>
                  <div class="token-chip clean"><span>a11y states</span><span class="good">restored</span></div>
                  <div class="token-chip clean"><span>receipt</span><span class="good">stored</span></div>
                </div>
                <div class="gate-state">
                  <span class="gate-bars" aria-hidden="true"></span>
                  <span>MERGE GATE OPEN<br><small>threshold met - ready for human review</small></span>
                  <span>PASS</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="shell divider" role="presentation"></div>

    <section id="problem" class="section">
      <div class="shell">
        <div class="section-head reveal">
          <div class="kicker">Problem</div>
          <h2>Agent UI compiles, but drifts</h2>
          <p>Generated frontend often passes the build while silently leaving the design system. Morph turns those subtle inconsistencies into concrete findings with concrete repairs.</p>
        </div>

        <div class="matrix">
          <div class="drift-row reveal">
            <div class="drift-cell problem">
              <span class="cell-label">Problem</span>
              <strong>Agent used almost-brand purple</strong>
              <code>#7c3aed</code>
            </div>
            <div class="drift-action">Morph scan<br>maps token</div>
            <div class="drift-cell repair">
              <span class="cell-label">Morph repair</span>
              <strong>Replaces it with the product color token</strong>
              <code>var(--color-primary)</code>
            </div>
          </div>
          <div class="drift-row reveal" style="transition-delay:.04s">
            <div class="drift-cell problem">
              <span class="cell-label">Problem</span>
              <strong>Agent invented a 28px radius</strong>
              <code>rounded-[28px]</code>
            </div>
            <div class="drift-action">Morph scan<br>snaps shape</div>
            <div class="drift-cell repair">
              <span class="cell-label">Morph repair</span>
              <strong>Snaps it to the card radius token</strong>
              <code>var(--radius-card)</code>
            </div>
          </div>
          <div class="drift-row reveal" style="transition-delay:.08s">
            <div class="drift-cell problem">
              <span class="cell-label">Problem</span>
              <strong>Agent used raw HTML</strong>
              <code>&lt;button&gt;Update plan&lt;/button&gt;</code>
            </div>
            <div class="drift-action">Morph scan<br>restores grammar</div>
            <div class="drift-cell repair">
              <span class="cell-label">Morph repair</span>
              <strong>Replaces it with the design-system component</strong>
              <code>&lt;Button variant="primary"&gt;</code>
            </div>
          </div>
          <div class="drift-row reveal" style="transition-delay:.12s">
            <div class="drift-cell problem">
              <span class="cell-label">Problem</span>
              <strong>Agent removed focus rings</strong>
              <code>focus:outline-none</code>
            </div>
            <div class="drift-action">Morph scan<br>repairs a11y</div>
            <div class="drift-cell repair">
              <span class="cell-label">Morph repair</span>
              <strong>Restores accessible focus-visible states</strong>
              <code>focus-visible:ring</code>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="shell divider" role="presentation"></div>

    <section id="repair" class="section">
      <div class="shell">
        <div class="section-head reveal">
          <div class="kicker">Before / after</div>
          <h2>Chaos on the left. Token order on the right.</h2>
          <p>The page reads like a visual firewall: broken drift enters, Morph scans it, deterministic patches snap it back into the product system, and the gate opens.</p>
        </div>

        <div class="compare-grid">
          <div class="compare-panel before reveal">
            <div class="compare-head">
              <span>Before - fail</span>
              <span class="mini-score">68/100</span>
            </div>
            <div class="compare-canvas">
              <div class="ui-card">
                <h3>Scale plan</h3>
                <p>This compiles, but the radius, color, component usage, focus style, and spacing all drift.</p>
                <button class="fake-button" tabindex="-1">Update plan</button>
              </div>
              <div class="canvas-tags">
                <span class="canvas-tag">broken token: #7c3aed</span>
                <span class="canvas-tag">off-grid shape: rounded-[28px]</span>
                <span class="canvas-tag">raw button bypasses design system</span>
                <span class="canvas-tag">missing focus ring</span>
              </div>
            </div>
          </div>

          <div class="compare-panel after reveal" style="transition-delay:.08s">
            <div class="compare-head">
              <span>After - pass</span>
              <span class="mini-score">100/100</span>
            </div>
            <div class="compare-canvas">
              <div class="ui-card">
                <h3>Scale plan</h3>
                <p>Values are tokenized, the Button component is restored, focus-visible state is back, and the card returns to the grid.</p>
                <button class="fake-button" tabindex="-1">Update plan</button>
              </div>
              <div class="canvas-tags">
                <span class="canvas-tag">tokenized: var(--color-primary)</span>
                <span class="canvas-tag">shape: var(--radius-card)</span>
                <span class="canvas-tag">component: &lt;Button variant="primary"&gt;</span>
                <span class="canvas-tag">a11y: focus-visible:ring</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="shell divider" role="presentation"></div>

    <section id="demo" class="section">
      <div class="shell">
        <div class="section-head reveal">
          <div class="kicker">Deterministic loop</div>
          <h2>One command path from drift to gate</h2>
          <p>The shipped fixture, ${projectName}, starts with seeded drift. The loop verifies, repairs, verifies again, and writes receipts that a CI job can attach to the PR.</p>
        </div>

        <div class="demo-shell">
          <div class="terminal-panel reveal">
            <div class="panel-title">
              <span>terminal - morph loop</span>
              <button class="copy-btn" type="button" data-copy="$ morph verify
Acme Control Plane: FAIL (68/100)

$ morph repair --apply
9 deterministic replacements across 1 file

$ morph verify
Acme Control Plane: PASS (100/100)
merge gate open">Copy</button>
            </div>
            <pre class="terminal-body"><span class="prompt">$</span> <span class="cmd">morph verify</span>
<span class="fail">Acme Control Plane: FAIL (68/100)</span>
  <span class="warn">high</span> hardcoded-color        #7c3aed -&gt; var(--color-primary)
  <span class="warn">high</span> radius-drift           rounded-[28px] -&gt; var(--radius-card)
  <span class="warn">high</span> component-drift        &lt;button&gt; -&gt; &lt;Button variant="primary"&gt;
  <span class="warn">medium</span> focus-regression   focus:outline-none -&gt; focus-visible:ring

<span class="prompt">$</span> <span class="cmd">morph repair --apply</span>
<span class="pass">9 deterministic replacements across 1 file</span>

<span class="prompt">$</span> <span class="cmd">morph verify</span>
<span class="pass">Acme Control Plane: PASS (100/100)</span>
<span class="pass">merge gate open</span></pre>
          </div>

          <div class="receipt-panel reveal" style="transition-delay:.08s">
            <div class="panel-title">
              <span>receipt preview</span>
              <span class="status-pill pass">stored</span>
            </div>
            <pre class="json-body">{
  <span class="json-key">"schemaVersion"</span>: <span class="json-str">"morph.report.v1"</span>,
  <span class="json-key">"project"</span>: <span class="json-str">"Acme Control Plane"</span>,
  <span class="json-key">"before"</span>: {
    <span class="json-key">"verdict"</span>: <span class="json-str">"fail"</span>,
    <span class="json-key">"score"</span>: <span class="json-num">68</span>
  },
  <span class="json-key">"repair"</span>: {
    <span class="json-key">"applied"</span>: <span class="json-bool">true</span>,
    <span class="json-key">"replacements"</span>: <span class="json-num">9</span>,
    <span class="json-key">"mode"</span>: <span class="json-str">"deterministic"</span>
  },
  <span class="json-key">"after"</span>: {
    <span class="json-key">"verdict"</span>: <span class="json-str">"pass"</span>,
    <span class="json-key">"score"</span>: <span class="json-num">100</span>
  },
  <span class="json-key">"gate"</span>: <span class="json-str">"open"</span>
}</pre>
          </div>
        </div>
      </div>
    </section>

    <div class="shell divider" role="presentation"></div>

    <section id="studio" class="section">
      <div class="shell">
        <div class="section-head reveal">
          <div class="kicker">Morph Studio</div>
          <h2>A real review console, not a decorative mockup</h2>
          <p>Studio gives reviewers and teams a dashboard for repo context, branch status, findings, exact patches, and the merge gate state after repair.</p>
        </div>

        <div class="studio-preview">
          <div class="studio-card reveal">
            <div class="studio-toolbar">
              <div class="repo-name">
                <strong>acme/control-plane</strong>
                <span>branch: agent/billing-upgrade-ui</span>
              </div>
              <span class="gate-pill open">gate open</span>
            </div>
            <div class="score-ring" aria-label="Score 100 out of 100">
              <div><strong>100</strong><span>score</span></div>
            </div>
            <div class="studio-metrics">
              <div class="metric"><strong>0</strong><span>open findings</span></div>
              <div class="metric"><strong>9</strong><span>repairs applied</span></div>
              <div class="metric"><strong>1</strong><span>file touched</span></div>
            </div>
            <div class="studio-actions">
              <a class="btn btn-green" href="/studio">Apply repair</a>
              <a class="btn btn-secondary" href="/studio">Re-run verify</a>
            </div>
          </div>

          <div class="studio-card patch-card reveal" style="transition-delay:.08s">
            <div class="panel-title">
              <span>findings and patch preview</span>
              <span class="status-pill pass">PASS 100/100</span>
            </div>
            <div class="finding-list">
              <div class="finding">
                <div class="finding-top"><strong>hardcoded-color</strong><span class="severity high">high</span></div>
                <span class="path">fixtures/acme-saas/src/routes/settings/billing.tsx</span>
              </div>
              <div class="finding">
                <div class="finding-top"><strong>radius-drift</strong><span class="severity high">high</span></div>
                <span class="path">fixtures/acme-saas/src/routes/settings/billing.tsx</span>
              </div>
              <div class="finding">
                <div class="finding-top"><strong>focus-regression</strong><span class="severity medium">medium</span></div>
                <span class="path">fixtures/acme-saas/src/routes/settings/billing.tsx</span>
              </div>
            </div>
            <pre class="patch-body patch-diff"><span class="minus">- className="rounded-[28px] bg-[#7c3aed] focus:outline-none"</span>
<span class="plus">+ className="rounded-[var(--radius-card)] bg-[var(--color-primary)] focus-visible:ring"</span>

<span class="minus">- &lt;button&gt;Update plan&lt;/button&gt;</span>
<span class="plus">+ &lt;Button variant="primary"&gt;Update plan&lt;/Button&gt;</span></pre>
            <div class="patch-summary">
              <div class="metric"><strong>merge</strong><span>gate status</span></div>
              <div class="metric"><strong>.morph/runs</strong><span>receipt path</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="shell divider" role="presentation"></div>

    <section id="docs" class="section">
      <div class="shell docs-cta">
        <div class="section-head reveal" style="margin-bottom:0">
          <div class="kicker">Docs / GitHub</div>
          <h2>Clone the firewall. Inspect the receipt. Wire the gate.</h2>
          <p>The public repo includes the seeded fixture, CLI loop, Studio server, API endpoints, CI workflow, demo transcript, and product architecture notes.</p>
          <div class="api-strip">
            <b>API status</b> /api/health<br>
            <b>Runs</b> /api/runs, /api/runs/:id<br>
            <b>Actions</b> /api/runs/verify, /api/runs/repair, /api/runs/loop
          </div>
        </div>
        <div class="doc-grid">
          <a class="doc-card reveal" href="${REPO_URL}" target="_blank" rel="noreferrer">
            <strong><svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.72.5.1.68-.22.68-.49v-1.7c-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.9-.64.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05a9.4 9.4 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9v2.82c0 .27.18.6.69.49A10.26 10.26 0 0 0 22 12.25C22 6.58 17.52 2 12 2z"/></svg> GitHub</strong>
            <span>Source, issues, workflow, CLI, Studio server, and the seeded review fixture.</span>
          </a>
          <a class="doc-card reveal" style="transition-delay:.04s" href="${REPO_URL}#readme" target="_blank" rel="noreferrer">
            <strong><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg> Docs</strong>
            <span>Quickstart, commands, report shape, auth modes, billing setup, and API map.</span>
          </a>
          <a class="doc-card reveal" style="transition-delay:.08s" href="${REPO_URL}/blob/main/DEMO.md" target="_blank" rel="noreferrer">
            <strong><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg> Demo runbook</strong>
            <span>The one-minute sample flow, exact terminal story, and live demo path.</span>
          </a>
          <a class="doc-card reveal" style="transition-delay:.12s" href="/api/health">
            <strong><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 12h-4l-3 8L9 4l-3 8H2"/></svg> API status</strong>
            <span>See the live server health response, auth mode, billing mode, and configured providers.</span>
          </a>
        </div>
      </div>
    </section>

    <div class="shell divider" role="presentation"></div>

    <section id="pricing" class="section section-compact">
      <div class="shell">
        <div class="section-head reveal">
          <div class="kicker">Pricing</div>
          <h2>Plans for local gates and shared reviews</h2>
          <p>The local loop is MIT-licensed and runs anywhere Node 20 does. Team features are ready when you want shared Studio reviews and billing.</p>
        </div>
        <div class="pricing-grid">
          <div class="pricing-card reveal">
            <h3>Local</h3>
            <div class="price">$0 <small>forever</small></div>
            <p>Run verify, repair, loop, and Studio locally or in CI.</p>
            <ul>
              <li>Deterministic CLI repair loop</li>
              <li>JSON receipts and stored runs</li>
              <li>GitHub Actions workflow</li>
            </ul>
            <a class="btn btn-secondary" href="#docs">Read docs</a>
          </div>
          <div class="pricing-card featured reveal" style="transition-delay:.05s">
            <h3>Team</h3>
            <div class="price">$29 <small>/ seat / month</small></div>
            <p>Shared Studio runs for teams reviewing agent branches.</p>
            <ul>
              <li>Interactive Studio reviews</li>
              <li>GitHub and Google SSO</li>
              <li>Stripe-ready checkout</li>
            </ul>
            <a class="btn btn-primary" href="/studio">Launch Studio</a>
          </div>
          <div class="pricing-card reveal" style="transition-delay:.1s">
            <h3>Enterprise</h3>
            <div class="price">Custom</div>
            <p>For teams gating many products and agent workflows.</p>
            <ul>
              <li>Custom grammar rules</li>
              <li>Workspace-scoped run storage</li>
              <li>Deployment support</li>
            </ul>
            <a class="btn btn-secondary" href="${REPO_URL}/issues" target="_blank" rel="noreferrer">Talk to us</a>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <div class="shell">
      <div class="foot-grid">
        <div class="foot-brand">
          <a class="brand" href="#top"><span class="mark">m</span><span>Morph</span></a>
          <p>CI for agent-written frontend. Detect drift, explain violations, repair deterministically, and open the merge gate.</p>
        </div>
        <div class="foot-col">
          <h4>Product</h4>
          <a href="#problem">Problem</a>
          <a href="#repair">Repair</a>
          <a href="#demo">Demo</a>
          <a href="/studio">Studio</a>
        </div>
        <div class="foot-col">
          <h4>Resources</h4>
          <a href="#docs">Docs</a>
          <a href="${REPO_URL}" target="_blank" rel="noreferrer">GitHub</a>
          <a href="${REPO_URL}/blob/main/DEMO.md" target="_blank" rel="noreferrer">Demo runbook</a>
          <a href="${REPO_URL}/blob/main/docs/product-architecture.md" target="_blank" rel="noreferrer">Architecture</a>
        </div>
        <div class="foot-col">
          <h4>Account</h4>
          <a href="/login?returnTo=%2Fstudio">Log in</a>
          <a href="/studio">Launch Studio</a>
          <a href="/api/health">API status</a>
          <a href="#pricing">Pricing</a>
        </div>
      </div>
      <div class="foot-bottom">
        <span>(c) <span id="year">2026</span> Morph. MIT licensed.</span>
        <span>Built for serious agent frontend review.</span>
      </div>
    </div>
  </footer>

  <script>
    (function () {
      var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      var year = document.getElementById("year");
      if (year) year.textContent = String(new Date().getFullYear());

      var header = document.getElementById("siteHeader");
      function updateHeader() {
        if (!header) return;
        if (window.scrollY > 8) header.classList.add("scrolled");
        else header.classList.remove("scrolled");
      }
      window.addEventListener("scroll", updateHeader, { passive: true });
      updateHeader();

      var toggle = document.getElementById("navToggle");
      var menu = document.getElementById("mobileMenu");
      if (toggle && menu) {
        toggle.addEventListener("click", function () {
          var open = menu.classList.toggle("open");
          toggle.setAttribute("aria-expanded", open ? "true" : "false");
        });
        menu.addEventListener("click", function (event) {
          if (event.target && event.target.tagName === "A") {
            menu.classList.remove("open");
            toggle.setAttribute("aria-expanded", "false");
          }
        });
      }

      var revealed = document.querySelectorAll(".reveal");
      if ("IntersectionObserver" in window && !reduceMotion) {
        var observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("in");
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.12, rootMargin: "0px 0px -50px 0px" });
        revealed.forEach(function (item) { observer.observe(item); });
      } else {
        revealed.forEach(function (item) { item.classList.add("in"); });
      }

      document.querySelectorAll(".copy-btn").forEach(function (button) {
        button.addEventListener("click", function () {
          var text = button.getAttribute("data-copy") || "";
          var previous = button.textContent;
          function done() {
            button.textContent = "Copied";
            window.setTimeout(function () { button.textContent = previous; }, 1300);
          }
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done, done);
          } else {
            done();
          }
        });
      });
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
