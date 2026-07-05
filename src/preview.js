import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function parsePreviewUrl(url) {
  const target = String(url ?? "").trim();
  if (!target) return null;

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    throw new Error("Preview URL must be a valid http, https, or file URL.");
  }
  if (!["http:", "https:", "file:"].includes(parsed.protocol)) {
    throw new Error("Preview URL must use http, https, or file.");
  }
  return parsed;
}

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export function assessCaptureQuality(html) {
  const source = String(html ?? "");
  const linkCount = (source.match(/<a\b/gi) ?? []).length;
  const paragraphCount = (source.match(/<p\b/gi) ?? []).length;
  const headingCount = (source.match(/<h[1-6]\b/gi) ?? []).length;
  const captchaSignals = [
    /opfcaptcha/i,
    /captcha\.amazon/i,
    /type=["']hidden["'][^>]*name=["']amzn/i,
    /automated access to amazon/i
  ];
  const looksLikeBotWall = captchaSignals.some((pattern) => pattern.test(source))
    || (/continue shopping/i.test(source) && linkCount < 10 && headingCount <= 2 && paragraphCount < 3);

  if (looksLikeBotWall) {
    return {
      ok: false,
      reason: "The site returned a bot-check page instead of real content. Try again or use a GitHub repo input."
    };
  }

  if (linkCount < 3 && headingCount < 2 && paragraphCount < 2 && source.length < 8000) {
    return {
      ok: false,
      reason: "The captured page looks empty — the site may have blocked automated access."
    };
  }

  return { ok: true };
}

function visibleTextLength(html) {
  return String(html ?? "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .length;
}

function metaDescription(html) {
  const source = String(html ?? "");
  return source.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1]?.trim()
    || source.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i)?.[1]?.trim()
    || "";
}

// Stricter than assessCaptureQuality — rejects pages morph can't meaningfully scan.
export function assessScanReadiness(html) {
  const captureQuality = assessCaptureQuality(html);
  if (!captureQuality.ok) return captureQuality;

  const source = String(html ?? "");
  const textLength = visibleTextLength(source);
  const description = metaDescription(source);
  const headingCount = (source.match(/<h[1-6]\b/gi) ?? []).length;
  const paragraphCount = (source.match(/<p\b/gi) ?? []).length;

  if (textLength < 120 && !description) {
    return {
      ok: false,
      reason: "We couldn't read enough content from this site. It may require login, block automated access, or load entirely in JavaScript. Try a GitHub repo instead."
    };
  }

  if (headingCount === 0 && paragraphCount === 0 && textLength < 400 && !description) {
    return {
      ok: false,
      reason: "This page has no readable text for morph to scan. Try a GitHub repo or a different URL."
    };
  }

  if (source.length > 50_000 && textLength < 250 && headingCount <= 1) {
    return {
      ok: false,
      reason: "This site didn't render readable content for us. It's likely JavaScript-only and blocked our scanner. Try a GitHub repo instead."
    };
  }

  return { ok: true };
}

async function createBrowserContext(chromium) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"]
  });
  const context = await browser.newContext({
    userAgent: BROWSER_USER_AGENT,
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    timezoneId: "America/New_York",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
    }
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  return { browser, context };
}

async function captureWithPlaywright(parsed, options = {}) {
  const { chromium } = await import("playwright");
  const { browser, context } = await createBrowserContext(chromium);
  try {
    const page = await context.newPage();
    await page.goto(parsed.href, {
      waitUntil: options.waitUntil ?? "domcontentloaded",
      timeout: options.timeout ?? 45_000
    });
    const title = await page.title();
    const html = await page.content();
    const quality = assessCaptureQuality(html);
    if (!quality.ok) {
      const error = new Error(quality.reason);
      error.code = "bot_wall";
      throw error;
    }
    const scanReady = assessScanReadiness(html);
    if (!scanReady.ok) {
      const error = new Error(scanReady.reason);
      error.code = "site_unreadable";
      throw error;
    }
    const css = await page.evaluate(async () => {
      const chunks = [];
      for (const style of document.querySelectorAll("style")) {
        if (style.textContent?.trim()) chunks.push(style.textContent);
      }
      for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
        try {
          const response = await fetch(link.href);
          if (response.ok) chunks.push(await response.text());
        } catch {
          // unreadable remote stylesheet
        }
      }
      return chunks.join("\n");
    });
    const screenshotBase64 = options.screenshot === false
      ? null
      : (await page.screenshot({ type: "png" })).toString("base64");
    return { title, html, css, screenshotBase64 };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function collectLocalCss(html, baseFile) {
  const chunks = [];
  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    if (match[1]?.trim()) chunks.push(match[1]);
  }
  for (const match of html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi)) {
    const href = match[0].match(/href=["']([^"']+)["']/i)?.[1];
    if (!href || /^https?:/i.test(href)) continue;
    const cssFile = path.resolve(path.dirname(baseFile), href.replace(/^\//, ""));
    if (existsSync(cssFile)) {
      try {
        chunks.push(await readFile(cssFile, "utf8"));
      } catch {
        // unreadable stylesheet
      }
    }
  }
  return chunks.join("\n");
}

async function fetchFilePage(parsed, outputDir) {
  const entrySource = fileURLToPath(parsed.href);
  const html = await readFile(entrySource, "utf8");
  const scanReady = assessScanReadiness(html);
  if (!scanReady.ok) {
    throw new Error(scanReady.reason);
  }
  const css = await collectLocalCss(html, entrySource);
  const enriched = injectCapturedCss(html, css);
  await mkdir(outputDir, { recursive: true });
  const entryPath = path.join(outputDir, "index.html");
  await writeFile(entryPath, enriched);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? path.basename(entrySource);
  return {
    url: parsed.href,
    title,
    screenshotBase64: null,
    capturedAt: new Date().toISOString(),
    method: "file",
    status: "captured",
    entry: entryPath
  };
}

async function collectRemoteCss(html, baseUrl) {
  const chunks = [];
  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    if (match[1]?.trim()) chunks.push(match[1]);
  }
  for (const match of html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi)) {
    const href = match[0].match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    let resolved;
    try {
      resolved = new URL(href, baseUrl).href;
    } catch {
      continue;
    }
    if (!/^https?:/i.test(resolved)) continue;
    try {
      const response = await fetch(resolved);
      if (response.ok) chunks.push(await response.text());
    } catch {
      // unreadable remote stylesheet
    }
  }
  return chunks.join("\n");
}

async function captureWithFetch(parsed, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout ?? 20_000);
  try {
    const response = await fetch(parsed.href, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": BROWSER_USER_AGENT,
        "accept-language": "en-US,en;q=0.9"
      }
    });
    if (!response.ok) {
      throw new Error(`Preview URL returned HTTP ${response.status}.`);
    }
    const html = await response.text();
    const css = await collectRemoteCss(html, parsed.href);
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? parsed.hostname;
    const quality = assessCaptureQuality(html);
    if (!quality.ok) {
      throw new Error(quality.reason);
    }
    const scanReady = assessScanReadiness(html);
    if (!scanReady.ok) {
      throw new Error(scanReady.reason);
    }
    return { title, html, css, screenshotBase64: null };
  } finally {
    clearTimeout(timeout);
  }
}

function injectCapturedCss(html, css) {
  if (!css.trim()) return html;
  const styleBlock = `<style data-morph-captured="true">\n${css}\n</style>`;
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${styleBlock}\n</head>`);
  }
  return `${styleBlock}\n${html}`;
}

export async function capturePreviewUrl(url) {
  const parsed = parsePreviewUrl(url);
  if (!parsed) return null;

  try {
    const capture = await captureWithPlaywright(parsed);
    return {
      url: parsed.href,
      title: capture.title,
      screenshotBase64: capture.screenshotBase64,
      capturedAt: new Date().toISOString(),
      method: "playwright",
      status: "captured"
    };
  } catch (error) {
    try {
      const fallback = await captureWithFetch(parsed);
      return {
        url: parsed.href,
        title: fallback.title,
        screenshotBase64: null,
        capturedAt: new Date().toISOString(),
        method: "fetch",
        status: "captured"
      };
    } catch (fetchError) {
      return {
        url: parsed.href,
        capturedAt: new Date().toISOString(),
        method: "fetch",
        status: "capture_failed",
        error: fetchError instanceof Error ? fetchError.message : String(fetchError)
      };
    }
  }
}

export async function fetchPageForTransform(url, outputDir) {
  const parsed = parsePreviewUrl(url);
  if (!parsed) {
    throw new Error("Preview URL is required.");
  }

  if (parsed.protocol === "file:") {
    try {
      return await fetchFilePage(parsed, outputDir);
    } catch (error) {
      return {
        url: parsed.href,
        capturedAt: new Date().toISOString(),
        method: "file",
        status: "capture_failed",
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  try {
    const capture = await captureWithPlaywright(parsed, { waitUntil: "networkidle" });
    const html = injectCapturedCss(capture.html, capture.css);
    await mkdir(outputDir, { recursive: true });
    const entryPath = path.join(outputDir, "index.html");
    await writeFile(entryPath, html);

    return {
      url: parsed.href,
      title: capture.title,
      screenshotBase64: capture.screenshotBase64,
      capturedAt: new Date().toISOString(),
      method: "playwright",
      status: "captured",
      entry: entryPath
    };
  } catch (error) {
    try {
      const fallback = await captureWithFetch(parsed);
      const html = injectCapturedCss(fallback.html, fallback.css);
      await mkdir(outputDir, { recursive: true });
      const entryPath = path.join(outputDir, "index.html");
      await writeFile(entryPath, html);
      return {
        url: parsed.href,
        title: fallback.title,
        screenshotBase64: null,
        capturedAt: new Date().toISOString(),
        method: "fetch",
        status: "captured",
        entry: entryPath
      };
    } catch (fetchError) {
      return {
        url: parsed.href,
        capturedAt: new Date().toISOString(),
        method: "fetch",
        status: "capture_failed",
        error: fetchError instanceof Error ? fetchError.message : String(fetchError)
      };
    }
  }
}
