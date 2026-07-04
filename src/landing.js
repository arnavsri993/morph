const REPO_URL = "https://github.com/arnavsri993/morph";

export function landingHtml(config, session) {
  const projectName = escapeHtml(config.projectName ?? "Acme Control Plane");
  const sessionBlock = session
    ? `<a class="login-link" href="/studio" title="Open Studio">${escapeHtml(session.name || session.email)}</a>`
    : `<a class="login-link" href="/login?returnTo=%2Fstudio">Log in</a>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Morph — CI for agent-written frontend</title>
  <meta name="description" content="Morph catches design-system drift in AI-generated frontend, explains every finding, and emits deterministic repair patches — before the PR reaches a human.">
  <meta property="og:title" content="Morph — CI for agent-written frontend">
  <meta property="og:description" content="AI writes the UI. Morph makes it belong. Verify, repair, and gate agent-generated frontend with deterministic patches and JSON receipts.">
  <meta property="og:type" content="website">
  <meta name="theme-color" content="#04060c">
  <style>
    :root {
      color-scheme: dark;
      --bg: #04060c;
      --bg-soft: #070b15;
      --raised: rgba(13, 19, 34, 0.62);
      --ink: #e9effd;
      --muted: #97a3c0;
      --faint: #67738f;
      --line: rgba(151, 163, 192, 0.14);
      --line-strong: rgba(151, 163, 192, 0.28);
      --accent: #5b8cff;
      --accent-2: #22d3ee;
      --violet: #8b5cf6;
      --ok: #34d399;
      --bad: #fb7185;
      --warn: #fbbf24;
      --font: "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: var(--font);
      font-size: 16px;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
    }
    ::selection { background: rgba(91, 140, 255, 0.35); }
    :focus-visible { outline: 2px solid var(--accent-2); outline-offset: 2px; border-radius: 4px; }
    a { color: inherit; }
    .skip {
      position: absolute;
      left: -9999px;
      top: 0;
      background: var(--accent);
      color: #fff;
      padding: 10px 16px;
      border-radius: 0 0 8px 0;
      z-index: 100;
    }
    .skip:focus { left: 0; }

    /* ── Background artifacts ─────────────────────────────────────────── */
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: -1;
      overflow: hidden;
      pointer-events: none;
    }
    .grid-bg {
      position: absolute;
      inset: -2px;
      background-image:
        linear-gradient(rgba(151, 163, 192, 0.055) 1px, transparent 1px),
        linear-gradient(90deg, rgba(151, 163, 192, 0.055) 1px, transparent 1px);
      background-size: 44px 44px;
      -webkit-mask-image: radial-gradient(ellipse 120% 68% at 50% 0%, black 30%, transparent 78%);
      mask-image: radial-gradient(ellipse 120% 68% at 50% 0%, black 30%, transparent 78%);
    }
    .orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(90px);
      opacity: 0.5;
      will-change: transform;
    }
    .orb-a {
      width: 620px; height: 620px;
      left: -180px; top: -220px;
      background: radial-gradient(circle at 35% 35%, rgba(91, 140, 255, 0.55), transparent 65%);
      animation: drift-a 26s ease-in-out infinite alternate;
    }
    .orb-b {
      width: 540px; height: 540px;
      right: -200px; top: 60px;
      background: radial-gradient(circle at 60% 40%, rgba(139, 92, 246, 0.42), transparent 65%);
      animation: drift-b 32s ease-in-out infinite alternate;
    }
    .orb-c {
      width: 460px; height: 460px;
      left: 34%; top: 46%;
      background: radial-gradient(circle at 50% 50%, rgba(34, 211, 238, 0.20), transparent 65%);
      animation: drift-c 38s ease-in-out infinite alternate;
    }
    @keyframes drift-a { to { transform: translate3d(70px, 50px, 0) scale(1.06); } }
    @keyframes drift-b { to { transform: translate3d(-60px, 80px, 0) scale(1.1); } }
    @keyframes drift-c { to { transform: translate3d(40px, -60px, 0) scale(0.94); } }
    .beam {
      position: absolute;
      left: 50%;
      top: -340px;
      width: 1200px;
      height: 720px;
      transform: translateX(-50%);
      background: conic-gradient(from 180deg at 50% 0%, transparent 42%, rgba(91, 140, 255, 0.14) 50%, transparent 58%);
      filter: blur(6px);
    }
    .noise {
      position: absolute;
      inset: 0;
      opacity: 0.5;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.028 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");
    }

    .shell {
      width: min(1180px, calc(100vw - 40px));
      margin: 0 auto;
    }

    /* ── Header ───────────────────────────────────────────────────────── */
    .site-header {
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 50;
      transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
      border-bottom: 1px solid transparent;
    }
    .site-header.scrolled {
      background: rgba(4, 6, 12, 0.78);
      -webkit-backdrop-filter: blur(18px) saturate(1.4);
      backdrop-filter: blur(18px) saturate(1.4);
      border-bottom-color: var(--line);
      box-shadow: 0 12px 40px -20px rgba(0, 0, 0, 0.8);
    }
    .nav-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      min-height: 68px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      font-weight: 700;
      font-size: 17px;
      letter-spacing: -0.01em;
    }
    .mark {
      width: 32px; height: 32px;
      border-radius: 9px;
      display: grid;
      place-items: center;
      font-size: 15px;
      font-weight: 800;
      color: #fff;
      background: linear-gradient(135deg, #5b8cff 0%, #7c5cff 55%, #22d3ee 130%);
      box-shadow: 0 0 0 1px rgba(91, 140, 255, 0.4), 0 6px 20px -6px rgba(91, 140, 255, 0.7);
    }
    .brand-tag {
      color: var(--faint);
      font-weight: 500;
      font-size: 13px;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 2px 9px;
      margin-left: 2px;
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .nav-links a {
      text-decoration: none;
      color: var(--muted);
      font-size: 14px;
      font-weight: 550;
      padding: 8px 13px;
      border-radius: 8px;
      transition: color 0.15s ease, background 0.15s ease;
    }
    .nav-links a:hover { color: var(--ink); background: rgba(151, 163, 192, 0.09); }
    .nav-actions {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .login-link {
      text-decoration: none;
      color: var(--muted);
      font-size: 14px;
      font-weight: 600;
      padding: 8px 10px;
      border-radius: 8px;
      transition: color 0.15s ease;
      white-space: nowrap;
    }
    .login-link:hover { color: var(--ink); }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 42px;
      padding: 0 19px;
      border-radius: 10px;
      border: 0;
      font: inherit;
      font-size: 14.5px;
      font-weight: 650;
      text-decoration: none;
      cursor: pointer;
      white-space: nowrap;
      transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease, border-color 0.15s ease;
    }
    .btn svg { flex: none; }
    .btn-primary {
      color: #fff;
      background: linear-gradient(135deg, #5b8cff, #7c5cff);
      box-shadow: 0 0 0 1px rgba(120, 140, 255, 0.45) inset, 0 14px 34px -12px rgba(91, 140, 255, 0.65);
    }
    .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 0 0 1px rgba(140, 160, 255, 0.6) inset, 0 18px 42px -12px rgba(91, 140, 255, 0.8);
    }
    .btn-ghost {
      color: var(--ink);
      background: rgba(151, 163, 192, 0.06);
      border: 1px solid var(--line-strong);
    }
    .btn-ghost:hover { border-color: rgba(151, 163, 192, 0.5); background: rgba(151, 163, 192, 0.11); }
    .btn-lg { min-height: 50px; padding: 0 26px; font-size: 15.5px; border-radius: 12px; }

    .nav-toggle {
      display: none;
      width: 40px; height: 40px;
      border: 1px solid var(--line-strong);
      border-radius: 9px;
      background: transparent;
      color: var(--ink);
      cursor: pointer;
      place-items: center;
    }
    .mobile-menu {
      display: none;
      border-top: 1px solid var(--line);
      background: rgba(4, 6, 12, 0.96);
      -webkit-backdrop-filter: blur(18px);
      backdrop-filter: blur(18px);
      padding: 14px 20px 22px;
    }
    .mobile-menu a {
      display: block;
      text-decoration: none;
      color: var(--ink);
      font-weight: 600;
      padding: 12px 6px;
      border-bottom: 1px solid var(--line);
    }
    .mobile-menu .btn { margin-top: 14px; width: 100%; }

    /* ── Hero ─────────────────────────────────────────────────────────── */
    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.02fr) minmax(360px, 0.98fr);
      gap: 56px;
      align-items: center;
      padding: 158px 0 96px;
      position: relative;
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      border: 1px solid var(--line-strong);
      background: rgba(91, 140, 255, 0.08);
      border-radius: 999px;
      padding: 6px 14px 6px 8px;
      font-size: 13px;
      font-weight: 600;
      color: var(--muted);
      margin-bottom: 26px;
    }
    .eyebrow .dot {
      width: 20px; height: 20px;
      border-radius: 6px;
      display: grid;
      place-items: center;
      font-size: 11px;
      font-weight: 800;
      color: #fff;
      background: linear-gradient(135deg, #5b8cff, #7c5cff);
    }
    .eyebrow strong { color: var(--ink); font-weight: 650; }
    h1 {
      margin: 0 0 22px;
      font-size: clamp(38px, 5.4vw, 62px);
      line-height: 1.04;
      letter-spacing: -0.03em;
      font-weight: 750;
    }
    .grad {
      background: linear-gradient(92deg, #5b8cff 0%, #22d3ee 55%, #8b5cf6 110%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .lede {
      margin: 0 0 34px;
      color: var(--muted);
      font-size: 18px;
      line-height: 1.65;
      max-width: 560px;
    }
    .lede strong { color: var(--ink); font-weight: 600; }
    .cta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      align-items: center;
      margin-bottom: 34px;
    }
    .proof-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .proof {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid var(--line);
      background: rgba(13, 19, 34, 0.5);
      border-radius: 999px;
      padding: 7px 14px;
      font-size: 13px;
      color: var(--muted);
      font-weight: 550;
    }
    .proof b { color: var(--ink); font-weight: 700; }
    .proof .p-ok { color: var(--ok); }
    .proof .p-bad { color: var(--bad); }

    /* ── Terminal ─────────────────────────────────────────────────────── */
    .hero-visual { position: relative; }
    .terminal {
      position: relative;
      border-radius: 16px;
      border: 1px solid var(--line-strong);
      background: rgba(5, 8, 17, 0.88);
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
      box-shadow:
        0 0 0 1px rgba(0, 0, 0, 0.4),
        0 30px 80px -20px rgba(0, 0, 0, 0.85),
        0 0 120px -30px rgba(91, 140, 255, 0.35);
      overflow: hidden;
      z-index: 2;
    }
    .term-head {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--line);
      background: rgba(151, 163, 192, 0.05);
    }
    .t-dot { width: 11px; height: 11px; border-radius: 50%; }
    .t-dot.r { background: #ff5f57; }
    .t-dot.y { background: #febc2e; }
    .t-dot.g { background: #28c840; }
    .term-title {
      margin-left: 8px;
      font-family: var(--mono);
      font-size: 12px;
      color: var(--faint);
    }
    .term-replay {
      margin-left: auto;
      border: 1px solid var(--line-strong);
      background: transparent;
      color: var(--muted);
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      border-radius: 7px;
      padding: 4px 11px;
      cursor: pointer;
      transition: color 0.15s ease, border-color 0.15s ease;
    }
    .term-replay:hover { color: var(--ink); border-color: rgba(151, 163, 192, 0.55); }
    .term-body {
      font-family: var(--mono);
      font-size: 13px;
      line-height: 1.75;
      padding: 18px 20px 22px;
      min-height: 328px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .term-line { min-height: 1.75em; }
    .t-prompt { color: var(--accent-2); }
    .t-cmd { color: var(--ink); font-weight: 600; }
    .t-dim { color: #7d89a8; }
    .t-fail { color: var(--bad); font-weight: 600; }
    .t-pass { color: var(--ok); font-weight: 600; }
    .t-warn { color: var(--warn); }
    .t-acc { color: var(--accent); }
    .caret {
      display: inline-block;
      width: 8px; height: 1.15em;
      vertical-align: text-bottom;
      background: var(--accent-2);
      animation: blink 1s steps(1) infinite;
    }
    @keyframes blink { 50% { opacity: 0; } }

    .drift-chip {
      position: absolute;
      z-index: 3;
      font-family: var(--mono);
      font-size: 11.5px;
      color: var(--muted);
      border: 1px solid var(--line-strong);
      background: rgba(9, 13, 25, 0.85);
      -webkit-backdrop-filter: blur(8px);
      backdrop-filter: blur(8px);
      border-radius: 9px;
      padding: 7px 12px;
      box-shadow: 0 14px 34px -14px rgba(0, 0, 0, 0.8);
      white-space: nowrap;
      animation: chip-float 7s ease-in-out infinite alternate;
    }
    .drift-chip .ok { color: var(--ok); }
    .drift-chip .bad { color: var(--bad); }
    .chip-1 { top: -22px; right: 22px; animation-delay: -1s; }
    .chip-2 { bottom: -24px; left: -30px; animation-delay: -3.5s; }
    .chip-3 { bottom: -30px; right: 40px; animation-delay: -5s; }
    @keyframes chip-float { to { transform: translateY(-10px); } }

    /* ── Sections ─────────────────────────────────────────────────────── */
    section { position: relative; }
    .section { padding: 96px 0; }
    .section-head { max-width: 640px; margin-bottom: 52px; }
    .kicker {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 14px;
    }
    .kicker::before {
      content: "";
      width: 22px; height: 2px;
      border-radius: 2px;
      background: linear-gradient(90deg, var(--accent), var(--accent-2));
    }
    h2 {
      margin: 0 0 16px;
      font-size: clamp(28px, 3.4vw, 40px);
      line-height: 1.12;
      letter-spacing: -0.02em;
      font-weight: 720;
    }
    .section-head p { margin: 0; color: var(--muted); font-size: 16.5px; }

    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--line-strong), transparent);
    }

    /* Pipeline */
    .pipeline {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      padding: 26px 28px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(13, 19, 34, 0.66), rgba(13, 19, 34, 0.35));
      margin-top: 8px;
    }
    .pipe-node {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      font-family: var(--mono);
      font-size: 12.5px;
      font-weight: 600;
      color: var(--ink);
      border: 1px solid var(--line-strong);
      background: rgba(4, 6, 12, 0.7);
      border-radius: 10px;
      padding: 9px 14px;
    }
    .pipe-node .n { 
      width: 18px; height: 18px;
      border-radius: 6px;
      display: grid;
      place-items: center;
      font-size: 10px;
      font-weight: 800;
      color: #fff;
      background: linear-gradient(135deg, var(--accent), var(--violet));
      font-family: var(--font);
    }
    .pipe-node.final { border-color: rgba(52, 211, 153, 0.5); color: var(--ok); }
    .pipe-node.final .n { background: linear-gradient(135deg, #10b981, #34d399); }
    .pipe-arrow { color: var(--faint); font-family: var(--mono); font-size: 14px; }

    /* Feature grid */
    .grid-3 {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px;
    }
    .card {
      border: 1px solid var(--line);
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(13, 19, 34, 0.66), rgba(13, 19, 34, 0.3));
      padding: 26px 24px;
      transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
      position: relative;
      overflow: hidden;
    }
    .card::before {
      content: "";
      position: absolute;
      inset: 0 0 auto;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(91, 140, 255, 0.5), transparent);
      opacity: 0;
      transition: opacity 0.25s ease;
    }
    .card:hover {
      transform: translateY(-3px);
      border-color: rgba(91, 140, 255, 0.35);
      box-shadow: 0 24px 60px -24px rgba(0, 0, 0, 0.7);
    }
    .card:hover::before { opacity: 1; }
    .card-icon {
      width: 40px; height: 40px;
      border-radius: 11px;
      display: grid;
      place-items: center;
      color: var(--accent);
      background: rgba(91, 140, 255, 0.1);
      border: 1px solid rgba(91, 140, 255, 0.25);
      margin-bottom: 18px;
    }
    .card h3 {
      margin: 0 0 8px;
      font-size: 16.5px;
      font-weight: 680;
      letter-spacing: -0.01em;
    }
    .card p { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.62; }
    .card code {
      font-family: var(--mono);
      font-size: 12.5px;
      color: var(--accent-2);
      background: rgba(34, 211, 238, 0.08);
      border-radius: 5px;
      padding: 1px 5px;
    }

    /* Demo section */
    .demo-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 22px;
      align-items: stretch;
    }
    .code-panel {
      border: 1px solid var(--line);
      border-radius: 16px;
      background: rgba(5, 8, 17, 0.85);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .code-panel-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 18px;
      border-bottom: 1px solid var(--line);
      background: rgba(151, 163, 192, 0.05);
      font-family: var(--mono);
      font-size: 12px;
      color: var(--faint);
    }
    .copy-btn {
      border: 1px solid var(--line-strong);
      background: transparent;
      color: var(--muted);
      font: inherit;
      font-size: 11.5px;
      font-weight: 600;
      border-radius: 6px;
      padding: 3px 10px;
      cursor: pointer;
      transition: color 0.15s ease, border-color 0.15s ease;
    }
    .copy-btn:hover { color: var(--ink); border-color: rgba(151, 163, 192, 0.55); }
    .code-body {
      font-family: var(--mono);
      font-size: 13px;
      line-height: 1.8;
      padding: 18px 20px;
      margin: 0;
      overflow-x: auto;
      flex: 1;
    }
    .code-body .c-key { color: #8ab4ff; }
    .code-body .c-str { color: #7ee0c2; }
    .code-body .c-num { color: #fbbf24; }
    .code-body .c-dim { color: #67738f; }
    .code-body .c-cmd { color: var(--ink); font-weight: 600; }
    .code-body .c-prompt { color: var(--accent-2); }
    .demo-steps {
      display: grid;
      gap: 12px;
      margin-top: 22px;
    }
    .demo-step {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      border: 1px solid var(--line);
      border-radius: 13px;
      background: rgba(13, 19, 34, 0.45);
      padding: 15px 17px;
    }
    .demo-step .n {
      flex: none;
      width: 24px; height: 24px;
      border-radius: 8px;
      display: grid;
      place-items: center;
      font-size: 12px;
      font-weight: 800;
      color: #fff;
      background: linear-gradient(135deg, var(--accent), var(--violet));
      margin-top: 1px;
    }
    .demo-step strong { display: block; font-size: 14px; margin-bottom: 2px; }
    .demo-step span { color: var(--muted); font-size: 13px; line-height: 1.55; }

    /* Studio section */
    .studio-wrap {
      display: grid;
      grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
      gap: 46px;
      align-items: center;
    }
    .journey-list { display: grid; gap: 10px; margin: 26px 0 30px; padding: 0; list-style: none; }
    .journey-list li {
      display: flex;
      align-items: center;
      gap: 12px;
      color: var(--muted);
      font-size: 14.5px;
    }
    .journey-list .jn {
      flex: none;
      width: 22px; height: 22px;
      border-radius: 7px;
      display: grid;
      place-items: center;
      font-size: 11px;
      font-weight: 800;
      color: var(--accent);
      background: rgba(91, 140, 255, 0.1);
      border: 1px solid rgba(91, 140, 255, 0.3);
    }
    .journey-list b { color: var(--ink); font-weight: 620; }
    .browser {
      border: 1px solid var(--line-strong);
      border-radius: 18px;
      background: rgba(6, 9, 18, 0.9);
      box-shadow: 0 40px 100px -30px rgba(0, 0, 0, 0.85), 0 0 140px -40px rgba(139, 92, 246, 0.3);
      overflow: hidden;
    }
    .browser-chrome {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--line);
      background: rgba(151, 163, 192, 0.05);
    }
    .url-pill {
      flex: 1;
      max-width: 320px;
      margin: 0 auto;
      text-align: center;
      font-family: var(--mono);
      font-size: 11.5px;
      color: var(--faint);
      border: 1px solid var(--line);
      background: rgba(4, 6, 12, 0.7);
      border-radius: 999px;
      padding: 5px 14px;
    }
    .browser-body { padding: 22px; }
    .review-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .score-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-family: var(--mono);
      font-size: 12.5px;
      font-weight: 700;
      border-radius: 999px;
      padding: 6px 13px;
      border: 1px solid;
    }
    .score-pill.fail { color: var(--bad); border-color: rgba(251, 113, 133, 0.45); background: rgba(251, 113, 133, 0.08); }
    .score-pill.pass { color: var(--ok); border-color: rgba(52, 211, 153, 0.45); background: rgba(52, 211, 153, 0.08); }
    .compare-mini {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }
    .mini {
      border: 1px solid var(--line);
      border-radius: 12px;
      background: #0b1020;
      padding: 14px;
    }
    .mini-label {
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 7px;
    }
    .mini.before .mini-label { color: var(--bad); }
    .mini.after .mini-label { color: var(--ok); }
    .mini-card {
      border: 1px solid rgba(151, 163, 192, 0.22);
      background: #f6f8fc;
      color: #101828;
      padding: 13px;
      font-size: 12px;
    }
    .mini.before .mini-card {
      border-radius: 22px;
      box-shadow: 0 18px 34px rgba(0, 0, 0, 0.5);
    }
    .mini.after .mini-card {
      border-radius: 8px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);
    }
    .mini-card .row { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    .mini-card .t { font-weight: 700; font-size: 12.5px; }
    .mini-card .s { color: #64748b; font-size: 11px; margin-top: 3px; max-width: 150px; }
    .chip-btn {
      border: 0;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      padding: 7px 12px;
      cursor: default;
      white-space: nowrap;
    }
    .mini.before .chip-btn { background: #7c3aed; border-radius: 22px; }
    .mini.after .chip-btn { background: #2563eb; border-radius: 6px; }
    .mini-note {
      margin-top: 11px;
      font-family: var(--mono);
      font-size: 10.5px;
      line-height: 1.6;
      color: var(--faint);
    }
    .mini.before .mini-note .hl { color: var(--bad); }
    .mini.after .mini-note .hl { color: var(--ok); }

    /* Pricing */
    .tiers {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px;
      align-items: stretch;
    }
    .tier {
      border: 1px solid var(--line);
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(13, 19, 34, 0.66), rgba(13, 19, 34, 0.3));
      padding: 30px 26px;
      display: flex;
      flex-direction: column;
      position: relative;
    }
    .tier.popular {
      border-color: rgba(91, 140, 255, 0.55);
      background: linear-gradient(180deg, rgba(23, 32, 58, 0.85), rgba(13, 19, 34, 0.5));
      box-shadow: 0 0 80px -30px rgba(91, 140, 255, 0.5);
    }
    .tier-badge {
      position: absolute;
      top: -12px; left: 50%;
      transform: translateX(-50%);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #fff;
      background: linear-gradient(135deg, var(--accent), var(--violet));
      border-radius: 999px;
      padding: 4px 13px;
      white-space: nowrap;
    }
    .tier h3 { margin: 0 0 6px; font-size: 17px; }
    .tier .price { font-size: 36px; font-weight: 760; letter-spacing: -0.02em; margin: 8px 0 2px; }
    .tier .price small { font-size: 13.5px; font-weight: 500; color: var(--muted); letter-spacing: 0; }
    .tier .tier-sub { color: var(--muted); font-size: 13.5px; margin: 0 0 20px; }
    .tier ul { list-style: none; margin: 0 0 26px; padding: 0; display: grid; gap: 9px; flex: 1; }
    .tier li {
      display: flex;
      gap: 9px;
      align-items: flex-start;
      color: var(--muted);
      font-size: 13.5px;
      line-height: 1.5;
    }
    .tier li::before {
      content: "";
      flex: none;
      width: 15px; height: 15px;
      margin-top: 3px;
      border-radius: 50%;
      background: rgba(52, 211, 153, 0.14) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='9' viewBox='0 0 24 24' fill='none' stroke='%2334d399' stroke-width='3.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6L9 17l-5-5'/%3E%3C/svg%3E") center/9px no-repeat;
    }
    .tier .btn { width: 100%; }
    .tier-note { margin-top: 22px; color: var(--faint); font-size: 12.5px; text-align: center; }
    .tier-note code { font-family: var(--mono); font-size: 11.5px; }

    /* Docs */
    .docs-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
      gap: 22px;
      align-items: stretch;
    }
    .doc-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .doc-card {
      display: block;
      text-decoration: none;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: rgba(13, 19, 34, 0.45);
      padding: 18px;
      transition: border-color 0.2s ease, transform 0.2s ease;
    }
    .doc-card:hover { border-color: rgba(91, 140, 255, 0.4); transform: translateY(-2px); }
    .doc-card strong { display: flex; align-items: center; gap: 8px; font-size: 14px; margin-bottom: 5px; }
    .doc-card strong svg { color: var(--accent); flex: none; }
    .doc-card span { color: var(--muted); font-size: 12.5px; line-height: 1.55; }
    .api-list {
      margin: 0;
      padding: 0;
      list-style: none;
      font-family: var(--mono);
      font-size: 12.5px;
      display: grid;
      gap: 7px;
    }
    .api-list li { display: flex; gap: 10px; align-items: baseline; color: var(--muted); }
    .api-list .m {
      flex: none;
      width: 44px;
      font-weight: 700;
      font-size: 11px;
      text-align: center;
      border-radius: 5px;
      padding: 2px 0;
    }
    .api-list .get { color: var(--accent-2); background: rgba(34, 211, 238, 0.1); }
    .api-list .post { color: var(--warn); background: rgba(251, 191, 36, 0.1); }

    /* Final CTA */
    .cta-final {
      border: 1px solid rgba(91, 140, 255, 0.35);
      border-radius: 22px;
      background:
        radial-gradient(ellipse 90% 140% at 50% -30%, rgba(91, 140, 255, 0.22), transparent 60%),
        linear-gradient(180deg, rgba(13, 19, 34, 0.9), rgba(7, 11, 21, 0.9));
      text-align: center;
      padding: 74px 30px;
      overflow: hidden;
      position: relative;
    }
    .cta-final h2 { margin-bottom: 14px; }
    .cta-final p { color: var(--muted); max-width: 540px; margin: 0 auto 32px; }
    .cta-final .cta-row { justify-content: center; margin-bottom: 0; }

    /* Footer */
    footer {
      border-top: 1px solid var(--line);
      padding: 56px 0 40px;
      background: rgba(4, 6, 12, 0.6);
    }
    .foot-grid {
      display: grid;
      grid-template-columns: 1.4fr 1fr 1fr 1fr;
      gap: 32px;
      margin-bottom: 42px;
    }
    .foot-brand p { color: var(--muted); font-size: 13.5px; max-width: 280px; margin: 14px 0 0; }
    .foot-col h4 {
      margin: 0 0 14px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--faint);
    }
    .foot-col a {
      display: block;
      text-decoration: none;
      color: var(--muted);
      font-size: 13.5px;
      padding: 4px 0;
      transition: color 0.15s ease;
    }
    .foot-col a:hover { color: var(--ink); }
    .foot-bottom {
      border-top: 1px solid var(--line);
      padding-top: 22px;
      display: flex;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      color: var(--faint);
      font-size: 12.5px;
    }

    /* Reveal */
    .reveal { opacity: 0; transform: translateY(20px); transition: opacity 0.7s ease, transform 0.7s ease; }
    .reveal.in { opacity: 1; transform: none; }

    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto; }
      .orb, .drift-chip, .caret { animation: none !important; }
      .reveal { opacity: 1; transform: none; transition: none; }
      * { transition-duration: 0.01ms !important; }
    }

    @media (max-width: 1020px) {
      .hero { grid-template-columns: 1fr; gap: 44px; padding-top: 138px; }
      .hero-visual { max-width: 640px; }
      .grid-3 { grid-template-columns: 1fr 1fr; }
      .studio-wrap, .docs-grid, .demo-grid { grid-template-columns: 1fr; }
      .tiers { grid-template-columns: 1fr; max-width: 480px; margin: 0 auto; }
      .foot-grid { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 860px) {
      .nav-links, .nav-actions .login-link, .nav-actions .btn { display: none; }
      .nav-toggle { display: grid; }
      .mobile-menu.open { display: block; }
    }
    @media (max-width: 640px) {
      .grid-3 { grid-template-columns: 1fr; }
      .section { padding: 68px 0; }
      .hero { padding: 122px 0 64px; }
      .drift-chip { display: none; }
      .compare-mini { grid-template-columns: 1fr; }
      .doc-cards { grid-template-columns: 1fr; }
      .foot-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>

  <div class="backdrop" aria-hidden="true">
    <div class="grid-bg"></div>
    <div class="beam"></div>
    <div class="orb orb-a" data-parallax="14"></div>
    <div class="orb orb-b" data-parallax="-10"></div>
    <div class="orb orb-c" data-parallax="7"></div>
    <div class="noise"></div>
  </div>

  <header class="site-header" id="siteHeader">
    <div class="shell nav-bar">
      <a class="brand" href="#top" aria-label="Morph home">
        <span class="mark">M</span>
        <span>Morph</span>
        <span class="brand-tag">Studio</span>
      </a>
      <nav class="nav-links" aria-label="Primary">
        <a href="#product">Product</a>
        <a href="#demo">Demo</a>
        <a href="#studio">Studio</a>
        <a href="#pricing">Pricing</a>
        <a href="#docs">Docs</a>
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
      <a href="#product">Product</a>
      <a href="#demo">Demo</a>
      <a href="#studio">Studio</a>
      <a href="#pricing">Pricing</a>
      <a href="#docs">Docs</a>
      <a href="/login?returnTo=%2Fstudio">Log in</a>
      <a class="btn btn-primary" href="/studio">Launch Studio</a>
    </div>
  </header>

  <main id="main">
    <span id="top"></span>

    <!-- ── Hero ─────────────────────────────────────────────────────── -->
    <section class="shell hero">
      <div>
        <div class="eyebrow reveal"><span class="dot">M</span> <span><strong>Morph</strong> — CI for agent-written frontend</span></div>
        <h1 class="reveal" style="transition-delay:.06s">AI writes the UI.<br><span class="grad">Morph makes it belong.</span></h1>
        <p class="lede reveal" style="transition-delay:.12s">Morph catches <strong>design-system drift</strong> in agent-generated frontend, explains every finding in plain language, and emits <strong>deterministic repair patches</strong> your agent can apply — before the PR ever reaches a human.</p>
        <div class="cta-row reveal" style="transition-delay:.18s">
          <a class="btn btn-primary btn-lg" href="/studio">
            Launch Studio
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </a>
          <a class="btn btn-ghost btn-lg" href="#demo">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>
            Run the demo
          </a>
        </div>
        <div class="proof-row reveal" style="transition-delay:.24s">
          <span class="proof"><span class="p-bad">68</span> <b>→</b> <span class="p-ok">100</span>&nbsp;review score</span>
          <span class="proof"><b>9</b>&nbsp;drift findings repaired</span>
          <span class="proof"><b>0</b>&nbsp;runtime dependencies</span>
          <span class="proof">JSON receipts for every run</span>
        </div>
      </div>

      <div class="hero-visual reveal" style="transition-delay:.2s">
        <div class="drift-chip chip-1"><span class="bad">rounded-[28px]</span> → <span class="ok">var(--radius-card)</span></div>
        <div class="drift-chip chip-2"><span class="bad">#7c3aed</span> → <span class="ok">var(--color-primary)</span></div>
        <div class="drift-chip chip-3"><span class="bad">&lt;button&gt;</span> → <span class="ok">&lt;Button variant="primary"&gt;</span></div>
        <div class="terminal" id="heroTerminal">
          <div class="term-head">
            <span class="t-dot r"></span><span class="t-dot y"></span><span class="t-dot g"></span>
            <span class="term-title">morph — agent branch review</span>
            <button class="term-replay" id="termReplay" type="button">Replay</button>
          </div>
          <div class="term-body" id="termBody" aria-label="Morph CLI demo transcript"></div>
        </div>
      </div>
    </section>

    <!-- ── Product ──────────────────────────────────────────────────── -->
    <section id="product" class="section">
      <div class="shell">
        <div class="section-head reveal">
          <div class="kicker">Product</div>
          <h2>A consistency layer between coding agents and production frontend</h2>
          <p>Agents ship UI that compiles but quietly breaks your product grammar: off-scale spacing, rogue radii, almost-brand colors, raw markup, lost focus states. Morph turns that into a machine-checkable merge gate.</p>
        </div>

        <div class="pipeline reveal" role="img" aria-label="Pipeline: agent ships UI, morph verify, JSON findings and patches, morph repair apply, pass and merge gate opens">
          <span class="pipe-node"><span class="n">1</span> Agent ships UI</span>
          <span class="pipe-arrow">→</span>
          <span class="pipe-node"><span class="n">2</span> morph verify</span>
          <span class="pipe-arrow">→</span>
          <span class="pipe-node"><span class="n">3</span> JSON findings + patches</span>
          <span class="pipe-arrow">→</span>
          <span class="pipe-node"><span class="n">4</span> morph repair --apply</span>
          <span class="pipe-arrow">→</span>
          <span class="pipe-node final"><span class="n">✓</span> PASS — merge gate opens</span>
        </div>

        <div class="grid-3" style="margin-top: 42px">
          <div class="card reveal">
            <div class="card-icon"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/></svg></div>
            <h3>Token grammar extraction</h3>
            <p>Morph reads <code>tokens.css</code> and your component map to learn the product's visual grammar — color, spacing, radius, type scale, and elevation.</p>
          </div>
          <div class="card reveal" style="transition-delay:.06s">
            <div class="card-icon"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg></div>
            <h3>Drift detection & classification</h3>
            <p>Findings are typed and severity-scored across visual, component, interaction, and responsive surfaces — with the agent's likely intent attached.</p>
          </div>
          <div class="card reveal" style="transition-delay:.12s">
            <div class="card-icon"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a4.5 4.5 0 0 0-6.4 6.4l-5 5V21h3.3l5-5a4.5 4.5 0 0 0 6.4-6.4l-3 3-2.3-2.3 3-3z"/></svg></div>
            <h3>Deterministic repair patches</h3>
            <p>Every finding ships an exact find/replace patch. Repairs are reproducible string operations — no LLM roulette in the merge path.</p>
          </div>
          <div class="card reveal">
            <div class="card-icon"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/></svg></div>
            <h3>Isolated Studio reviews</h3>
            <p>Full reviews run on a disposable <code>.studio-run</code> copy, so the seeded fixture stays intact and every demo is repeatable.</p>
          </div>
          <div class="card reveal" style="transition-delay:.06s">
            <div class="card-icon"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg></div>
            <h3>JSON receipts, stored runs</h3>
            <p>Machine-readable <code>morph.report.v1</code> receipts live under <code>.morph/runs</code> — an audit trail agents and humans can both consume.</p>
          </div>
          <div class="card reveal" style="transition-delay:.12s">
            <div class="card-icon"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg></div>
            <h3>CI merge gate</h3>
            <p><code>morph loop</code> verifies, repairs, and verifies again, returning pass/fail against your score threshold. One step in GitHub Actions.</p>
          </div>
        </div>
      </div>
    </section>

    <div class="shell divider" role="presentation"></div>

    <!-- ── Demo ─────────────────────────────────────────────────────── -->
    <section id="demo" class="section">
      <div class="shell">
        <div class="section-head reveal">
          <div class="kicker">Demo</div>
          <h2>From failing review to open merge gate in three commands</h2>
          <p>The repo ships with ${projectName} — a seeded fixture where an agent-generated billing screen compiles but drifts from the design system in nine distinct ways.</p>
        </div>

        <div class="demo-grid">
          <div class="code-panel reveal">
            <div class="code-panel-head">
              <span>quickstart — zsh</span>
              <button class="copy-btn" type="button" data-copy="git clone ${REPO_URL} && cd morph
npm test
npm run demo
npm run serve">Copy</button>
            </div>
            <pre class="code-body"><span class="c-prompt">$</span> <span class="c-cmd">git clone ${REPO_URL.replace("https://", "")}</span>
<span class="c-prompt">$</span> <span class="c-cmd">cd morph &amp;&amp; npm test</span>
<span class="c-dim"># 8 passing — deterministic scanner suite</span>

<span class="c-prompt">$</span> <span class="c-cmd">npm run demo</span>
<span class="c-dim">Before:</span> <span style="color:var(--bad)">fail (68/100), 9 issue(s)</span>
<span class="c-dim">Repair:</span> 9 replacement(s) across 1 file(s)
<span class="c-dim">After:</span>  <span style="color:var(--ok)">pass (100/100), 0 issue(s)</span>

<span class="c-prompt">$</span> <span class="c-cmd">npm run serve</span>
<span class="c-dim">Morph control plane:</span> <span class="c-str">http://127.0.0.1:4177</span></pre>
          </div>

          <div class="code-panel reveal" style="transition-delay:.08s">
            <div class="code-panel-head">
              <span>demo/reports/demo-repair.json</span>
              <span style="color:var(--ok)">receipt</span>
            </div>
            <pre class="code-body">{
  <span class="c-key">"schemaVersion"</span>: <span class="c-str">"morph.repair.v1"</span>,
  <span class="c-key">"applied"</span>: <span class="c-num">true</span>,
  <span class="c-key">"basedOnScore"</span>: <span class="c-num">68</span>,
  <span class="c-key">"replacements"</span>: <span class="c-num">9</span>,
  <span class="c-key">"risk"</span>: <span class="c-str">"deterministic_replacements_only"</span>,
  <span class="c-key">"patches"</span>: [{
    <span class="c-key">"file"</span>: <span class="c-str">"src/routes/settings/billing.tsx"</span>,
    <span class="c-key">"replacements"</span>: [{
      <span class="c-key">"find"</span>: <span class="c-str">"rounded-[28px]"</span>,
      <span class="c-key">"replace"</span>: <span class="c-str">"rounded-[var(--radius-card)]"</span>
    }, <span class="c-dim">…8 more</span>]
  }]
}</pre>
          </div>
        </div>

        <div class="demo-steps">
          <div class="demo-step reveal"><span class="n">1</span><div><strong>Seeded drift, real receipts</strong><span>The fixture hides hardcoded colors, a rogue 28px radius, raw button markup, a removed focus ring, and mobile overflow risk — Morph catches all nine.</span></div></div>
          <div class="demo-step reveal" style="transition-delay:.05s"><span class="n">2</span><div><strong>Repair runs on a copy</strong><span><code style="font-family:var(--mono);font-size:12px;color:var(--accent-2)">npm run demo</code> repairs a disposable copy and writes before/repair/after receipts, so the seeded catch is repeatable for every viewer.</span></div></div>
          <div class="demo-step reveal" style="transition-delay:.1s"><span class="n">3</span><div><strong>Same loop gates your CI</strong><span>The bundled GitHub Actions workflow runs the test suite, generates the drift report, and proves the repair loop on every push and PR.</span></div></div>
        </div>
      </div>
    </section>

    <div class="shell divider" role="presentation"></div>

    <!-- ── Studio ───────────────────────────────────────────────────── -->
    <section id="studio" class="section">
      <div class="shell studio-wrap">
        <div>
          <div class="section-head reveal" style="margin-bottom:0">
            <div class="kicker">Morph Studio</div>
            <h2>An interactive review journey, not another dashboard</h2>
            <p>Studio turns the stressful "is this AI code safe to merge?" moment into a guided before/after review with narration, receipts, and a one-click repair loop.</p>
          </div>
          <ul class="journey-list reveal" style="transition-delay:.08s">
            <li><span class="jn">1</span><span><b>Narrate review</b> — hear the design critique out loud</span></li>
            <li><span class="jn">2</span><span><b>Inspect agent UI</b> — token-level findings with severity</span></li>
            <li><span class="jn">3</span><span><b>Generate fix plan</b> — deterministic patches, previewed</span></li>
            <li><span class="jn">4</span><span><b>Run full review</b> — repair an isolated copy, re-verify</span></li>
            <li><span class="jn">5</span><span><b>Ship with receipts</b> — stored runs in JSON or readable mode</span></li>
          </ul>
          <div class="cta-row reveal" style="transition-delay:.14s">
            <a class="btn btn-primary btn-lg" href="/studio">
              Launch Studio
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </a>
            <a class="btn btn-ghost btn-lg" href="/login?returnTo=%2Fstudio">Log in</a>
          </div>
        </div>

        <div class="reveal" style="transition-delay:.1s">
          <div class="browser">
            <div class="browser-chrome">
              <span class="t-dot r"></span><span class="t-dot y"></span><span class="t-dot g"></span>
              <span class="url-pill">127.0.0.1:4177/studio</span>
            </div>
            <div class="browser-body">
              <div class="review-strip">
                <span class="score-pill fail">BEFORE · FAIL 68/100</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                <span class="score-pill pass">AFTER · PASS 100/100</span>
              </div>
              <div class="compare-mini">
                <div class="mini before">
                  <div class="mini-label">● Agent output</div>
                  <div class="mini-card">
                    <div class="row">
                      <div><div class="t">Scale plan</div><div class="s">Works, but quietly drifts from the product grammar.</div></div>
                      <button class="chip-btn" tabindex="-1">Update plan</button>
                    </div>
                  </div>
                  <div class="mini-note"><span class="hl">✗ rounded-[28px]</span> · <span class="hl">✗ #7c3aed</span> · <span class="hl">✗ raw &lt;button&gt;</span> · <span class="hl">✗ focus ring removed</span></div>
                </div>
                <div class="mini after">
                  <div class="mini-label">● After Morph repair</div>
                  <div class="mini-card">
                    <div class="row">
                      <div><div class="t">Scale plan</div><div class="s">Snapped back into tokens, components, and focus states.</div></div>
                      <button class="chip-btn" tabindex="-1">Update plan</button>
                    </div>
                  </div>
                  <div class="mini-note"><span class="hl">✓ var(--radius-card)</span> · <span class="hl">✓ var(--color-primary)</span> · <span class="hl">✓ &lt;Button/&gt;</span> · <span class="hl">✓ focus restored</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="shell divider" role="presentation"></div>

    <!-- ── Pricing ──────────────────────────────────────────────────── -->
    <section id="pricing" class="section">
      <div class="shell">
        <div class="section-head reveal">
          <div class="kicker">Pricing</div>
          <h2>Start local, scale to your team</h2>
          <p>The core loop is MIT-licensed and runs anywhere Node 20 does. The product shell is auth- and billing-ready when your team is.</p>
        </div>
        <div class="tiers">
          <div class="tier reveal">
            <h3>Local</h3>
            <div class="price">$0 <small>forever</small></div>
            <p class="tier-sub">The full deterministic loop, on your machine and in your CI.</p>
            <ul>
              <li>morph verify / repair / loop CLI</li>
              <li>JSON receipts + stored runs</li>
              <li>GitHub Actions workflow included</li>
              <li>Zero runtime dependencies</li>
              <li>MIT license</li>
            </ul>
            <a class="btn btn-ghost" href="#docs">Read the quickstart</a>
          </div>
          <div class="tier popular reveal" style="transition-delay:.07s">
            <span class="tier-badge">Most popular</span>
            <h3>Team</h3>
            <div class="price">$29 <small>/ seat / month</small></div>
            <p class="tier-sub">Morph Studio for the whole review loop, with shared history.</p>
            <ul>
              <li>Interactive Studio reviews</li>
              <li>Isolated review copies per run</li>
              <li>Google + GitHub SSO</li>
              <li>Shared run history per workspace</li>
              <li>Stripe-ready checkout</li>
            </ul>
            <a class="btn btn-primary" href="/studio">Launch Studio</a>
          </div>
          <div class="tier reveal" style="transition-delay:.14s">
            <h3>Enterprise</h3>
            <div class="price">Custom</div>
            <p class="tier-sub">For teams gating every agent branch across many products.</p>
            <ul>
              <li>Enforced OAuth mode</li>
              <li>Workspace-scoped run storage</li>
              <li>Custom grammar rules & thresholds</li>
              <li>Deploy on any Node 20 host</li>
              <li>Priority support</li>
            </ul>
            <a class="btn btn-ghost" href="${REPO_URL}/issues" target="_blank" rel="noreferrer">Talk to us</a>
          </div>
        </div>
        <p class="tier-note reveal">Billing runs in stub mode until <code>STRIPE_SECRET_KEY</code> and <code>STRIPE_PRICE_ID</code> are configured — no fake charges, no surprises.</p>
      </div>
    </section>

    <div class="shell divider" role="presentation"></div>

    <!-- ── Docs ─────────────────────────────────────────────────────── -->
    <section id="docs" class="section">
      <div class="shell">
        <div class="section-head reveal">
          <div class="kicker">Docs</div>
          <h2>Everything you need to wire Morph in</h2>
          <p>Point <code style="font-family:var(--mono);font-size:14px;color:var(--accent-2)">morph.config.json</code> at your frontend and token files, then let the loop run.</p>
        </div>
        <div class="docs-grid">
          <div>
            <div class="code-panel reveal">
              <div class="code-panel-head">
                <span>morph.config.json</span>
                <button class="copy-btn" type="button" data-copy='{
  "projectName": "Your App",
  "projectRoot": "apps/web",
  "tokenFiles": ["design-system/tokens.css"],
  "scan": ["src/**/*.tsx"],
  "componentImports": { "Button": "src/components/Button.tsx" },
  "gate": { "minScore": 95, "mergePolicy": "block_on_any_drift" }
}'>Copy</button>
              </div>
              <pre class="code-body">{
  <span class="c-key">"projectName"</span>: <span class="c-str">"Your App"</span>,
  <span class="c-key">"projectRoot"</span>: <span class="c-str">"apps/web"</span>,
  <span class="c-key">"tokenFiles"</span>: [<span class="c-str">"design-system/tokens.css"</span>],
  <span class="c-key">"scan"</span>: [<span class="c-str">"src/**/*.tsx"</span>],
  <span class="c-key">"componentImports"</span>: { <span class="c-key">"Button"</span>: <span class="c-str">"src/components/Button.tsx"</span> },
  <span class="c-key">"gate"</span>: { <span class="c-key">"minScore"</span>: <span class="c-num">95</span>, <span class="c-key">"mergePolicy"</span>: <span class="c-str">"block_on_any_drift"</span> }
}</pre>
            </div>
            <div class="code-panel reveal" style="margin-top:14px">
              <div class="code-panel-head"><span>API surface — morph serve</span></div>
              <div style="padding:16px 20px">
                <ul class="api-list">
                  <li><span class="m get">GET</span> /api/health</li>
                  <li><span class="m get">GET</span> /api/runs · /api/runs/:id · /api/projects</li>
                  <li><span class="m post">POST</span> /api/runs/verify · /api/runs/repair · /api/runs/loop</li>
                  <li><span class="m post">POST</span> /api/studio/review</li>
                  <li><span class="m post">POST</span> /api/billing/checkout · /api/webhooks/stripe</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="doc-cards">
            <a class="doc-card reveal" href="${REPO_URL}#readme" target="_blank" rel="noreferrer">
              <strong><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg> README</strong>
              <span>Why Morph exists, the full command reference, and the report schema.</span>
            </a>
            <a class="doc-card reveal" style="transition-delay:.05s" href="${REPO_URL}/blob/main/DEMO.md" target="_blank" rel="noreferrer">
              <strong><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg> Demo runbook</strong>
              <span>The one-minute video script and live judge flow, step by step.</span>
            </a>
            <a class="doc-card reveal" style="transition-delay:.1s" href="${REPO_URL}/blob/main/docs/product-architecture.md" target="_blank" rel="noreferrer">
              <strong><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> Architecture</strong>
              <span>The workspace/project/run model, auth modes, and deployment notes.</span>
            </a>
            <a class="doc-card reveal" style="transition-delay:.15s" href="${REPO_URL}" target="_blank" rel="noreferrer">
              <strong><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.72.5.1.68-.22.68-.49v-1.7c-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.9-.64.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05a9.4 9.4 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9v2.82c0 .27.18.6.69.49A10.26 10.26 0 0 0 22 12.25C22 6.58 17.52 2 12 2z"/></svg> GitHub</strong>
              <span>Source, issues, and the CI workflow that runs this exact loop.</span>
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Final CTA ────────────────────────────────────────────────── -->
    <section class="section" style="padding-top: 30px">
      <div class="shell">
        <div class="cta-final reveal">
          <h2>Put a merge gate between<br>your agents and production.</h2>
          <p>Clone the repo, run the seeded demo, and watch a failing review repair itself into a passing gate — receipts included.</p>
          <div class="cta-row">
            <a class="btn btn-primary btn-lg" href="/studio">
              Launch Studio
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </a>
            <a class="btn btn-ghost btn-lg" href="${REPO_URL}" target="_blank" rel="noreferrer">View on GitHub</a>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <div class="shell">
      <div class="foot-grid">
        <div class="foot-brand">
          <a class="brand" href="#top"><span class="mark">M</span><span>Morph</span><span class="brand-tag">Studio</span></a>
          <p>The consistency layer between coding agents and production frontend. Verify, repair, and gate agent-written UI with receipts.</p>
        </div>
        <div class="foot-col">
          <h4>Product</h4>
          <a href="#product">Overview</a>
          <a href="#demo">Demo</a>
          <a href="/studio">Studio</a>
          <a href="#pricing">Pricing</a>
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
        </div>
      </div>
      <div class="foot-bottom">
        <span>© <span id="year">2026</span> Morph. MIT licensed.</span>
        <span>Built for the RAISE Summit Hackathon · Cursor track · Node ≥ 20</span>
      </div>
    </div>
  </footer>

  <script>
    (function () {
      var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      document.getElementById("year").textContent = String(new Date().getFullYear());

      // Header state on scroll
      var header = document.getElementById("siteHeader");
      function onScroll() {
        if (window.scrollY > 8) header.classList.add("scrolled");
        else header.classList.remove("scrolled");
      }
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();

      // Mobile menu
      var toggle = document.getElementById("navToggle");
      var menu = document.getElementById("mobileMenu");
      toggle.addEventListener("click", function () {
        var open = menu.classList.toggle("open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
      menu.addEventListener("click", function (event) {
        if (event.target.tagName === "A") {
          menu.classList.remove("open");
          toggle.setAttribute("aria-expanded", "false");
        }
      });

      // Reveal on scroll
      var revealed = document.querySelectorAll(".reveal");
      if ("IntersectionObserver" in window && !reduceMotion) {
        var revealObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("in");
              revealObserver.unobserve(entry.target);
            }
          });
        }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
        revealed.forEach(function (el) { revealObserver.observe(el); });
      } else {
        revealed.forEach(function (el) { el.classList.add("in"); });
      }

      // Copy buttons
      document.querySelectorAll(".copy-btn").forEach(function (button) {
        button.addEventListener("click", function () {
          var text = button.getAttribute("data-copy") || "";
          function done() {
            var previous = button.textContent;
            button.textContent = "Copied";
            setTimeout(function () { button.textContent = previous; }, 1400);
          }
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done, done);
          } else {
            done();
          }
        });
      });

      // Orb parallax
      if (!reduceMotion && window.matchMedia("(pointer: fine)").matches) {
        var orbs = document.querySelectorAll("[data-parallax]");
        window.addEventListener("mousemove", function (event) {
          var x = (event.clientX / window.innerWidth) - 0.5;
          var y = (event.clientY / window.innerHeight) - 0.5;
          orbs.forEach(function (orb) {
            var depth = Number(orb.getAttribute("data-parallax")) || 0;
            orb.style.translate = (x * depth) + "px " + (y * depth) + "px";
          });
        }, { passive: true });
      }

      // Terminal typing animation
      var termBody = document.getElementById("termBody");
      var replayButton = document.getElementById("termReplay");
      var LINES = [
        { pause: 300, parts: [["$ ", "t-prompt"], ["morph verify", "t-cmd"]] },
        { pause: 420, parts: [["Acme Control Plane: ", "t-dim"], ["FAIL (68/100)", "t-fail"]] },
        { pause: 90,  parts: [["  ✗ hardcoded-color          ", "t-fail"], ["#7c3aed outside the token set", "t-dim"]] },
        { pause: 90,  parts: [["  ✗ radius-drift             ", "t-fail"], ["rounded-[28px] breaks shape language", "t-dim"]] },
        { pause: 90,  parts: [["  ✗ component-fragmentation  ", "t-fail"], ["raw <button> bypasses <Button/>", "t-dim"]] },
        { pause: 90,  parts: [["  ✗ focus-regression         ", "t-fail"], ["focus:outline-none removes the ring", "t-dim"]] },
        { pause: 90,  parts: [["  … 5 more findings", "t-dim"], [" · receipts → .morph/runs", "t-acc"]] },
        { pause: 600, parts: [["$ ", "t-prompt"], ["morph repair --apply", "t-cmd"]] },
        { pause: 340, parts: [["  ↺ 9 deterministic replacements across 1 file", "t-warn"]] },
        { pause: 600, parts: [["$ ", "t-prompt"], ["morph verify", "t-cmd"]] },
        { pause: 420, parts: [["Acme Control Plane: ", "t-dim"], ["PASS (100/100)", "t-pass"]] },
        { pause: 120, parts: [["  ✓ merge gate open — safe to hand to human review", "t-pass"]] }
      ];
      var runToken = 0;

      function renderInstant() {
        termBody.innerHTML = "";
        LINES.forEach(function (line) {
          var lineElement = document.createElement("div");
          lineElement.className = "term-line";
          line.parts.forEach(function (part) {
            var span = document.createElement("span");
            span.className = part[1];
            span.textContent = part[0];
            lineElement.appendChild(span);
          });
          termBody.appendChild(lineElement);
        });
      }

      function typeTranscript() {
        var token = ++runToken;
        termBody.innerHTML = "";
        var caret = document.createElement("span");
        caret.className = "caret";
        var lineIndex = 0;

        function nextLine() {
          if (token !== runToken) return;
          if (lineIndex >= LINES.length) { caret.remove(); return; }
          var line = LINES[lineIndex++];
          setTimeout(function () {
            if (token !== runToken) return;
            var lineElement = document.createElement("div");
            lineElement.className = "term-line";
            termBody.appendChild(lineElement);
            var partIndex = 0;
            var charIndex = 0;
            var currentSpan = null;

            function typeChar() {
              if (token !== runToken) return;
              if (partIndex >= line.parts.length) { nextLine(); return; }
              var part = line.parts[partIndex];
              if (!currentSpan) {
                currentSpan = document.createElement("span");
                currentSpan.className = part[1];
                lineElement.appendChild(currentSpan);
                lineElement.appendChild(caret);
              }
              currentSpan.textContent = part[0].slice(0, ++charIndex);
              if (charIndex >= part[0].length) {
                partIndex += 1;
                charIndex = 0;
                currentSpan = null;
              }
              setTimeout(typeChar, line.parts[partIndex] && line.parts[partIndex][1] === "t-cmd" ? 26 : 7);
            }
            typeChar();
          }, line.pause);
        }
        nextLine();
      }

      replayButton.addEventListener("click", function () {
        if (reduceMotion) renderInstant();
        else typeTranscript();
      });

      if (reduceMotion || !("IntersectionObserver" in window)) {
        renderInstant();
      } else {
        var started = false;
        var terminalObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting && !started) {
              started = true;
              typeTranscript();
              terminalObserver.disconnect();
            }
          });
        }, { threshold: 0.35 });
        terminalObserver.observe(document.getElementById("heroTerminal"));
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
