import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function loadEnvFile(cwd = process.cwd()) {
  try {
    const content = await readFile(path.join(cwd, ".env"), "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // Optional local env file.
  }
}

export function createAuthManager(config, runtimeAuth) {
  const cookieName = config.auth?.sessionCookieName ?? "morph_session";
  const secret = process.env.AUTH_SECRET?.trim() || "morph-dev-auth-secret";
  const pendingOAuth = new Map();

  function getGoogleCredentials() {
    return {
      clientId: runtimeAuth.googleClientId || process.env.GOOGLE_CLIENT_ID?.trim() || "",
      clientSecret: runtimeAuth.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET?.trim() || ""
    };
  }

  function getGithubCredentials() {
    return {
      clientId: runtimeAuth.githubClientId || process.env.GITHUB_CLIENT_ID?.trim() || "",
      clientSecret: runtimeAuth.githubClientSecret || process.env.GITHUB_CLIENT_SECRET?.trim() || ""
    };
  }

  function isGoogleConfigured() {
    const { clientId, clientSecret } = getGoogleCredentials();
    return Boolean(clientId && clientSecret);
  }

  function isGithubConfigured() {
    const { clientId, clientSecret } = getGithubCredentials();
    return Boolean(clientId && clientSecret);
  }

  function getAuthMode() {
    return config.auth?.mode ?? process.env.MORPH_AUTH_MODE ?? "dev";
  }

  function isAuthRequired() {
    return getAuthMode() === "oauth";
  }

  function getProviders() {
    return {
      google: isGoogleConfigured(),
      github: isGithubConfigured()
    };
  }

  function isPublicRoute(pathname, method) {
    if (pathname === "/") return true;
    if (pathname === "/login") return true;
    if (pathname.startsWith("/auth/")) return true;
    if (pathname === "/api/health") return true;
    if (pathname === "/api/auth/providers" && method === "GET") return true;
    return false;
  }

  function prunePendingOAuth() {
    const now = Date.now();
    for (const [state, entry] of pendingOAuth.entries()) {
      if (entry.expiresAt <= now) pendingOAuth.delete(state);
    }
  }

  function createOAuthState(provider, returnTo) {
    prunePendingOAuth();
    const state = randomBytes(24).toString("hex");
    pendingOAuth.set(state, {
      provider,
      returnTo: sanitizeReturnTo(returnTo),
      expiresAt: Date.now() + OAUTH_STATE_TTL_MS
    });
    return state;
  }

  function consumeOAuthState(state) {
    prunePendingOAuth();
    const entry = pendingOAuth.get(state);
    if (!entry) return null;
    pendingOAuth.delete(state);
    if (entry.expiresAt <= Date.now()) return null;
    return entry;
  }

  function signSession(payload) {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", secret).update(body).digest("base64url");
    return `${body}.${signature}`;
  }

  function verifySessionToken(token) {
    if (!token) return null;
    const [body, signature] = token.split(".");
    if (!body || !signature) return null;
    const expected = createHmac("sha256", secret).update(body).digest("base64url");
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (sigBuffer.length !== expectedBuffer.length) return null;
    if (!timingSafeEqual(sigBuffer, expectedBuffer)) return null;
    try {
      const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
      if (payload.exp && Date.now() > payload.exp) return null;
      return payload;
    } catch {
      return null;
    }
  }

  function readCookie(request, name) {
    const header = request.headers.cookie ?? "";
    for (const part of header.split(";")) {
      const [rawKey, ...rawValue] = part.trim().split("=");
      if (rawKey === name) return decodeURIComponent(rawValue.join("="));
    }
    return null;
  }

  function getSession(request) {
    return verifySessionToken(readCookie(request, cookieName));
  }

  function buildSessionCookie(token) {
    const secure = process.env.MORPH_APP_URL?.startsWith("https://") ? "; Secure" : "";
    return `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`;
  }

  function clearSessionCookie() {
    const secure = process.env.MORPH_APP_URL?.startsWith("https://") ? "; Secure" : "";
    return `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
  }

  function setSession(response, user) {
    const now = Date.now();
    const payload = {
      sub: `${user.provider}:${user.id}`,
      email: user.email,
      name: user.name,
      picture: user.picture ?? null,
      provider: user.provider,
      iat: now,
      exp: now + SESSION_TTL_MS
    };
    const token = signSession(payload);
    response.setHeader("set-cookie", buildSessionCookie(token));
    return payload;
  }

  function clearSession(response) {
    response.setHeader("set-cookie", clearSessionCookie());
  }

  function getAppUrl(request, host, port) {
    const configured = process.env.MORPH_APP_URL?.trim();
    if (configured) return configured.replace(/\/$/, "");
    const requestHost = request.headers.host?.trim();
    if (requestHost) return `http://${requestHost}`;
    return `http://${host}:${port}`;
  }

  function startOAuth(provider, returnTo, appUrl) {
    const state = createOAuthState(provider, returnTo);
    if (provider === "google") {
      const { clientId } = getGoogleCredentials();
      if (!clientId) throw new AuthError(503, "google_not_configured", "Google OAuth is not configured.");
      const redirectUri = `${appUrl}/auth/google/callback`;
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state,
        access_type: "online",
        prompt: "select_account"
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    }

    if (provider === "github") {
      const { clientId } = getGithubCredentials();
      if (!clientId) throw new AuthError(503, "github_not_configured", "GitHub OAuth is not configured.");
      const redirectUri = `${appUrl}/auth/github/callback`;
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "read:user user:email",
        state
      });
      return `https://github.com/login/oauth/authorize?${params}`;
    }

    throw new AuthError(400, "unknown_provider", "Unsupported OAuth provider.");
  }

  async function handleOAuthCallback(provider, url, appUrl) {
    const error = url.searchParams.get("error");
    if (error) {
      throw new AuthError(401, "oauth_denied", url.searchParams.get("error_description") || "Sign-in was cancelled.");
    }

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) {
      throw new AuthError(400, "invalid_oauth_callback", "Missing OAuth code or state.");
    }

    const pending = consumeOAuthState(state);
    if (!pending || pending.provider !== provider) {
      throw new AuthError(400, "invalid_oauth_state", "OAuth state expired or is invalid.");
    }

    const user = provider === "google"
      ? await exchangeGoogleCode(code, appUrl)
      : await exchangeGithubCode(code, appUrl);

    return { user, returnTo: pending.returnTo };
  }

  async function exchangeGoogleCode(code, appUrl) {
    const { clientId, clientSecret } = getGoogleCredentials();
    const redirectUri = `${appUrl}/auth/google/callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });
    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new AuthError(502, "google_token_error", tokenPayload.error_description || "Google token exchange failed.");
    }

    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { authorization: `Bearer ${tokenPayload.access_token}` }
    });
    const profile = await profileResponse.json();
    if (!profileResponse.ok) {
      throw new AuthError(502, "google_profile_error", "Could not load Google profile.");
    }

    return {
      id: String(profile.sub),
      email: profile.email,
      name: profile.name || profile.email,
      picture: profile.picture ?? null,
      provider: "google"
    };
  }

  async function exchangeGithubCode(code, appUrl) {
    const { clientId, clientSecret } = getGithubCredentials();
    const redirectUri = `${appUrl}/auth/github/callback`;
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri
      })
    });
    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok || tokenPayload.error) {
      throw new AuthError(502, "github_token_error", tokenPayload.error_description || tokenPayload.error || "GitHub token exchange failed.");
    }

    const profileResponse = await fetch("https://api.github.com/user", {
      headers: {
        authorization: `Bearer ${tokenPayload.access_token}`,
        "user-agent": "Morph-Studio",
        accept: "application/json"
      }
    });
    const profile = await profileResponse.json();
    if (!profileResponse.ok) {
      throw new AuthError(502, "github_profile_error", "Could not load GitHub profile.");
    }

    let email = profile.email;
    if (!email) {
      const emailResponse = await fetch("https://api.github.com/user/emails", {
        headers: {
          authorization: `Bearer ${tokenPayload.access_token}`,
          "user-agent": "Morph-Studio",
          accept: "application/json"
        }
      });
      const emails = await emailResponse.json();
      if (emailResponse.ok && Array.isArray(emails)) {
        const primary = emails.find((entry) => entry.primary && entry.verified);
        email = primary?.email || emails.find((entry) => entry.verified)?.email || null;
      }
    }

    return {
      id: String(profile.id),
      email: email || `${profile.login}@users.noreply.github.com`,
      name: profile.name || profile.login,
      picture: profile.avatar_url ?? null,
      provider: "github"
    };
  }

  return {
    cookieName,
    getAuthMode,
    isAuthRequired,
    getProviders,
    isPublicRoute,
    getSession,
    setSession,
    clearSession,
    getAppUrl,
    startOAuth,
    handleOAuthCallback,
    isGoogleConfigured,
    isGithubConfigured,
    loginHtml
  };
}

export class AuthError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function sanitizeReturnTo(value) {
  const returnTo = String(value ?? "/").trim();
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) return "/";
  return returnTo;
}

function loginHtml({ error, providers, returnTo }) {
  const target = !returnTo || returnTo === "/" ? "/studio" : returnTo;
  const safeReturnTo = escapeHtml(target);
  const encodedReturnTo = encodeURIComponent(target);
  const errorBlock = error
    ? `<p class="error" role="alert">${escapeHtml(error)}</p>`
    : "";
  const hasProviders = Boolean(providers.google || providers.github);
  const buttons = [];

  if (providers.github) {
    buttons.push(`<a class="provider github" href="/auth/github?returnTo=${encodedReturnTo}">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.72.5.1.68-.22.68-.49v-1.7c-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.9-.64.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05a9.4 9.4 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9v2.82c0 .27.18.6.69.49A10.26 10.26 0 0 0 22 12.25C22 6.58 17.52 2 12 2z"/></svg>
        Continue with GitHub</a>`);
  }
  if (providers.google) {
    buttons.push(`<a class="provider google" href="/auth/google?returnTo=${encodedReturnTo}">
        <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.86c2.26-2.09 3.58-5.16 3.58-8.81z"/><path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.86-3c-1.07.72-2.44 1.14-4.08 1.14-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54V6.64H1.29a12 12 0 0 0 0 10.72l3.98-3.09z"/><path fill="#EA4335" d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.42-3.42A11.96 11.96 0 0 0 12 0 12 12 0 0 0 1.29 6.64l3.98 3.09C6.22 6.88 8.87 4.77 12 4.77z"/></svg>
        Continue with Google</a>`);
  }

  const providerSection = hasProviders
    ? `<div class="providers">${buttons.join("\n      ")}</div>
    <p class="footnote">After sign-in you will return to <code>${safeReturnTo}</code>.</p>`
    : `<div class="setup">
      <div class="setup-head"><span class="setup-dot"></span> Auth-ready · running in dev mode</div>
      <p class="setup-copy">SSO is wired but no OAuth provider is configured yet, so Studio is open locally. To enable sign-in, add credentials to <code>.env</code>:</p>
      <pre class="setup-env">GITHUB_CLIENT_ID=…
GITHUB_CLIENT_SECRET=…
GOOGLE_CLIENT_ID=…
GOOGLE_CLIENT_SECRET=…
MORPH_AUTH_MODE=oauth</pre>
    </div>
    <a class="provider continue" href="${safeReturnTo}">Continue to Studio
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Log in · morph</title>
  <meta name="theme-color" content="#09090b">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      color-scheme: dark;
      --bg: #09090b;
      --ink: #fafafa;
      --muted: #a1a1aa;
      --faint: #71717a;
      --line: rgba(255, 255, 255, 0.08);
      --line-strong: rgba(255, 255, 255, 0.14);
      --surface: rgba(24, 24, 27, 0.65);
      --brand-a: #818cf8;
      --brand-b: #a78bfa;
      --cyan: #22d3ee;
      --ok: #4ade80;
      --bad: #f87171;
      --mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      --radius: 24px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: var(--bg);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 16px;
      line-height: 1.7;
      padding: 32px;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
    }
    :focus-visible { outline: 2px solid var(--cyan); outline-offset: 3px; border-radius: 8px; }
    .backdrop { position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; }
    .aurora {
      position: absolute;
      width: 140%;
      height: 140%;
      left: -20%;
      top: -30%;
      background:
        radial-gradient(ellipse 40% 35% at 20% 20%, rgba(129, 140, 248, 0.2), transparent 70%),
        radial-gradient(ellipse 35% 30% at 80% 10%, rgba(167, 139, 250, 0.16), transparent 70%);
      animation: aurora-drift 24s ease-in-out infinite alternate;
    }
    @keyframes aurora-drift { to { transform: translate3d(2%, 3%, 0) scale(1.04); } }
    .grid-bg {
      position: absolute; inset: 0;
      background-image: radial-gradient(rgba(255, 255, 255, 0.09) 1px, transparent 1px);
      background-size: 32px 32px;
      opacity: 0.35;
    }
    .card {
      position: relative;
      overflow: hidden;
      width: min(440px, 100%);
      background: var(--surface);
      -webkit-backdrop-filter: blur(20px) saturate(1.3);
      backdrop-filter: blur(20px) saturate(1.3);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 40px;
      box-shadow: 0 40px 100px -40px rgba(0, 0, 0, 0.8);
    }
    .card::before {
      content: "";
      position: absolute;
      inset: 0;
      background: radial-gradient(500px circle at var(--spot-x, 50%) var(--spot-y, 0%), rgba(129, 140, 248, 0.1), transparent 50%);
      pointer-events: none;
    }
    .card > * { position: relative; z-index: 1; }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 600;
      margin-bottom: 32px;
      color: inherit;
      text-decoration: none;
      width: fit-content;
      font-size: 15px;
    }
    .mark {
      width: 32px; height: 32px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      font-size: 14px;
      font-weight: 700;
      color: #fff;
      background: linear-gradient(135deg, var(--brand-a), var(--brand-b));
      box-shadow: 0 0 24px -4px rgba(129, 140, 248, 0.6);
    }
    h1 {
      margin: 0 0 12px;
      font-size: 32px;
      line-height: 1.1;
      letter-spacing: -0.03em;
      font-weight: 600;
      background: linear-gradient(to right, #fafafa, #a1a1aa 50%, #818cf8);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .sub { margin: 0 0 32px; color: var(--muted); line-height: 1.75; font-size: 15px; }
    .providers { display: grid; gap: 12px; }
    .provider {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      min-height: 52px;
      border-radius: 999px;
      border: 1px solid var(--line-strong);
      background: rgba(255, 255, 255, 0.04);
      color: var(--ink);
      text-decoration: none;
      font-weight: 500;
      font-size: 15px;
      transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
    }
    .provider:hover { border-color: rgba(255, 255, 255, 0.22); background: rgba(255, 255, 255, 0.07); transform: translateY(-2px); }
    .provider.github { background: rgba(255, 255, 255, 0.06); }
    .provider.google { background: #fafafa; border-color: #fafafa; color: #18181b; }
    .provider.google:hover { background: #fff; }
    .provider.continue {
      color: #fff;
      background: linear-gradient(135deg, var(--brand-a), var(--brand-b));
      border: 0;
      box-shadow: 0 0 40px -8px rgba(129, 140, 248, 0.7);
      margin-top: 20px;
    }
    .provider.continue:hover { box-shadow: 0 0 56px -8px rgba(129, 140, 248, 0.85); }
    .error {
      margin: 0 0 20px;
      padding: 14px 16px;
      border-radius: 12px;
      background: rgba(248, 113, 113, 0.08);
      border: 1px solid rgba(248, 113, 113, 0.25);
      color: var(--bad);
      font-size: 14px;
      line-height: 1.6;
    }
    .setup {
      border: 1px solid var(--line);
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.02);
      padding: 20px;
      margin-bottom: 8px;
    }
    .setup-head {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 500;
      color: var(--ok);
      margin-bottom: 10px;
    }
    .setup-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: var(--ok);
      box-shadow: 0 0 12px rgba(74, 222, 128, 0.6);
    }
    .setup-copy { margin: 0 0 14px; color: var(--muted); font-size: 14px; line-height: 1.7; }
    .setup-copy code { font-family: var(--mono); font-size: 13px; color: var(--cyan); }
    .setup-env {
      margin: 0;
      font-family: var(--mono);
      font-size: 12px;
      line-height: 1.75;
      color: var(--muted);
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 14px 16px;
      overflow-x: auto;
    }
    .footnote { margin: 20px 0 0; font-size: 14px; color: var(--faint); line-height: 1.6; }
    .footnote code { font-family: var(--mono); font-size: 13px; }
    .back {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: 28px;
      color: var(--faint);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition: color 0.2s ease;
    }
    .back:hover { color: var(--ink); }
    @media (prefers-reduced-motion: reduce) {
      * { animation: none !important; transition-duration: 0.01ms !important; }
    }
  </style>
</head>
<body>
  <div class="backdrop" aria-hidden="true">
    <div class="aurora"></div>
    <div class="grid-bg"></div>
  </div>
  <main class="card" id="loginCard">
    <a class="brand" href="/"><span class="mark">m</span><span>morph</span></a>
    <h1>Welcome back</h1>
    <p class="sub">Sign in to open Studio — review agent UI, run repair loops, and store merge gate receipts.</p>
    ${errorBlock}
    ${providerSection}
    <a class="back" href="/">← Back to home</a>
  </main>
  <script>
    const card = document.getElementById("loginCard");
    if (card) {
      card.addEventListener("mousemove", (e) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--spot-x", ((e.clientX - rect.left) / rect.width * 100) + "%");
        card.style.setProperty("--spot-y", ((e.clientY - rect.top) / rect.height * 100) + "%");
      });
    }
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
