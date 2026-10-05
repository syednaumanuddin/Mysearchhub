export interface SearchSource {
  /** Stable identifier. Never derived from the domain so a rename keeps history. */
  id: string;
  name: string;
  /** Normalized: lowercase, no scheme, no `www.`, no path. */
  domain: string;
  url: string;
  category: string;
  enabled: boolean;
  /** Optional native site search URL template. Must be https and contain `{query}`. */
  searchUrlTemplate?: string;
}

export type ProviderId = "engine" | "brave-api";

export interface EnginePreset {
  id: string;
  name: string;
  /** URL template containing `{query}`. */
  urlTemplate: string;
  /** Whether the engine understands `(site:a OR site:b)` groups. */
  supportsOr: boolean;
}

export interface Settings {
  /** Preset id, or `"custom"` when `customEngineUrl` is used. */
  engineId: string;
  enginePreset: EnginePreset;
  customEngineUrl?: string;
  providerId: ProviderId;
  theme: ThemePreference;
  /** Wrap the user query in double quotes. */
  exactMatch: boolean;
  onboardingCompleted: boolean;
}

export type ThemePreference = "system" | "light" | "dark";

export type ResolvedTheme = "light" | "dark";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  sourceId: string | null;
}

export interface PerSourceLaunch {
  source: SearchSource;
  url: string;
}

export type SearchOutcome =
  | {
      mode: "launch";
      combinedUrl: string;
      query: string;
      perSource: PerSourceLaunch[];
      /** Set when a configured provider was unusable and the engine stood in. */
      notice?: string;
    }
  | {
      mode: "results";
      results: SearchResult[];
      filteredOut: number;
    };

export interface RecentSearch {
  query: string;
  /** Epoch milliseconds. */
  at: number;
}
