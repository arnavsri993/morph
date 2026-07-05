export async function capturePreviewUrl(url) {
  const target = String(url ?? "").trim();
  if (!target) return null;

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    throw new Error("Preview URL must be a valid http or https URL.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Preview URL must use http or https.");
  }

  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      await page.goto(parsed.href, { waitUntil: "domcontentloaded", timeout: 30_000 });
      const title = await page.title();
      const screenshotBase64 = (await page.screenshot({ type: "png" })).toString("base64");
      return {
        url: parsed.href,
        title,
        screenshotBase64,
        capturedAt: new Date().toISOString(),
        method: "playwright",
        status: "captured"
      };
    } finally {
      await browser.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const missingPlaywright = /Cannot find module 'playwright'|playwright/i.test(message);
    return {
      url: parsed.href,
      capturedAt: new Date().toISOString(),
      method: "playwright",
      status: missingPlaywright ? "playwright_not_installed" : "capture_failed",
      error: missingPlaywright
        ? "Playwright is not installed. Run npm install playwright && npx playwright install chromium."
        : message
    };
  }
}
