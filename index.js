import path from "node:path";
import { fileURLToPath } from "node:url";
import morphConfig from "./morph.config.json" with { type: "json" };
import { parseConfig } from "./src/core.js";
import { createMorphHandler } from "./src/server.js";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(rootDir, "morph.config.json");

let handlerPromise;

function ensureAppUrl() {
  if (!process.env.MORPH_APP_URL?.trim() && process.env.VERCEL_URL) {
    process.env.MORPH_APP_URL = `https://${process.env.VERCEL_URL}`;
  }
}

async function getHandler() {
  if (!handlerPromise) {
    handlerPromise = (async () => {
      ensureAppUrl();
      const config = parseConfig(morphConfig, configPath);
      return createMorphHandler(config, {
        host: "0.0.0.0",
        port: 443,
        cwd: rootDir,
        loadEnv: false
      });
    })();
  }
  return handlerPromise;
}

export default async function handler(request, response) {
  const morphHandler = await getHandler();
  return morphHandler(request, response);
}
