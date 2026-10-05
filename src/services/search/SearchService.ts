import { getProvider } from "./SearchProvider";
import { sanitizeQuery } from "./QueryBuilder";
import { SearchError, toSearchError } from "./errors";
import type { ProviderId, SearchOutcome, SearchSource, Settings } from "../../types";

export interface RunSearchInput {
  query: string;
  sources: SearchSource[];
  settings: Settings;
}

export function enabledSources(sources: SearchSource[]): SearchSource[] {
  return sources.filter((source) => source.enabled);
}

/**
 * The single entry point the UI searches through.
 *
 * Guard rails, in order: a usable query, at least one enabled source, a
 * configured provider, then execution. There is deliberately no branch that
 * produces an unscoped query — a misconfigured API provider falls back to
 * engine *launch* URLs, which are still `site:`-scoped, never to open the web
 * search directly.
 */
export async function runSearch({ query, sources, settings }: RunSearchInput): Promise<SearchOutcome> {
  if (sanitizeQuery(query) === "") {
    throw new SearchError("EMPTY_QUERY");
  }

  const active = enabledSources(sources);
  if (active.length === 0) {
    throw new SearchError("NO_SOURCES");
  }

  const provider = getProvider(settings.providerId);
  const configured = await provider.isConfigured();

  if (!configured) {
    if (settings.providerId === "engine") {
      throw new SearchError("INVALID_ENGINE");
    }
    const fallback = await getProvider("engine").search({ query, sources: active, settings });
    if (fallback.mode !== "launch") {
      // The engine provider is launch-only; anything else means a real bug.
      throw new SearchError("PROVIDER_ERROR", {
        userMessage: "The search engine provider returned an unexpected response.",
      });
    }
    return { ...fallback, notice: fallbackNotice(settings.providerId) };
  }

  try {
    return await provider.search({ query, sources: active, settings });
  } catch (error) {
    throw toSearchError(error);
  }
}

function fallbackNotice(providerId: ProviderId): string {
  return providerId === "brave-api"
    ? "Brave Search is not set up, so these links use your search engine instead. Add a key in settings to get in-page results."
    : "That provider is unavailable, so these links use your search engine instead.";
}

export { SearchError };
