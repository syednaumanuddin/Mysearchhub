import { describe, expect, it } from "vitest";
import {
  assertSourceFilter,
  buildEngineUrl,
  buildSearchQuery,
  buildSourceUrl,
  sanitizeQuery,
} from "../src/services/search/QueryBuilder";
import { SearchError } from "../src/services/search/errors";
import type { EnginePreset, SearchSource } from "../src/types";

const OR_ENGINE: EnginePreset = {
  id: "google",
  name: "Google",
  urlTemplate: "https://www.google.com/search?q={query}",
  supportsOr: true,
};

const PLAIN_ENGINE: EnginePreset = {
  id: "duckduckgo",
  name: "DuckDuckGo",
  urlTemplate: "https://duckduckgo.com/?q={query}",
  supportsOr: false,
};

function source(overrides: Partial<SearchSource> & { domain: string }): SearchSource {
  return {
    id: overrides.domain,
    name: overrides.domain,
    url: `https://${overrides.domain}`,
    category: "Test",
    enabled: true,
    ...overrides,
  };
}

describe("sanitizeQuery", () => {
  it("trims and collapses whitespace", () => {
    expect(sanitizeQuery("  react   hooks \n")).toBe("react hooks");
  });

  it("strips control characters", () => {
    expect(sanitizeQuery("a\u0007b\u001fc")).toBe("a b c");
  });

  it("caps the length", () => {
    expect(sanitizeQuery("x".repeat(400))).toHaveLength(256);
  });

  it("removes site: operators with and without a value", () => {
    expect(sanitizeQuery("react site:evil.com")).toBe("react");
    expect(sanitizeQuery("react site:")).toBe("react");
    expect(sanitizeQuery("react -site:evil.com")).toBe("react");
  });

  it("removes other operator tokens case-insensitively", () => {
    expect(sanitizeQuery("a INURL:x b InTitle:y c filetype:pdf")).toBe("a b c");
  });

  it("removes characters that could break out of the quoted phrase", () => {
    expect(sanitizeQuery('foo" )(')).toBe("foo");
  });
});

describe("buildSearchQuery", () => {
  it("scopes the query to every enabled source", () => {
    const built = buildSearchQuery("event loop", ["github.com", "stackoverflow.com"], {
      supportsOr: true,
    });
    expect(built).toContain("site:github.com");
    expect(built).toContain("site:stackoverflow.com");
    expect(built).toBe('"event loop" (site:github.com OR site:stackoverflow.com)');
  });

  it("dedupes and normalizes domains", () => {
    const built = buildSearchQuery("x", ["github.com", "https://www.GitHub.com/", "github.com/"], {
      supportsOr: true,
    });
    expect(built).toBe('"x" (site:github.com)');
  });

  it("falls back to space separated filters on a non-OR engine", () => {
    const built = buildSearchQuery("event loop", ["github.com", "stackoverflow.com"], {
      supportsOr: false,
    });
    expect(built).toBe('"event loop" site:github.com site:stackoverflow.com');
    expect(built).not.toContain("OR");
  });

  it("drops the quotes when exact match is off", () => {
    const built = buildSearchQuery("event loop", ["github.com"], {
      supportsOr: true,
      exactMatch: false,
    });
    expect(built).toBe("event loop (site:github.com)");
  });

  it("throws NO_SOURCES on an empty domain list", () => {
    expect(() => buildSearchQuery("x", [], { supportsOr: true })).toThrowError(SearchError);
    try {
      buildSearchQuery("x", [], { supportsOr: true });
    } catch (error) {
      expect((error as SearchError).code).toBe("NO_SOURCES");
    }
  });

  it("throws EMPTY_QUERY when nothing survives sanitizing", () => {
    try {
      buildSearchQuery("site:evil.com", ["github.com"], { supportsOr: true });
      throw new Error("expected a throw");
    } catch (error) {
      expect((error as SearchError).code).toBe("EMPTY_QUERY");
    }
  });

  it("cannot be tricked into an unscoped query by an injected operator", () => {
    const built = buildSearchQuery("foo site:evil.com", ["github.com"], { supportsOr: true });
    expect(built).not.toContain("evil.com");
    expect(built).toContain("site:github.com");
  });

  it("never emits a query without a site filter", () => {
    const built = buildSearchQuery("foo -site:evil.com OR bar", ["github.com", "npmjs.com"], {
      supportsOr: true,
    });
    expect(built).toContain("site:github.com");
    expect(built).toContain("site:npmjs.com");
  });
});

describe("assertSourceFilter", () => {
  it("passes when every domain is present", () => {
    expect(() =>
      assertSourceFilter('"x" (site:a.com OR site:b.com)', ["a.com", "b.com"]),
    ).not.toThrow();
  });

  it("throws when a domain is missing", () => {
    expect(() => assertSourceFilter('"x" (site:a.com)', ["a.com", "b.com"])).toThrow();
  });
});

describe("URL builders", () => {
  it("encodes the query into the engine template", () => {
    expect(buildEngineUrl(OR_ENGINE, '"a b"')).toBe(
      `https://www.google.com/search?q=${encodeURIComponent('"a b"')}`,
    );
    expect(buildEngineUrl(PLAIN_ENGINE, "a b")).toBe(
      `https://duckduckgo.com/?q=${encodeURIComponent("a b")}`,
    );
  });

  it("rejects a template with no {query} placeholder", () => {
    const broken: EnginePreset = { ...OR_ENGINE, urlTemplate: "https://x.example/" };
    expect(() => buildEngineUrl(broken, "x")).toThrowError(SearchError);
  });

  it("scopes a source without a native template", () => {
    const url = buildSourceUrl(source({ domain: "github.com" }), "event loop", OR_ENGINE);
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain("site:github.com");
  });

  it("prefers the source's native search template", () => {
    const native = source({
      domain: "youtube.com",
      searchUrlTemplate: "https://www.youtube.com/results?search_query={query}",
    });
    const url = buildSourceUrl(native, "event loop", OR_ENGINE);
    expect(url).toBe(
      `https://www.youtube.com/results?search_query=${encodeURIComponent("event loop")}`,
    );
    expect(url).not.toContain("site%3A");
  });
});
