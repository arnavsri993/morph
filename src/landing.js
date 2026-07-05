import { brandLink, brandStyles, headLinks, headerBarStyles } from "./brand.js";

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
  ${headLinks()}
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
      overflow-x: hidden;
    }
    ::selection { background: rgba(129, 140, 248, 0.35); }
    :focus-visible { outline: 2px solid var(--brand); outline-offset: 3px; border-radius: 6px; }
    a { color: inherit; text-decoration: none; }
    code { font-family: var(--mono); font-size: 0.9em; color: var(--cyan); }

    /* Animated backdrop */
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
        radial-gradient(ellipse 40% 35% at 20% 20%, rgba(129, 140, 248, 0.2), transparent 70%),
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
    }

    .shell {
      width: min(var(--max), calc(100vw - 48px));
      margin: 0 auto;
    }

    ${headerBarStyles()}
    ${brandStyles()}
    .nav-links { display: flex; align-items: center; gap: 2px; }
    .nav-link {
      color: var(--muted);
      font-size: 14px;
      font-weight: 500;
      padding: 8px 14px;
      border-radius: 999px;
      transition: color 0.18s, background 0.18s;
    }
    .nav-link:hover { color: var(--text); background: rgba(255, 255, 255, 0.05); }
    .nav-actions { display: flex; align-items: center; gap: 10px; }
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
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      background: #000000;
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
    .btn svg { flex: none; transition: transform 0.18s var(--ease); }
    .btn-primary {
      color: #fff;
      background: linear-gradient(135deg, var(--brand), var(--brand-2));
      box-shadow: 0 0 32px -8px rgba(129, 140, 248, 0.65);
    }
    .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 28px -4px rgba(129, 140, 248, 0.7);
    }
    .btn-primary:hover svg { transform: translateX(2px); }
    .btn-ghost {
      color: var(--text);
      background: rgba(255, 255, 255, 0.04);
      border-color: var(--border-strong);
    }
    .btn-ghost:hover { background: rgba(255, 255, 255, 0.08); transform: translateY(-1px); }
    .btn-lg { min-height: 48px; padding: 0 26px; font-size: 15px; }

    /* Hero */
    .hero {
      padding: clamp(64px, 10vw, 112px) 0 clamp(48px, 8vw, 72px);
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
      animation: fade-up 0.7s var(--ease) both;
    }
    .badge-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--ok);
      box-shadow: 0 0 12px rgba(74, 222, 128, 0.6);
      animation: pulse-dot 2.4s ease-in-out infinite;
    }
    @keyframes pulse-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(0.85); }
    }
    h1 {
      margin: 0 auto 20px;
      max-width: 16ch;
      font-size: clamp(2.5rem, 6vw, 3.75rem);
      line-height: 1.05;
      letter-spacing: -0.03em;
      font-weight: 600;
      animation: fade-up 0.7s var(--ease) 0.05s both;
    }
    .gradient {
      background: linear-gradient(100deg, #fafafa 0%, #a1a1aa 35%, var(--brand) 70%, var(--brand-2) 100%);
      background-size: 200% auto;
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      animation: shimmer 6s ease-in-out infinite;
    }
    @keyframes shimmer {
      0%, 100% { background-position: 0% center; }
      50% { background-position: 100% center; }
    }
    .lede {
      margin: 0 auto 36px;
      max-width: 52ch;
      color: var(--muted);
      font-size: 17px;
      line-height: 1.75;
      animation: fade-up 0.7s var(--ease) 0.1s both;
    }
    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 12px;
      margin-bottom: clamp(48px, 8vw, 64px);
      animation: fade-up 0.7s var(--ease) 0.15s both;
    }

    /* Studio mock — hero showcase */
    .studio-mock {
      position: relative;
      max-width: 720px;
      margin: 0 auto;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      overflow: hidden;
      text-align: left;
      box-shadow: 0 0 0 1px rgba(255,255,255,0.04), 0 32px 80px -32px rgba(0,0,0,0.7);
      animation: fade-up 0.8s var(--ease) 0.2s both;
    }
    .studio-mock::before {
      content: "";
      position: absolute;
      inset: 0;
      background: radial-gradient(520px circle at var(--spot-x, 50%) var(--spot-y, 0%), rgba(129,140,248,0.12), transparent 50%);
      pointer-events: none;
      z-index: 0;
    }
    .studio-mock::after {
      content: "";
      position: absolute;
      top: 0;
      left: -30%;
      width: 24%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(129,140,248,0.08), rgba(34,211,238,0.12), transparent);
      animation: scan-sweep 5s ease-in-out infinite;
      pointer-events: none;
      z-index: 1;
    }
    @keyframes scan-sweep {
      0%, 15% { transform: translateX(0); opacity: 0; }
      25% { opacity: 1; }
      65% { opacity: 1; }
      80%, 100% { transform: translateX(520%); opacity: 0; }
    }
    .mock-bar {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 18px;
      border-bottom: 1px solid var(--border);
      background: rgba(255,255,255,0.02);
    }
    .mock-repo {
      display: grid;
      gap: 2px;
    }
    .mock-repo strong { font-size: 13px; font-weight: 600; }
    .mock-repo span { color: var(--faint); font-family: var(--mono); font-size: 11px; }
    .mock-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      font-family: var(--mono);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      border: 1px solid transparent;
      transition: color 0.5s, background 0.5s, border-color 0.5s;
    }
    .mock-pill.fail {
      color: var(--bad);
      background: rgba(248,113,113,0.1);
      border-color: rgba(248,113,113,0.25);
    }
    .mock-pill.pass {
      color: var(--ok);
      background: rgba(74,222,128,0.1);
      border-color: rgba(74,222,128,0.28);
      box-shadow: 0 0 20px rgba(74,222,128,0.12);
    }
    .mock-body {
      position: relative;
      z-index: 2;
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 0;
      min-height: 280px;
    }
    .mock-score-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      border-right: 1px solid var(--border);
      gap: 8px;
    }
    .score-ring {
      width: 96px;
      height: 96px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background:
        radial-gradient(circle at 50% 50%, #0c0c0f 0 58%, transparent 59%),
        conic-gradient(var(--ring-color, var(--bad)) 0 var(--ring-pct, 68%), rgba(255,255,255,0.08) 0);
      transition: --ring-color 0.6s var(--ease), --ring-pct 0.6s var(--ease);
      box-shadow: 0 0 32px var(--ring-glow, rgba(248,113,113,0.15));
    }
    .score-ring.repaired {
      --ring-color: var(--ok);
      --ring-pct: 100%;
      --ring-glow: rgba(74,222,128,0.2);
    }
    .score-ring strong {
      font-family: var(--mono);
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.04em;
      color: var(--score-color, var(--bad));
      transition: color 0.5s var(--ease);
    }
    .score-ring.repaired strong { color: var(--ok); }
    .score-ring span {
      display: block;
      font-size: 10px;
      color: var(--faint);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      text-align: center;
    }
    .mock-main { padding: 20px; display: grid; gap: 14px; align-content: start; }
    .mock-ui {
      position: relative;
      padding: 16px;
      border-radius: var(--radius-sm);
      background: #f8fafc;
      color: #0f172a;
      transition: border-radius 0.6s var(--ease), box-shadow 0.6s var(--ease), transform 0.6s var(--ease);
      overflow: hidden;
    }
    .mock-ui.drift {
      border-radius: 24px;
      transform: rotate(-0.8deg);
      box-shadow: 0 12px 32px rgba(124,58,237,0.2);
    }
    .mock-ui.fixed {
      border-radius: 8px;
      transform: none;
      box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    }
    .mock-ui h4 { margin: 0 0 4px; font-size: 15px; font-weight: 600; }
    .mock-ui p { margin: 0 0 12px; font-size: 12px; color: #64748b; line-height: 1.5; }
    .mock-btn {
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      padding: 0 14px;
      border: 0;
      font-size: 12px;
      font-weight: 700;
      color: #fff;
      border-radius: 999px;
      background: #7c3aed;
      transition: border-radius 0.6s var(--ease), background 0.6s var(--ease), box-shadow 0.6s var(--ease);
    }
    .mock-ui.fixed .mock-btn {
      border-radius: 6px;
      background: #2563eb;
      box-shadow: 0 0 0 3px rgba(34,211,238,0.25);
    }
    .mock-findings { display: grid; gap: 6px; }
    .finding-chip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 7px 10px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: rgba(9,9,11,0.5);
      font-family: var(--mono);
      font-size: 10.5px;
      color: var(--muted);
      opacity: 0;
      transform: translateX(-8px);
      transition: opacity 0.4s var(--ease), transform 0.4s var(--ease), border-color 0.4s;
    }
    .finding-chip.show { opacity: 1; transform: none; }
    .finding-chip.resolved {
      border-color: rgba(74,222,128,0.22);
      color: rgba(74,222,128,0.85);
    }
    .finding-chip .sev {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--warn);
    }
    .finding-chip.resolved .sev { color: var(--ok); }

    /* Demo — morph pipeline */
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

    .pipeline {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 32px;
    }
    .pipe-step {
      position: relative;
      padding: 20px 18px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      text-align: center;
      transition: border-color 0.35s, box-shadow 0.35s, transform 0.35s var(--ease);
    }
    .pipe-step.active {
      border-color: rgba(129,140,248,0.4);
      box-shadow: 0 0 32px -8px rgba(129,140,248,0.3);
      transform: translateY(-2px);
    }
    .pipe-step.done {
      border-color: rgba(74,222,128,0.28);
    }
    .pipe-num {
      width: 28px;
      height: 28px;
      margin: 0 auto 10px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      font-family: var(--mono);
      font-size: 12px;
      font-weight: 700;
      border: 1px solid var(--border);
      color: var(--faint);
      transition: background 0.35s, border-color 0.35s, color 0.35s;
    }
    .pipe-step.active .pipe-num {
      background: rgba(129,140,248,0.15);
      border-color: rgba(129,140,248,0.35);
      color: var(--brand);
    }
    .pipe-step.done .pipe-num {
      background: rgba(74,222,128,0.12);
      border-color: rgba(74,222,128,0.3);
      color: var(--ok);
    }
    .pipe-step h3 { margin: 0 0 4px; font-size: 14px; font-weight: 600; }
    .pipe-step p { margin: 0; font-size: 12px; color: var(--muted); line-height: 1.45; }

    .compare-stage {
      position: relative;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      overflow: hidden;
      min-height: 320px;
    }
    .compare-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
      border-bottom: 1px solid var(--border);
      background: rgba(255,255,255,0.02);
    }
    .compare-tabs {
      display: inline-flex;
      gap: 4px;
      padding: 3px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: rgba(255,255,255,0.03);
    }
    .compare-tab {
      padding: 5px 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 500;
      color: var(--muted);
      transition: background 0.3s, color 0.3s;
    }
    .compare-tab.on-before { background: rgba(248,113,113,0.12); color: var(--bad); }
    .compare-tab.on-after { background: rgba(74,222,128,0.12); color: var(--ok); }
    .compare-score {
      font-family: var(--mono);
      font-size: 13px;
      font-weight: 700;
      transition: color 0.4s;
    }
    .compare-body {
      display: grid;
      place-items: center;
      padding: 32px 24px 40px;
      position: relative;
    }
    .compare-body::before {
      content: "";
      position: absolute;
      inset: 0;
      background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px);
      background-size: 24px 24px;
      opacity: 0.5;
    }
    .demo-card {
      position: relative;
      z-index: 1;
      width: min(100%, 340px);
      padding: 20px;
      background: #f8fafc;
      color: #0f172a;
      transition: border-radius 0.7s var(--ease), transform 0.7s var(--ease), box-shadow 0.7s var(--ease);
    }
    .demo-card.before {
      border-radius: 26px;
      transform: rotate(-1deg);
      box-shadow: 0 20px 48px rgba(124,58,237,0.25);
    }
    .demo-card.after {
      border-radius: 8px;
      transform: none;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    }
    .demo-card h4 { margin: 0 0 6px; font-size: 17px; font-weight: 700; }
    .demo-card p { margin: 0 0 16px; font-size: 13px; color: #64748b; line-height: 1.55; }
    .demo-card .demo-btn {
      display: inline-flex;
      min-height: 38px;
      padding: 0 16px;
      align-items: center;
      font-size: 13px;
      font-weight: 700;
      color: #fff;
      border: 0;
      transition: border-radius 0.7s var(--ease), background 0.7s var(--ease), box-shadow 0.7s var(--ease);
    }
    .demo-card.before .demo-btn {
      border-radius: 20px;
      background: #7c3aed;
    }
    .demo-card.after .demo-btn {
      border-radius: 6px;
      background: #2563eb;
      box-shadow: 0 0 0 3px rgba(34,211,238,0.28);
    }
    .drift-tags {
      position: relative;
      z-index: 1;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
      margin-top: 20px;
      max-width: 480px;
      margin-left: auto;
      margin-right: auto;
    }
    .drift-tag {
      padding: 5px 10px;
      border-radius: 999px;
      font-family: var(--mono);
      font-size: 11px;
      border: 1px solid transparent;
      opacity: 0;
      transform: translateY(6px);
      transition: opacity 0.35s var(--ease), transform 0.35s var(--ease), color 0.4s, border-color 0.4s, background 0.4s;
    }
    .drift-tag.show { opacity: 1; transform: none; }
    .drift-tag.bad { color: rgba(251,191,36,0.9); background: rgba(251,191,36,0.08); border-color: rgba(251,191,36,0.2); }
    .drift-tag.good { color: rgba(74,222,128,0.9); background: rgba(74,222,128,0.08); border-color: rgba(74,222,128,0.22); }

    /* Bento */
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
      overflow: hidden;
      transition: border-color 0.25s, transform 0.25s var(--ease), box-shadow 0.25s;
    }
    .bento-card::before {
      content: "";
      position: absolute;
      inset: 0;
      background: radial-gradient(400px circle at var(--bx,50%) var(--by,0%), rgba(129,140,248,0.1), transparent 50%);
      opacity: 0;
      transition: opacity 0.4s;
      pointer-events: none;
    }
    .bento-card:hover {
      border-color: var(--border-strong);
      transform: translateY(-3px);
      box-shadow: 0 16px 48px -24px rgba(0,0,0,0.5);
    }
    .bento-card:hover::before { opacity: 1; }
    .bento-icon {
      width: 40px;
      height: 40px;
      margin-bottom: 16px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      background: rgba(129,140,248,0.12);
      border: 1px solid rgba(129,140,248,0.22);
      color: var(--brand);
    }
    .bento-card h3 { margin: 0 0 8px; font-size: 16px; font-weight: 600; }
    .bento-card p { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.65; }

    /* CTA band */
    .cta-band {
      position: relative;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: clamp(32px, 5vw, 48px);
      background: linear-gradient(135deg, rgba(129,140,248,0.08), rgba(34,211,238,0.04)), var(--surface);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      flex-wrap: wrap;
      overflow: hidden;
    }
    .cta-band::before {
      content: "";
      position: absolute;
      inset: -50%;
      background: conic-gradient(from 0deg, transparent, rgba(129,140,248,0.06), transparent, rgba(34,211,238,0.04), transparent);
      animation: cta-spin 12s linear infinite;
    }
    @keyframes cta-spin { to { transform: rotate(360deg); } }
    .cta-band > * { position: relative; z-index: 1; }
    .cta-band h2 { margin-bottom: 8px; }
    .cta-band p { margin: 0; color: var(--muted); font-size: 15px; max-width: 42ch; }

    /* Docs + pricing */
    .link-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
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
    .link-card:hover { border-color: rgba(129,140,248,0.35); transform: translateY(-2px); }
    .link-card svg { flex: none; color: var(--brand); margin-top: 2px; }
    .link-card strong { display: block; font-size: 15px; margin-bottom: 4px; }
    .link-card span { color: var(--muted); font-size: 14px; line-height: 1.55; }
    .pricing { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .price-card {
      padding: 28px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      display: flex;
      flex-direction: column;
      transition: transform 0.25s var(--ease), border-color 0.25s;
    }
    .price-card:hover { transform: translateY(-2px); border-color: var(--border-strong); }
    .price-card.featured {
      border-color: rgba(129,140,248,0.35);
      background: linear-gradient(180deg, rgba(129,140,248,0.06) 0%, var(--surface) 40%);
    }
    .price-card h3 { margin: 0 0 4px; font-size: 16px; font-weight: 600; }
    .price { margin: 12px 0 8px; font-size: 2rem; font-weight: 600; letter-spacing: -0.03em; }
    .price small { color: var(--muted); font-size: 14px; font-weight: 500; }
    .price-card > p { margin: 0 0 20px; color: var(--muted); font-size: 14px; line-height: 1.6; }
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
    .price-card li::before { content: "·"; color: var(--brand); font-weight: 700; margin-right: 8px; }
    .price-card .btn { width: 100%; }

    footer {
      border-top: 1px solid var(--border);
      padding: 46px 0 34px;
      background: rgba(9, 9, 11, 0.72);
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
      line-height: 1.65;
    }
    .foot-col h4 {
      margin: 0 0 11px;
      color: var(--faint);
      font-family: var(--mono);
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .foot-col a {
      display: block;
      color: var(--muted);
      font-size: 13px;
      padding: 4px 0;
      transition: color 0.18s;
    }
    .foot-col a:hover { color: var(--text); }
    .foot-bottom {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      padding-top: 20px;
      border-top: 1px solid var(--border);
      color: var(--faint);
      font-size: 12px;
    }

    /* Scroll reveal */
    .reveal {
      opacity: 0;
      transform: translateY(20px);
      transition: opacity 0.65s var(--ease), transform 0.65s var(--ease);
    }
    .reveal.in { opacity: 1; transform: none; }

    @keyframes fade-up {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: none; }
    }

    @media (max-width: 900px) {
      .bento, .pricing, .pipeline { grid-template-columns: 1fr; }
      .link-row { grid-template-columns: 1fr; }
      .mock-body { grid-template-columns: 1fr; }
      .mock-score-col {
        flex-direction: row;
        border-right: 0;
        border-bottom: 1px solid var(--border);
        padding: 16px 20px;
      }
      .foot-grid { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 768px) {
      .shell { width: min(var(--max), calc(100vw - 32px)); }
      .nav-links, .nav-actions .nav-link, .nav-actions .btn { display: none; }
      .nav-toggle { display: grid; }
      .mobile-menu.open { display: block; }
      .cta-band { flex-direction: column; align-items: flex-start; }
      .hero-actions .btn-lg { flex: 1 1 100%; }
      .foot-grid { grid-template-columns: 1fr; }
    }
    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto; }
      *, *::before, *::after { animation: none !important; transition-duration: 0.01ms !important; }
      .reveal { opacity: 1; transform: none; }
      .finding-chip, .drift-tag { opacity: 1; transform: none; }
    }
  </style>
</head>
<body>
  <div class="backdrop" aria-hidden="true">
    <div class="aurora"></div>
    <div class="grid-bg"></div>
  </div>

  <header class="site-header" id="siteHeader">
    <div class="shell site-header-inner">
      ${brandLink("#top")}
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
          Interactive review for agent-written UI
        </div>
        <h1>AI writes the UI. <span class="gradient">Morph makes it belong.</span></h1>
        <p class="lede">Connect a repo or preview URL in Studio. Morph scans for drift, shows before/after, and applies deterministic repairs — no terminal required.</p>
        <div class="hero-actions">
          <a class="btn btn-primary btn-lg" href="/studio">
            Launch Studio
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </a>
          <a class="btn btn-ghost btn-lg" href="#demo">See how it works</a>
        </div>

        <div class="studio-mock" id="heroMock" aria-label="Morph Studio review preview">
          <div class="mock-bar">
            <div class="mock-repo">
              <strong>acme/control-plane</strong>
              <span>agent/billing-upgrade-ui</span>
            </div>
            <span class="mock-pill fail" id="mockPill">fail 68/100</span>
          </div>
          <div class="mock-body">
            <div class="mock-score-col">
              <div class="score-ring" id="scoreRing">
                <div><strong id="scoreNum">68</strong><span>score</span></div>
              </div>
            </div>
            <div class="mock-main">
              <div class="mock-ui drift" id="mockUi">
                <h4>Scale plan</h4>
                <p>Agent output compiles — but color, radius, and components drift from the system.</p>
                <span class="mock-btn">Update plan</span>
              </div>
              <div class="mock-findings" id="mockFindings">
                <div class="finding-chip" data-i="0"><span class="sev">high</span><span>#7c3aed → token</span></div>
                <div class="finding-chip" data-i="1"><span class="sev">high</span><span>rounded-[28px] → card radius</span></div>
                <div class="finding-chip" data-i="2"><span class="sev">med</span><span>&lt;button&gt; → &lt;Button/&gt;</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="product">
      <div class="shell">
        <div class="section-head center reveal">
          <span class="section-label">Product</span>
          <h2>One gate. Four engines.</h2>
          <p class="section-desc">Morph native rules, Buoy health scoring, ESLint token linting, and axe accessibility — unified in a single Studio review.</p>
        </div>
        <div class="bento">
          <div class="bento-card reveal" data-spotlight>
            <div class="bento-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <h3>Detect drift</h3>
            <p>Hardcoded colors, off-grid radii, raw HTML, missing focus states — flagged with severity and file paths.</p>
          </div>
          <div class="bento-card reveal" data-spotlight style="transition-delay:.06s">
            <div class="bento-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            </div>
            <h3>Repair in Studio</h3>
            <p>Exact token replacements and component swaps — applied interactively with a full before/after preview.</p>
          </div>
          <div class="bento-card reveal" data-spotlight style="transition-delay:.12s">
            <div class="bento-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/></svg>
            </div>
            <h3>Open the gate</h3>
            <p>Review receipts stored per run. Merge when the score passes threshold — ready for human review.</p>
          </div>
        </div>
      </div>
    </section>

    <section id="demo">
      <div class="shell">
        <div class="section-head reveal">
          <span class="section-label">Demo</span>
          <h2>From drift to merge-ready in Studio</h2>
          <p class="section-desc">Connect a GitHub repo or paste a preview URL. Morph runs the full review loop and shows exactly what changed.</p>
        </div>

        <div class="pipeline reveal" id="pipeline">
          <div class="pipe-step" data-step="0">
            <div class="pipe-num">1</div>
            <h3>Connect</h3>
            <p>Repo or preview URL</p>
          </div>
          <div class="pipe-step" data-step="1">
            <div class="pipe-num">2</div>
            <h3>Scan</h3>
            <p>Find drift &amp; score</p>
          </div>
          <div class="pipe-step" data-step="2">
            <div class="pipe-num">3</div>
            <h3>Repair</h3>
            <p>Apply patches</p>
          </div>
          <div class="pipe-step" data-step="3">
            <div class="pipe-num">4</div>
            <h3>Gate</h3>
            <p>Merge-ready receipt</p>
          </div>
        </div>

        <div class="compare-stage reveal">
          <div class="compare-head">
            <div class="compare-tabs">
              <span class="compare-tab on-before" id="tabBefore">Before</span>
              <span class="compare-tab" id="tabAfter">After</span>
            </div>
            <span class="compare-score" id="compareScore" style="color:var(--bad)">68 / 100</span>
          </div>
          <div class="compare-body">
            <div class="demo-card before" id="demoCard">
              <h4>Scale plan</h4>
              <p>Compiles fine — but radius, color, component usage, and focus all drift from the design system.</p>
              <span class="demo-btn">Update plan</span>
            </div>
            <div class="drift-tags" id="driftTags">
              <span class="drift-tag bad" data-t="0">#7c3aed</span>
              <span class="drift-tag bad" data-t="1">rounded-[28px]</span>
              <span class="drift-tag bad" data-t="2">raw &lt;button&gt;</span>
              <span class="drift-tag bad" data-t="3">no focus ring</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="studio">
      <div class="shell">
        <div class="cta-band reveal">
          <div>
            <span class="section-label">Studio</span>
            <h2>Review console for agent branches</h2>
            <p>Findings, exact patches, score history, and merge gate status — all in one interactive dashboard.</p>
          </div>
          <a class="btn btn-primary btn-lg" href="/studio">Launch Studio</a>
        </div>
      </div>
    </section>

    <section id="docs">
      <div class="shell">
        <div class="section-head reveal">
          <span class="section-label">Docs</span>
          <h2>Source, docs, and API</h2>
          <p class="section-desc">The public repo includes the seeded fixture, Studio server, review API, and CI workflow.</p>
        </div>
        <div class="link-row">
          <a class="link-card reveal" href="${REPO_URL}" target="_blank" rel="noreferrer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.72.5.1.68-.22.68-.49v-1.7c-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.9-.64.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05a9.4 9.4 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9v2.82c0 .27.18.6.69.49A10.26 10.26 0 0 0 22 12.25C22 6.58 17.52 2 12 2z"/></svg>
            <div><strong>GitHub</strong><span>Source, issues, Studio server, and the seeded review fixture.</span></div>
          </a>
          <a class="link-card reveal" style="transition-delay:.06s" href="${REPO_URL}#readme" target="_blank" rel="noreferrer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>
            <div><strong>Documentation</strong><span>Quickstart, Studio flow, report shape, auth, and API map.</span></div>
          </a>
        </div>
      </div>
    </section>

    <section id="pricing">
      <div class="shell">
        <div class="section-head center reveal">
          <span class="section-label">Pricing</span>
          <h2>Start free. Scale when ready.</h2>
          <p class="section-desc">Studio reviews are free locally. Team features add shared runs and billing.</p>
        </div>
        <div class="pricing">
          <div class="price-card reveal">
            <h3>Local</h3>
            <div class="price">$0 <small>forever</small></div>
            <p>Full Studio reviews — locally or self-hosted.</p>
            <ul>
              <li>Interactive before/after reviews</li>
              <li>JSON receipts and stored runs</li>
              <li>GitHub Actions workflow</li>
            </ul>
            <a class="btn btn-ghost" href="#docs">Read docs</a>
          </div>
          <div class="price-card featured reveal" style="transition-delay:.05s">
            <h3>Team</h3>
            <div class="price">$29 <small>/ seat / mo</small></div>
            <p>Shared Studio runs for teams reviewing agent branches.</p>
            <ul>
              <li>Collaborative Studio reviews</li>
              <li>GitHub and Google SSO</li>
              <li>Team usage limits</li>
            </ul>
            <a class="btn btn-primary" href="/studio">Launch Studio</a>
          </div>
          <div class="price-card reveal" style="transition-delay:.1s">
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
    <div class="shell">
      <div class="foot-grid">
        <div class="foot-brand">
          ${brandLink("#top")}
          <p>CI for agent-written frontend. Detect drift, explain violations, repair deterministically, and open the merge gate.</p>
        </div>
        <div class="foot-col">
          <h4>Product</h4>
          <a href="#product">Product</a>
          <a href="#demo">Demo</a>
          <a href="#studio">Studio</a>
          <a href="/studio">Launch Studio</a>
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
        <span>© <span id="year">2026</span> Morph · MIT licensed</span>
        <span>Built for serious agent frontend review.</span>
      </div>
    </div>
  </footer>

  <script>
    (function () {
      var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      var year = document.getElementById("year");
      if (year) year.textContent = String(new Date().getFullYear());

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

      /* Spotlight on hero mock + bento cards */
      function bindSpotlight(el) {
        el.addEventListener("mousemove", function (e) {
          var r = el.getBoundingClientRect();
          var x = ((e.clientX - r.left) / r.width * 100) + "%";
          var y = ((e.clientY - r.top) / r.height * 100) + "%";
          if (el.id === "heroMock") {
            el.style.setProperty("--spot-x", x);
            el.style.setProperty("--spot-y", y);
          } else {
            el.style.setProperty("--bx", x);
            el.style.setProperty("--by", y);
          }
        });
      }
      var heroMock = document.getElementById("heroMock");
      if (heroMock) bindSpotlight(heroMock);
      document.querySelectorAll("[data-spotlight]").forEach(bindSpotlight);

      /* Scroll reveal */
      var reveals = document.querySelectorAll(".reveal");
      if ("IntersectionObserver" in window && !reduceMotion) {
        var obs = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("in");
              obs.unobserve(entry.target);
            }
          });
        }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
        reveals.forEach(function (el) { obs.observe(el); });
      } else {
        reveals.forEach(function (el) { el.classList.add("in"); });
      }

      if (reduceMotion) return;

      /* Hero mock — auto cycle: show findings → repair → pass */
      var scoreRing = document.getElementById("scoreRing");
      var scoreNum = document.getElementById("scoreNum");
      var mockPill = document.getElementById("mockPill");
      var mockUi = document.getElementById("mockUi");
      var chips = document.querySelectorAll("#mockFindings .finding-chip");
      var heroPhase = 0;

      function animateScore(from, to, duration, cb) {
        var start = performance.now();
        function tick(now) {
          var t = Math.min(1, (now - start) / duration);
          var eased = 1 - Math.pow(1 - t, 3);
          var val = Math.round(from + (to - from) * eased);
          if (scoreNum) scoreNum.textContent = String(val);
          if (scoreRing) scoreRing.style.setProperty("--ring-pct", val + "%");
          if (t < 1) requestAnimationFrame(tick);
          else if (cb) cb();
        }
        requestAnimationFrame(tick);
      }

      function runHeroCycle() {
        heroPhase = 0;
        if (scoreRing) { scoreRing.classList.remove("repaired"); scoreRing.style.setProperty("--ring-pct", "68%"); }
        if (scoreNum) scoreNum.textContent = "68";
        if (mockPill) { mockPill.className = "mock-pill fail"; mockPill.textContent = "fail 68/100"; }
        if (mockUi) { mockUi.className = "mock-ui drift"; }
        chips.forEach(function (c) { c.classList.remove("show", "resolved"); });

        setTimeout(function () {
          chips.forEach(function (c, i) {
            setTimeout(function () { c.classList.add("show"); }, i * 350);
          });
        }, 600);

        setTimeout(function () {
          chips.forEach(function (c) { c.classList.add("resolved"); c.querySelector(".sev").textContent = "fixed"; });
          if (mockUi) mockUi.className = "mock-ui fixed";
          if (scoreRing) scoreRing.classList.add("repaired");
          animateScore(68, 100, 900);
          if (mockPill) {
            setTimeout(function () {
              mockPill.className = "mock-pill pass";
              mockPill.textContent = "pass 100/100";
            }, 500);
          }
        }, 2400);

        setTimeout(runHeroCycle, 6500);
      }
      runHeroCycle();

      /* Demo section — pipeline + before/after morph */
      var steps = document.querySelectorAll("#pipeline .pipe-step");
      var demoCard = document.getElementById("demoCard");
      var tabBefore = document.getElementById("tabBefore");
      var tabAfter = document.getElementById("tabAfter");
      var compareScore = document.getElementById("compareScore");
      var driftTags = document.querySelectorAll("#driftTags .drift-tag");
      var demoRunning = false;

      function setStep(active) {
        steps.forEach(function (s, i) {
          s.classList.toggle("active", i === active);
          s.classList.toggle("done", i < active);
        });
      }

      function runDemoCycle() {
        if (demoRunning) return;
        demoRunning = true;
        setStep(0);
        if (demoCard) demoCard.className = "demo-card before";
        if (tabBefore) tabBefore.className = "compare-tab on-before";
        if (tabAfter) tabAfter.className = "compare-tab";
        if (compareScore) { compareScore.textContent = "68 / 100"; compareScore.style.color = "var(--bad)"; }
        driftTags.forEach(function (t) { t.className = "drift-tag bad"; t.classList.remove("show"); });

        setTimeout(function () { setStep(1); driftTags.forEach(function (t, i) {
          setTimeout(function () { t.classList.add("show"); }, i * 200);
        }); }, 800);

        setTimeout(function () { setStep(2); }, 2200);

        setTimeout(function () {
          setStep(3);
          if (demoCard) demoCard.className = "demo-card after";
          if (tabBefore) tabBefore.className = "compare-tab";
          if (tabAfter) tabAfter.className = "compare-tab on-after";
          if (compareScore) { compareScore.textContent = "100 / 100"; compareScore.style.color = "var(--ok)"; }
          driftTags.forEach(function (t, i) {
            var labels = ["var(--color-primary)", "var(--radius-card)", "&lt;Button/&gt;", "focus-visible:ring"];
            t.className = "drift-tag good show";
            t.textContent = labels[i] || t.textContent;
          });
        }, 3400);

        setTimeout(function () { demoRunning = false; runDemoCycle(); }, 7000);
      }

      var demoSection = document.getElementById("demo");
      if (demoSection && "IntersectionObserver" in window) {
        var demoObs = new IntersectionObserver(function (entries) {
          if (entries[0].isIntersecting) {
            runDemoCycle();
            demoObs.disconnect();
          }
        }, { threshold: 0.3 });
        demoObs.observe(demoSection);
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
