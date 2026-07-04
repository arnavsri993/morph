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
      clientId: process.env.GOOGLE_CLIENT_ID?.trim() || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || ""
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
    const explicit = config.auth?.mode ?? process.env.MORPH_AUTH_MODE ?? "dev";
    if (explicit === "oauth") return "oauth";
    if (explicit === "dev" && (isGoogleConfigured() || isGithubConfigured())) return "oauth";
    return explicit;
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
  const safeReturnTo = escapeHtml(returnTo || "/");
  const errorBlock = error
    ? `<p class="error">${escapeHtml(error)}</p>`
    : "";
  const buttons = [];

  if (providers.google) {
    buttons.push(`<a class="provider google" href="/auth/google?returnTo=${encodeURIComponent(returnTo || "/")}">Continue with Google</a>`);
  }
  if (providers.github) {
    buttons.push(`<a class="provider github" href="/auth/github?returnTo=${encodeURIComponent(returnTo || "/")}">Continue with GitHub</a>`);
  }
  if (!buttons.length) {
    buttons.push(`<p class="error">No SSO providers are configured. Add Google or GitHub OAuth credentials to <code>.env</code>.</p>`);
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sign in · Morph Studio</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f5f7fb;
      --ink: #101828;
      --muted: #667085;
      --line: #d0d8e6;
      --surface: #ffffff;
      --accent: #1f5eff;
      --bad: #b42318;
      --shadow: 0 16px 40px rgba(16, 24, 40, 0.10);
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
      padding: 24px;
    }
    .card {
      width: min(420px, 100%);
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 28px;
      box-shadow: var(--shadow);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
      margin-bottom: 18px;
    }
    .mark {
      width: 30px;
      height: 30px;
      border-radius: 7px;
      background: var(--ink);
      color: white;
      display: grid;
      place-items: center;
      font-size: 14px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 28px;
      line-height: 1.1;
    }
    p {
      margin: 0 0 18px;
      color: var(--muted);
      line-height: 1.5;
    }
    .providers {
      display: grid;
      gap: 10px;
    }
    .provider {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      border-radius: 8px;
      border: 1px solid var(--line);
      background: #fff;
      color: var(--ink);
      text-decoration: none;
      font-weight: 650;
    }
    .provider:hover { border-color: #98a9c8; }
    .provider.google { background: #fff; }
    .provider.github { background: #24292f; border-color: #24292f; color: #fff; }
    .error {
      margin: 0 0 14px;
      padding: 10px 12px;
      border-radius: 8px;
      background: #fef3f2;
      border: 1px solid #fecdca;
      color: var(--bad);
      font-size: 14px;
    }
    .footnote {
      margin-top: 16px;
      font-size: 12px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand"><span class="mark">M</span><span>Morph Studio</span></div>
    <h1>Sign in</h1>
    <p>Use your workspace SSO provider to access the Morph review control plane.</p>
    ${errorBlock}
    <div class="providers">
      ${buttons.join("\n      ")}
    </div>
    <p class="footnote">After sign-in you will return to <code>${safeReturnTo}</code>.</p>
  </div>
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
