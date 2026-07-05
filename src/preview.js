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

async function captureWithPlaywright(parsed, options = {}) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(parsed.href, {
      waitUntil: options.waitUntil ?? "domcontentloaded",
      timeout: options.timeout ?? 30_000
    });
    const title = await page.title();
    const html = await page.content();
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
      headers: { "user-agent": "morph-review/0.1 (+https://morph.dev)" }
    });
    if (!response.ok) {
      throw new Error(`Preview URL returned HTTP ${response.status}.`);
    }
    const html = await response.text();
    const css = await collectRemoteCss(html, parsed.href);
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? parsed.hostname;
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
    return fetchFilePage(parsed, outputDir);
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
