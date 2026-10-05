export const MENU_ID = "search-in-mysearch-hub";

/**
 * Results-page URL for a text selection.
 *
 * Kept free of any `chrome.*` usage so the encoding rules can be tested without
 * a service-worker harness. Returns null for an empty selection rather than
 * opening a blank results page.
 */
export function buildResultsUrl(selectionText: string): string | null {
  if (typeof selectionText !== "string") return null;
  const trimmed = selectionText.trim();
  if (trimmed === "") return null;
  return `results.html?q=${encodeURIComponent(trimmed)}`;
}
