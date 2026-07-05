// morph Composer loop — puts Cursor Composer 2.5 in charge of the design
// decisions and iterates the transform until the frontend quality score stops
// improving.
//
// Each iteration:
//   1. Composer 2.5 reads the site summary + the last render's leftover
//      quality findings and returns a JSON design decision (profile, archetype,
//      colors, typography, taste dials, extra instructions).
//   2. morph runs a real transform with those hints and scores the output.
//   3. The score + remaining findings are fed back to Composer for the next
//      decision. The best-scoring render wins.
//
// Composer is optional: without @cursor/sdk installed or CURSOR_API_KEY set,
// this falls back to a single plain transform (the existing sponsor-enrichment
// path) so nothing breaks.

import os from "node:os";
import path from "node:path";
import { cp, mkdir, rm } from "node:fs/promises";
import { transformSite } from "./transform.js";
import { databaseSummary } from "./design-db/index.js";

const DEFAULT_TARGET_SCORE = 98;
const DEFAULT_MAX_ITERATIONS = 4;
const DEFAULT_MODEL = "composer-2.5";

export function composerAvailable() {
  return Boolean(process.env.CURSOR_API_KEY?.trim());
}

// Run the full Composer-in-the-loop transform. Writes the best render to
// `outputDir` and returns { receipt, iterations, best, composer }.
export async function transformWithComposer(inputDir, outputDir, options = {}) {
  const targetScore = clampScore(options.targetScore ?? DEFAULT_TARGET_SCORE);
  const maxIterations = Math.max(1, Number(options.maxIterations ?? DEFAULT_MAX_ITERATIONS));
  const model = options.model?.trim() || DEFAULT_MODEL;
  const apiKey = options.apiKey?.trim() || process.env.CURSOR_API_KEY?.trim() || null;

  const agent = apiKey ? await createComposerAgent({ apiKey, model, cwd: inputDir }).catch(() => null) : null;

  // No Composer available: do one honest transform and return it.
  if (!agent) {
    const receipt = await transformSite(inputDir, outputDir, {
      instructions: options.instructions ?? null,
      profile: options.profile ?? null,
      archetype: options.archetype ?? null,
      taste: options.taste ?? null,
      referenceImage: options.referenceImage ?? null,
      generateReference: Boolean(options.generateReference)
    });
    return {
      receipt,
      iterations: [scoreOnly(receipt, null)],
      best: { score: receipt.after.score, iteration: 0, decision: null },
      composer: { used: false, reason: apiKey ? "sdk_unavailable" : "no_api_key" }
    };
  }

  const database = databaseSummary();
  const scratchRoot = path.join(os.tmpdir(), `morph-composer-${Date.now()}`);
  await mkdir(scratchRoot, { recursive: true });

  const iterations = [];
  let best = null;
  let lastFindings = null;
  let lastScore = null;

  try {
    for (let i = 0; i < maxIterations; i += 1) {
      const decision = await askComposerForDecision(agent, {
        database,
        instructions: options.instructions ?? null,
        iteration: i,
        lastScore,
        lastFindings,
        targetScore
      });

      const iterationDir = path.join(scratchRoot, `iter-${i}`);
      const receipt = await transformSite(inputDir, iterationDir, {
        instructions: composeInstructions(options.instructions, decision),
        profile: decision?.profileId ?? options.profile ?? null,
        archetype: decision?.archetypeId ?? options.archetype ?? null,
        aiHints: decisionToHints(decision),
        taste: decisionToTaste(decision) ?? options.taste ?? null
      });

      const score = receipt.after.score;
      iterations.push({
        iteration: i,
        score,
        decision,
        outputDir: iterationDir,
        findingCount: receipt.after.findings.length
      });

      if (!best || score > best.score) {
        best = { score, iteration: i, decision, receipt, outputDir: iterationDir };
      }

      lastScore = score;
      lastFindings = receipt.after.findings;

      if (score >= targetScore) break;
    }

    // Materialize the best render into the requested output directory.
    await rm(outputDir, { recursive: true, force: true });
    await cp(best.outputDir, outputDir, { recursive: true });

    return {
      receipt: best.receipt,
      iterations: iterations.map(({ outputDir: _drop, ...rest }) => rest),
      best: { score: best.score, iteration: best.iteration, decision: best.decision },
      composer: { used: true, model, iterations: iterations.length, targetScore }
    };
  } finally {
    await disposeAgent(agent);
    await rm(scratchRoot, { recursive: true, force: true }).catch(() => {});
  }
}

async function createComposerAgent({ apiKey, model, cwd }) {
  const { Agent } = await import("@cursor/sdk");
  return Agent.create({
    apiKey,
    model: { id: model },
    local: { cwd }
  });
}

async function disposeAgent(agent) {
  if (!agent) return;
  try {
    const dispose = agent[Symbol.asyncDispose];
    if (typeof dispose === "function") await dispose.call(agent);
    else if (typeof agent.close === "function") await agent.close();
  } catch {
    // best-effort cleanup
  }
}

async function askComposerForDecision(agent, context) {
  const prompt = buildDecisionPrompt(context);
  try {
    const run = await agent.send(prompt);
    const result = await run.wait();
    if (result.status === "error") return null;
    return parseDecision(collectText(result));
  } catch {
    return null;
  }
}

function buildDecisionPrompt(context) {
  const { database, instructions, iteration, lastScore, lastFindings, targetScore } = context;
  const findingLines = (lastFindings ?? [])
    .slice(0, 12)
    .map((finding) => `- [${finding.severity}] ${finding.id}: ${finding.message}`)
    .join("\n");

  return [
    "You are the design director for morph, a website redesign engine.",
    "Pick the design system that will produce the highest UI-quality score for this site.",
    instructions ? `Creative brief: ${instructions}` : "",
    iteration === 0
      ? "This is the first attempt."
      : `Previous attempt scored ${lastScore}/100 (target is ${targetScore}). Remaining UI-quality issues:\n${findingLines || "- none"}`,
    "",
    `Valid profileId values: ${database.profileIds.join(", ")}.`,
    `Valid archetypeId values: ${database.archetypeIds.join(", ")}.`,
    "Taste dials are integers 1-10 (designVariance, motionIntensity, visualDensity).",
    "",
    "Respond with ONLY a JSON object, no prose, no code fences:",
    "{",
    '  "profileId": "<one valid profileId>",',
    '  "archetypeId": "<one valid archetypeId>",',
    '  "mode": "dark" | "light",',
    '  "primaryColor": "#rrggbb",',
    '  "accentColor": "#rrggbb",',
    '  "typographyMood": "geometric-sans" | "humanist-sans" | "editorial-serif" | "mono-tech",',
    '  "designVariance": 1-10,',
    '  "motionIntensity": 1-10,',
    '  "visualDensity": 1-10,',
    '  "instructions": "one sentence of extra art direction",',
    '  "reasoning": "one sentence on why this raises the score"',
    "}"
  ].filter((line) => line !== null && line !== undefined).join("\n");
}

function collectText(result) {
  if (typeof result?.result === "string") return result.result;
  if (Array.isArray(result?.messages)) {
    return result.messages
      .flatMap((message) => (Array.isArray(message?.content) ? message.content : []))
      .filter((block) => block?.type === "text")
      .map((block) => block.text)
      .join("\n");
  }
  return "";
}

function parseDecision(text) {
  if (!text) return null;
  const withoutFences = text.replace(/```(?:json)?/gi, "");
  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(withoutFences.slice(start, end + 1));
    return normalizeDecision(parsed);
  } catch {
    return null;
  }
}

function normalizeDecision(raw) {
  if (!raw || typeof raw !== "object") return null;
  const hex = (value) => (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : null);
  const dial = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(1, Math.min(10, Math.round(n))) : null;
  };
  return {
    profileId: typeof raw.profileId === "string" ? raw.profileId.trim() : null,
    archetypeId: typeof raw.archetypeId === "string" ? raw.archetypeId.trim() : null,
    mode: raw.mode === "dark" || raw.mode === "light" ? raw.mode : null,
    primaryColor: hex(raw.primaryColor),
    accentColor: hex(raw.accentColor),
    typographyMood: typeof raw.typographyMood === "string" ? raw.typographyMood.trim() : null,
    designVariance: dial(raw.designVariance),
    motionIntensity: dial(raw.motionIntensity),
    visualDensity: dial(raw.visualDensity),
    instructions: typeof raw.instructions === "string" ? raw.instructions.trim() : null,
    reasoning: typeof raw.reasoning === "string" ? raw.reasoning.trim() : null
  };
}

function decisionToHints(decision) {
  if (!decision) return null;
  const hints = {
    profileId: decision.profileId,
    archetypeId: decision.archetypeId,
    mode: decision.mode,
    primaryColor: decision.primaryColor,
    accentColor: decision.accentColor,
    typographyMood: decision.typographyMood,
    layoutNotes: decision.reasoning,
    confidence: 0.9
  };
  return Object.values(hints).some((value) => value != null) ? hints : null;
}

function decisionToTaste(decision) {
  if (!decision) return null;
  const taste = {};
  if (decision.designVariance != null) taste.designVariance = decision.designVariance;
  if (decision.motionIntensity != null) taste.motionIntensity = decision.motionIntensity;
  if (decision.visualDensity != null) taste.visualDensity = decision.visualDensity;
  return Object.keys(taste).length ? taste : null;
}

function composeInstructions(baseInstructions, decision) {
  return [baseInstructions, decision?.instructions].filter(Boolean).join(" ").trim() || null;
}

function scoreOnly(receipt, decision) {
  return {
    iteration: 0,
    score: receipt.after.score,
    decision,
    findingCount: receipt.after.findings.length
  };
}

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_TARGET_SCORE;
  return Math.max(1, Math.min(100, Math.round(n)));
}
