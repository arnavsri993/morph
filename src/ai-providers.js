// Unified AI provider routing for morph sponsor integrations.
//
// Supports OpenRouter, Nebius Token Factory, NVIDIA NIM, Azure OpenAI
// (Microsoft for Startups), Cloudflare Workers AI, and OpenAI-compatible fallbacks.

export const SPONSOR_IDS = [
  "openrouter",
  "nebius",
  "nvidia",
  "microsoft",
  "cloudflare",
  "suse"
];

const AI_FETCH_TIMEOUT_MS = 20_000;
const SPONSOR_ENRICHMENT_TIMEOUT_MS = 25_000;

const PROVIDER_DEFS = {
  openrouter: {
    sponsor: "openrouter",
    label: "OpenRouter",
    env: ["OPENROUTER_API_KEY"],
    baseUrl: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPENROUTER_API_KEY",
    defaultModel: process.env.MORPH_OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
    visionModel: process.env.MORPH_OPENROUTER_VISION_MODEL ?? "openai/gpt-4o-mini",
    extraHeaders: () => ({
      "HTTP-Referer": process.env.MORPH_APP_URL ?? "https://morph.dev",
      "X-Title": "morph Studio"
    })
  },
  nebius: {
    sponsor: "nebius",
    label: "Nebius Token Factory",
    env: ["NEBIUS_API_KEY"],
    baseUrl: "https://api.tokenfactory.nebius.com/v1",
    apiKeyEnv: "NEBIUS_API_KEY",
    defaultModel: process.env.MORPH_NEBIUS_MODEL ?? "Qwen/Qwen3-30B-A3B",
    visionModel: process.env.MORPH_NEBIUS_VISION_MODEL ?? "Qwen/Qwen3-30B-A3B"
  },
  nvidia: {
    sponsor: "nvidia",
    label: "NVIDIA NIM",
    env: ["NVIDIA_API_KEY"],
    baseUrl: process.env.NVIDIA_NIM_BASE_URL ?? "https://integrate.api.nvidia.com/v1",
    apiKeyEnv: "NVIDIA_API_KEY",
    defaultModel: process.env.MORPH_NVIDIA_MODEL ?? "nvidia/nemotron-4-mini-instruct",
    visionModel: process.env.MORPH_NVIDIA_VISION_MODEL ?? "nvidia/nemotron-4-mini-instruct"
  },
  microsoft: {
    sponsor: "microsoft",
    label: "Azure OpenAI (Microsoft for Startups)",
    env: ["AZURE_OPENAI_API_KEY", "AZURE_OPENAI_ENDPOINT"],
    baseUrl: () => {
      const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim().replace(/\/$/, "");
      const deployment = process.env.AZURE_OPENAI_DEPLOYMENT?.trim() || "gpt-4o-mini";
      if (!endpoint) return null;
      return `${endpoint}/openai/deployments/${deployment}`;
    },
    apiKeyEnv: "AZURE_OPENAI_API_KEY",
    defaultModel: null,
    visionModel: null,
    azureApiVersion: process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-21"
  },
  cloudflare: {
    sponsor: "cloudflare",
    label: "Cloudflare Workers AI",
    env: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"],
    apiKeyEnv: "CLOUDFLARE_API_TOKEN",
    defaultModel: process.env.MORPH_CLOUDFLARE_MODEL ?? "@cf/meta/llama-3.1-8b-instruct",
    visionModel: process.env.MORPH_CLOUDFLARE_VISION_MODEL ?? "@cf/meta/llama-3.1-8b-instruct",
    gatewayId: process.env.CLOUDFLARE_AI_GATEWAY_ID ?? "default"
  },
  openai: {
    sponsor: null,
    label: "OpenAI-compatible",
    env: ["OPENAI_API_KEY"],
    baseUrl: process.env.MORPH_AI_BASE_URL ?? "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
    defaultModel: process.env.MORPH_VISION_MODEL ?? "gpt-4o-mini",
    visionModel: process.env.MORPH_VISION_MODEL ?? "gpt-4o-mini"
  }
};

export function getProviderDefinition(id) {
  return PROVIDER_DEFS[id] ?? null;
}

export function isProviderConfigured(id) {
  const def = PROVIDER_DEFS[id];
  if (!def) return false;
  return def.env.every((key) => Boolean(process.env[key]?.trim()));
}

export function listConfiguredProviders() {
  return Object.keys(PROVIDER_DEFS).filter((id) => isProviderConfigured(id));
}

export function listSponsorIntegrations() {
  const sponsors = {};
  for (const id of SPONSOR_IDS) {
    sponsors[id] = describeSponsorIntegration(id);
  }
  sponsors.suse.runtime = detectSuseRuntime();
  return sponsors;
}

export function describeSponsorIntegration(id) {
  switch (id) {
    case "openrouter":
      return {
        id,
        label: "OpenRouter",
        configured: isProviderConfigured("openrouter"),
        role: "Unified model gateway for vision analysis and design reasoning.",
        models: {
          text: PROVIDER_DEFS.openrouter.defaultModel,
          vision: PROVIDER_DEFS.openrouter.visionModel
        }
      };
    case "nebius":
      return {
        id,
        label: "Nebius Token Factory",
        configured: isProviderConfigured("nebius"),
        role: "Primary inference for site-content enrichment during transform.",
        models: {
          text: PROVIDER_DEFS.nebius.defaultModel,
          vision: PROVIDER_DEFS.nebius.visionModel
        }
      };
    case "nvidia":
      return {
        id,
        label: "NVIDIA",
        configured: isProviderConfigured("nvidia") || isNvidiaViaOpenRouter(),
        role: "Nemotron reasoning for UI quality review and profile selection.",
        models: {
          text: PROVIDER_DEFS.nvidia.defaultModel,
          viaOpenRouter: isNvidiaViaOpenRouter()
            ? (process.env.MORPH_NVIDIA_OPENROUTER_MODEL ?? "nvidia/nemotron-3-nano-30b-a3b")
            : null
        }
      };
    case "microsoft":
      return {
        id,
        label: "Microsoft for Startups",
        configured: isProviderConfigured("microsoft") || detectAzureHosting(),
        role: "Azure OpenAI inference and Azure Container Apps deployment target.",
        hosting: detectAzureHosting(),
        models: {
          deployment: process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o-mini"
        }
      };
    case "cloudflare":
      return {
        id,
        label: "Cloudflare",
        configured: isProviderConfigured("cloudflare"),
        role: "Workers AI edge inference and optional transform cache worker.",
        models: {
          text: PROVIDER_DEFS.cloudflare.defaultModel,
          worker: Boolean(process.env.CLOUDFLARE_TRANSFORM_CACHE?.trim())
        }
      };
    case "suse":
      return {
        id,
        label: "SUSE",
        configured: detectSuseRuntime(),
        role: "openSUSE container runtime for self-hosted morph Studio.",
        runtime: detectSuseRuntime()
      };
    default:
      return { id, configured: false };
  }
}

export function aiAvailable() {
  return listConfiguredProviders().length > 0;
}

export function resolveProviderOrder(preferred = null) {
  const explicit = preferred?.trim() || process.env.MORPH_AI_PROVIDER?.trim();
  if (explicit && isProviderConfigured(explicit)) return [explicit];

  const order = [
    process.env.MORPH_AI_PROVIDER,
    "openrouter",
    "nebius",
    "nvidia",
    "microsoft",
    "cloudflare",
    "openai"
  ].filter(Boolean);

  const seen = new Set();
  return order.filter((id) => {
    if (seen.has(id) || !isProviderConfigured(id)) return false;
    seen.add(id);
    return true;
  });
}

export async function chatCompletion(options = {}) {
  const providers = options.provider
    ? [options.provider].filter((id) => isProviderConfigured(id))
    : resolveProviderOrder(options.task);

  if (providers.length === 0) {
    throw new AiProviderError("no_api_key", "No AI provider is configured.");
  }

  let lastError = null;
  for (const providerId of providers) {
    try {
      const payload = await dispatchChat(providerId, options);
      return {
        provider: providerId,
        sponsor: PROVIDER_DEFS[providerId]?.sponsor ?? null,
        ...payload
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new AiProviderError("api_error", "All configured AI providers failed.");
}

export async function runSponsorEnrichment(options = {}) {
  const tasks = [];
  const summary = options.contentSummary ?? "";
  const prompt = [
    "You are a senior product designer reviewing an agent-generated website.",
    summary ? `Site summary: ${summary}` : "",
    options.instructions ? `Agent instructions: ${options.instructions}` : "",
    "Return ONLY valid JSON: {\"profileHint\":\"aurora-dark|halcyon-blue|monolith-mono|...\",\"layoutNote\":\"one sentence\",\"confidence\":0.0-1.0}"
  ].filter(Boolean).join("\n\n");

  if (isProviderConfigured("nebius")) {
    tasks.push(runTaggedTask("nebius", prompt, PROVIDER_DEFS.nebius.defaultModel));
  }
  if (isProviderConfigured("nvidia")) {
    tasks.push(runTaggedTask("nvidia", prompt, PROVIDER_DEFS.nvidia.defaultModel));
  } else if (isNvidiaViaOpenRouter()) {
    tasks.push(runOpenRouterNvidiaTask(prompt));
  }
  if (isProviderConfigured("openrouter")) {
    tasks.push(runTaggedTask("openrouter", prompt, PROVIDER_DEFS.openrouter.defaultModel));
  }
  if (isProviderConfigured("microsoft")) {
    tasks.push(runTaggedTask("microsoft", prompt, null));
  }
  if (isProviderConfigured("cloudflare")) {
    tasks.push(runTaggedTask("cloudflare", prompt, PROVIDER_DEFS.cloudflare.defaultModel));
  }

  const enrichment = await Promise.race([
    Promise.allSettled(tasks).then((results) => ({ results })),
    new Promise((resolve) => {
      setTimeout(() => resolve({ results: [] }), SPONSOR_ENRICHMENT_TIMEOUT_MS);
    })
  ]);
  const settled = enrichment.results;
  const results = {};
  for (const entry of settled) {
    if (entry.status !== "fulfilled" || !entry.value) continue;
    results[entry.value.sponsor] = entry.value;
  }
  return {
    available: Object.keys(results).length > 0,
    providers: results,
    mergedHints: mergeEnrichmentHints(Object.values(results))
  };
}

async function runTaggedTask(providerId, prompt, model) {
  const response = await chatCompletion({
    provider: providerId,
    model,
    messages: [
      { role: "system", content: "Respond with compact JSON only." },
      { role: "user", content: prompt }
    ],
    maxTokens: 300,
    json: true
  });
  return {
    sponsor: PROVIDER_DEFS[providerId].sponsor ?? providerId,
    provider: providerId,
    model: response.model,
    hints: parseJsonHints(response.content),
    message: response.content
  };
}

async function runOpenRouterNvidiaTask(prompt) {
  const model = process.env.MORPH_NVIDIA_OPENROUTER_MODEL ?? "nvidia/nemotron-3-nano-30b-a3b";
  const response = await chatCompletion({
    provider: "openrouter",
    model,
    messages: [
      { role: "system", content: "Respond with compact JSON only." },
      { role: "user", content: prompt }
    ],
    maxTokens: 300,
    json: true,
    openRouterProvider: { only: ["nvidia"], allow_fallbacks: false }
  });
  return {
    sponsor: "nvidia",
    provider: "openrouter",
    model,
    hints: parseJsonHints(response.content),
    message: response.content
  };
}

async function dispatchChat(providerId, options) {
  if (providerId === "cloudflare") return cloudflareChat(options);
  if (providerId === "microsoft") return azureChat(options);
  return openAiCompatibleChat(providerId, options);
}

async function openAiCompatibleChat(providerId, options) {
  const def = PROVIDER_DEFS[providerId];
  const apiKey = process.env[def.apiKeyEnv]?.trim();
  const baseUrl = typeof def.baseUrl === "function" ? def.baseUrl() : def.baseUrl;
  if (!apiKey || !baseUrl) {
    throw new AiProviderError("not_configured", `${def.label} is not configured.`);
  }

  const model = options.model
    ?? (options.vision ? def.visionModel : def.defaultModel);
  const body = {
    model,
    messages: options.messages,
    max_tokens: options.maxTokens ?? 500
  };
  if (options.json) body.response_format = { type: "json_object" };
  if (options.openRouterProvider) body.provider = options.openRouterProvider;

  const headers = {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
    ...(def.extraHeaders?.() ?? {})
  };
  if (providerId === "microsoft") {
    headers["api-key"] = apiKey;
    delete headers.authorization;
  }

  const url = providerId === "microsoft"
    ? `${baseUrl}/chat/completions?api-version=${def.azureApiVersion}`
    : `${String(baseUrl).replace(/\/$/, "")}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(AI_FETCH_TIMEOUT_MS)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error?.message ?? `${def.label} API ${response.status}`;
    throw new AiProviderError("api_error", message);
  }

  return {
    model,
    content: payload.choices?.[0]?.message?.content ?? "",
    raw: payload
  };
}

async function cloudflareChat(options) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !token) {
    throw new AiProviderError("not_configured", "Cloudflare Workers AI is not configured.");
  }

  const model = options.model ?? PROVIDER_DEFS.cloudflare.defaultModel;
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "cf-aig-gateway-id": PROVIDER_DEFS.cloudflare.gatewayId
      },
      body: JSON.stringify({
        model,
        messages: options.messages,
        max_tokens: options.maxTokens ?? 500
      }),
      signal: AbortSignal.timeout(AI_FETCH_TIMEOUT_MS)
    }
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const message = payload.errors?.[0]?.message ?? `Cloudflare AI ${response.status}`;
    throw new AiProviderError("api_error", message);
  }

  const result = payload.result ?? payload;
  return {
    model,
    content: result.choices?.[0]?.message?.content ?? "",
    raw: payload
  };
}

async function azureChat(options) {
  return openAiCompatibleChat("microsoft", options);
}

function mergeEnrichmentHints(entries) {
  const hints = {};
  let bestConfidence = -1;
  for (const entry of entries) {
    const parsed = entry.hints;
    if (!parsed) continue;
    if (typeof parsed.profileHint === "string" && !hints.profileId) {
      hints.profileId = parsed.profileHint;
    }
    if (typeof parsed.layoutNote === "string") {
      hints.layoutNotes = parsed.layoutNote;
    }
    if (typeof parsed.confidence === "number" && parsed.confidence >= bestConfidence) {
      bestConfidence = parsed.confidence;
      hints.confidence = parsed.confidence;
    }
  }
  return Object.keys(hints).length ? hints : null;
}

function parseJsonHints(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      profileHint: typeof parsed.profileHint === "string" ? parsed.profileHint : null,
      layoutNote: typeof parsed.layoutNote === "string" ? parsed.layoutNote : null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : null
    };
  } catch {
    return null;
  }
}

function isNvidiaViaOpenRouter() {
  return isProviderConfigured("openrouter") && !isProviderConfigured("nvidia");
}

function detectAzureHosting() {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim() ?? "";
  const endpointLooksReal = endpoint.length > 0
    && !/YOUR_RESOURCE|example\.com|replace-me/i.test(endpoint);
  return Boolean(
    process.env.WEBSITE_SITE_NAME
    || process.env.CONTAINER_APP_NAME
    || (endpointLooksReal && isProviderConfigured("microsoft"))
  );
}

function detectSuseRuntime() {
  if (process.env.MORPH_SUSE_RUNTIME === "1") return true;
  try {
    const release = process.env.SUSE_VERSION ?? "";
    if (/opensuse|suse/i.test(release)) return true;
  } catch {
    // ignore
  }
  return process.env.MORPH_CONTAINER_BASE === "opensuse";
}

export class AiProviderError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
