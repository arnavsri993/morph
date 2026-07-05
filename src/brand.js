export const LOGO_URL = "/assets/logo.png";
export const ICON_URL = "/assets/icon.png";
export const DEFAULT_LOGO_HEIGHT = 28;

/** Shared favicon + font preloads for site chrome pages. */
export function headLinks() {
  return `<link rel="icon" href="${ICON_URL}" type="image/png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">`;
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
  return `<a class="${className}" href="${href}" aria-label="morph home" style="--logo-height:${height}px"><img class="logo" src="${LOGO_URL}" alt="morph" height="${height}" decoding="async"></a>`;
}
