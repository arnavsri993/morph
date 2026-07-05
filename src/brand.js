export const LOGO_URL = "/assets/logo.png";

/** Logo wordmark link for site chrome. */
export function brandLink(href, { className = "brand", height = 28 } = {}) {
  return `<a class="${className}" href="${href}" aria-label="morph home"><img class="logo" src="${LOGO_URL}" alt="" height="${height}" decoding="async"></a>`;
}
