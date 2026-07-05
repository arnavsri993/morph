import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { brandLink, LOGO_URL } from "./brand.js";

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
    if (pathname.startsWith("/assets/")) return true;
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
    if (user.provider === "github" && user.accessToken) {
      payload.githubToken = user.accessToken;
    }
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
        scope: "read:user user:email repo",
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
      provider: "github",
      accessToken: tokenPayload.access_token
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
    ? `<p class="error" role="alert">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        <span>${escapeHtml(error)}</span>
      </p>`
    : "";
  const hasProviders = Boolean(providers.google || providers.github);
  const buttons = [];

  if (providers.github) {
    buttons.push(`<a class="provider github" href="/auth/github?returnTo=${encodedReturnTo}" aria-label="Continue with GitHub">
        <span class="icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.72.5.1.68-.22.68-.49v-1.7c-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.9-.64.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05a9.4 9.4 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9v2.82c0 .27.18.6.69.49A10.26 10.26 0 0 0 22 12.25C22 6.58 17.52 2 12 2z"/></svg></span>
        <span>Continue with GitHub</span></a>`);
  }
  if (providers.google) {
    buttons.push(`<a class="provider google" href="/auth/google?returnTo=${encodedReturnTo}" aria-label="Continue with Google">
        <span class="icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.86c2.26-2.09 3.58-5.16 3.58-8.81z"/><path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.86-3c-1.07.72-2.44 1.14-4.08 1.14-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54V6.64H1.29a12 12 0 0 0 0 10.72l3.98-3.09z"/><path fill="#EA4335" d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.42-3.42A11.96 11.96 0 0 0 12 0 12 12 0 0 0 1.29 6.64l3.98 3.09C6.22 6.88 8.87 4.77 12 4.77z"/></svg></span>
        <span>Continue with Google</span></a>`);
  }

  const providerSection = hasProviders
    ? `<div class="providers" role="group" aria-label="Sign-in providers">${buttons.join("\n      ")}</div>
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
    <a class="provider continue" href="${safeReturnTo}" aria-label="Continue to Studio without signing in">
      <span>Continue to Studio</span>
      <span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></a>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Log in · morph</title>
  <meta name="theme-color" content="#050507">
  <meta name="description" content="Sign in to Morph Studio — review agent UI, run repair loops, and store merge gate receipts.">
  <link rel="icon" href="${LOGO_URL}" type="image/png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      color-scheme: dark;
      --bg: #050507;
      --bg-elevated: #0c0c0f;
      --ink: #fafafa;
      --muted: #a1a1aa;
      --faint: #71717a;
      --line: rgba(255, 255, 255, 0.07);
      --line-strong: rgba(255, 255, 255, 0.13);
      --surface: rgba(12, 12, 15, 0.78);
      --surface-hover: rgba(255, 255, 255, 0.05);
      --brand-a: #818cf8;
      --brand-b: #a78bfa;
      --brand-c: #6366f1;
      --cyan: #22d3ee;
      --ok: #4ade80;
      --bad: #f87171;
      --mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      --radius: 28px;
      --radius-sm: 14px;
      --shadow-xl: 0 48px 120px -48px rgba(0, 0, 0, 0.92), 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
      --ease: cubic-bezier(0.22, 1, 0.36, 1);
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      min-height: 100vh;
      min-height: 100dvh;
      display: grid;
      place-items: center;
      background: var(--bg);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 16px;
      line-height: 1.65;
      padding: clamp(20px, 5vw, 48px);
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }
    :focus-visible {
      outline: 2px solid var(--cyan);
      outline-offset: 3px;
    }
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: -1;
      overflow: hidden;
      pointer-events: none;
      background:
        radial-gradient(ellipse 80% 50% at 50% 100%, rgba(99, 102, 241, 0.08), transparent 70%),
        var(--bg);
    }
    .aurora {
      position: absolute;
      width: 160%;
      height: 160%;
      left: -30%;
      top: -40%;
      background:
        radial-gradient(ellipse 42% 38% at 18% 22%, rgba(129, 140, 248, 0.22), transparent 68%),
        radial-gradient(ellipse 36% 32% at 82% 12%, rgba(167, 139, 250, 0.18), transparent 68%),
        radial-gradient(ellipse 28% 24% at 55% 68%, rgba(34, 211, 238, 0.08), transparent 72%);
      animation: aurora-drift 28s var(--ease) infinite alternate;
      will-change: transform;
    }
    .aurora-2 {
      position: absolute;
      inset: -20%;
      background: radial-gradient(ellipse 50% 40% at 70% 80%, rgba(99, 102, 241, 0.1), transparent 65%);
      animation: aurora-drift-2 32s var(--ease) infinite alternate-reverse;
      opacity: 0.7;
    }
    @keyframes aurora-drift { to { transform: translate3d(3%, 4%, 0) scale(1.05) rotate(1deg); } }
    @keyframes aurora-drift-2 { to { transform: translate3d(-2%, -3%, 0) scale(1.03); } }
    .grid-bg {
      position: absolute;
      inset: 0;
      background-image: radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px);
      background-size: 28px 28px;
      mask-image: radial-gradient(ellipse 90% 70% at 50% 40%, black 20%, transparent 80%);
      opacity: 0.45;
    }
    .vignette {
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, rgba(5, 5, 7, 0.55) 100%);
    }
    .card-wrap {
      width: min(460px, 100%);
      position: relative;
    }
    .card-wrap::before {
      content: "";
      position: absolute;
      inset: -1px;
      border-radius: calc(var(--radius) + 1px);
      background: linear-gradient(145deg, rgba(129, 140, 248, 0.35), rgba(34, 211, 238, 0.12) 40%, rgba(255, 255, 255, 0.06) 60%, rgba(167, 139, 250, 0.2));
      opacity: 0.55;
      z-index: 0;
      pointer-events: none;
    }
    .card {
      position: relative;
      overflow: hidden;
      width: 100%;
      background: var(--surface);
      -webkit-backdrop-filter: blur(28px) saturate(1.4);
      backdrop-filter: blur(28px) saturate(1.4);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: clamp(28px, 6vw, 44px);
      box-shadow: var(--shadow-xl);
      z-index: 1;
    }
    .card::before {
      content: "";
      position: absolute;
      inset: 0;
      background: radial-gradient(520px circle at var(--spot-x, 50%) var(--spot-y, 0%), rgba(129, 140, 248, 0.12), transparent 52%);
      pointer-events: none;
      transition: opacity 0.3s var(--ease);
    }
    .card::after {
      content: "";
      position: absolute;
      top: 0;
      left: 12%;
      right: 12%;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.22), transparent);
      pointer-events: none;
    }
    .card > * { position: relative; z-index: 1; }
    .brand {
      display: inline-flex;
      align-items: center;
      margin-bottom: clamp(24px, 5vw, 36px);
      color: inherit;
      text-decoration: none;
      width: fit-content;
      transition: opacity 0.2s var(--ease);
    }
    .brand:hover { opacity: 0.88; }
    .brand:focus-visible { border-radius: 12px; }
    .logo {
      display: block;
      height: 32px;
      width: auto;
    }
    .card-head { margin-bottom: clamp(24px, 4vw, 32px); }
    h1 {
      margin: 0 0 10px;
      font-size: clamp(28px, 5.5vw, 34px);
      line-height: 1.08;
      letter-spacing: -0.035em;
      font-weight: 600;
      background: linear-gradient(120deg, #fafafa 0%, #d4d4d8 42%, #a5b4fc 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .sub {
      margin: 0;
      color: var(--muted);
      line-height: 1.72;
      font-size: clamp(14px, 2.5vw, 15px);
      max-width: 38ch;
    }
    .providers {
      display: grid;
      gap: 10px;
    }
    .provider {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 11px;
      min-height: 50px;
      padding: 0 20px;
      border-radius: 999px;
      border: 1px solid var(--line-strong);
      background: rgba(255, 255, 255, 0.035);
      color: var(--ink);
      text-decoration: none;
      font-weight: 500;
      font-size: 15px;
      letter-spacing: -0.01em;
      transition:
        border-color 0.22s var(--ease),
        background 0.22s var(--ease),
        transform 0.22s var(--ease),
        box-shadow 0.22s var(--ease);
    }
    .provider .icon {
      display: grid;
      place-items: center;
      width: 22px;
      height: 22px;
      flex: none;
    }
    .provider:hover {
      border-color: rgba(255, 255, 255, 0.24);
      background: var(--surface-hover);
      transform: translateY(-1px);
      box-shadow: 0 8px 24px -12px rgba(0, 0, 0, 0.5);
    }
    .provider:active { transform: translateY(0); }
    .provider.github {
      background: rgba(255, 255, 255, 0.05);
    }
    .provider.github:hover {
      border-color: rgba(255, 255, 255, 0.28);
      box-shadow: 0 8px 28px -10px rgba(129, 140, 248, 0.25);
    }
    .provider.google {
      background: #f4f4f5;
      border-color: rgba(255, 255, 255, 0.9);
      color: #18181b;
    }
    .provider.google:hover {
      background: #fff;
      border-color: #fff;
      box-shadow: 0 8px 28px -10px rgba(0, 0, 0, 0.35);
    }
    .provider.continue {
      color: #fff;
      background: linear-gradient(135deg, var(--brand-c) 0%, var(--brand-a) 45%, var(--brand-b) 100%);
      border: 0;
      box-shadow:
        0 0 0 1px rgba(255, 255, 255, 0.1) inset,
        0 0 48px -10px rgba(129, 140, 248, 0.8);
      margin-top: 18px;
      position: relative;
      overflow: hidden;
    }
    .provider.continue::before {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(105deg, transparent 40%, rgba(255, 255, 255, 0.14) 50%, transparent 60%);
      transform: translateX(-120%);
      transition: transform 0.55s var(--ease);
    }
    .provider.continue:hover {
      box-shadow:
        0 0 0 1px rgba(255, 255, 255, 0.14) inset,
        0 0 64px -8px rgba(129, 140, 248, 0.95);
      transform: translateY(-2px);
    }
    .provider.continue:hover::before { transform: translateX(120%); }
    .error {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin: 0 0 20px;
      padding: 14px 16px;
      border-radius: var(--radius-sm);
      background: rgba(248, 113, 113, 0.07);
      border: 1px solid rgba(248, 113, 113, 0.22);
      color: #fca5a5;
      font-size: 14px;
      line-height: 1.55;
    }
    .error svg { flex: none; margin-top: 1px; opacity: 0.9; }
    .setup {
      border: 1px solid var(--line);
      border-radius: var(--radius-sm);
      background: rgba(255, 255, 255, 0.02);
      padding: clamp(16px, 3vw, 22px);
      margin-bottom: 6px;
    }
    .setup-head {
      display: flex;
      align-items: center;
      gap: 9px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: var(--ok);
      margin-bottom: 12px;
    }
    .setup-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--ok);
      box-shadow: 0 0 14px rgba(74, 222, 128, 0.65);
      animation: pulse-dot 2.4s ease-in-out infinite;
      flex: none;
    }
    @keyframes pulse-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.65; transform: scale(0.92); }
    }
    .setup-copy {
      margin: 0 0 14px;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.68;
    }
    .setup-copy code {
      font-family: var(--mono);
      font-size: 12.5px;
      color: var(--cyan);
      background: rgba(34, 211, 238, 0.06);
      padding: 2px 6px;
      border-radius: 6px;
    }
    .setup-env {
      margin: 0;
      font-family: var(--mono);
      font-size: 11.5px;
      line-height: 1.7;
      color: #a1a1aa;
      background: rgba(0, 0, 0, 0.28);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 14px 16px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .footnote {
      margin: 18px 0 0;
      font-size: 13px;
      color: var(--faint);
      line-height: 1.55;
      text-align: center;
    }
    .footnote code {
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
      background: rgba(255, 255, 255, 0.04);
      padding: 2px 7px;
      border-radius: 6px;
    }
    .back {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      margin-top: clamp(20px, 4vw, 28px);
      color: var(--faint);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition: color 0.2s var(--ease), gap 0.2s var(--ease);
    }
    .back:hover { color: var(--ink); gap: 9px; }
    .back svg { opacity: 0.7; transition: transform 0.2s var(--ease); }
    .back:hover svg { transform: translateX(-2px); opacity: 1; }
    @media (min-width: 768px) {
      .card-wrap { width: min(480px, 100%); }
    }
    @media (min-width: 1280px) {
      .card { padding: 44px 48px; }
    }
    @media (max-width: 374px) {
      body { padding: 16px; }
      .provider { min-height: 48px; font-size: 14px; padding: 0 16px; }
      .setup-env { font-size: 10.5px; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation: none !important;
        transition-duration: 0.01ms !important;
      }
      .provider.continue::before { display: none; }
    }
  </style>
</head>
<body>
  <div class="backdrop" aria-hidden="true">
    <div class="aurora"></div>
    <div class="aurora-2"></div>
    <div class="grid-bg"></div>
    <div class="vignette"></div>
  </div>
  <div class="card-wrap">
    <main class="card" id="loginCard" aria-labelledby="loginTitle">
      ${brandLink("/", { height: 32 })}
      <header class="card-head">
        <h1 id="loginTitle">Welcome back</h1>
        <p class="sub">Sign in to open Studio — review agent UI, run repair loops, and store merge gate receipts.</p>
      </header>
      ${errorBlock}
      ${providerSection}
      <a class="back" href="/">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Back to home
      </a>
    </main>
  </div>
  <script>
    const card = document.getElementById("loginCard");
    if (card && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
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
