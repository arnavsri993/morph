const REPO_URL = "https://github.com/arnavsri993/morph";

export function landingHtml(config, session) {
  const projectName = escapeHtml(config.projectName ?? "Acme Control Plane");
  const sessionLabel = session ? escapeHtml(session.name || session.email) : null;
  const sessionBlock = sessionLabel
    ? `<a class="nav-link" href="/studio">${sessionLabel}</a>`
    : `<a class="nav-link" href="/login?returnTo=%2Fstudio">Log in</a>`;
  const mobileSessionBlock = sessionLabel
    ? `<a href="/studio">${sessionLabel}</a>`
    : `<a href="/login?returnTo=%2Fstudio">Log in</a>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Morph — CI for agent-written frontend</title>
  <meta name="description" content="Morph catches design-system drift in AI-generated frontend, explains every violation, and emits deterministic repair patches before a PR reaches human review.">
  <meta property="og:title" content="Morph — CI for agent-written frontend">
  <meta property="og:description" content="AI writes the UI. Morph makes it belong.">
  <meta property="og:type" content="website">
  <meta name="theme-color" content="#09090b">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      color-scheme: dark;
      --bg: #09090b;
      --surface: rgba(24, 24, 27, 0.72);
      --border: rgba(255, 255, 255, 0.08);
      --border-strong: rgba(255, 255, 255, 0.14);
      --text: #fafafa;
      --muted: #a1a1aa;
      --faint: #71717a;
      --brand: #818cf8;
      --brand-2: #a78bfa;
      --cyan: #22d3ee;
      --ok: #4ade80;
      --bad: #f87171;
      --warn: #fbbf24;
      --font: "Inter", ui-sans-serif, system-ui, sans-serif;
      --mono: "JetBrains Mono", ui-monospace, monospace;
      --radius: 16px;
      --radius-sm: 10px;
      --max: 1080px;
      --ease: cubic-bezier(0.16, 1, 0.3, 1);
    }
    *, *::before, *::after { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      min-width: 320px;
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      font-size: 16px;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    ::selection { background: rgba(129, 140, 248, 0.35); }
    :focus-visible { outline: 2px solid var(--brand); outline-offset: 3px; border-radius: 6px; }
    a { color: inherit; text-decoration: none; }
    code, pre { font-family: var(--mono); }

    .backdrop {
      position: fixed;
      inset: 0;
      z-index: -1;
      pointer-events: none;
      overflow: hidden;
    }
    .backdrop::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse 50% 40% at 50% -10%, rgba(129, 140, 248, 0.18), transparent 70%),
        radial-gradient(ellipse 40% 30% at 90% 20%, rgba(34, 211, 238, 0.08), transparent 60%);
    }
    .backdrop::after {
      content: "";
      position: absolute;
      inset: 0;
      background-image: radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px);
      background-size: 32px 32px;
      mask-image: radial-gradient(ellipse 80% 50% at 50% 0%, black 10%, transparent 75%);
      -webkit-mask-image: radial-gradient(ellipse 80% 50% at 50% 0%, black 10%, transparent 75%);
      opacity: 0.45;
    }

    .shell {
      width: min(var(--max), calc(100vw - 48px));
      margin: 0 auto;
    }

    /* Nav — glass sticky bar (21st-style) */
    .nav {
      position: sticky;
      top: 0;
      z-index: 50;
      border-bottom: 1px solid transparent;
      transition: background 0.25s var(--ease), border-color 0.25s var(--ease);
    }
    .nav.scrolled {
      background: rgba(9, 9, 11, 0.82);
      border-bottom-color: var(--border);
      backdrop-filter: blur(20px) saturate(1.4);
      -webkit-backdrop-filter: blur(20px) saturate(1.4);
    }
    .nav-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      min-height: 64px;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-weight: 600;
      font-size: 15px;
      letter-spacing: -0.02em;
    }
    .mark {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      font-family: var(--mono);
      font-size: 14px;
      font-weight: 700;
      color: #fff;
      background: linear-gradient(135deg, var(--brand), var(--brand-2));
      box-shadow: 0 0 24px -4px rgba(129, 140, 248, 0.55);
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .nav-link {
      color: var(--muted);
      font-size: 14px;
      font-weight: 500;
      padding: 8px 14px;
      border-radius: 999px;
      transition: color 0.18s, background 0.18s;
    }
    .nav-link:hover { color: var(--text); background: rgba(255, 255, 255, 0.05); }
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
      border-radius: var(--radius-sm);
      background: rgba(255, 255, 255, 0.04);
      color: var(--text);
      cursor: pointer;
    }
    .mobile-menu {
      display: none;
      border-top: 1px solid var(--border);
      background: rgba(9, 9, 11, 0.96);
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

    /* Buttons */
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
    .btn svg { flex: none; }
    .btn-primary {
      color: #fff;
      background: linear-gradient(135deg, var(--brand), var(--brand-2));
      box-shadow: 0 0 32px -8px rgba(129, 140, 248, 0.65);
    }
    .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 28px -4px rgba(129, 140, 248, 0.7);
    }
    .btn-ghost {
      color: var(--text);
      background: rgba(255, 255, 255, 0.04);
      border-color: var(--border-strong);
    }
    .btn-ghost:hover {
      background: rgba(255, 255, 255, 0.08);
      transform: translateY(-1px);
    }
    .btn-lg { min-height: 48px; padding: 0 26px; font-size: 15px; }

    /* Hero */
    .hero {
      padding: clamp(64px, 10vw, 120px) 0 clamp(48px, 8vw, 80px);
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 28px;
      padding: 6px 14px 6px 8px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.03);
      color: var(--muted);
      font-size: 13px;
      font-weight: 500;
    }
    .badge-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--ok);
      box-shadow: 0 0 12px rgba(74, 222, 128, 0.6);
    }
    h1 {
      margin: 0 auto 20px;
      max-width: 16ch;
      font-size: clamp(2.5rem, 6vw, 3.75rem);
      line-height: 1.05;
      letter-spacing: -0.03em;
      font-weight: 600;
    }
    .gradient {
      background: linear-gradient(to right, #fafafa, #a1a1aa 40%, var(--brand) 75%, var(--brand-2));
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .lede {
      margin: 0 auto 36px;
      max-width: 52ch;
      color: var(--muted);
      font-size: 17px;
      line-height: 1.75;
    }
    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 12px;
      margin-bottom: clamp(48px, 8vw, 72px);
    }

    /* Terminal preview card */
    .preview {
      position: relative;
      max-width: 640px;
      margin: 0 auto;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      overflow: hidden;
      text-align: left;
      box-shadow:
        0 0 0 1px rgba(255, 255, 255, 0.04),
        0 24px 64px -24px rgba(0, 0, 0, 0.65);
    }
    .preview::before {
      content: "";
      position: absolute;
      inset: 0;
      background: radial-gradient(480px circle at var(--spot-x, 50%) 0%, rgba(129, 140, 248, 0.1), transparent 50%);
      pointer-events: none;
    }
    .preview-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 14px 18px;
      border-bottom: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.02);
    }
    .dot { width: 10px; height: 10px; border-radius: 50%; }
    .dot-r { background: #ef4444; }
    .dot-y { background: #eab308; }
    .dot-g { background: #22c55e; }
    .preview-title {
      margin-left: 8px;
      color: var(--faint);
      font-family: var(--mono);
      font-size: 12px;
    }
    .preview pre {
      margin: 0;
      padding: 20px 22px 24px;
      overflow-x: auto;
      font-size: 13px;
      line-height: 1.75;
      color: var(--muted);
      position: relative;
    }
    .prompt { color: var(--cyan); }
    .cmd { color: var(--text); font-weight: 600; }
    .fail { color: var(--bad); }
    .pass { color: var(--ok); }
    .warn { color: var(--warn); }

    /* Sections */
    section { padding: clamp(56px, 8vw, 96px) 0; }
    .section-label {
      display: block;
      margin-bottom: 12px;
      color: var(--brand);
      font-family: var(--mono);
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    h2 {
      margin: 0 0 12px;
      font-size: clamp(1.75rem, 4vw, 2.25rem);
      letter-spacing: -0.025em;
      font-weight: 600;
      line-height: 1.15;
    }
    .section-desc {
      margin: 0 0 40px;
      max-width: 52ch;
      color: var(--muted);
      font-size: 16px;
      line-height: 1.7;
    }
    .section-head.center { text-align: center; }
    .section-head.center .section-desc { margin-left: auto; margin-right: auto; }

    /* Bento feature grid */
    .bento {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    .bento-card {
      position: relative;
      padding: 28px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      backdrop-filter: blur(12px);
      transition: border-color 0.22s, transform 0.22s var(--ease);
    }
    .bento-card:hover {
      border-color: var(--border-strong);
      transform: translateY(-2px);
    }
    .bento-icon {
      width: 40px;
      height: 40px;
      margin-bottom: 16px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      background: rgba(129, 140, 248, 0.12);
      border: 1px solid rgba(129, 140, 248, 0.22);
      color: var(--brand);
    }
    .bento-card h3 {
      margin: 0 0 8px;
      font-size: 16px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    .bento-card p {
      margin: 0;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.65;
    }

    /* Studio CTA band */
    .cta-band {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: clamp(32px, 5vw, 48px);
      background:
        linear-gradient(135deg, rgba(129, 140, 248, 0.08), rgba(34, 211, 238, 0.04)),
        var(--surface);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      flex-wrap: wrap;
    }
    .cta-band h2 { margin-bottom: 8px; }
    .cta-band p { margin: 0; color: var(--muted); font-size: 15px; max-width: 42ch; }

    /* Docs row */
    .link-row {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
    }
    .link-card {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 22px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      transition: border-color 0.2s, transform 0.2s var(--ease);
    }
    .link-card:hover {
      border-color: rgba(129, 140, 248, 0.35);
      transform: translateY(-2px);
    }
    .link-card svg { flex: none; color: var(--brand); margin-top: 2px; }
    .link-card strong { display: block; font-size: 15px; margin-bottom: 4px; }
    .link-card span { color: var(--muted); font-size: 14px; line-height: 1.55; }

    /* Pricing */
    .pricing {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    .price-card {
      padding: 28px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      display: flex;
      flex-direction: column;
    }
    .price-card.featured {
      border-color: rgba(129, 140, 248, 0.35);
      background: linear-gradient(180deg, rgba(129, 140, 248, 0.06) 0%, var(--surface) 40%);
    }
    .price-card h3 { margin: 0 0 4px; font-size: 16px; font-weight: 600; }
    .price {
      margin: 12px 0 8px;
      font-size: 2rem;
      font-weight: 600;
      letter-spacing: -0.03em;
    }
    .price small { color: var(--muted); font-size: 14px; font-weight: 500; }
    .price-card > p {
      margin: 0 0 20px;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.6;
    }
    .price-card ul {
      margin: 0 0 24px;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 8px;
      color: var(--muted);
      font-size: 13px;
      flex: 1;
    }
    .price-card li::before {
      content: "·";
      color: var(--brand);
      font-weight: 700;
      margin-right: 8px;
    }
    .price-card .btn { width: 100%; }

    /* Footer */
    footer {
      border-top: 1px solid var(--border);
      padding: 40px 0 32px;
    }
    .foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      flex-wrap: wrap;
    }
    .foot p { margin: 0; color: var(--faint); font-size: 13px; }
    .foot-links {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
    }
    .foot-links a {
      color: var(--muted);
      font-size: 13px;
      transition: color 0.18s;
    }
    .foot-links a:hover { color: var(--text); }

    @media (max-width: 900px) {
      .bento, .pricing { grid-template-columns: 1fr; }
      .link-row { grid-template-columns: 1fr; }
    }
    @media (max-width: 768px) {
      .shell { width: min(var(--max), calc(100vw - 32px)); }
      .nav-links, .nav-actions .nav-link, .nav-actions .btn { display: none; }
      .nav-toggle { display: grid; }
      .mobile-menu.open { display: block; }
      .cta-band { flex-direction: column; align-items: flex-start; }
      .hero-actions .btn-lg { flex: 1 1 100%; }
    }
    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto; }
      *, *::before, *::after { animation: none !important; transition-duration: 0.01ms !important; }
    }
  </style>
</head>
<body>
  <div class="backdrop" aria-hidden="true"></div>

  <header class="nav" id="siteHeader">
    <div class="shell nav-inner">
      <a class="brand" href="#top">
        <span class="mark">m</span>
        <span>Morph</span>
      </a>
      <nav class="nav-links" aria-label="Primary">
        <a class="nav-link" href="#product">Product</a>
        <a class="nav-link" href="#demo">Demo</a>
        <a class="nav-link" href="#studio">Studio</a>
        <a class="nav-link" href="#docs">Docs</a>
        <a class="nav-link" href="#pricing">Pricing</a>
      </nav>
      <div class="nav-actions">
        ${sessionBlock}
        <a class="btn btn-primary" href="/studio">Launch Studio</a>
        <button class="nav-toggle" id="navToggle" aria-expanded="false" aria-controls="mobileMenu" aria-label="Open menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
      </div>
    </div>
    <div class="mobile-menu" id="mobileMenu">
      <a href="#product">Product</a>
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
      <div class="shell">
        <div class="badge">
          <span class="badge-dot"></span>
          CI for agent-written frontend
        </div>
        <h1>AI writes the UI. <span class="gradient">Morph makes it belong.</span></h1>
        <p class="lede">Catch design-system drift, explain every violation, and emit deterministic patches — before a PR reaches human review.</p>
        <div class="hero-actions">
          <a class="btn btn-primary btn-lg" href="/studio">
            Launch Studio
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </a>
          <a class="btn btn-ghost btn-lg" href="#demo">See the demo</a>
        </div>

        <div class="preview" id="heroPreview">
          <div class="preview-bar">
            <span class="dot dot-r"></span>
            <span class="dot dot-y"></span>
            <span class="dot dot-g"></span>
            <span class="preview-title">morph loop</span>
          </div>
          <pre><span class="prompt">$</span> <span class="cmd">morph verify</span>
<span class="fail">${projectName}: FAIL (68/100)</span>

<span class="prompt">$</span> <span class="cmd">morph repair --apply</span>
<span class="pass">9 deterministic replacements</span>

<span class="prompt">$</span> <span class="cmd">morph verify</span>
<span class="pass">${projectName}: PASS (100/100)</span></pre>
        </div>
      </div>
    </section>

    <section id="product">
      <div class="shell">
        <div class="section-head center">
          <span class="section-label">Product</span>
          <h2>One gate. Four engines.</h2>
          <p class="section-desc">Morph native rules, Buoy health scoring, ESLint token linting, and axe accessibility — unified in a single verify pass.</p>
        </div>
        <div class="bento">
          <div class="bento-card">
            <div class="bento-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <h3>Detect drift</h3>
            <p>Hardcoded colors, off-grid radii, raw HTML, missing focus states — flagged with severity and file paths.</p>
          </div>
          <div class="bento-card">
            <div class="bento-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            </div>
            <h3>Repair deterministically</h3>
            <p>Exact token replacements and component swaps your agent can apply — no guesswork, no LLM rewrites.</p>
          </div>
          <div class="bento-card">
            <div class="bento-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/></svg>
            </div>
            <h3>Open the gate</h3>
            <p>JSON receipts attach to PRs. Merge when the score passes threshold — ready for human review.</p>
          </div>
        </div>
      </div>
    </section>

    <section id="demo">
      <div class="shell">
        <div class="section-head">
          <span class="section-label">Demo</span>
          <h2>Verify → repair → verify</h2>
          <p class="section-desc">The shipped fixture, ${projectName}, starts with seeded drift. One loop turns a failing gate into a passing one.</p>
        </div>
        <div class="preview">
          <div class="preview-bar">
            <span class="dot dot-r"></span>
            <span class="dot dot-y"></span>
            <span class="dot dot-g"></span>
            <span class="preview-title">terminal</span>
          </div>
          <pre><span class="prompt">$</span> <span class="cmd">morph verify</span>
<span class="fail">${projectName}: FAIL (68/100)</span>
  <span class="warn">high</span>   hardcoded-color     #7c3aed → var(--color-primary)
  <span class="warn">high</span>   radius-drift        rounded-[28px] → var(--radius-card)
  <span class="warn">high</span>   component-drift     &lt;button&gt; → &lt;Button variant="primary"&gt;

<span class="prompt">$</span> <span class="cmd">morph repair --apply</span>
<span class="pass">9 deterministic replacements across 1 file</span>

<span class="prompt">$</span> <span class="cmd">morph verify</span>
<span class="pass">${projectName}: PASS (100/100) — merge gate open</span></pre>
        </div>
      </div>
    </section>

    <section id="studio">
      <div class="shell">
        <div class="cta-band">
          <div>
            <span class="section-label">Studio</span>
            <h2>Review console for agent branches</h2>
            <p>Findings, exact patches, score history, and merge gate status — in one dashboard.</p>
          </div>
          <a class="btn btn-primary btn-lg" href="/studio">Launch Studio</a>
        </div>
      </div>
    </section>

    <section id="docs">
      <div class="shell">
        <div class="section-head">
          <span class="section-label">Docs</span>
          <h2>Source, docs, and API</h2>
          <p class="section-desc">The public repo includes the seeded fixture, CLI loop, Studio server, and CI workflow.</p>
        </div>
        <div class="link-row">
          <a class="link-card" href="${REPO_URL}" target="_blank" rel="noreferrer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.72.5.1.68-.22.68-.49v-1.7c-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.9-.64.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05a9.4 9.4 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9v2.82c0 .27.18.6.69.49A10.26 10.26 0 0 0 22 12.25C22 6.58 17.52 2 12 2z"/></svg>
            <div><strong>GitHub</strong><span>Source, issues, CLI, Studio server, and the seeded fixture.</span></div>
          </a>
          <a class="link-card" href="${REPO_URL}#readme" target="_blank" rel="noreferrer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>
            <div><strong>Documentation</strong><span>Quickstart, commands, report shape, auth, and API map.</span></div>
          </a>
        </div>
      </div>
    </section>

    <section id="pricing">
      <div class="shell">
        <div class="section-head center">
          <span class="section-label">Pricing</span>
          <h2>Start free. Scale when ready.</h2>
          <p class="section-desc">The local loop is MIT-licensed. Team features add shared Studio reviews and billing.</p>
        </div>
        <div class="pricing">
          <div class="price-card">
            <h3>Local</h3>
            <div class="price">$0 <small>forever</small></div>
            <p>Verify, repair, loop, and Studio — locally or in CI.</p>
            <ul>
              <li>Deterministic CLI repair loop</li>
              <li>JSON receipts and stored runs</li>
              <li>GitHub Actions workflow</li>
            </ul>
            <a class="btn btn-ghost" href="#docs">Read docs</a>
          </div>
          <div class="price-card featured">
            <h3>Team</h3>
            <div class="price">$29 <small>/ seat / mo</small></div>
            <p>Shared Studio runs for teams reviewing agent branches.</p>
            <ul>
              <li>Interactive Studio reviews</li>
              <li>GitHub and Google SSO</li>
              <li>Stripe-ready checkout</li>
            </ul>
            <a class="btn btn-primary" href="/studio">Launch Studio</a>
          </div>
          <div class="price-card">
            <h3>Enterprise</h3>
            <div class="price">Custom</div>
            <p>For teams gating many products and agent workflows.</p>
            <ul>
              <li>Custom grammar rules</li>
              <li>Workspace-scoped run storage</li>
              <li>Deployment support</li>
            </ul>
            <a class="btn btn-ghost" href="${REPO_URL}/issues" target="_blank" rel="noreferrer">Talk to us</a>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <div class="shell foot">
      <a class="brand" href="#top"><span class="mark">m</span><span>Morph</span></a>
      <p>© <span id="year">2026</span> Morph · MIT licensed</p>
      <div class="foot-links">
        <a href="${REPO_URL}" target="_blank" rel="noreferrer">GitHub</a>
        <a href="/api/health">API</a>
        <a href="/login?returnTo=%2Fstudio">Log in</a>
      </div>
    </div>
  </footer>

  <script>
    (function () {
      var year = document.getElementById("year");
      if (year) year.textContent = String(new Date().getFullYear());

      var header = document.getElementById("siteHeader");
      function updateHeader() {
        if (!header) return;
        header.classList.toggle("scrolled", window.scrollY > 8);
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
        menu.addEventListener("click", function (e) {
          if (e.target && e.target.tagName === "A") {
            menu.classList.remove("open");
            toggle.setAttribute("aria-expanded", "false");
          }
        });
      }

      var preview = document.getElementById("heroPreview");
      if (preview) {
        preview.addEventListener("mousemove", function (e) {
          var r = preview.getBoundingClientRect();
          preview.style.setProperty("--spot-x", ((e.clientX - r.left) / r.width * 100) + "%");
        });
      }
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
