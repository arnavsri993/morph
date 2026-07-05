// Cloudflare Worker — edge cache + Workers AI fallback for morph transform previews.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        product: "morph-transform-cache",
        cloudflare: {
          workersAi: Boolean(env.AI),
          kv: Boolean(env.TRANSFORM_CACHE)
        }
      });
    }

    if (url.pathname === "/api/cloudflare/design-hint" && request.method === "POST") {
      if (!env.AI) {
        return Response.json({ error: "workers_ai_unavailable" }, { status: 503 });
      }
      const body = await request.json().catch(() => ({}));
      const summary = String(body.summary ?? "agent-generated landing page");
      const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          {
            role: "user",
            content: `Suggest a design profile id (aurora-dark, halcyon-blue, monolith-mono) for: ${summary}. Reply JSON only: {"profileHint":"...","layoutNote":"..."}`
          }
        ]
      });
      return Response.json({ provider: "cloudflare", result });
    }

    const cacheKey = url.pathname.replace(/^\/+/, "") || "index.html";
    if (env.TRANSFORM_CACHE) {
      const cached = await env.TRANSFORM_CACHE.get(cacheKey);
      if (cached) {
        return new Response(cached, {
          headers: { "content-type": contentTypeFor(cacheKey), "x-morph-cache": "hit" }
        });
      }
    }

    const origin = (env.MORPH_ORIGIN ?? "").replace(/\/$/, "");
    if (!origin) {
      return Response.json({ error: "origin_not_configured" }, { status: 502 });
    }

    const upstream = await fetch(`${origin}/transformed/${cacheKey}`);
    const text = await upstream.text();
    if (upstream.ok && env.TRANSFORM_CACHE) {
      await env.TRANSFORM_CACHE.put(cacheKey, text, { expirationTtl: 3600 });
    }
    return new Response(text, {
      status: upstream.status,
      headers: {
        "content-type": contentTypeFor(cacheKey),
        "x-morph-cache": upstream.ok ? "miss" : "bypass"
      }
    });
  }
};

function contentTypeFor(pathname) {
  if (pathname.endsWith(".css")) return "text/css; charset=utf-8";
  if (pathname.endsWith(".png")) return "image/png";
  return "text/html; charset=utf-8";
}
