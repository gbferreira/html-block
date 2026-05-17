export type HtmlBlockAttributes = Record<string, string | number | boolean | undefined>;

const ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPE[char] ?? char);
}

export function stringifyAttributes(attrs: HtmlBlockAttributes): string {
  const parts: string[] = [];
  for (const [key, raw] of Object.entries(attrs)) {
    if (raw === undefined || raw === false) continue;
    const value = raw === true ? "" : String(raw);
    parts.push(value === "" ? ` ${escapeHtml(key)}` : ` ${escapeHtml(key)}="${escapeHtml(value)}"`);
  }
  return parts.join("");
}

/**
 * Renders a simple HTML element string. Intended as a starter API; extend as needed.
 */
export function createHtmlBlock(
  tagName: string,
  innerHtml: string,
  attributes: HtmlBlockAttributes = {},
): string {
  const safeTag = /^[a-z][a-z0-9-]*$/i.test(tagName) ? tagName : "div";
  return `<${safeTag}${stringifyAttributes(attributes)}>${escapeHtml(innerHtml)}</${safeTag}>`;
}
