// morph Design Intelligence Database — externally ingested reference layer.
//
// Loads the generated corpus built by scripts/build-design-database.mjs from
// npm registry searches and public awesome-list catalogs. Merged with the
// hand-curated frontier references in reference-corpus.js at retrieval time.

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const generatedDir = path.join(__dirname, "generated");
const referencesPath = path.join(generatedDir, "external-references.json");
const statsPath = path.join(generatedDir, "source-index-stats.json");
const manifestPath = path.join(generatedDir, "manifest.json");

let cachedReferences = null;
let cachedStats = null;
let cachedManifest = null;

function readJson(filePath, fallback) {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

export function loadExternalReferences() {
  if (cachedReferences) return cachedReferences;
  cachedReferences = readJson(referencesPath, []);
  return cachedReferences;
}

export function loadExternalStats() {
  if (cachedStats) return cachedStats;
  cachedStats = readJson(statsPath, null);
  return cachedStats;
}

export function loadExternalManifest() {
  if (cachedManifest) return cachedManifest;
  cachedManifest = readJson(manifestPath, null);
  return cachedManifest;
}

export function externalCorpusSummary() {
  const references = loadExternalReferences();
  const manifest = loadExternalManifest();
  const stats = loadExternalStats();
  const bySource = {};
  const byIndustry = {};

  for (const entry of references) {
    const source = entry.source?.split(":")[0] ?? "external";
    bySource[source] = (bySource[source] ?? 0) + 1;
    byIndustry[entry.industry] = (byIndustry[entry.industry] ?? 0) + 1;
  }

  return {
    references: references.length,
    builtAt: manifest?.builtAt ?? stats?.builtAt ?? null,
    npmAggregateTotal: manifest?.npmAggregateTotal ?? stats?.npmAggregateTotal ?? 0,
    estimatedSources: manifest?.estimatedSources ?? stats?.estimatedSources ?? 0,
    bySource,
    byIndustry,
    loaded: references.length > 0
  };
}

export function mergeReferenceCorpus(curatedCorpus) {
  const external = loadExternalReferences();
  if (!external.length) return curatedCorpus;

  const byId = new Map();
  for (const entry of curatedCorpus) byId.set(entry.id, entry);
  for (const entry of external) {
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  }
  return [...byId.values()];
}

export function isExternalCorpusAvailable() {
  return loadExternalReferences().length > 0;
}
