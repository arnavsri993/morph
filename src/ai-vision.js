// morph AI vision — optional reference-image analysis and mockup generation.
//
// When OPENAI_API_KEY is set, morph can:
//   1. Analyze a reference screenshot/mockup and extract design hints
//   2. Generate a UI mockup image from site content, then analyze it
//
// Works with any OpenAI-compatible API via MORPH_AI_BASE_URL.

import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const DEFAULT_BASE = "https://api.openai.com/v1";
const VISION_MODEL = process.env.MORPH_VISION_MODEL ?? "gpt-4o-mini";
const IMAGE_MODEL = process.env.MORPH_IMAGE_MODEL ?? "dall-e-3";

export function aiVisionAvailable() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function analyzeUiReference(options = {}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      available: false,
      reason: "no_api_key",
      hints: null,
      message: "Set OPENAI_API_KEY to enable AI reference analysis."
    };
  }

  const imageData = await loadImageData(options);
  if (!imageData) {
    return {
      available: true,
      reason: "no_image",
      hints: null,
      message: "No reference image provided."
    };
  }

  const systemPrompt = `You are a senior product designer analyzing a website UI reference.
Return ONLY valid JSON with these fields:
{
  "profileId": one of aurora-dark, meridian-light, atelier-warm, monolith-mono, signal-green, halcyon-blue, obsidian-lux, verdant-editorial, cobalt-enterprise, rose-health, ember-gaming, slate-legal, citrus-creative, midnight-fintech, sand-travel, pixel-retro, coral-marketing,
  "archetypeId": one of landing-classic, landing-split, landing-bento, developer-product, editorial-story, saas-pricing, enterprise-trust, minimal-showcase,
  "mode": "dark" or "light",
  "primaryColor": "#hex",
  "accentColor": "#hex or null",
  "typographyMood": "geometric-sans" | "humanist-sans" | "editorial-serif" | "mono-tech",
  "layoutNotes": "one sentence about layout/composition",
  "confidence": 0.0 to 1.0
}`;

  const userParts = [
    {
      type: "text",
      text: [
        options.instructions ? `Agent instructions: ${options.instructions}` : "",
        options.contentSummary ? `Site content summary: ${options.contentSummary}` : "",
        "Analyze this UI reference and return design hints as JSON."
      ].filter(Boolean).join("\n\n")
    },
    {
      type: "image_url",
      image_url: { url: imageData, detail: "low" }
    }
  ];

  try {
    const response = await aiRequest("/chat/completions", {
      model: VISION_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userParts }
      ],
      max_tokens: 500
    }, apiKey);

    const raw = response.choices?.[0]?.message?.content ?? "{}";
    const hints = normalizeHints(JSON.parse(raw));
    return {
      available: true,
      reason: "analyzed",
      hints,
      model: VISION_MODEL,
      message: hints.layoutNotes ?? "Reference analyzed."
    };
  } catch (error) {
    return {
      available: true,
      reason: "api_error",
      hints: null,
      message: error.message
    };
  }
}

export async function generateUiReference(options = {}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      available: false,
      reason: "no_api_key",
      imagePath: null,
      hints: null,
      message: "Set OPENAI_API_KEY to generate UI reference mockups."
    };
  }

  const prompt = buildGenerationPrompt(options);
  const outputDir = options.outputDir ?? path.join(process.cwd(), ".morph", "references");
  await mkdir(outputDir, { recursive: true });
  const imagePath = path.join(outputDir, `ui-reference-${Date.now()}.png`);

  try {
    const response = await aiRequest("/images/generations", {
      model: IMAGE_MODEL,
      prompt,
      n: 1,
      size: "1792x1024",
      quality: "standard",
      response_format: "b64_json"
    }, apiKey);

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) throw new Error("Image generation returned no data.");
    await writeFile(imagePath, Buffer.from(b64, "base64"));

    const analysis = await analyzeUiReference({
      imagePath,
      instructions: options.instructions,
      contentSummary: options.contentSummary
    });

    return {
      available: true,
      reason: "generated",
      imagePath,
      prompt,
      hints: analysis.hints,
      analysis,
      message: `Generated UI reference at ${imagePath}`
    };
  } catch (error) {
    return {
      available: true,
      reason: "api_error",
      imagePath: null,
      hints: null,
      message: error.message
    };
  }
}

export function applyDesignHints(profile, hints) {
  if (!hints) return profile;
  const merged = structuredClone(profile);

  if (hints.primaryColor && /^#[0-9a-f]{6}$/i.test(hints.primaryColor)) {
    merged.colors.primary = hints.primaryColor;
    merged.colors.primaryHover = shiftColor(hints.primaryColor, 12);
    merged.colors.focus = hints.primaryColor;
  }
  if (hints.accentColor && /^#[0-9a-f]{6}$/i.test(hints.accentColor)) {
    merged.colors.accent = hints.accentColor;
  }
  if (hints.mode === "dark" || hints.mode === "light") {
    merged.mode = hints.mode;
  }

  return merged;
}

async function loadImageData(options) {
  if (options.imageUrl) return options.imageUrl;
  if (options.imagePath && existsSync(options.imagePath)) {
    const buffer = await readFile(options.imagePath);
    const mime = options.imagePath.toLowerCase().endsWith(".png") ? "image/png"
      : options.imagePath.toLowerCase().endsWith(".webp") ? "image/webp"
        : "image/jpeg";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  }
  return null;
}

function buildGenerationPrompt(options) {
  const brand = options.brand ?? "a modern SaaS product";
  const headline = options.headline ?? "Build faster with AI";
  const style = options.instructions ?? "frontier-grade, polished, responsive landing page";
  return [
    "High-fidelity website UI mockup screenshot, desktop viewport.",
    `Product: ${brand}. Headline: "${headline}".`,
    `Style direction: ${style}.`,
    "Clean navigation, hero section, feature cards, modern typography, subtle gradients.",
    "No watermarks, no device frame, no text gibberish — readable English UI labels.",
    "Professional product marketing site like Linear or Stripe."
  ].join(" ");
}

function normalizeHints(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    profileId: typeof raw.profileId === "string" ? raw.profileId : null,
    archetypeId: typeof raw.archetypeId === "string" ? raw.archetypeId : null,
    mode: raw.mode === "dark" || raw.mode === "light" ? raw.mode : null,
    primaryColor: typeof raw.primaryColor === "string" ? raw.primaryColor : null,
    accentColor: typeof raw.accentColor === "string" ? raw.accentColor : null,
    typographyMood: typeof raw.typographyMood === "string" ? raw.typographyMood : null,
    layoutNotes: typeof raw.layoutNotes === "string" ? raw.layoutNotes : null,
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0.5
  };
}

async function aiRequest(endpoint, body, apiKey) {
  const base = (process.env.MORPH_AI_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, "");
  const response = await fetch(`${base}${endpoint}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error?.message ?? `AI API ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

function shiftColor(hex, amount) {
  const num = Number.parseInt(hex.slice(1), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
