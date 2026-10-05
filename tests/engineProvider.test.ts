import { describe, expect, it } from "vitest";
import { EngineProvider } from "../src/services/search/providers/EngineProvider";
import { SearchError } from "../src/services/search/errors";
import type { EnginePreset, SearchSource, Settings } from "../src/types";

const engine: EnginePreset = {
  id: "google",
  name: "Google",
  urlTemplate: "https://www.google.com/search?q={query}",
  supportsOr: true,
};

const settings: Settings = {
  engineId: "google",
  enginePreset: engine,
  providerId: "engine",
  theme: "system",
  exactMatch: true,
  onboardingCompleted: true,
};

function source(id: string, domain: string, extra: Partial<SearchSource> = {}): SearchSource {
  return {
    id,
    name: id,
    domain,
    url: `https://${domain}`,
    category: "Test",
    enabled: true,
    ...extra,
  };
}

const provider = new EngineProvider();

describe("EngineProvider", () => {
  it("is always configured", async () => {
    await expect(provider.isConfigured()).resolves.toBe(true);
  });

  it("returns launch mode with no network access", async () => {
    const outcome = await provider.search({
      query: "event loop",
      sources: [source("gh", "github.com"), source("so", "stackoverflow.com")],
      settings,
    });

    expect(outcome.mode).toBe("launch");
    if (outcome.mode !== "launch") throw new Error("unreachable");

    const combined = decodeURIComponent(outcome.combinedUrl);
    expect(combined).toContain("site:github.com");
    expect(combined).toContain("site:stackoverflow.com");
    expect(outcome.query).toBe('"event loop" (site:github.com OR site:stackoverflow.com)');
  });

  it("produces one URL per source, in order", async () => {
    const sources = [source("a", "github.com"), source("b", "stackoverflow.com")];
    const outcome = await provider.search({ query: "x", sources, settings });
    if (outcome.mode !== "launch") throw new Error("unreachable");

    expect(outcome.perSource).toHaveLength(2);
    expect(outcome.perSource[0]?.source.id).toBe("a");
    expect(outcome.perSource[1]?.source.id).toBe("b");
    expect(decodeURIComponent(outcome.perSource[0]!.url)).toContain("site:github.com");
  });

  it("lets a native template win over the engine fallback", async () => {
    const youtube = source("yt", "youtube.com", {
      searchUrlTemplate: "https://www.youtube.com/results?search_query={query}",
    });
    const outcome = await provider.search({ query: "loops", sources: [youtube], settings });
    if (outcome.mode !== "launch") throw new Error("unreachable");

    expect(outcome.perSource[0]?.url).toBe(
      `https://www.youtube.com/results?search_query=${encodeURIComponent("loops")}`,
    );
    expect(decodeURIComponent(outcome.perSource[0]!.url)).not.toContain("site:");
  });

  it("throws NO_SOURCES with no sources", async () => {
    await expect(provider.search({ query: "x", sources: [], settings })).rejects.toMatchObject({
      code: "NO_SOURCES",
    });
  });

  it("throws NO_SOURCES when handed a SearchError", async () => {
    await expect(provider.search({ query: "x", sources: [], settings })).rejects.toBeInstanceOf(
      SearchError,
    );
  });

  it("never emits an unscoped combined URL", async () => {
    const outcome = await provider.search({
      query: "foo site:evil.com",
      sources: [source("a", "github.com")],
      settings,
    });
    if (outcome.mode !== "launch") throw new Error("unreachable");
    expect(decodeURIComponent(outcome.combinedUrl)).not.toContain("evil.com");
  });
});
