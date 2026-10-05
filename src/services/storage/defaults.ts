import type { EnginePreset, SearchSource, Settings } from "../../types";

export const CATEGORIES = [
  "Development",
  "Video",
  "General Knowledge",
  "Documentation",
  "Social",
  "News",
  "Other",
] as const;

export const ENGINE_PRESETS: EnginePreset[] = [
  {
    id: "google",
    name: "Google",
    urlTemplate: "https://www.google.com/search?q={query}",
    supportsOr: true,
  },
  {
    id: "bing",
    name: "Bing",
    urlTemplate: "https://www.bing.com/search?q={query}",
    supportsOr: true,
  },
  {
    id: "brave",
    name: "Brave",
    urlTemplate: "https://search.brave.com/search?q={query}",
    supportsOr: true,
  },
  {
    id: "duckduckgo",
    name: "DuckDuckGo",
    urlTemplate: "https://duckduckgo.com/?q={query}",
    supportsOr: false,
  },
];

export const DEFAULT_ENGINE_ID = "google";

export interface SourcePreset {
  id: string;
  name: string;
  description: string;
  /** Matched by domain, so a preset still works after the user adds their own sources. */
  domains: string[];
}

export const PRESETS: SourcePreset[] = [
  {
    id: "web-development",
    name: "Web Development",
    description: "Stack Overflow, GitHub, npm, MDN and DevDocs.",
    domains: [
      "stackoverflow.com",
      "github.com",
      "npmjs.com",
      "developer.mozilla.org",
      "devdocs.io",
    ],
  },
  {
    id: "programming",
    name: "Programming",
    description: "Reference-heavy sources only, no video or social.",
    domains: ["stackoverflow.com", "github.com", "npmjs.com", "devdocs.io"],
  },
  {
    id: "video-learning",
    name: "Video Learning",
    description: "YouTube and Vimeo.",
    domains: ["youtube.com", "vimeo.com"],
  },
];

function source(
  id: string,
  name: string,
  domain: string,
  category: string,
  enabled: boolean,
  searchUrlTemplate?: string,
): SearchSource {
  return {
    id,
    name,
    domain,
    url: `https://${domain}`,
    category,
    enabled,
    ...(searchUrlTemplate === undefined ? {} : { searchUrlTemplate }),
  };
}

/** §5 starter set. Array position is the user's visible order. */
export const DEFAULT_SOURCES: SearchSource[] = [
  source(
    "stackoverflow",
    "Stack Overflow",
    "stackoverflow.com",
    "Development",
    true,
    "https://stackoverflow.com/search?q={query}",
  ),
  source("github", "GitHub", "github.com", "Development", true, "https://github.com/search?q={query}"),
  source("npm", "npm", "npmjs.com", "Development", false, "https://www.npmjs.com/search?q={query}"),
  source(
    "youtube",
    "YouTube",
    "youtube.com",
    "Video",
    true,
    "https://www.youtube.com/results?search_query={query}",
  ),
  source(
    "wikipedia",
    "Wikipedia",
    "wikipedia.org",
    "General Knowledge",
    true,
    "https://en.wikipedia.org/w/index.php?search={query}",
  ),
  source("mdn", "MDN Web Docs", "developer.mozilla.org", "Documentation", true),
  source("devdocs", "DevDocs", "devdocs.io", "Documentation", false),
  source("reddit", "Reddit", "reddit.com", "Social", true),
  source("hacker-news", "Hacker News", "news.ycombinator.com", "News", true),
  source("lobsters", "Lobsters", "lobste.rs", "News", false),
];

export const DEFAULT_SETTINGS: Settings = {
  engineId: DEFAULT_ENGINE_ID,
  enginePreset: findEnginePreset(DEFAULT_ENGINE_ID),
  providerId: "engine",
  theme: "system",
  exactMatch: true,
  onboardingCompleted: false,
};

function findEnginePreset(id: string): EnginePreset {
  return ENGINE_PRESETS.find((preset) => preset.id === id) ?? ENGINE_PRESETS[0]!;
}

export function getEnginePreset(id: string): EnginePreset {
  return findEnginePreset(id);
}
