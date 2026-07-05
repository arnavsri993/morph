// Detect visible design preferences from an incoming site so morph preserves
// dark/light mode and brand colors during transform instead of forcing a
// mismatched palette.

import { applyDesignHints } from "../ai-vision.js";
import { DESIGN_PROFILES } from "./profiles.js";

const HEX_COLOR = /#(?:[0-9a-f]{3,8})\b/gi;
const RGB_COLOR = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i;

export function extractVisualPreferences(html, css = "") {
  const source = `${String(html ?? "")}\n${String(css ?? "")}`;
  let darkSignals = 0;
  let lightSignals = 0;

  if (/color-scheme:\s*dark/i.test(source)) darkSignals += 4;
  if (/color-scheme:\s*light/i.test(source)) lightSignals += 3;
  if (/\bclass=["'][^"']*\bdark\b/i.test(html)) darkSignals += 3;
  if (/\bclass=["'][^"']*\blight\b/i.test(html)) lightSignals += 2;
  if (/\bdata-theme=["']dark["']/i.test(html)) darkSignals += 3;
  if (/\bdata-theme=["']light["']/i.test(html)) lightSignals += 2;
  if (/<html[^>]*\bdark\b/i.test(html)) darkSignals += 2;
  if (/<body[^>]*\bbackground(?:-color)?\s*:\s*[^;>]*#(?:000|0a0a0a|0b0b0b|111|121212|0f0f0f)/i.test(html)) {
    darkSignals += 2;
  }

  for (const match of source.matchAll(/(?:background(?:-color)?|bg-color)\s*:\s*([^;}\n]+)/gi)) {
    const lum = colorLuminance(match[1]);
    if (lum === null) continue;
    if (lum < 0.28) darkSignals += 1;
    if (lum > 0.72) lightSignals += 1;
  }

  for (const match of source.matchAll(/(?:^|\s)color\s*:\s*([^;}\n]+)/gi)) {
    const lum = colorLuminance(match[1]);
    if (lum === null) continue;
    if (lum > 0.82) darkSignals += 0.5;
    if (lum < 0.22) lightSignals += 0.5;
  }

  const mode = darkSignals > lightSignals + 0.5
    ? "dark"
    : lightSignals > darkSignals + 0.5
      ? "light"
      : null;

  const primaryColor = pickBrandColor(source, [
    /--(?:primary|brand|accent|color-primary)\s*:\s*([^;}\n]+)/gi,
    /<meta[^>]*name=["']theme-color["'][^>]*content=["'](#[^"']+)["']/gi,
    /<meta[^>]*content=["'](#[^"']+)["'][^>]*name=["']theme-color["']/gi
  ]);
  const accentColor = pickBrandColor(source, [
    /--(?:accent|secondary|highlight)\s*:\s*([^;}\n]+)/gi
  ], primaryColor);

  const confidence = mode
    ? Math.min(1, Math.abs(darkSignals - lightSignals) / 4)
    : 0;

  return {
    mode,
    primaryColor,
    accentColor,
    confidence,
    signals: { dark: darkSignals, light: lightSignals }
  };
}

export function alignProfileToPreferences(profile, preferences, context = {}) {
  if (!profile) return profile;

  let aligned = profile;
  if (preferences?.mode && profile.mode !== preferences.mode) {
    aligned = pickModeAlignedProfile(profile, preferences.mode, context);
  }

  return applyPreferenceHints(aligned, preferences);
}

export function applyPreferenceHints(profile, preferences) {
  if (!preferences) return profile;
  const hints = {};
  if (preferences.primaryColor) hints.primaryColor = preferences.primaryColor;
  if (preferences.accentColor) hints.accentColor = preferences.accentColor;
  if (preferences.mode) hints.mode = preferences.mode;
  if (!Object.keys(hints).length) return profile;
  return applyDesignHints(profile, hints);
}

function pickModeAlignedProfile(profile, mode, context = {}) {
  const candidates = DESIGN_PROFILES.filter((candidate) => candidate.mode === mode);
  if (!candidates.length) return profile;

  const originalKeywords = new Set(profile.keywords ?? []);
  const matchedKeywords = new Set(context.matchedKeywords ?? []);
  let best = candidates[0];
  let bestScore = -1;

  for (const candidate of candidates) {
    const keywordOverlap = candidate.keywords.filter((keyword) => originalKeywords.has(keyword)).length;
    const contentOverlap = candidate.keywords.filter((keyword) => matchedKeywords.has(keyword)).length;
    const sameFamily = candidate.inspiration.split("/")[0].trim() === profile.inspiration.split("/")[0].trim()
      ? 1
      : 0;
    const score = keywordOverlap * 3 + contentOverlap * 2 + sameFamily;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

function pickBrandColor(source, patterns, exclude = null) {
  const counts = new Map();

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const hex = normalizeHex(match[1] ?? match[0]);
      if (!hex || hex === exclude || isNeutralColor(hex)) continue;
      counts.set(hex, (counts.get(hex) ?? 0) + 3);
    }
  }

  for (const match of source.matchAll(/<button\b[^>]*style=["']([^"']*)["']/gi)) {
  for (const colorMatch of match[1].matchAll(/background(?:-color)?\s*:\s*([^;]+)/gi)) {
      const hex = normalizeHex(colorMatch[1]);
      if (!hex || hex === exclude || isNeutralColor(hex)) continue;
      counts.set(hex, (counts.get(hex) ?? 0) + 2);
    }
  }

  for (const match of source.matchAll(HEX_COLOR)) {
    const hex = normalizeHex(match[0]);
    if (!hex || hex === exclude || isNeutralColor(hex)) continue;
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }

  let best = null;
  let bestCount = 0;
  for (const [hex, count] of counts.entries()) {
    if (count > bestCount) {
      best = hex;
      bestCount = count;
    }
  }
  return best;
}

function normalizeHex(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  const hexMatch = raw.match(HEX_COLOR);
  if (hexMatch) {
    let hex = hexMatch[0].slice(1);
    if (hex.length === 3) hex = hex.split("").map((ch) => ch + ch).join("");
    if (hex.length === 6) return `#${hex}`;
    if (hex.length === 8) return `#${hex.slice(0, 6)}`;
  }

  const rgbMatch = raw.match(RGB_COLOR);
  if (!rgbMatch) return null;
  const parts = [rgbMatch[1], rgbMatch[2], rgbMatch[3]].map((part) => {
    const n = Number(part);
    const channel = Number.isFinite(n) ? Math.max(0, Math.min(255, n > 1 ? n : n * 255)) : 0;
    return Math.round(channel).toString(16).padStart(2, "0");
  });
  return `#${parts.join("")}`;
}

function colorLuminance(value) {
  const hex = normalizeHex(value);
  if (!hex) return null;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const channel = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function isNeutralColor(hex) {
  const lum = colorLuminance(hex);
  if (lum === null) return true;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  return spread < 18 && (lum < 0.12 || lum > 0.88);
}
