import { buildEngineUrl, buildSearchQuery, buildSourceUrl } from "../QueryBuilder";
import { SearchError } from "../errors";
import type { SearchOutcome } from "../../../types";
import type { SearchProvider, SearchRequest } from "../SearchProvider";

/**
 * Zero-configuration provider.
 *
 * Builds the scoped query and hands back launch URLs. It performs no network
 * I/O of its own — the browser, not the extension, performs the request, so
 * this provider needs no host permissions.
 */
export class EngineProvider implements SearchProvider {
  readonly id = "engine" as const;
  readonly name = "Search engine";

  async isConfigured(): Promise<boolean> {
    return true;
  }

  async search({ query, sources, settings }: SearchRequest): Promise<SearchOutcome> {
    if (sources.length === 0) {
      throw new SearchError("NO_SOURCES");
    }

    const { enginePreset, exactMatch } = settings;
    const combinedQuery = buildSearchQuery(
      query,
      sources.map((source) => source.domain),
      { supportsOr: enginePreset.supportsOr, exactMatch },
    );

    return {
      mode: "launch",
      combinedUrl: buildEngineUrl(enginePreset, combinedQuery),
      query: combinedQuery,
      perSource: sources.map((source) => ({
        source,
        url: buildSourceUrl(source, query, enginePreset, { exactMatch }),
      })),
    };
  }
}
