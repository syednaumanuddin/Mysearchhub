import { getBraveApiKey } from "../../storage/StorageService";
import { hasAccess } from "../../brave/permissions";
import { hostnameFromUrl, isSameOrSubdomain } from "../../../utils/domain";
import { SearchError } from "../errors";
import { buildSearchQuery } from "../QueryBuilder";
import type { SearchOutcome, SearchResult, SearchSource } from "../../../types";
import type { SearchProvider, SearchRequest } from "../SearchProvider";

export const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const RESULT_COUNT = 20;

interface BraveWebResult {
  title?: string;
  url?: string;
  description?: string;
}

function statusToError(status: number): SearchError {
  if (status === 401) return new SearchError("BAD_API_KEY");
  if (status === 402) return new SearchError("PLAN_REQUIRED");
  if (status === 429) return new SearchError("RATE_LIMITED");
  return new SearchError("PROVIDER_ERROR");
}

function resolveSourceId(hostname: string, sources: SearchSource[]): string | null {
  for (const source of sources) {
    if (isSameOrSubdomain(hostname, source.domain)) return source.id;
  }
  return null;
}

/**
 * Brave Search API provider.
 *
 * Brave is not treated as trusted to honour the filter: every response is
 * re-checked against the enabled sources and off-source results are dropped
 * before the UI ever sees them.
 */
export class BraveApiProvider implements SearchProvider {
  readonly id = "brave-api" as const;
  readonly name = "Brave Search API";

  async isConfigured(): Promise<boolean> {
    const [key, permitted] = await Promise.all([getBraveApiKey(), hasAccess()]);
    return key !== "" && permitted;
  }

  async search({ query, sources, settings }: SearchRequest): Promise<SearchOutcome> {
    if (sources.length === 0) {
      throw new SearchError("NO_SOURCES");
    }

    const key = await getBraveApiKey();
    if (key === "") {
      throw new SearchError("NOT_CONFIGURED");
    }
    if (!(await hasAccess())) {
      throw new SearchError("NOT_CONFIGURED");
    }

    const scopedQuery = buildSearchQuery(
      query,
      sources.map((source) => source.domain),
      { supportsOr: true, exactMatch: settings.exactMatch },
    );

    const url = new URL(BRAVE_ENDPOINT);
    url.searchParams.set("q", scopedQuery);
    url.searchParams.set("count", String(RESULT_COUNT));

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": key,
        },
      });
    } catch (error) {
      throw new SearchError("NETWORK_ERROR", { cause: error });
    }

    if (!response.ok) {
      throw statusToError(response.status);
    }

    let payload: { web?: { results?: BraveWebResult[] } };
    try {
      payload = (await response.json()) as { web?: { results?: BraveWebResult[] } };
    } catch (error) {
      throw new SearchError("PROVIDER_ERROR", { cause: error });
    }

    const raw = payload.web?.results ?? [];
    const results: SearchResult[] = [];
    let filteredOut = 0;

    for (const entry of raw) {
      const link = typeof entry.url === "string" ? entry.url : "";
      const domain = hostnameFromUrl(link);
      const allowed = domain !== "" && sources.some((source) => isSameOrSubdomain(domain, source.domain));

      if (!allowed) {
        filteredOut += 1;
        continue;
      }

      results.push({
        title: entry.title?.trim() || domain,
        url: link,
        snippet: entry.description?.trim() ?? "",
        domain,
        sourceId: resolveSourceId(domain, sources),
      });
    }

    return { mode: "results", results, filteredOut };
  }
}
