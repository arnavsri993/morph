import { spawn } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const landingPath = path.join(root, "src/landing.js");
const afterPath = path.join(__dirname, "landing-after-snapshot.js");
const beforePath = path.join(__dirname, "landing-before.js");
const outDir = __dirname;

mkdirSync(outDir, { recursive: true });
copyFileSync(landingPath, afterPath);

const require = createRequire(import.meta.url);
const playwrightPath = path.join(root, "node_modules/playwright/index.mjs");
const { chromium } = await import(playwrightPath);

async function capture(label, landingSource) {
  copyFileSync(landingSource, landingPath);
  await new Promise((r) => setTimeout(r, 500));

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const sizes = [
    { name: "375", width: 375, height: 812 },
    { name: "768", width: 768, height: 1024 },
    { name: "1280", width: 1280, height: 900 },
    { name: "1920", width: 1920, height: 1080 },
  ];

  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto("http://127.0.0.1:4177/", { waitUntil: "networkidle" });
    await page.evaluate(() => {
      document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
    });
    await page.waitForTimeout(350);
    await page.screenshot({
      path: path.join(outDir, `${label}-${size.name}.png`),
    });
  }

  await browser.close();
}

try {
  await capture("before", beforePath);
  await capture("after", afterPath);
  copyFileSync(afterPath, landingPath);
  console.log("Screenshots saved to", outDir);
} catch (error) {
  copyFileSync(afterPath, landingPath);
  throw error;
}
