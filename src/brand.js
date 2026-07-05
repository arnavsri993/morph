import { CHROME_HEADER_BG } from "./chrome.js";

export const LOGO_URL = "/assets/logo.png";
export const ICON_URL = "/assets/icon.png";
export const HEADER_BG = CHROME_HEADER_BG;
export const DEFAULT_LOGO_HEIGHT = 64;

/** Shared favicon + font preloads for site chrome pages. */
export function headLinks() {
  return `<link rel="icon" href="${ICON_URL}" type="image/png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">`;
}

/** Solid black header bar matching the logo background. */
export function headerBarStyles() {
  return `
    .site-header {
      position: sticky;
      top: 0;
      z-index: 50;
      background: ${HEADER_BG};
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .site-header-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      min-height: 72px;
      width: min(1080px, calc(100vw - 48px));
      margin: 0 auto;
      padding: 0 clamp(20px, 4vw, 24px);
    }`;
}

/** Shared brand/logo styles — set --logo-height on :root to resize per page. */
export function brandStyles() {
  return `
    .brand, .brand-mini {
      display: inline-flex;
      align-items: center;
      text-decoration: none;
      color: inherit;
      flex: none;
      transition: opacity 0.18s var(--ease, ease);
    }
    .brand:hover, .brand-mini:hover { opacity: 0.88; }
    .logo {
      display: block;
      height: var(--logo-height, ${DEFAULT_LOGO_HEIGHT}px);
      width: auto;
    }`;
}

/** Logo wordmark link for site chrome. */
export function brandLink(href, { className = "brand", height = DEFAULT_LOGO_HEIGHT } = {}) {
  const styleAttr = height === DEFAULT_LOGO_HEIGHT ? "" : ` style="--logo-height:${height}px"`;
  return `<a class="${className}" href="${href}" aria-label="morph home"${styleAttr}><img class="logo" src="${LOGO_URL}" alt="morph" height="${height}" decoding="async"></a>`;
}
