// Morph Design Intelligence Database — design profiles.
//
// Each profile is a complete, production-grade design system distilled from
// the visual grammar of frontier product companies. Profiles are selected by
// the transform engine based on the content of the incoming site, then used
// to re-render the site with `src/design-db/patterns.js`.

export const DESIGN_PROFILES = [
  {
    id: "aurora-dark",
    name: "Aurora Dark",
    inspiration: "Linear / Vercel-class developer product sites",
    mode: "dark",
    keywords: [
      "developer", "dev", "api", "sdk", "cli", "infra", "infrastructure",
      "deploy", "build", "code", "engineering", "terminal", "git", "agent",
      "ai", "ml", "model", "data", "cloud", "platform", "tool", "workflow"
    ],
    fonts: {
      display: "Inter",
      body: "Inter",
      mono: "JetBrains Mono",
      googleImport:
        "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap",
      displayStack: "'Inter', -apple-system, 'Segoe UI', sans-serif",
      bodyStack: "'Inter', -apple-system, 'Segoe UI', sans-serif",
      monoStack: "'JetBrains Mono', ui-monospace, 'SF Mono', monospace",
      displayWeight: 700,
      displayTracking: "-0.035em"
    },
    colors: {
      bg: "#0a0a0f",
      bgAlt: "#0e0e15",
      surface: "#12121a",
      surfaceRaised: "#181822",
      border: "rgba(255,255,255,0.08)",
      borderStrong: "rgba(255,255,255,0.14)",
      ink: "#f4f4f6",
      inkSecondary: "#c8c8d4",
      muted: "#8a8a9b",
      primary: "#7c7cf8",
      primaryHover: "#8f8ffa",
      primaryInk: "#0a0a0f",
      accent: "#4cc9f0",
      focus: "#8f8ffa",
      heroGradient: "linear-gradient(135deg, #a5a0ff 0%, #6ee7f5 50%, #a5f0c5 100%)",
      buttonGradient: "linear-gradient(180deg, #8b8bfa 0%, #6b6bf0 100%)",
      glow: "radial-gradient(ellipse 60% 45% at 50% -10%, rgba(124,124,248,0.28), transparent 70%)",
      cardHoverBorder: "rgba(139,139,250,0.45)"
    },
    radius: { sm: "8px", md: "12px", lg: "16px", xl: "24px", pill: "999px" },
    shadows: {
      card: "0 1px 2px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.35)",
      raised: "0 12px 40px rgba(0,0,0,0.5)",
      button: "0 1px 2px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18)",
      glowPrimary: "0 0 40px rgba(124,124,248,0.35)"
    },
    texture: "grid"
  },
  {
    id: "meridian-light",
    name: "Meridian Light",
    inspiration: "Stripe-class fintech and commerce platforms",
    mode: "light",
    keywords: [
      "payment", "payments", "finance", "fintech", "bank", "banking", "money",
      "billing", "invoice", "checkout", "commerce", "shop", "store", "market",
      "business", "revenue", "pricing", "subscription", "wallet", "card"
    ],
    fonts: {
      display: "Sora",
      body: "Inter",
      mono: "IBM Plex Mono",
      googleImport:
        "https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap",
      displayStack: "'Sora', -apple-system, 'Segoe UI', sans-serif",
      bodyStack: "'Inter', -apple-system, 'Segoe UI', sans-serif",
      monoStack: "'IBM Plex Mono', ui-monospace, monospace",
      displayWeight: 700,
      displayTracking: "-0.03em"
    },
    colors: {
      bg: "#fafbfd",
      bgAlt: "#f2f5fa",
      surface: "#ffffff",
      surfaceRaised: "#ffffff",
      border: "rgba(15,23,42,0.08)",
      borderStrong: "rgba(15,23,42,0.16)",
      ink: "#0f172a",
      inkSecondary: "#334155",
      muted: "#64748b",
      primary: "#4f46e5",
      primaryHover: "#4338ca",
      primaryInk: "#ffffff",
      accent: "#06b6d4",
      focus: "#4f46e5",
      heroGradient: "linear-gradient(120deg, #4f46e5 0%, #7c3aed 45%, #06b6d4 100%)",
      buttonGradient: "linear-gradient(180deg, #5b52f0 0%, #4f46e5 100%)",
      glow: "radial-gradient(ellipse 65% 50% at 50% -12%, rgba(99,102,241,0.14), transparent 70%)",
      cardHoverBorder: "rgba(79,70,229,0.35)"
    },
    radius: { sm: "8px", md: "12px", lg: "18px", xl: "28px", pill: "999px" },
    shadows: {
      card: "0 1px 2px rgba(15,23,42,0.05), 0 8px 24px rgba(15,23,42,0.06)",
      raised: "0 16px 48px rgba(15,23,42,0.12)",
      button: "0 1px 2px rgba(79,70,229,0.4), inset 0 1px 0 rgba(255,255,255,0.24)",
      glowPrimary: "0 8px 32px rgba(79,70,229,0.28)"
    },
    texture: "beams"
  },
  {
    id: "atelier-warm",
    name: "Atelier Warm",
    inspiration: "Notion / Airbnb-class warm consumer products",
    mode: "light",
    keywords: [
      "note", "notes", "write", "writing", "doc", "docs", "team", "workspace",
      "travel", "home", "food", "recipe", "health", "wellness", "community",
      "social", "learn", "learning", "education", "course", "creative", "design",
      "portfolio", "blog", "journal", "life", "personal"
    ],
    fonts: {
      display: "Fraunces",
      body: "Inter",
      mono: "IBM Plex Mono",
      googleImport:
        "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400&display=swap",
      displayStack: "'Fraunces', Georgia, serif",
      bodyStack: "'Inter', -apple-system, 'Segoe UI', sans-serif",
      monoStack: "'IBM Plex Mono', ui-monospace, monospace",
      displayWeight: 600,
      displayTracking: "-0.02em"
    },
    colors: {
      bg: "#fdfbf7",
      bgAlt: "#f7f3ea",
      surface: "#ffffff",
      surfaceRaised: "#ffffff",
      border: "rgba(60,45,30,0.1)",
      borderStrong: "rgba(60,45,30,0.2)",
      ink: "#1f1a14",
      inkSecondary: "#463a2c",
      muted: "#7d7264",
      primary: "#c2542e",
      primaryHover: "#a84523",
      primaryInk: "#ffffff",
      accent: "#2e7d5b",
      focus: "#c2542e",
      heroGradient: "linear-gradient(120deg, #c2542e 0%, #d97742 55%, #2e7d5b 100%)",
      buttonGradient: "linear-gradient(180deg, #cd5f37 0%, #c2542e 100%)",
      glow: "radial-gradient(ellipse 60% 45% at 50% -10%, rgba(194,84,46,0.1), transparent 70%)",
      cardHoverBorder: "rgba(194,84,46,0.35)"
    },
    radius: { sm: "10px", md: "14px", lg: "20px", xl: "32px", pill: "999px" },
    shadows: {
      card: "0 1px 2px rgba(60,45,30,0.06), 0 10px 28px rgba(60,45,30,0.07)",
      raised: "0 18px 48px rgba(60,45,30,0.14)",
      button: "0 1px 2px rgba(194,84,46,0.4), inset 0 1px 0 rgba(255,255,255,0.28)",
      glowPrimary: "0 8px 28px rgba(194,84,46,0.24)"
    },
    texture: "none"
  },
  {
    id: "monolith-mono",
    name: "Monolith Mono",
    inspiration: "Apple / OpenAI-class minimal monochrome sites",
    mode: "light",
    keywords: [
      "studio", "agency", "brand", "product", "hardware", "device", "premium",
      "luxury", "architecture", "photography", "film", "research", "lab",
      "foundation", "institute", "minimal"
    ],
    fonts: {
      display: "Instrument Sans",
      body: "Instrument Sans",
      mono: "Space Mono",
      googleImport:
        "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Space+Mono:wght@400&display=swap",
      displayStack: "'Instrument Sans', -apple-system, 'Helvetica Neue', sans-serif",
      bodyStack: "'Instrument Sans', -apple-system, 'Helvetica Neue', sans-serif",
      monoStack: "'Space Mono', ui-monospace, monospace",
      displayWeight: 600,
      displayTracking: "-0.04em"
    },
    colors: {
      bg: "#ffffff",
      bgAlt: "#f5f5f7",
      surface: "#ffffff",
      surfaceRaised: "#fafafa",
      border: "rgba(0,0,0,0.09)",
      borderStrong: "rgba(0,0,0,0.18)",
      ink: "#111111",
      inkSecondary: "#3a3a3c",
      muted: "#6e6e73",
      primary: "#111111",
      primaryHover: "#2c2c2e",
      primaryInk: "#ffffff",
      accent: "#0071e3",
      focus: "#0071e3",
      heroGradient: "linear-gradient(120deg, #111111 0%, #48484a 100%)",
      buttonGradient: "linear-gradient(180deg, #2c2c2e 0%, #111111 100%)",
      glow: "none",
      cardHoverBorder: "rgba(0,0,0,0.28)"
    },
    radius: { sm: "8px", md: "14px", lg: "20px", xl: "28px", pill: "999px" },
    shadows: {
      card: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05)",
      raised: "0 16px 48px rgba(0,0,0,0.1)",
      button: "0 1px 2px rgba(0,0,0,0.3)",
      glowPrimary: "0 8px 24px rgba(0,0,0,0.18)"
    },
    texture: "none"
  },
  {
    id: "signal-green",
    name: "Signal Green",
    inspiration: "Supabase / Spotify-class electric dark sites",
    mode: "dark",
    keywords: [
      "music", "audio", "stream", "streaming", "database", "db", "realtime",
      "open source", "opensource", "sql", "analytics", "monitor", "monitoring",
      "observability", "security", "gaming", "game", "energy"
    ],
    fonts: {
      display: "Space Grotesk",
      body: "Inter",
      mono: "JetBrains Mono",
      googleImport:
        "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap",
      displayStack: "'Space Grotesk', -apple-system, sans-serif",
      bodyStack: "'Inter', -apple-system, 'Segoe UI', sans-serif",
      monoStack: "'JetBrains Mono', ui-monospace, monospace",
      displayWeight: 700,
      displayTracking: "-0.03em"
    },
    colors: {
      bg: "#0c0f0d",
      bgAlt: "#101512",
      surface: "#141a16",
      surfaceRaised: "#1a221d",
      border: "rgba(255,255,255,0.08)",
      borderStrong: "rgba(255,255,255,0.15)",
      ink: "#f2f7f3",
      inkSecondary: "#c4d1c8",
      muted: "#84948a",
      primary: "#3ecf8e",
      primaryHover: "#5adf9f",
      primaryInk: "#06231a",
      accent: "#a3e635",
      focus: "#3ecf8e",
      heroGradient: "linear-gradient(120deg, #3ecf8e 0%, #a3e635 60%, #fde047 110%)",
      buttonGradient: "linear-gradient(180deg, #46d996 0%, #34bd80 100%)",
      glow: "radial-gradient(ellipse 60% 45% at 50% -10%, rgba(62,207,142,0.2), transparent 70%)",
      cardHoverBorder: "rgba(62,207,142,0.45)"
    },
    radius: { sm: "8px", md: "12px", lg: "16px", xl: "24px", pill: "999px" },
    shadows: {
      card: "0 1px 2px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.35)",
      raised: "0 12px 40px rgba(0,0,0,0.5)",
      button: "0 1px 2px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.22)",
      glowPrimary: "0 0 36px rgba(62,207,142,0.3)"
    },
    texture: "grid"
  },
  {
    id: "halcyon-blue",
    name: "Halcyon Blue",
    inspiration: "Intercom / Slack-class friendly SaaS",
    mode: "light",
    keywords: [
      "chat", "support", "customer", "crm", "sales", "marketing", "email",
      "messaging", "collaboration", "hr", "people", "hiring", "recruit",
      "project", "task", "manage", "management", "calendar", "schedule",
      "meeting", "event", "booking"
    ],
    fonts: {
      display: "Plus Jakarta Sans",
      body: "Plus Jakarta Sans",
      mono: "IBM Plex Mono",
      googleImport:
        "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400&display=swap",
      displayStack: "'Plus Jakarta Sans', -apple-system, 'Segoe UI', sans-serif",
      bodyStack: "'Plus Jakarta Sans', -apple-system, 'Segoe UI', sans-serif",
      monoStack: "'IBM Plex Mono', ui-monospace, monospace",
      displayWeight: 800,
      displayTracking: "-0.03em"
    },
    colors: {
      bg: "#f8fafc",
      bgAlt: "#eef4fb",
      surface: "#ffffff",
      surfaceRaised: "#ffffff",
      border: "rgba(13,42,84,0.09)",
      borderStrong: "rgba(13,42,84,0.18)",
      ink: "#0b1c33",
      inkSecondary: "#2d4257",
      muted: "#5c718a",
      primary: "#2563eb",
      primaryHover: "#1d4ed8",
      primaryInk: "#ffffff",
      accent: "#f59e0b",
      focus: "#2563eb",
      heroGradient: "linear-gradient(120deg, #2563eb 0%, #7c3aed 60%, #f59e0b 120%)",
      buttonGradient: "linear-gradient(180deg, #3b74f0 0%, #2563eb 100%)",
      glow: "radial-gradient(ellipse 65% 50% at 50% -12%, rgba(37,99,235,0.12), transparent 70%)",
      cardHoverBorder: "rgba(37,99,235,0.35)"
    },
    radius: { sm: "10px", md: "14px", lg: "20px", xl: "32px", pill: "999px" },
    shadows: {
      card: "0 1px 2px rgba(13,42,84,0.05), 0 10px 28px rgba(13,42,84,0.07)",
      raised: "0 18px 48px rgba(13,42,84,0.13)",
      button: "0 1px 2px rgba(37,99,235,0.4), inset 0 1px 0 rgba(255,255,255,0.25)",
      glowPrimary: "0 8px 28px rgba(37,99,235,0.3)"
    },
    texture: "dots"
  },
  {
    id: "obsidian-lux",
    name: "Obsidian Lux",
    inspiration: "Framer / Arc-class expressive dark sites",
    mode: "dark",
    keywords: [
      "browser", "app", "mobile", "startup", "launch", "modern", "future",
      "web3", "crypto", "nft", "motion", "animation", "3d", "video", "media",
      "entertainment", "fashion", "style"
    ],
    fonts: {
      display: "Manrope",
      body: "Manrope",
      mono: "JetBrains Mono",
      googleImport:
        "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400&display=swap",
      displayStack: "'Manrope', -apple-system, 'Segoe UI', sans-serif",
      bodyStack: "'Manrope', -apple-system, 'Segoe UI', sans-serif",
      monoStack: "'JetBrains Mono', ui-monospace, monospace",
      displayWeight: 800,
      displayTracking: "-0.04em"
    },
    colors: {
      bg: "#0b0812",
      bgAlt: "#0f0b18",
      surface: "#151020",
      surfaceRaised: "#1c1529",
      border: "rgba(255,255,255,0.09)",
      borderStrong: "rgba(255,255,255,0.16)",
      ink: "#f6f3fb",
      inkSecondary: "#d3c9e6",
      muted: "#93879f",
      primary: "#e879f9",
      primaryHover: "#f0abfc",
      primaryInk: "#1c0a24",
      accent: "#818cf8",
      focus: "#e879f9",
      heroGradient: "linear-gradient(120deg, #e879f9 0%, #818cf8 55%, #38bdf8 110%)",
      buttonGradient: "linear-gradient(180deg, #ec8bfa 0%, #d946ef 100%)",
      glow: "radial-gradient(ellipse 60% 45% at 50% -10%, rgba(232,121,249,0.22), transparent 70%)",
      cardHoverBorder: "rgba(232,121,249,0.45)"
    },
    radius: { sm: "10px", md: "14px", lg: "20px", xl: "28px", pill: "999px" },
    shadows: {
      card: "0 1px 2px rgba(0,0,0,0.45), 0 10px 30px rgba(0,0,0,0.4)",
      raised: "0 14px 44px rgba(0,0,0,0.55)",
      button: "0 1px 2px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.22)",
      glowPrimary: "0 0 40px rgba(232,121,249,0.32)"
    },
    texture: "grid"
  },
  {
    id: "verdant-editorial",
    name: "Verdant Editorial",
    inspiration: "Patagonia / Kinfolk-class editorial sustainability sites",
    mode: "light",
    keywords: [
      "climate", "sustain", "sustainable", "green", "nature", "environment",
      "farm", "organic", "outdoor", "coffee", "restaurant", "kitchen",
      "garden", "plant", "eco", "earth", "nonprofit", "charity"
    ],
    fonts: {
      display: "Newsreader",
      body: "Inter",
      mono: "IBM Plex Mono",
      googleImport:
        "https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500;6..72,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400&display=swap",
      displayStack: "'Newsreader', Georgia, serif",
      bodyStack: "'Inter', -apple-system, 'Segoe UI', sans-serif",
      monoStack: "'IBM Plex Mono', ui-monospace, monospace",
      displayWeight: 500,
      displayTracking: "-0.015em"
    },
    colors: {
      bg: "#f8f7f2",
      bgAlt: "#efeee5",
      surface: "#ffffff",
      surfaceRaised: "#ffffff",
      border: "rgba(30,42,32,0.11)",
      borderStrong: "rgba(30,42,32,0.22)",
      ink: "#1c2620",
      inkSecondary: "#3b4a40",
      muted: "#6b7a6f",
      primary: "#2e5d43",
      primaryHover: "#254c37",
      primaryInk: "#ffffff",
      accent: "#b3541e",
      focus: "#2e5d43",
      heroGradient: "linear-gradient(120deg, #2e5d43 0%, #557c5c 60%, #b3541e 130%)",
      buttonGradient: "linear-gradient(180deg, #37694d 0%, #2e5d43 100%)",
      glow: "none",
      cardHoverBorder: "rgba(46,93,67,0.35)"
    },
    radius: { sm: "6px", md: "10px", lg: "16px", xl: "24px", pill: "999px" },
    shadows: {
      card: "0 1px 2px rgba(30,42,32,0.05), 0 8px 24px rgba(30,42,32,0.06)",
      raised: "0 16px 44px rgba(30,42,32,0.12)",
      button: "0 1px 2px rgba(46,93,67,0.35)",
      glowPrimary: "0 8px 24px rgba(46,93,67,0.22)"
    },
    texture: "none"
  },
  {
    id: "cobalt-enterprise",
    name: "Cobalt Enterprise",
    inspiration: "Databricks / Snowflake-class enterprise data platforms",
    mode: "light",
    keywords: [
      "enterprise", "lakehouse", "warehouse", "pipeline", "etl", "bi",
      "governance", "compliance", "sso", "saml", "audit", "fortune"
    ],
    fonts: {
      display: "IBM Plex Sans",
      body: "IBM Plex Sans",
      mono: "IBM Plex Mono",
      googleImport:
        "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap",
      displayStack: "'IBM Plex Sans', -apple-system, 'Segoe UI', sans-serif",
      bodyStack: "'IBM Plex Sans', -apple-system, 'Segoe UI', sans-serif",
      monoStack: "'IBM Plex Mono', ui-monospace, monospace",
      displayWeight: 700,
      displayTracking: "-0.025em"
    },
    colors: {
      bg: "#f4f7fb",
      bgAlt: "#e8eef6",
      surface: "#ffffff",
      surfaceRaised: "#ffffff",
      border: "rgba(15,40,80,0.1)",
      borderStrong: "rgba(15,40,80,0.18)",
      ink: "#0c1a2e",
      inkSecondary: "#2a4060",
      muted: "#5a7090",
      primary: "#1e56a0",
      primaryHover: "#184a8a",
      primaryInk: "#ffffff",
      accent: "#e87722",
      focus: "#1e56a0",
      heroGradient: "linear-gradient(120deg, #1e56a0 0%, #2d7dd2 55%, #e87722 120%)",
      buttonGradient: "linear-gradient(180deg, #2563b5 0%, #1e56a0 100%)",
      glow: "radial-gradient(ellipse 65% 50% at 50% -12%, rgba(30,86,160,0.12), transparent 70%)",
      cardHoverBorder: "rgba(30,86,160,0.35)"
    },
    radius: { sm: "6px", md: "10px", lg: "14px", xl: "20px", pill: "999px" },
    shadows: {
      card: "0 1px 2px rgba(12,26,46,0.06), 0 8px 24px rgba(12,26,46,0.07)",
      raised: "0 16px 48px rgba(12,26,46,0.12)",
      button: "0 1px 2px rgba(30,86,160,0.35)",
      glowPrimary: "0 8px 28px rgba(30,86,160,0.28)"
    },
    texture: "beams"
  },
  {
    id: "rose-health",
    name: "Rose Health",
    inspiration: "Headspace / Calm-class wellness and healthcare apps",
    mode: "light",
    keywords: [
      "health", "healthcare", "medical", "therapy", "mental", "meditation",
      "mindful", "care", "patient", "clinical", "hospital", "doctor"
    ],
    fonts: {
      display: "DM Sans",
      body: "DM Sans",
      mono: "IBM Plex Mono",
      googleImport:
        "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400&display=swap",
      displayStack: "'DM Sans', -apple-system, 'Segoe UI', sans-serif",
      bodyStack: "'DM Sans', -apple-system, 'Segoe UI', sans-serif",
      monoStack: "'IBM Plex Mono', ui-monospace, monospace",
      displayWeight: 700,
      displayTracking: "-0.02em"
    },
    colors: {
      bg: "#fdf8f8",
      bgAlt: "#f8eeee",
      surface: "#ffffff",
      surfaceRaised: "#ffffff",
      border: "rgba(80,40,50,0.1)",
      borderStrong: "rgba(80,40,50,0.18)",
      ink: "#2a1820",
      inkSecondary: "#5a3848",
      muted: "#8a6878",
      primary: "#d4567a",
      primaryHover: "#c04468",
      primaryInk: "#ffffff",
      accent: "#5aab8a",
      focus: "#d4567a",
      heroGradient: "linear-gradient(120deg, #d4567a 0%, #e8889a 50%, #5aab8a 110%)",
      buttonGradient: "linear-gradient(180deg, #dc6284 0%, #d4567a 100%)",
      glow: "radial-gradient(ellipse 60% 45% at 50% -10%, rgba(212,86,122,0.12), transparent 70%)",
      cardHoverBorder: "rgba(212,86,122,0.35)"
    },
    radius: { sm: "12px", md: "16px", lg: "24px", xl: "32px", pill: "999px" },
    shadows: {
      card: "0 1px 2px rgba(42,24,32,0.05), 0 10px 28px rgba(42,24,32,0.06)",
      raised: "0 18px 48px rgba(42,24,32,0.1)",
      button: "0 1px 2px rgba(212,86,122,0.35)",
      glowPrimary: "0 8px 28px rgba(212,86,122,0.24)"
    },
    texture: "none"
  },
  {
    id: "ember-gaming",
    name: "Ember Gaming",
    inspiration: "Epic Games / Riot-class gaming and esports sites",
    mode: "dark",
    keywords: [
      "esports", "tournament", "player", "guild", "quest", "level", "xp",
      "battle", "arena", "console", "pc gaming", "multiplayer"
    ],
    fonts: {
      display: "Rajdhani",
      body: "Inter",
      mono: "JetBrains Mono",
      googleImport:
        "https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap",
      displayStack: "'Rajdhani', -apple-system, sans-serif",
      bodyStack: "'Inter', -apple-system, 'Segoe UI', sans-serif",
      monoStack: "'JetBrains Mono', ui-monospace, monospace",
      displayWeight: 700,
      displayTracking: "0.02em"
    },
    colors: {
      bg: "#0d0a0a",
      bgAlt: "#141010",
      surface: "#1a1414",
      surfaceRaised: "#221818",
      border: "rgba(255,255,255,0.09)",
      borderStrong: "rgba(255,255,255,0.16)",
      ink: "#f8f0ee",
      inkSecondary: "#d8c8c4",
      muted: "#9a8480",
      primary: "#ff4d2e",
      primaryHover: "#ff6347",
      primaryInk: "#1a0804",
      accent: "#ffd000",
      focus: "#ff4d2e",
      heroGradient: "linear-gradient(120deg, #ff4d2e 0%, #ff8c00 50%, #ffd000 110%)",
      buttonGradient: "linear-gradient(180deg, #ff5a3a 0%, #e84428 100%)",
      glow: "radial-gradient(ellipse 60% 45% at 50% -10%, rgba(255,77,46,0.22), transparent 70%)",
      cardHoverBorder: "rgba(255,77,46,0.45)"
    },
    radius: { sm: "4px", md: "8px", lg: "12px", xl: "16px", pill: "999px" },
    shadows: {
      card: "0 1px 2px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.4)",
      raised: "0 14px 44px rgba(0,0,0,0.55)",
      button: "0 1px 2px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)",
      glowPrimary: "0 0 40px rgba(255,77,46,0.35)"
    },
    texture: "grid"
  },
  {
    id: "slate-legal",
    name: "Slate Legal",
    inspiration: "Law firm / professional services trust sites",
    mode: "light",
    keywords: [
      "law", "legal", "attorney", "counsel", "litigation", "contract",
      "regulatory", "policy", "government", "public sector", "consulting"
    ],
    fonts: {
      display: "Libre Baskerville",
      body: "Source Sans 3",
      mono: "IBM Plex Mono",
      googleImport:
        "https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Source+Sans+3:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400&display=swap",
      displayStack: "'Libre Baskerville', Georgia, serif",
      bodyStack: "'Source Sans 3', -apple-system, 'Segoe UI', sans-serif",
      monoStack: "'IBM Plex Mono', ui-monospace, monospace",
      displayWeight: 700,
      displayTracking: "-0.01em"
    },
    colors: {
      bg: "#f7f8fa",
      bgAlt: "#eef0f4",
      surface: "#ffffff",
      surfaceRaised: "#ffffff",
      border: "rgba(20,30,50,0.1)",
      borderStrong: "rgba(20,30,50,0.2)",
      ink: "#141e32",
      inkSecondary: "#344058",
      muted: "#647088",
      primary: "#1a3352",
      primaryHover: "#142840",
      primaryInk: "#ffffff",
      accent: "#8b6914",
      focus: "#1a3352",
      heroGradient: "linear-gradient(120deg, #1a3352 0%, #2a5070 60%, #8b6914 130%)",
      buttonGradient: "linear-gradient(180deg, #224060 0%, #1a3352 100%)",
      glow: "none",
      cardHoverBorder: "rgba(26,51,82,0.35)"
    },
    radius: { sm: "4px", md: "6px", lg: "10px", xl: "14px", pill: "999px" },
    shadows: {
      card: "0 1px 2px rgba(20,30,50,0.05), 0 6px 20px rgba(20,30,50,0.06)",
      raised: "0 12px 40px rgba(20,30,50,0.1)",
      button: "0 1px 2px rgba(26,51,82,0.35)",
      glowPrimary: "0 6px 20px rgba(26,51,82,0.2)"
    },
    texture: "none"
  },
  {
    id: "citrus-creative",
    name: "Citrus Creative",
    inspiration: "Figma / Loom-class colorful creative tools",
    mode: "light",
    keywords: [
      "figma", "prototype", "wireframe", "brand", "campaign", "advertis",
      "marketing agency", "studio", "illustration", "video", "content creator"
    ],
    fonts: {
      display: "Outfit",
      body: "Outfit",
      mono: "Space Mono",
      googleImport:
        "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Space+Mono:wght@400&display=swap",
      displayStack: "'Outfit', -apple-system, 'Segoe UI', sans-serif",
      bodyStack: "'Outfit', -apple-system, 'Segoe UI', sans-serif",
      monoStack: "'Space Mono', ui-monospace, monospace",
      displayWeight: 800,
      displayTracking: "-0.03em"
    },
    colors: {
      bg: "#fffaf5",
      bgAlt: "#fff3e8",
      surface: "#ffffff",
      surfaceRaised: "#ffffff",
      border: "rgba(50,30,10,0.09)",
      borderStrong: "rgba(50,30,10,0.16)",
      ink: "#1a1008",
      inkSecondary: "#4a3020",
      muted: "#806858",
      primary: "#f97316",
      primaryHover: "#ea580c",
      primaryInk: "#ffffff",
      accent: "#8b5cf6",
      focus: "#f97316",
      heroGradient: "linear-gradient(120deg, #f97316 0%, #ec4899 45%, #8b5cf6 100%)",
      buttonGradient: "linear-gradient(180deg, #fb923c 0%, #f97316 100%)",
      glow: "radial-gradient(ellipse 65% 50% at 50% -12%, rgba(249,115,22,0.14), transparent 70%)",
      cardHoverBorder: "rgba(249,115,22,0.35)"
    },
    radius: { sm: "10px", md: "16px", lg: "24px", xl: "32px", pill: "999px" },
    shadows: {
      card: "0 1px 2px rgba(26,16,8,0.05), 0 10px 28px rgba(26,16,8,0.07)",
      raised: "0 18px 48px rgba(26,16,8,0.12)",
      button: "0 1px 2px rgba(249,115,22,0.4)",
      glowPrimary: "0 8px 28px rgba(249,115,22,0.28)"
    },
    texture: "dots"
  },
  {
    id: "midnight-fintech",
    name: "Midnight Fintech",
    inspiration: "Ramp / Mercury-class dark fintech startups",
    mode: "dark",
    keywords: [
      "spend", "expense", "corporate card", "treasury", "capital", "invest",
      "portfolio", "trading", "crypto", "defi", "blockchain", "web3"
    ],
    fonts: {
      display: "Geist",
      body: "Inter",
      mono: "JetBrains Mono",
      googleImport:
        "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      displayStack: "'Inter', -apple-system, 'Segoe UI', sans-serif",
      bodyStack: "'Inter', -apple-system, 'Segoe UI', sans-serif",
      monoStack: "'JetBrains Mono', ui-monospace, monospace",
      displayWeight: 700,
      displayTracking: "-0.035em"
    },
    colors: {
      bg: "#080b10",
      bgAlt: "#0c1018",
      surface: "#101620",
      surfaceRaised: "#161e2c",
      border: "rgba(255,255,255,0.08)",
      borderStrong: "rgba(255,255,255,0.14)",
      ink: "#eef2f8",
      inkSecondary: "#b8c4d8",
      muted: "#7888a0",
      primary: "#4d9fff",
      primaryHover: "#6ab0ff",
      primaryInk: "#061018",
      accent: "#34d399",
      focus: "#4d9fff",
      heroGradient: "linear-gradient(120deg, #4d9fff 0%, #818cf8 55%, #34d399 110%)",
      buttonGradient: "linear-gradient(180deg, #5aa8ff 0%, #4d9fff 100%)",
      glow: "radial-gradient(ellipse 60% 45% at 50% -10%, rgba(77,159,255,0.2), transparent 70%)",
      cardHoverBorder: "rgba(77,159,255,0.45)"
    },
    radius: { sm: "8px", md: "12px", lg: "16px", xl: "24px", pill: "999px" },
    shadows: {
      card: "0 1px 2px rgba(0,0,0,0.45), 0 8px 24px rgba(0,0,0,0.4)",
      raised: "0 14px 44px rgba(0,0,0,0.55)",
      button: "0 1px 2px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18)",
      glowPrimary: "0 0 36px rgba(77,159,255,0.3)"
    },
    texture: "grid"
  },
  {
    id: "sand-travel",
    name: "Sand Travel",
    inspiration: "Airbnb / Booking-class travel and hospitality",
    mode: "light",
    keywords: [
      "hotel", "host", "booking", "vacation", "trip", "flight", "destination",
      "resort", "hospitality", "guest", "rental", "stay", "explore"
    ],
    fonts: {
      display: "Nunito",
      body: "Nunito Sans",
      mono: "IBM Plex Mono",
      googleImport:
        "https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800&family=Nunito+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400&display=swap",
      displayStack: "'Nunito', -apple-system, 'Segoe UI', sans-serif",
      bodyStack: "'Nunito Sans', -apple-system, 'Segoe UI', sans-serif",
      monoStack: "'IBM Plex Mono', ui-monospace, monospace",
      displayWeight: 800,
      displayTracking: "-0.02em"
    },
    colors: {
      bg: "#fffaf6",
      bgAlt: "#fff0e6",
      surface: "#ffffff",
      surfaceRaised: "#ffffff",
      border: "rgba(60,40,20,0.1)",
      borderStrong: "rgba(60,40,20,0.18)",
      ink: "#221810",
      inkSecondary: "#4a3828",
      muted: "#806858",
      primary: "#e04e3a",
      primaryHover: "#c84432",
      primaryInk: "#ffffff",
      accent: "#0891b2",
      focus: "#e04e3a",
      heroGradient: "linear-gradient(120deg, #e04e3a 0%, #f08060 50%, #0891b2 110%)",
      buttonGradient: "linear-gradient(180deg, #e85a48 0%, #e04e3a 100%)",
      glow: "radial-gradient(ellipse 60% 45% at 50% -10%, rgba(224,78,58,0.12), transparent 70%)",
      cardHoverBorder: "rgba(224,78,58,0.35)"
    },
    radius: { sm: "10px", md: "14px", lg: "20px", xl: "28px", pill: "999px" },
    shadows: {
      card: "0 1px 2px rgba(34,24,16,0.05), 0 10px 28px rgba(34,24,16,0.07)",
      raised: "0 18px 48px rgba(34,24,16,0.12)",
      button: "0 1px 2px rgba(224,78,58,0.35)",
      glowPrimary: "0 8px 28px rgba(224,78,58,0.24)"
    },
    texture: "none"
  },
  {
    id: "pixel-retro",
    name: "Pixel Retro",
    inspiration: "Playful indie / retro-futurist product sites",
    mode: "dark",
    keywords: [
      "indie", "fun", "play", "toy", "retro", "pixel", "arcade", "nostalg",
      "kids", "family", "emoji", "cartoon", "whimsical"
    ],
    fonts: {
      display: "Press Start 2P",
      body: "Space Grotesk",
      mono: "JetBrains Mono",
      googleImport:
        "https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Space+Grotesk:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap",
      displayStack: "'Press Start 2P', monospace",
      bodyStack: "'Space Grotesk', -apple-system, sans-serif",
      monoStack: "'JetBrains Mono', ui-monospace, monospace",
      displayWeight: 400,
      displayTracking: "0"
    },
    colors: {
      bg: "#1a1030",
      bgAlt: "#221840",
      surface: "#2a2050",
      surfaceRaised: "#322860",
      border: "rgba(255,255,255,0.12)",
      borderStrong: "rgba(255,255,255,0.2)",
      ink: "#f0e8ff",
      inkSecondary: "#c8b8e8",
      muted: "#9888b8",
      primary: "#ff6ec7",
      primaryHover: "#ff8fd4",
      primaryInk: "#1a0830",
      accent: "#7df9ff",
      focus: "#ff6ec7",
      heroGradient: "linear-gradient(120deg, #ff6ec7 0%, #7df9ff 50%, #ffe66d 110%)",
      buttonGradient: "linear-gradient(180deg, #ff7ed0 0%, #ff6ec7 100%)",
      glow: "radial-gradient(ellipse 60% 45% at 50% -10%, rgba(255,110,199,0.25), transparent 70%)",
      cardHoverBorder: "rgba(255,110,199,0.5)"
    },
    radius: { sm: "0", md: "4px", lg: "8px", xl: "12px", pill: "999px" },
    shadows: {
      card: "4px 4px 0 rgba(0,0,0,0.5)",
      raised: "6px 6px 0 rgba(0,0,0,0.5)",
      button: "3px 3px 0 rgba(0,0,0,0.6)",
      glowPrimary: "0 0 24px rgba(255,110,199,0.4)"
    },
    texture: "grid"
  },
  {
    id: "coral-marketing",
    name: "Coral Marketing",
    inspiration: "HubSpot / Mailchimp-class marketing platforms",
    mode: "light",
    keywords: [
      "hubspot", "mailchimp", "newsletter", "campaign", "lead", "funnel",
      "seo", "ads", "growth", "convert", "landing page", "automation"
    ],
    fonts: {
      display: "Lexend",
      body: "Lexend",
      mono: "IBM Plex Mono",
      googleImport:
        "https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400&display=swap",
      displayStack: "'Lexend', -apple-system, 'Segoe UI', sans-serif",
      bodyStack: "'Lexend', -apple-system, 'Segoe UI', sans-serif",
      monoStack: "'IBM Plex Mono', ui-monospace, monospace",
      displayWeight: 800,
      displayTracking: "-0.03em"
    },
    colors: {
      bg: "#fff8f5",
      bgAlt: "#ffefe8",
      surface: "#ffffff",
      surfaceRaised: "#ffffff",
      border: "rgba(50,30,20,0.09)",
      borderStrong: "rgba(50,30,20,0.16)",
      ink: "#1a1008",
      inkSecondary: "#4a3020",
      muted: "#806858",
      primary: "#ff5c35",
      primaryHover: "#e84a28",
      primaryInk: "#ffffff",
      accent: "#00bda5",
      focus: "#ff5c35",
      heroGradient: "linear-gradient(120deg, #ff5c35 0%, #ff8a65 50%, #00bda5 110%)",
      buttonGradient: "linear-gradient(180deg, #ff6842 0%, #ff5c35 100%)",
      glow: "radial-gradient(ellipse 65% 50% at 50% -12%, rgba(255,92,53,0.14), transparent 70%)",
      cardHoverBorder: "rgba(255,92,53,0.35)"
    },
    radius: { sm: "8px", md: "12px", lg: "18px", xl: "28px", pill: "999px" },
    shadows: {
      card: "0 1px 2px rgba(26,16,8,0.05), 0 10px 28px rgba(26,16,8,0.07)",
      raised: "0 18px 48px rgba(26,16,8,0.12)",
      button: "0 1px 2px rgba(255,92,53,0.4)",
      glowPrimary: "0 8px 28px rgba(255,92,53,0.28)"
    },
    texture: "beams"
  }
];

export function getProfile(id) {
  return DESIGN_PROFILES.find((profile) => profile.id === id) ?? null;
}
