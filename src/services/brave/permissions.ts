import { clearBraveApiKey, setBraveApiKey } from "../storage/StorageService";

export const BRAVE_ORIGIN = "https://api.search.brave.com/*";

function permissionsApi(): typeof chrome.permissions | null {
  if (typeof chrome === "undefined" || !chrome.permissions) return null;
  return chrome.permissions;
}

export async function hasAccess(): Promise<boolean> {
  const api = permissionsApi();
  if (!api) return false;
  try {
    return await api.contains({ origins: [BRAVE_ORIGIN] });
  } catch {
    return false;
  }
}

/**
 * Grant the Brave host permission and store the key.
 *
 * `chrome.permissions.request` only succeeds inside a user gesture on an
 * extension page, so this must be called directly from a click handler in
 * settings.html — never on mount.
 */
export async function enable(key: string): Promise<void> {
  const api = permissionsApi();
  const trimmed = key.trim();
  if (trimmed === "") {
    throw new Error("Enter a Brave Search API key first.");
  }
  if (!api) {
    throw new Error("The permissions API is unavailable in this context.");
  }

  const granted = await api.request({ origins: [BRAVE_ORIGIN] });
  if (!granted) {
    throw new Error("Permission denied. Brave Search access was not enabled.");
  }

  await setBraveApiKey(trimmed);
}

/** Drop the key and give the host permission back. */
export async function disable(): Promise<void> {
  const api = permissionsApi();
  await clearBraveApiKey();
  if (api) {
    try {
      await api.remove({ origins: [BRAVE_ORIGIN] });
    } catch {
      // A permission that is already gone is not a failure worth surfacing.
    }
  }
}
